---
"ai-calculator": minor
---

La logique métier du calculateur passe côté backend : nouvel endpoint `POST /api/calculate`.

- **Un seul calcul de scénario** : il reçoit tous les usages quotidiens et le nombre de salariés, et renvoie l'impact de chaque usage (par action, par jour et par an), les totaux annuels individuel et entreprise, la répartition par fournisseur et les équivalences CO2.
- **Paramètres typés par type de cas d'usage** : les usages sont distingués par `kind` (`text`, `video`, `image`), chacun n'acceptant que ses propres paramètres, vérifiés contre les options du modèle. Un scénario invalide reçoit une erreur `422` avec un message explicite.
- **Catalogue allégé** : `GET /api/use-cases` ne décrit plus que les choix possibles (de 59 à 11,5 Ko) et indique le `kind` de chaque cas d'usage ; les impacts EcoLogits sont calculés à la demande, avec un cache.
- **Équivalences CO2** : les facteurs ImpactCO2 sont désormais gérés par le backend.
- **Frontend** : il envoie le scénario 150 ms après le dernier changement, annule les requêtes dépassées et n'applique que la dernière réponse ; les valeurs en attente de mise à jour sont atténuées, et un calcul en échec conserve le dernier résultat avec un bouton « Réessayer ». Les résultats sont inchangés.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 20,9 M tokens (dont 20,7 M relus en cache, 97 k générés)._
