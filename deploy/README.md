# Déploiement continu sur le VPS GreenIT

Ce dossier déploie ai-calculator sur le VPS de l'association GreenIT (`yunohost.greenit.eco`, Debian 12, YunoHost) à partir des images publiées sur ghcr.io. Le serveur tire lui-même les images : GitHub n'a aucun accès au VPS.

| Environnement | Suit | Dossier | Port local | Domaine | Accès |
|---|---|---|---|---|---|
| staging | branche `develop` (image `:develop`) | `/srv/ai-calculator-staging` | 8086 | `ia-calculator-staging.greenit.eco` | comptes YunoHost |
| prod | dernière GitHub Release (image `:vX.Y.Z`) | `/srv/ai-calculator-prod` | 8085 | `ia-calculator.greenit.eco` | public |

Fichiers :
- `compose.yml` : les deux services, les images ghcr.io, les healthchecks et la rotation des logs (50 Mo au plus par conteneur).
- `update.sh` : la mise à jour d'un environnement, lancée toutes les 5 minutes.
- `env.example` : le modèle du `.env` de chaque environnement.
- `systemd/` : le service et le timer `ai-calculator-update@<env>`.
- `tests/` : les tests de `update.sh` avec un faux docker, lancés en CI.

## Fonctionnement

- Un push sur `develop` publie `:develop` et `:sha-<commit>`. Une release publie `:vX.Y.Z` et `:latest` (workflows `images-develop.yml` et `release.yml`).
- Toutes les 5 minutes, `update.sh <env>` :
  - **staging** : tire `:develop`. Si les conteneurs tournent déjà dessus, il ne fait rien. Sinon il redémarre et contrôle `GET /api/use-cases`. En cas d'échec, il alerte. Le push suivant réparera le staging.
  - **prod** : lit la dernière release sur l'API GitHub. Si l'image n'est pas encore construite, il attend. Sinon il bascule et contrôle. En cas d'échec, il revient à la version précédente et alerte. Une release en échec n'est pas retentée tant qu'une nouvelle release ne sort pas.
- Après une bascule réussie, les images du projet devenues inutiles sont supprimées. Les autres projets du serveur ne sont pas touchés.
- Pied de page : `vX.Y.Z` en prod, `vX.Y.Z+sha.<commit>` en staging.

Variables du `.env` :

| Variable | Rôle |
|---|---|
| `COMPOSE_PROJECT_NAME` | `ai-calculator-prod` ou `ai-calculator-staging` |
| `HTTP_PORT` | `8085` ou `8086` |
| `IMAGE_TAG` | Tag en service : `develop` en staging, `vX.Y.Z` en prod |
| `ALERT_WEBHOOK_URL` | Webhook entrant Mattermost. **Secret.** Vide = pas d'alerte |
| `PREVIOUS_TAG` | Écrit par `update.sh` : version précédente, cible du retour arrière (prod) |
| `PINNED` | Écrit par `update.sh` : `true` quand la prod est figée à la main |
| `FAILED_TARGET` | Écrit par `update.sh` : release ou images en échec, non retentées |

## Règles

- Ce README est **la seule procédure de référence** pour le VPS. Si une commande diffère à l'exécution, corrigez-le dans une PR.
- Aucune action sur le VPS sans validation explicite du responsable du projet.
- Le `.env` contient l'URL du webhook, qui est un secret. Ne la collez jamais dans une issue, une PR ou un chat. Pour afficher un `.env` : `sudo grep -v ALERT_WEBHOOK_URL /srv/ai-calculator-<env>/.env`.
- Chaque étape indique **qui** la fait, la **commande**, comment **vérifier** et comment **annuler**. Les commandes VPS se lancent en SSH avec le compte `debian`.

## 1. Vérifications préalables (lecture seule)

**Qui** : Développeur, sur le VPS.

```bash
docker --version && docker compose version
ss -ltn | grep -E ':(8085|8086)\b' || echo "8085 et 8086 libres"
command -v curl jq flock
journalctl --disk-usage
sudo cat /etc/docker/daemon.json 2>/dev/null || echo "pas de daemon.json"
curl -sI https://ghcr.io/v2/ | head -n 1
sudo yunohost app list | grep -B1 -A3 -i redirect
```

**Vérifier** :
- Docker et Compose répondent.
- `8085 et 8086 libres` s'affiche.
- Trois chemins s'affichent. Si `jq` manque, faites l'étape 2.1.
- ghcr.io répond par un statut HTTP, même `401`.

