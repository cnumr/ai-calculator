---
"ai-calculator": minor
---

Génération d'images : impacts calculés selon la méthodologie, au lieu des valeurs du POC sans source publiée.

- **Méthode** : EcoLogits ne modélise pas la génération d'images. L'impact d'une image est celui d'une vidéo de référence calculée par EcoLogits (Veo 3.1, 720p, 8 s, avec audio : 27,7 à 60,6 Wh), divisé par un facteur selon la taille. Ce facteur vaut 30 en 1024 × 1024 (environ 1,5 Wh) et 8 en 2048 × 2048 (environ 5 Wh), d'après l'étude « The Hidden Cost of an Image » (arXiv 2506.17016).
- **Les cinq critères** (émissions, énergie, ressources minérales, énergie primaire, eau) sont désormais renseignés. Avant, seuls les émissions et les ressources minérales l'étaient.
- **Taille d'image** : réglable dans le menu « Personnaliser » (1024 × 1024 par défaut, ou 2048 × 2048). `POST /api/calculate` accepte `parameters.size` pour les usages d'image.
- **Même méthode pour Google et OpenAI** : la carte garde le nom du modèle d'image utilisé (Gemini 2.5 Flash Image, DALL·E 3).
- **Valeurs** : une image 1024 × 1024 émet en moyenne 0,75 g CO2eq, au lieu de 12,6 g pour la valeur du POC, qui incluait une estimation d'infrastructure plus large.
- **Source** : la carte cite la transposition depuis la vidéo EcoLogits et l'étude, avec un lien vers la nouvelle section « Génération d'images » de la page Méthodologie.
- **Code** : le mode de calcul « valeurs statiques » et la mention « sans source publiée », devenus inutilisés, sont supprimés.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 17,0 M tokens (dont 16,9 M relus en cache, 41 k générés)._
