# Installation en production

Guide de déploiement du calculateur avec la stack de production Docker Compose (`docker-compose.yml`).

## Architecture

Un seul service HTTP est exposé sur l'hôte : le **frontend**. Il sert le build statique du SPA et proxifie en interne les appels `/api/*` vers le **backend**, qui reste uniquement joignable sur le réseau Docker interne (aucun port publié). Le navigateur de l'utilisateur ne parle donc jamais directement au backend.

```
navigateur ── :80 ──> frontend (Nginx)
                         ├── fichiers statiques du SPA
                         └── /api/*  ──(réseau docker interne)──> backend:8000
```

## Prérequis

- Docker + Docker Compose (v2, `docker compose`)
- Un accès au dépôt (`git clone`) sur la machine de déploiement

## Installation

```bash
git clone <url-du-dépôt>
cd ai-calculator
docker compose up --build -d
```

L'application est alors accessible sur `http://<hôte>` (port 80 par défaut).

### Changer le port exposé

Le port publié sur l'hôte est configurable via la variable `HTTP_PORT` :

```bash
HTTP_PORT=8080 docker compose up --build -d
```

Pour fixer la valeur durablement, créer un fichier `.env` à la racine du dépôt (lu automatiquement par Docker Compose) :

```bash
echo "HTTP_PORT=8080" > .env
docker compose up --build -d
```

## Mise à jour

```bash
git pull
docker compose up --build -d
```

Docker Compose ne reconstruit et ne redémarre que les services dont l'image a changé.

## Arrêt

```bash
docker compose down
```

## Vérifications post-déploiement

```bash
# Le front répond
curl -I http://localhost:${HTTP_PORT:-80}/

# L'API est bien joignable via le proxy du front
curl http://localhost:${HTTP_PORT:-80}/api/providers

# Seul le service frontend publie un port sur l'hôte
docker compose ps
```

Le script `scripts/verify-prod-compose.sh` (exécutable depuis la racine du dépôt) automatise ce dernier contrôle : il échoue si le backend venait à publier un port sur l'hôte.

## Variables d'environnement

| Variable    | Service  | Défaut | Rôle                                                              |
| ----------- | -------- | ------ | ----------------------------------------------------------------- |
| `HTTP_PORT` | frontend | `80`   | Port hôte sur lequel le frontend (donc l'application) est exposé. |

`CORS_ALLOWED_ORIGINS` et `VITE_API_BASE_URL` ne s'appliquent pas ici : en production, le frontend et l'API sont servis depuis la même origine (proxy Nginx), donc aucune configuration CORS n'est nécessaire côté backend.

## Limites actuelles

- Pas de HTTPS/TLS intégré : à placer derrière un reverse proxy externe (ex. Traefik, Caddy, load balancer) si l'application est exposée publiquement.
- Pas de volumes persistants : le backend est stateless, rien à sauvegarder côté données applicatives.
