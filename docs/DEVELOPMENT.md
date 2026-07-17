# Guide développeur / devops

## Prérequis

- **Docker** + **Docker Compose** (chemin recommandé, aucune autre dépendance locale requise)
- Ou, pour un lancement manuel sans Docker :
  - Python ≥ 3.11 avec [uv](https://docs.astral.sh/uv/)
  - Node.js ≥ 22 avec npm

## Démarrage en production avec Docker Compose (recommandé)

```bash
docker compose up --build
```

`docker-compose.yml` est la stack de **production** : build multi-stage, pas de hot-reload ni de montage de volumes, un seul service HTTP exposé sur l'hôte.

- Le frontend (`frontend/Dockerfile.prod`) compile le SPA (`npm run build`) et sert les fichiers statiques via Nginx sur http://localhost (port `80`, configurable avec `HTTP_PORT`).
- Nginx (`frontend/nginx.conf`) proxifie en interne les requêtes `/api/` vers le service `backend` (port `8000`, sur le réseau Docker uniquement).
- Le backend (`backend/Dockerfile.prod`) ne publie aucun port sur l'hôte : il n'est joignable que depuis le conteneur frontend, jamais directement depuis le navigateur.

```bash
HTTP_PORT=8080 docker compose up --build
```

Le script `scripts/verify-prod-compose.sh` vérifie que cette contrainte (un seul point d'entrée HTTP, backend non publié) reste respectée.

Pour arrêter :

```bash
docker compose down
```

## Démarrage en développement avec Docker Compose

Le fichier `docker-compose.dev.yml` fournit l'environnement de dev (hot-reload, montage du code en volume) :

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Backend (FastAPI + hot-reload) : http://localhost:8000
- Frontend (Vite dev server + hot-reload) : http://localhost:5173
- Documentation interactive de l'API : http://localhost:8000/docs

Les dossiers `backend/` et `frontend/` sont montés en volume dans les conteneurs : toute modification du code sur l'hôte est reflétée immédiatement (rechargement à chaud des deux côtés). Les dépendances (`.venv` côté backend, `node_modules` côté frontend) sont conservées dans des volumes Docker nommés, séparés du bind mount, pour ne pas être écrasées par le contenu de l'hôte.

Pour arrêter :

```bash
docker compose -f docker-compose.dev.yml down
```

Si `pyproject.toml`, `uv.lock`, `package.json` ou `package-lock.json` changent, reconstruire les images :

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Démarrage manuel (sans Docker)

**Backend :**

```bash
cd backend
uv sync --extra dev
uv run uvicorn ai_calculator.main:app --reload
```

**Frontend** (dans un autre terminal) :

```bash
cd frontend
npm install
npm run dev
```

Par défaut, le frontend appelle l'API sur la même origine (`VITE_API_BASE_URL` vide). En lancement manuel avec le frontend sur le port 5173 (Vite) et le backend sur le port 8000, positionner :

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Pour éviter de la répéter à chaque commande, cette variable peut être placée dans un fichier `frontend/.env` local (non versionné, voir `.gitignore`) : Vite le charge automatiquement en dev comme en build. **Attention** : ce fichier ne doit jamais être commité, car Vite l'utiliserait aussi pour le build de production (`docker-compose.yml`), y figeant une URL locale (`localhost:8000`) inutilisable par les visiteurs.

## Variables d'environnement (développement)

Ces variables s'appliquent à `docker-compose.dev.yml` (voir [PRODUCTION.md](PRODUCTION.md) pour la production) :

| Variable               | Service        | Défaut                  | Rôle                                                                                                                                                                                                       |
| ---------------------- | -------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORS_ALLOWED_ORIGINS` | backend        | `http://localhost:5173` | Liste d'origines autorisées à appeler l'API (séparées par des virgules). À ajuster si le frontend est servi depuis une autre origine (déploiement, port différent).                                        |
| `VITE_API_BASE_URL`    | frontend       | `""` (même origine)     | URL de base de l'API consommée par le frontend.                                                                                                                                                            |
| `FRONTEND_PORT`        | docker-compose | `5173`                  | Port hôte sur lequel le frontend est exposé (`docker compose -f docker-compose.dev.yml up`). Utile en cas de conflit de port local, ex : `FRONTEND_PORT=3000 docker compose -f docker-compose.dev.yml up`. |

Si `FRONTEND_PORT` est changé, penser à ajuster en parallèle `CORS_ALLOWED_ORIGINS` côté backend pour que l'origine corresponde toujours au port réellement utilisé.

## Tests

**Backend :**

```bash
cd backend
uv run pytest
```

**Frontend :**

```bash
cd frontend
npm test
```

Les deux suites doivent passer avant tout merge (voir [AGENTS.md](../AGENTS.md) pour les conventions TDD du projet).

## Structure du dépôt

```
backend/    API FastAPI stateless (EcoLogits pour le calcul d'impacts)
frontend/   SPA React + Vite, bilingue FR/EN
docs/       Documentation (ce fichier)
```

## Processus de release

### Branches

On ne travaille jamais directement sur `main`. Chaque changement part d'une branche `feat/*` (fonctionnalité) ou `fix/*` (correctif), mergée sur `develop` pour y être testée. `develop` est ensuite mergée sur `main` via une pull request : c'est ce merge (donc un push sur `main`) qui déclenche le workflow de release décrit ci-dessous — le déclencheur `on: push: branches: [main]` de `.github/workflows/release.yml` fonctionne indifféremment que le push vienne d'un commit direct ou d'un merge de PR.

### Versioning

Le versioning est automatisé avec [Changesets](https://github.com/changesets/changesets). Le projet a une **version unique partagée** entre `frontend/package.json` et `backend/pyproject.toml`, pilotée par le `package.json` racine.

**Pour chaque changement notable** (feature, fix… — pas pour un `chore`/`docs` mineur), ajouter un changeset avant de merger sur `main` :

```bash
npm install   # une fois, à la racine
npx changeset
```

Répondre aux questions (bump `patch`/`minor`/`major`, résumé du changement en une phrase — ce résumé alimente directement le `CHANGELOG.md`). Committer le fichier généré dans `.changeset/`.

**Automatisation (`.github/workflows/release.yml`)** :

1. À chaque push sur `main`, si des changesets sont en attente, la CI ouvre/actualise une pull request « Version Packages » qui applique le(s) bump(s) et met à jour `CHANGELOG.md`.
2. Au merge de cette PR, la CI (`scripts/create-release.mjs`) crée le tag `vX.Y.Z` et la GitHub Release correspondante. Le projet n'étant publié sur aucun registre (npm/PyPI), il n'y a pas d'étape `npm publish`/`twine upload` : seuls la version, le changelog, le tag et la release sont automatisés.
3. `scripts/sync-versions.mjs` (appelé pendant l'étape `version`) synchronise la version bumpée du `package.json` racine vers `frontend/package.json` et `backend/pyproject.toml`.

## Devops : état actuel et hors périmètre

- **CI/CD** : le versioning/tag/release est automatisé (voir ci-dessus). Il n'y a en revanche aucun pipeline de lint/tests à chaque PR à ce jour — à mettre en place (tests des deux suites a minima).
- **Images de production** : voir [PRODUCTION.md](PRODUCTION.md) — `docker-compose.yml` + `Dockerfile.prod` fournissent une stack de production (build multi-stage, un seul point d'entrée HTTP, backend non exposé).
- **Hébergement / mise en production** : non défini (voir mention "à préciser" dans les mentions légales du front).
