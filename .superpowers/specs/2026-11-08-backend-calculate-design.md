# Logique métier côté back : `POST /api/calculate` — Design

Statut : implémenté. Branche : `feat/backend-calculate-dhe` (depuis `feat/ux-layout-dhe`).

## Contexte

Le spec V1 voulait toute la logique métier côté back, testée en Python. Le code a pris le chemin inverse : `POST /api/calculate` a été retiré et le front calcule :

- l'impact d'une action selon les paramètres (recherche de variante précalculée) ;
- × fréquence × 218 jours ouvrés, somme des usages ;
- répartition par fournisseur et parts en % ;
- total entreprise (× effectif) ;
- équivalences CO2.

## Décisions

| Sujet | Choix |
|---|---|
| Forme | **Un seul `POST /api/calculate`** qui reçoit tout le scénario, paramètres **typés selon le type de cas d'usage** (union discriminée sur `kind`) |
| Précalcul | **Retiré** : le catalogue ne décrit plus que les choix ; calcul EcoLogits à la demande avec cache mémoire |
| Équivalences CO2 | **Côté back** : facteurs ImpactCO2 et quantités dans la réponse |

## Catalogue (`GET /api/use-cases`)

- Chaque cas d'usage gagne `kind` : `text`, `video` ou `image`, déclaré dans le YAML. Le chargement vérifie que ses profils sont du type attendu (texte → `ecologits_model`, vidéo → `ecologits_video`, image → `static_impacts`).
- Les profils perdent `impacts` et `variants`. Ils gardent `models`, `output_tokens` et `parameters` (options et défaut).
- Au démarrage, l'impact par défaut de chaque profil est calculé une fois pour valider le catalogue (modèle inconnu, défaut non supporté → arrêt), comme aujourd'hui.

## `POST /api/calculate`

Requête :

```json
{
  "headcount": 50,
  "usages": [
    { "kind": "text", "use_case_id": "email", "provider_id": "openai", "profile_id": "eco", "frequency_per_day": 3 },
    { "kind": "video", "use_case_id": "video", "provider_id": "google", "profile_id": "video", "frequency_per_day": 1,
      "parameters": { "resolution": "1080p", "duration_s": 8, "with_audio": true } },
    { "kind": "image", "use_case_id": "image", "provider_id": "google", "profile_id": "image", "frequency_per_day": 2 }
  ]
}
```

- Union discriminée sur `kind` : seuls les usages `video` acceptent `parameters` (`resolution`, `duration_s`, `with_audio`, tous facultatifs → défaut du profil). Tout champ inconnu est refusé. L'OpenAPI documente un schéma par type.
- Validation métier : cas d'usage, fournisseur et profil existants, `kind` cohérent avec le cas d'usage, valeurs de paramètres parmi les options du modèle, `frequency_per_day ≥ 0`, `headcount ≥ 1`, 50 usages au plus → sinon `422` avec un message explicite.
- Le front n'envoie que les usages dont la carte est utilisable (fournisseur sélectionné) ; le choix de repli du fournisseur ou du profil reste une logique d'interface, côté front.

Réponse :

```json
{
  "working_days_per_year": 218,
  "usages": [
    { "use_case_id": "video", "provider_id": "google", "profile_id": "video",
      "parameters": { "resolution": "1080p", "duration_s": 8, "with_audio": true },
      "unit_impacts": {}, "daily_impacts": {}, "annual_impacts": {} }
  ],
  "individual_annual": {},
  "enterprise_annual": {},
  "provider_breakdown": [ { "provider_id": "google", "annual_impacts": {}, "gwp_share_percent": 58.1 } ],
  "co2_equivalents": [ { "id": "car_km", "impact_co2_slug": "voiturethermique", "quantity": 93.4 } ]
}
```

Règles reprises à l'identique du front (pas de changement de résultat) :

- totaux : somme partant de zéro ; un critère `null` compte pour 0 (un total n'est jamais `null`) ;
- part d'un fournisseur : `gwp.max` du fournisseur / somme des `gwp.max` × 100, ordre de première apparition ;
- équivalences : `individual_annual.gwp.max` / facteur ; arrondi et pluriel restent de la présentation (front).

## Back : organisation

- `domain/use_cases.py` : catalogue descriptif ; chaque profil porte un calcul (`TextCalculation`, `VideoCalculation`, `StaticCalculation`) exposant `unit_impacts(values)`.
- `domain/impacts.py` : appels EcoLogits mis en cache (`functools.lru_cache`).
- `domain/scenario.py` : `compute_scenario(catalog, usages, headcount)`, fonction pure testée unitairement.
- `domain/equivalents.py` : facteurs ImpactCO2 (`data/co2_equivalents.json`, déplacé depuis le front).
- `api/calculate.py` + `schemas/calculate.py` : endpoint, union discriminée, erreurs → 422.

## Front : organisation

- `CalculatorPage` construit la requête (`buildCalculateRequest`, fonction pure) à chaque changement, l'envoie après un court délai (150 ms) en annulant la précédente (`AbortController`), et n'applique que la dernière réponse.
- Les cartes affichent `daily_impacts` de la réponse. Si la réponse ne correspond pas encore à la sélection affichée, les valeurs précédentes restent visibles, atténuées (`aria-busy`).
- Erreur de calcul : message avec « Réessayer », dernières valeurs conservées.
- Supprimés : `domain/aggregate.ts`, `resolveImpacts`, `computeAnnualEntries`, `data/co2-equivalents.json`, `WORKING_DAYS_PER_YEAR`.

## Tests

- Back : calcul unitaire par type, cache, validation (kind, paramètres, effectif, fréquence), agrégation, répartition, équivalences, API (schéma, 422).
- Front : `buildCalculateRequest` (désélection, repli, réinitialisation, paramètres), page avec `calculate` simulé (affichage, annulation des réponses obsolètes, erreur), carte (valeurs reçues, état en attente).
