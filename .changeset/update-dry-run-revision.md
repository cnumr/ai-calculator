---
"ai-calculator": patch
---

Correction de `deploy/update.sh --dry-run` : sur le staging, la commande sortait en erreur sans message quand l'image `develop` n'était pas encore téléchargée sur le serveur. Elle annonce désormais le redémarrage prévu, sans rien modifier.

_Réalisé avec Claude Code — Claude Haiku 5.5 : ≈ 8,1 M tokens (dont 7,3 M relus en cache, 99 k générés)._
