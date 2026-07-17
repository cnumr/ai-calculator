---
"ai-calculator": minor
---

Ajout d'une stack Docker Compose de production (`docker-compose.yml`, `Dockerfile.prod` back/front, proxy Nginx) : un seul point d'entrée HTTP exposé, le backend n'est plus jamais accessible directement depuis le navigateur. L'ancien `docker-compose.yml` de développement devient `docker-compose.dev.yml`. Voir `docs/PRODUCTION.md`.
