---
"ai-calculator": patch
---

Tokens générés (#60) : une saisie au-delà du maximum retient désormais le maximum, et non plus la valeur par défaut du cas d'usage ; le maximum, affiché sous le champ, passe à 1 milliard pour l'aide au développement (10 millions pour les autres cas d'usage). Nombre de salariés : le champ vidé reste vide au lieu d'afficher 0, et une saisie ne donne plus « 0500 ». Badge Ecoindex : sans `ECOINDEX_DOMAIN`, l'image de production et les fichiers Compose prennent le domaine de production `ai-calculator.greenit.eco` ; la variable définie vide désactive le badge.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 9,6 M tokens (dont 9,3 M relus en cache, 24 k générés)._
