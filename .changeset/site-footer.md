---
"ai-calculator": minor
---

Ajout d'un pied de page sur toutes les pages : version du site, lien vers l'association GreenIT.fr, lien vers le code source sur GitHub, sources de données avec leur version (EcoLogits 0.11.3, ImpactCO2 relevé du 8 nov. 2026) et rappel des liens Méthodologie, À propos et Mentions légales.

- Les versions sont lues dans ce qui est réellement utilisé (version du site au build, version d'EcoLogits installée, date de relevé d'ImpactCO2) : elles restent à jour sans maintenance. `GET /api/use-cases` expose ces `data_sources`.
- Le catalogue est désormais chargé une seule fois pour tout le site, et partagé entre le calculateur et le pied de page : revenir sur le calculateur ne le recharge plus.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 15,3 M tokens (dont 14,5 M relus en cache, 26 k générés)._