Notez :
- la taille du journal ;
- l'éventuelle limite de logs dans `daemon.json` ;
- l'identifiant d'une app Redirect existante, utile à l'étape 2.6.

**Annuler** : rien à annuler.

## 2. Installation sur le VPS

### 2.1 jq (si absent)

**Qui** : Développeur.

**Commande** : `sudo apt install -y jq`

**Vérifier** : `jq --version`

**Annuler** : `sudo apt remove jq`

### 2.2 Compte système

**Qui** : Développeur.

**Commande** : on crée un compte système, et non un utilisateur YunoHost. Il n'a ni mot de passe, ni shell, ni accès SSH.

```bash
sudo adduser --system --group --no-create-home --shell /usr/sbin/nologin ai-calculator
sudo usermod -aG docker ai-calculator
```

**Vérifier** : `id ai-calculator` montre les groupes `ai-calculator` et `docker`.

**Annuler** : `sudo deluser ai-calculator && sudo delgroup ai-calculator`

### 2.3 Dossiers et fichiers

**Qui** : Développeur.

**Commande** : prendre les fichiers sur `develop` avant la première release, sur le tag de la release ensuite.

```bash
git clone --depth 1 --branch develop https://github.com/cnumr/ai-calculator /tmp/ai-calculator-src
src=/tmp/ai-calculator-src/deploy
for env in staging prod; do
  dir=/srv/ai-calculator-$env
  sudo install -d -o root -g root -m 755 "$dir"
  sudo install -o root -g root -m 644 "$src/compose.yml" "$dir/compose.yml"
  sudo install -o root -g root -m 755 "$src/update.sh" "$dir/update.sh"
  sudo install -o ai-calculator -g ai-calculator -m 600 "$src/env.example" "$dir/.env"
done
# Prod : nom, port, et tag vide (update.sh écrira la dernière release).
sudo sed -i -e 's/^COMPOSE_PROJECT_NAME=.*/COMPOSE_PROJECT_NAME=ai-calculator-prod/' \
  -e 's/^HTTP_PORT=.*/HTTP_PORT=8085/' -e 's/^IMAGE_TAG=.*/IMAGE_TAG=/' /srv/ai-calculator-prod/.env
sudo chown ai-calculator:ai-calculator /srv/ai-calculator-prod/.env
sudo chmod 600 /srv/ai-calculator-prod/.env
```

Le dossier et les scripts appartiennent à `root`. Le compte `ai-calculator` ne peut modifier que son `.env`.

**Vérifier** :

```bash
sudo ls -la /srv/ai-calculator-staging /srv/ai-calculator-prod
sudo grep -v ALERT_WEBHOOK_URL /srv/ai-calculator-prod/.env
```

Le `.env` doit appartenir à `ai-calculator` avec les droits `-rw-------`, et les autres fichiers à `root`. La prod doit avoir `HTTP_PORT=8085` et `IMAGE_TAG=` vide.

**Annuler** : `sudo rm -r /srv/ai-calculator-staging /srv/ai-calculator-prod`

### 2.4 systemd et premier lancement

**Qui** : Développeur. Le staging s'installe dès que `:develop` est publié et public (étape 3.2). La prod s'installe après la première release construite (voir section 4).

**Commande** (exemple pour le staging ; pour la prod, remplacez `staging` par `prod`) :

```bash
sudo install -o root -g root -m 644 /tmp/ai-calculator-src/deploy/systemd/ai-calculator-update@.service \
  /tmp/ai-calculator-src/deploy/systemd/ai-calculator-update@.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo -u ai-calculator /srv/ai-calculator-staging/update.sh staging --dry-run --verbose
sudo -u ai-calculator /srv/ai-calculator-staging/update.sh staging --verbose
sudo systemctl enable --now ai-calculator-update@staging.timer
```

**Vérifier** :

```bash
curl -fsS http://127.0.0.1:8086/api/use-cases | jq 'keys'
systemctl list-timers 'ai-calculator-update@*'
journalctl -u ai-calculator-update@staging -n 20
docker inspect -f '{{.Name}} {{.HostConfig.LogConfig}}' $(docker ps -q --filter label=com.docker.compose.project=ai-calculator-staging)
```

On attend :
- la liste des clés du catalogue ;
- un timer actif, avec un prochain passage dans 5 minutes au plus ;
- le driver de logs `local` avec `max-size:10m` et `max-file:5`.

**Annuler** :

```bash
sudo systemctl disable --now ai-calculator-update@staging.timer
cd /srv/ai-calculator-staging && sudo docker compose down
```

### 2.5 Domaines YunoHost

