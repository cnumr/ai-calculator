---
"ai-calculator": patch
---

Correction de la stack Docker Compose de production : les services `backend` et `frontend` ont `restart: unless-stopped`, ils repartent automatiquement après un redémarrage du serveur ou du démon Docker. Voir `docs/PRODUCTION.md`.
