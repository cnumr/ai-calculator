# Test de charge de l'API

Estimer combien de requêtes par seconde (TPS) l'API tient sur un petit serveur, en limitant le backend à très peu de ressources (par défaut **0,1 CPU et 128 Mo**, sans swap).

## Outils

- `docker-compose.loadtest.yml` : surcharge de la stack de production qui limite le CPU et la mémoire du backend et le rend joignable sur `127.0.0.1:8001` (port de test uniquement, jamais en production).
- `scripts/load_test.py` : générateur de charge sans dépendance (bibliothèque standard Python). Pour chaque palier de clients simultanés, il envoie des requêtes en continu pendant une durée fixe et affiche le débit (TPS), les latences p50/p95/p99 et les erreurs. Le TPS « supporté » est celui du dernier palier dont le p95 reste sous le seuil (`--p95-max`, 1 000 ms par défaut) sans erreur.

Scénario de `POST /api/calculate` : tous les cas d'usage du catalogue, une fois par jour, avec leur fournisseur et profil par défaut, pour 50 salariés (le calcul le plus complet que propose l'interface).

## Lancer le test (Docker)

```bash
# Backend de production, limité (variables facultatives : LOADTEST_CPUS, LOADTEST_MEMORY, LOADTEST_PORT)
docker compose -f docker-compose.yml -f docker-compose.loadtest.yml up --build -d backend

scripts/load_test.py                                   # POST /api/calculate
scripts/load_test.py --endpoint use-cases              # GET /api/use-cases
scripts/load_test.py --concurrency 1,4,16,32 --duration 30 --p95-max 500

# Mémoire consommée, et arrêt éventuel par manque de mémoire
docker stats --no-stream
docker inspect --format '{{.State.OOMKilled}}' $(docker compose ps -q backend)

docker compose -f docker-compose.yml -f docker-compose.loadtest.yml down
```

Pour un autre budget : `LOADTEST_CPUS=0.5 LOADTEST_MEMORY=256m docker compose ... up -d backend`.

### Sans Docker (Linux avec systemd)

Les mêmes limites (cgroups) s'appliquent avec `systemd-run`, utile pour une mesure rapide sur un poste de développement :

```bash
cd backend
systemd-run --user --unit=ai-loadtest -p CPUQuota=10% -p MemoryMax=128M -p MemorySwapMax=0 \
  --working-directory="$PWD" "$(which uv)" run uvicorn ai_calculator.main:app --host 127.0.0.1 --port 8001
cd .. && scripts/load_test.py
systemctl --user show ai-loadtest -p MemoryPeak    # pic mémoire
systemctl --user stop ai-loadtest && systemctl --user reset-failed ai-loadtest
```

## Résultats (9 novembre 2026)

Backend de la version en cours (12 cas d'usage, EcoLogits 0.11.3), lancé comme en production (`uv run uvicorn`, un processus), limité à **0,1 CPU et 128 Mo sans swap** via `systemd-run` (mêmes cgroups que Docker). Générateur sur la même machine, en local : pas de latence réseau.

`POST /api/calculate` (12 usages, 50 salariés), 15 s par palier :

| Clients | TPS | p50 | p95 | p99 | Erreurs |
|---|---|---|---|---|---|
| 1 | 22,2 | 6 ms | 98 ms | 99 ms | 0 |
| 2 | 22,5 | 99 ms | 195 ms | 302 ms | 0 |
| 4 | 20,3 | 198 ms | 371 ms | 604 ms | 0 |
| 8 | 19,3 | 399 ms | 696 ms | 1 122 ms | 0 |
| 16 | 19,0 | 800 ms | 1 702 ms | 1 819 ms | 0 |

`GET /api/use-cases`, 15 s par palier, **sans** le cache du catalogue (resérialisé à chaque requête) :

| Clients | TPS | p50 | p95 | p99 | Erreurs |
|---|---|---|---|---|---|
| 1 | 16,7 | 94 ms | 101 ms | 196 ms | 0 |
| 4 | 13,5 | 295 ms | 781 ms | 905 ms | 0 |
| 16 | 11,7 | 1 302 ms | 2 122 ms | 2 816 ms | 0 |

`GET /api/use-cases` **avec** le cache du catalogue (sérialisation unique, `Cache-Control` et `ETag`), 15 s par palier :

| Clients | TPS | p50 | p95 | p99 | Erreurs |
|---|---|---|---|---|---|
| 1 | 96,9 | 1 ms | 91 ms | 93 ms | 0 |
| 4 | 113,5 | 3 ms | 98 ms | 100 ms | 0 |
| 16 | 129,4 | 103 ms | 201 ms | 298 ms | 0 |

Revalidation par le navigateur (`If-None-Match`, réponse 304 sans contenu) : 116,9 / 122,2 / 144,6 TPS avec 1 / 4 / 16 clients, p95 de 91 à 202 ms. Et la plupart des visites n'appellent même pas le catalogue : il est gardé 5 minutes par le navigateur.

Mémoire : 45 Mo au démarrage, **pic à 58 Mo**, aucun arrêt par manque de mémoire. Démarrage en 5 s.

### Lecture

- **Le CPU est la limite, pas la mémoire.** Le débit plafonne vers **20 TPS** en calcul : chaque requête coûte environ 5 ms de CPU, et 0,1 CPU en offre 100 ms par seconde. Au-delà, rien n'échoue, les requêtes attendent : la latence croît avec le nombre de clients.
- **Un p95 d'environ 100 ms même avec un seul client** : effet du quota CPU, accordé par tranches de 10 ms toutes les 100 ms. Une requête qui dépasse sa tranche attend la période suivante.
- **128 Mo suffisent** (pic à 58 Mo) ; 96 Mo laisseraient encore de la marge.
- **Le cache du catalogue multiplie son débit par 10** (13,5 → 129 TPS) : sans lui, le catalogue (34,6 Ko) était resérialisé à chaque requête et coûtait plus cher qu'un calcul. Avec lui, sa sérialisation est faite une fois, et le navigateur ne le redemande qu'après 5 minutes, en revalidation (304). Le calcul (~20 TPS) reste donc la seule vraie limite.
- **Ordre de grandeur en utilisateurs** : en supposant qu'une visite charge le catalogue une fois puis déclenche une quinzaine de calculs en 3 minutes (environ 0,09 requête par seconde et par visiteur actif), 20 TPS correspondent à **environ 200 visiteurs actifs simultanés**. Le débit croît à peu près avec le CPU : environ 100 TPS avec 0,5 CPU.

### Limites

- Mesure sans nginx devant le backend : en production, nginx compresse aussi les réponses JSON à la volée, ce qui consomme du CPU sur le même serveur.
- Générateur et backend sur la même machine : pas de latence ni de débit réseau réels.
- Le scénario de calcul est le plus complet (12 usages) : un visiteur qui ne renseigne que quelques usages coûte moins.
