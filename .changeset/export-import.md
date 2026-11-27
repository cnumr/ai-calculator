---
"ai-calculator": minor
---

Export et import des données du calculateur (#55). « Exporter » enregistre, dans un fichier JSON créé par le navigateur, les saisies et leurs impacts par cas d'usage, par personne et pour l'entreprise, avec la version du site et des sources de données. « Importer » recharge un tel fichier : les saisies sont reprises et les impacts recalculés en un seul appel, avec un avertissement si les versions diffèrent. L'API renvoie désormais ces versions (`meta`) et la valeur estimée de chaque fourchette (`value`), que le front affiche au lieu de la calculer. Les boutons de l'en-tête (visite guidée, export, import, réinitialisation) ont une infobulle qui décrit leur action.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 18,1 M tokens (dont 17,8 M relus en cache, 100 k générés)._