**Qui** : Développeur. Le domaine peut être ajouté avant le DNS. Le certificat ne peut être installé qu'une fois le DNS en place (étape 3.1).

**Commande** :

```bash
sudo yunohost domain add ia-calculator-staging.greenit.eco
# après propagation du DNS :
sudo yunohost domain cert install ia-calculator-staging.greenit.eco
```

Faites de même pour `ia-calculator.greenit.eco`. Le certificat de la prod s'installe le jour J, après la bascule DNS.

**Vérifier** : `sudo yunohost domain cert status ia-calculator-staging.greenit.eco` indique un certificat Let's Encrypt valide.

**Annuler** : `sudo yunohost domain remove ia-calculator-staging.greenit.eco`

### 2.6 Apps Redirect (proxy HTTPS vers le port local)

**Qui** : Développeur.

**Commande** : les arguments viennent du manifeste de l'app `redirect` (dépôt `YunoHost-Apps/redirect_ynh`). Les valeurs du chemin `/` sont `redirect_type=reverseproxy` et `init_main_permission` (`visitors` = public, `all_users` = comptes YunoHost).

```bash
# staging : réservé aux comptes YunoHost
sudo yunohost app install redirect --label "AI Calculator staging" \
  --args "domain=ia-calculator-staging.greenit.eco&path=/&redirect_type=reverseproxy&target=http://127.0.0.1:8086&init_main_permission=all_users"

# prod : public
sudo yunohost app install redirect --label "AI Calculator" \
  --args "domain=ia-calculator.greenit.eco&path=/&redirect_type=reverseproxy&target=http://127.0.0.1:8085&init_main_permission=visitors"
```

Si l'installation refuse un argument, lisez les réglages d'une app Redirect existante (identifiant noté en section 1) :

```bash
sudo yunohost app setting <id> redirect_type
sudo yunohost app setting <id> target
```

Corrigez ensuite la commande et ce README.

Pour changer la visibilité plus tard :
- `sudo yunohost user permission update <id>.main --add visitors` (public) ;
- `sudo yunohost user permission update <id>.main --remove visitors` (comptes YunoHost).

**Vérifier** :
- `curl -sI https://ia-calculator-staging.greenit.eco/ | head -n 1` renvoie une redirection vers la connexion YunoHost (SSO).
- Dans un navigateur connecté, la page s'affiche.
- En prod, la page s'affiche sans connexion.
- `sudo yunohost app list` liste les deux apps.

**Annuler** : `sudo yunohost app remove <id>` (identifiant donné par `sudo yunohost app list`).

## 3. Hors VPS

### 3.1 DNS (Infomaniak, zone `greenit.eco`)

**Qui** : l'administrateur de la zone.

**Commande** :
- **Maintenant** : créer `A ia-calculator-staging` vers `<IP-du-VPS>`.
- **Jour J** : remplacer l'enregistrement `A` de `ia-calculator`, qui vise l'ancien POC (`83.166.133.33`), par `<IP-du-VPS>`. Puis installer le certificat (2.5).

**Vérifier** : `dig +short ia-calculator-staging.greenit.eco` renvoie `<IP-du-VPS>`.

**Annuler** :
- supprimer l'enregistrement du staging ;
- pour la prod, remettre `83.166.133.33`.

### 3.2 Packages ghcr.io publics

**Qui** : un administrateur de l'organisation `cnumr` sur GitHub, après la première exécution réussie du workflow « Images develop ».

**Commande** : sur `https://github.com/orgs/cnumr/packages`, pour `ai-calculator-backend` puis `ai-calculator-frontend` :
1. ouvrir **Package settings** ;
2. dans **Danger Zone**, choisir **Change visibility** ;
3. sélectionner **Public**.

**Vérifier** : sur le VPS, sans connexion à ghcr :

```bash
docker manifest inspect ghcr.io/cnumr/ai-calculator-frontend:develop >/dev/null && echo public
```

**Annuler** : remettre les packages en **Private**. Le VPS ne pourra alors plus tirer les images.

### 3.3 Webhook Mattermost

**Qui** : un administrateur du canal Mattermost choisi, puis le Développeur.

**Commande** :
1. Dans Mattermost, ouvrir **Intégrations > Webhooks entrants > Ajouter un webhook entrant**. Choisir le canal, puis copier l'URL. Les intégrations doivent être activées par l'administrateur du serveur Mattermost.
2. Sur le VPS, mettre l'URL dans `ALERT_WEBHOOK_URL`, dans chacun des deux `.env`. `sudoedit` garde le propriétaire et les droits du fichier.

