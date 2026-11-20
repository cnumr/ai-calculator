---
"ai-calculator": minor
---

Fréquence d'un usage par jour, par semaine ou par mois.

- **Saisie** : à côté de la fréquence de chaque cas d'usage, un sélecteur discret « /jour · /semaine · /mois » (jour par défaut). Un usage occasionnel se saisit simplement, par exemple « 1 vidéo par mois », au lieu de « 0,05 par jour ».
- **Calcul (back)** : sur la base de 218 jours ouvrés par an, une semaine compte 5 jours ouvrés (43,6 semaines par an) et une année compte 11 mois travaillés. Les impacts annuels en tiennent compte.
- **Affichage par jour ouvré** : l'impact de chaque ligne et le détail des impacts restent exprimés par jour ouvré, quelle que soit l'unité, pour comparer les usages entre eux. Les titres le précisent (« Impact par jour ouvré »).
- **API** : `POST /api/calculate` accepte `frequency` et `frequency_unit` (`day`, `week` ou `month`, `day` par défaut). L'ancien champ `frequency_per_day` reste accepté, avec les mêmes résultats qu'avant. La réponse renvoie la fréquence saisie, son unité et son équivalent par jour ouvré (`frequency_per_day`).
- **Méthodologie** : nouvelle section « Fréquence d'usage », qui détaille la conversion.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 7,5 M tokens (dont 7,4 M relus en cache, 34 k générés)._
