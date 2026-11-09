---
"ai-calculator": minor
---

Nouvelle disposition des cartes, sources méthodologiques et hypothèses modifiables.

- **Une ligne de sélection** : fournisseur (avec son logo), profil et fréquence quotidienne moyenne côte à côte ; résultats (émissions et eau) en dessous.
- **Fréquence par défaut à 0** : aucun usage n'est compté tant que l'utilisateur n'a pas renseigné ses fréquences ; « Réinitialiser » y revient.
- **Source méthodologique** : chaque carte indique la source de ses valeurs, par exemple « Source : EcoLogits 0.11.3, modélisation de l'inférence des LLM », avec un lien vers la méthodologie EcoLogits ; la génération d'images garde sa mention « valeur indicative, sans source publiée ». `GET /api/use-cases` expose une `source` par cas d'usage (identifiant, version d'EcoLogits installée, lien).
- **Tokens modifiables** : pour les cas d'usage texte, le menu « Personnaliser » affiche le nombre de tokens générés par action (valeur du catalogue par défaut) et permet de le modifier ; `POST /api/calculate` accepte `parameters.output_tokens` (de 1 à 10 000 000).
- **Logos des fournisseurs** : également affichés dans la répartition par fournisseur.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 26,6 M tokens (dont 25,9 M relus en cache, 59 k générés) ; Claude Haiku 5.5 : ≈ 50 k tokens (dont 13 k relus en cache, 2 k générés)._