```bash
sudoedit /srv/ai-calculator-staging/.env
sudoedit /srv/ai-calculator-prod/.env
```

**Vérifier** : envoyez un message de test, sans afficher l'URL :

```bash
url="$(sudo grep '^ALERT_WEBHOOK_URL=' /srv/ai-calculator-staging/.env | cut -d= -f2-)"
curl -fsS -X POST -H 'Content-Type: application/json' -d '{"text":"Test des alertes ai-calculator"}' "$url"; unset url
```

Le message doit apparaître dans le canal.

**Annuler** : vider `ALERT_WEBHOOK_URL` dans les deux `.env`, puis supprimer le webhook dans Mattermost.

## 4. Ordre de mise en service

1. Merger la PR dans `develop`. Le workflow « Images develop » publie les images. Les rendre publiques (3.2).
2. **Staging de bout en bout** :
   - DNS (3.1) ;
   - sections 1 à 2.3 ;
   - 2.4 staging ;
   - 2.5 et 2.6 staging ;
   - webhook (3.3).

   Puis vérifier qu'un push sur `develop` est en ligne en moins de 10 minutes, avec `+sha.<commit>` dans le pied de page.
3. **Prod en local** : après une release dont le job `images` de « Release » a réussi :
   - lancer 2.4 avec `prod` ;
   - vérifier `curl -fsS http://127.0.0.1:8085/api/use-cases | jq 'keys'` ;
   - ajouter le domaine prod (2.5, sans le certificat) et installer l'app Redirect prod (2.6).

   Le site public ne change pas tant que le DNS vise Infomaniak.
4. **Jour J** : bascule DNS de la prod (3.1), puis certificat (2.5). L'ancien POC n'est plus servi.

## 5. Exploitation

- **Logs du script** : `journalctl -u ai-calculator-update@prod --since today`
- **Logs de l'app** : `cd /srv/ai-calculator-prod && sudo docker compose logs --tail 100`
- **État** :
  - `systemctl list-timers 'ai-calculator-update@*'` ;
  - `sudo grep -v ALERT_WEBHOOK_URL /srv/ai-calculator-prod/.env`.
- **Voir ce que ferait le script, sans rien changer** : `sudo -u ai-calculator /srv/ai-calculator-prod/update.sh prod --dry-run --verbose`
- **Forcer une mise à jour maintenant** : `sudo systemctl start ai-calculator-update@prod`
- **Revenir à une version** : `sudo -u ai-calculator /srv/ai-calculator-prod/update.sh prod v0.4.0`
  - La prod est figée (`PINNED=true`) et la tâche planifiée la laisse en place.
  - Pour reprendre le suivi des releases : `sudo -u ai-calculator /srv/ai-calculator-prod/update.sh prod --unpin`.
- **Release en échec** : le script est revenu à `PREVIOUS_TAG`, a alerté et a noté la release dans `FAILED_TARGET`. Elle n'est pas retentée tant qu'aucune nouvelle release ne sort. Pour la retenter à la main : `update.sh prod vX.Y.Z`, puis `--unpin` si elle fonctionne.
- **Staging en échec** : les images en échec sont notées dans `FAILED_TARGET`. Le prochain push sur `develop` est déployé normalement.
- **Mettre à jour `update.sh`, `compose.yml` ou les modèles systemd** : un administrateur reprend les fichiers sur le tag de la release, avec les commandes `install` des étapes 2.3 et 2.4, mais sans réinstaller le `.env`. Comparez avant avec `diff`. Le compte `ai-calculator` ne peut pas modifier ses propres scripts.
- **Changer le webhook** : `sudoedit` du `.env` (3.3).

## 6. Désinstallation

Pour chaque environnement :

```bash
sudo systemctl disable --now ai-calculator-update@<env>.timer
cd /srv/ai-calculator-<env> && sudo docker compose down && cd /
sudo yunohost app remove <id de l'app Redirect>
sudo yunohost domain remove <domaine>
sudo rm -r /srv/ai-calculator-<env>
```

Puis, une fois les deux environnements supprimés :

```bash
sudo rm /etc/systemd/system/ai-calculator-update@.service /etc/systemd/system/ai-calculator-update@.timer
sudo systemctl daemon-reload
sudo docker image prune -af --filter label=org.opencontainers.image.source=https://github.com/cnumr/ai-calculator
sudo deluser ai-calculator && sudo delgroup ai-calculator
```

Enfin, supprimez les enregistrements DNS et le webhook Mattermost.
