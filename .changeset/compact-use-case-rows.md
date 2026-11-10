---
"ai-calculator": minor
---

Liste des cas d'usage plus compacte, regroupée par familles.

- **Une ligne par cas d'usage** : titre, rappel du choix sur deux lignes (fournisseur et profil, par exemple « Microsoft Copilot · Éco (GPT-6 Luna) », puis les réglages, par exemple « 300 tokens générés »), fréquence quotidienne et impact par jour (GES, puis eau en dessous). Saisir une fréquence suffit à compter un usage, sans clic supplémentaire. Les lignes utilisées sont soulignées, les autres atténuées.
- **Bouton « Réglages »** : il déplie, sous la ligne, le fournisseur et le profil, puis une section « Personnalisation » (tokens, résolution, durée, audio, taille d'image), puis le « Détail des impacts par jour » avec la source méthodologique. Ce contenu n'est rendu qu'à l'ouverture.
- **Familles** : les cas d'usage sont listés sous un intertitre par famille (Rédaction, Analyse et synthèse, Production bureautique, Création visuelle, Développement), avec des titres de colonnes au-dessus de la liste. Les familles sont déclarées dans `use_cases.yaml`. `GET /api/use-cases` expose `families` et la `family` de chaque cas d'usage.
- **Filtre « Seulement mes usages (n) »** : une case discrète, dans la ligne des titres de colonnes, ne garde que les cas d'usage avec une fréquence (et leurs familles). Elle retient les usages actifs au moment où on la coche : une ligne remise à 0 reste affichée, pour ne pas disparaître pendant la saisie. « Réinitialiser » la décoche.
- **Effet** : sur ordinateur, la page passe de 5 900 à 3 000 px de haut, et de 831 à 609 éléments au chargement (−27 %).

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 28,7 M tokens (dont 28,5 M relus en cache, 68 k générés)._
