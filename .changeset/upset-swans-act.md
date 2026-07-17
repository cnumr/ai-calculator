---
"ai-calculator": patch
---

Fix critique prod : `frontend/.env` (contenant `VITE_API_BASE_URL=http://localhost:8000`) était commité dans le dépôt, ce qui figeait cette URL locale dans le build de production du front (`docker-compose.yml`), rendant le chargement du catalogue de cas d'usage impossible pour les visiteurs. Le fichier est retiré du suivi git et désormais exclu du contexte de build Docker (`frontend/.dockerignore`).
