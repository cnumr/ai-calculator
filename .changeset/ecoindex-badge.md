---
"ai-calculator": minor
---

Badge Ecoindex de la page en cours dans le pied de page, à droite de la version du site.

- **Propre à chaque page** : accueil, méthodologie, à propos, mentions légales. Le lien mène à l'analyse de la page sur ecoindex.fr.
- **Relayé par le serveur du site** (`/ecoindex-badge.svg?path=…`, lien `/ecoindex?path=…`) : le navigateur des visiteurs ne contacte pas ecoindex.fr, les mentions légales restent exactes. nginx récupère chaque badge au plus une fois par jour, sans en-tête du visiteur, et sert la dernière version si ecoindex.fr est injoignable. Seules les pages du site sont relayées.
- **Domaine par environnement** : variable `ECOINDEX_DOMAIN` lue au démarrage du conteneur (`ai-calculator.greenit.eco` en prod, `ia-calculator-staging.greenit.eco` en staging) ; vide, pas de badge. La configuration nginx devient un modèle (`frontend/nginx.conf.template`).
- **En développement**, le serveur Vite relaie le badge de la même façon quand `ECOINDEX_DOMAIN` est définie (`docker-compose.dev.yml`).

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 8,5 M tokens (dont 8,4 M relus en cache, 34 k générés)._
