# Guide développeur / devops

## Prérequis

- **Docker** + **Docker Compose** (chemin recommandé, aucune autre dépendance locale requise)
- Ou, pour un lancement manuel sans Docker :
  - Python ≥ 3.11 avec [uv](https://docs.astral.sh/uv/)
  - Node.js ≥ 22 avec npm

## Démarrage avec Docker Compose (recommandé)

```bash
docker compose up --build
```

- Backend (FastAPI + hot-reload) : http://localhost:8000
- Frontend (Vite dev server + hot-reload) : http://localhost:5173
- Documentation interactive de l'API : http://localhost:8000/docs

Les dossiers `backend/` et `frontend/` sont montés en volume dans les conteneurs : toute modification du code sur l'hôte est reflétée immédiatement (rechargement à chaud des deux côtés). Les dépendances (`.venv` côté backend, `node_modules` côté frontend) sont conservées dans des volumes Docker nommés, séparés du bind mount, pour ne pas être écrasées par le contenu de l'hôte.

Pour arrêter :

```bash
docker compose down
```

Si `pyproject.toml`, `uv.lock`, `package.json` ou `package-lock.json` changent, reconstruire les images :

```bash
docker compose up --build
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

## Variables d'environnement

| Variable               | Service        | Défaut                  | Rôle                                                                                                                                                                |
| ---------------------- | -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORS_ALLOWED_ORIGINS` | backend        | `http://localhost:5173` | Liste d'origines autorisées à appeler l'API (séparées par des virgules). À ajuster si le frontend est servi depuis une autre origine (déploiement, port différent). |
| `VITE_API_BASE_URL`    | frontend       | `""` (même origine)     | URL de base de l'API consommée par le frontend.                                                                                                                     |
| `FRONTEND_PORT`        | docker-compose | `5173`                  | Port hôte sur lequel le frontend est exposé (`docker compose up`). Utile en cas de conflit de port local, ex : `FRONTEND_PORT=3000 docker compose up`.              |

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

## Devops : état actuel et hors périmètre

- **CI/CD** : aucun pipeline configuré à ce jour — à mettre en place (lint + tests des deux suites à chaque PR, a minima).
- **Images de production** : les `Dockerfile` actuels (`backend/Dockerfile`, `frontend/Dockerfile`) sont conçus pour le développement local (hot-reload, montage du code en volume) et **ne sont pas adaptés à la production** (pas de build multi-stage, pas de serveur de fichiers statiques pour le frontend, pas de durcissement de l'image). La conteneurisation de production est hors périmètre de ce guide et devra faire l'objet d'un travail dédié le moment venu.
- **Hébergement / mise en production** : non défini (voir mention "à préciser" dans les mentions légales du front).
