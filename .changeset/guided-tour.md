---
"ai-calculator": minor
---

Visite guidée du calculateur pour les nouveaux utilisateurs (#42).

- **Bouton « Visite guidée »**, à côté de « Réinitialiser ». Il porte une pastille discrète tant que la visite n'a été ni terminée ni quittée. Ce repère reste dans le navigateur (`localStorage`) et n'est jamais envoyé au serveur.
- **8 étapes sur les éléments réels du calculateur** : écosystème IA, configuration d'un cas d'usage, fréquence, impact par jour ouvré, filtre « Seulement mes usages », impact annuel, nombre de salariés, réinitialisation et méthodologie. Le fil rouge est « Rédaction d'un mail court, 5 fois par jour ». L'élément de chaque étape est entouré, et une bulle l'explique, avec Précédent, Suivant, Terminer et Échap.
- **Sans coût pour qui ne la lance pas** : le code et les textes de la visite (3 Ko compressés) ne sont chargés qu'au clic, sans bibliothèque. Au chargement de la page : 6 requêtes, comme avant, et un EcoIndex de 68,07 (C) contre 68,16.
- **Ne modifie pas le scénario** : la visite raconte l'exemple sans rien saisir, donc sans recalcul.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 11,9 M tokens (dont 11,8 M relus en cache, 41 k générés)._
