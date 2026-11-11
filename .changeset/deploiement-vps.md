---
"ai-calculator": minor
---

Déploiement continu sur le VPS GreenIT : les images Docker sont publiées sur ghcr.io à chaque push sur `develop` (tags `develop` et `sha-<commit>`) et à chaque release (tags `vX.Y.Z` et `latest`). Le VPS les tire toutes les 5 minutes : le staging suit `develop`, la prod suit la dernière release. En cas d'échec, la prod revient à la version précédente et une alerte part sur Mattermost. La version affichée en pied de page inclut désormais le commit (`X.Y.Z+sha.<commit>`) en staging. La procédure est dans `deploy/README.md` et `docs/PRODUCTION.md`.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 507 k tokens (dont 476 k relus en cache, 5 k générés)._
