---
"ai-calculator": patch
---

Écoconception : les fichiers texte sont désormais servis compressés en production (bonne pratique GreenIT RWEB_0076). Le JavaScript, le CSS, le HTML et le SVG sont précompressés une seule fois au build et servis tels quels par nginx ; les réponses JSON de l'API sont compressées à la volée. Au premier chargement du calculateur, le poids transféré passe de 354 à 107 Ko (JavaScript 318 → 99 Ko, CSS 14,6 → 3,2 Ko, catalogue de l'API 17,7 → 1,2 Ko). Le script `scripts/verify-compression.sh` permet de le vérifier sur la stack lancée.
