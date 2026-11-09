---
"ai-calculator": minor
---

Données sourcées et formatage localisé.

- **Génération de vidéos** : calculée par EcoLogits (Veo 3, 720p, 8 s, avec audio par défaut) au lieu d'une valeur fixe sans source héritée du POC ; les cinq indicateurs sont désormais disponibles.
- **Génération d'images** : EcoLogits ne la modélise pas ; les valeurs du POC sont conservées et signalées sur la carte comme indicatives, sans source publiée à ce jour.
- **Équivalences CO2** : facteurs exacts d'ImpactCO2 (ADEME) pour le streaming vidéo, le smartphone et la voiture thermique, avec gestion des pluriels.
- **Formatage des nombres** : séparateurs décimaux et de milliers selon la langue choisie (`22,0` en français, `22.0` en anglais).
- **Unités** : espacées (`g CO2eq`, `mg Sbeq`).

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 13,8 M tokens (dont 13,4 M relus en cache, 48 k générés) ; Claude Haiku 5.5 : ≈ 412 k tokens (dont 258 k relus en cache, 20 k générés)._
