# AI Calculator — Catalogue de cas d'usage (Design V2)

## Contexte

Le calculateur V1 ([spec](2026-07-13-ai-calculator-design.md)) permet de calculer les 5 impacts (GWP, Eau, ADPe, Énergie, PE) pour un couple provider/model EcoLogits choisi librement, via `POST /api/calculate`. Le [POC](https://ia-calculator.greenit.eco/) de référence propose une expérience différente et plus proche du besoin métier : un **catalogue de 8 cas d'usage concrets** (ex. "Résumés de réunions", "Génération d'images"), chacun avec une cascade fournisseur métier → profil (éco/équilibré/puissant), et un calcul instantané de l'impact par action. Cette V2 reproduit ce fonctionnel du POC, en l'étendant aux 5 indicateurs EcoLogits (le POC ne montre que le CO2).

## Objectif

Remplacer le formulaire libre du calculateur par un catalogue de cas d'usage configurable, fidèle au fonctionnel du POC (cascade fournisseur→profil, lecture seule si non supporté, chips fournisseurs togglables), avec les 5 indicateurs EcoLogits affichés pour chaque cas d'usage.

## Fonctionnel de référence (POC)

- 5 chips fournisseurs ("écosystème IA"), togglables individuellement, qui filtrent les fournisseurs proposés dans les cartes de cas d'usage.
- 8 cartes de cas d'usage, chacune avec : select fournisseur → select profil (dépendant du fournisseur) → fréquence/jour → impact par action recalculé en direct.
- Si un profil n'est pas supporté par le fournisseur choisi, le select passe en lecture seule.
- Panneau impact individuel annuel (équivalences CO2 + répartition par fournisseur) et panneau impact entreprise (mêmes totaux × headcount).

## Périmètre V2

- Catalogue de cas d'usage configurable via un fichier YAML unique, sans back-office.
- Reprise des 8 cas d'usage du POC, avec les mêmes fournisseurs et profils.
- Extension aux 5 indicateurs EcoLogits pour chaque cas d'usage (le POC ne fait que le GWP).
- Nouvel endpoint API, **en complément** de `GET /api/providers` et `POST /api/calculate` existants (non remplacés — ils restent disponibles pour d'autres usages du calculateur libre).

## Fichier de config (`use_cases.yaml`)

Un seul fichier YAML, versionné dans le repo (`backend/src/ai_calculator/data/use_cases.yaml`), source de vérité pour le catalogue. Deux sections top-level :

```yaml
providers:
  - id: openai
    selected_by_default: true
  - id: google
    selected_by_default: true
  - id: anthropic
    selected_by_default: true
  - id: mistral
    selected_by_default: false
  - id: microsoft_copilot
    selected_by_default: true

use_cases:
  - id: meeting_summary
    providers:
      - provider_id: microsoft_copilot
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 450
          - id: powerful
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 450
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 450
  - id: image_generation
    providers:
      - provider_id: openai
        profiles:
          - id: standard
            static_impacts:
              gwp: { min: 1.2, max: 1.8, unit: g }
              water: { min: 4.0, max: 6.0, unit: mL }
              adpe: { min: 0.9, max: 1.3, unit: "µg Sb" }
              energy: { min: 12.0, max: 18.0, unit: mJ }
              pe: { min: 0.15, max: 0.22, unit: mJ }
```

- **`providers`** : les 5 chips "écosystème IA". `id` sert de clé stable, `selected_by_default` pilote l'état initial de la chip (togglable ensuite par l'utilisateur, jamais forcé).
- **`use_cases`** : arborescence à 4 niveaux (cas d'usage → fournisseur → profil → mapping). Deux formes de profil :
  - **LLM (majorité des cas)** : `ecologits_provider` + `ecologits_model` + `output_tokens` fixe, résolus via `compute_unit_impacts()` (existant, `backend/src/ai_calculator/domain/impacts.py`).
  - **Non-LLM (image/vidéo)** : `static_impacts`, valeurs figées pour les 5 indicateurs (EcoLogits ne modélise pas ces usages).
- Un fournisseur métier (`microsoft_copilot`) n'a pas d'identité EcoLogits propre : chaque profil le mappe explicitement vers un couple `ecologits_provider`/`ecologits_model` réel. Le nom affiché ("Microsoft Copilot") reste indépendant de l'identifiant technique utilisé pour le calcul.
- Toute combinaison fournisseur/profil absente de la config = non supportée (équivalent du "lecture seule" du POC).

## i18n de la config

La config ne porte que des **identifiants stables** (`meeting_summary`, `eco`, `microsoft_copilot`, etc.), jamais de texte affiché. Les libellés et descriptions (nom du cas d'usage, nom du fournisseur, nom du profil) sont ajoutés aux fichiers `fr.json`/`en.json` existants du front (`frontend/src/i18n/`), sous une clé dédiée (ex. `useCases.meeting_summary.name`), cohérent avec le mécanisme i18n déjà en place pour le reste du site.

## API

- **`GET /api/use-cases`** _(nouveau)_ : charge `use_cases.yaml`, résout chaque profil LLM via `compute_unit_impacts()` (ou reprend directement `static_impacts` pour les profils non-LLM), et retourne le catalogue complet — fournisseurs (avec `selected_by_default`) et cas d'usage, chaque combinaison fournisseur/profil valide portant ses 5 indicateurs en min-max. Un seul appel au chargement de la page ; le front ne refait pas d'appel réseau lors des interactions (toggle de fournisseur, changement de select, fréquence) — il relit dans la structure déjà chargée.
- **`GET /api/providers`** et **`POST /api/calculate`** _(existants, inchangés)_ : conservés tels quels, non affectés par ce nouvel endpoint.

## Composants front

- **Carte de cas d'usage** : select fournisseur → select profil (cascade identique au POC, lecture seule si combinaison absente de la config) + fréquence/jour. Les 5 indicateurs (GWP, Eau, ADPe, Énergie, PE) sont affichés en lignes compactes (icône + libellé + valeur min-max), **repliées par défaut** dans un `<details>/<summary>` natif, libellé : _"Voir/Masquer le détail de vos impacts pour cette tâche"_.
- **Chips fournisseurs "écosystème IA"** : état initial = `selected_by_default` de la config, togglable librement ensuite. Filtrent les fournisseurs proposés sur les cartes.
- **Logos fournisseurs** : un fichier statique par fournisseur dans `frontend/src/assets/providers/<id>.svg` (ex. `openai.svg`, `microsoft_copilot.svg`), résolu directement depuis l'`id` déjà présent dans `use_cases.yaml` — pas de champ logo dans la config, pas de dépendance réseau externe. Affiché sur les chips "écosystème IA" et dans le select fournisseur de chaque carte. Si un logo manque pour un `id` (asset non fourni), affichage d'un fallback textuel (initiale du fournisseur) plutôt qu'une image cassée. Les 5 logos ont été extraits du POC (SVG vectoriels inline dans son code source, pas d'images bitmap) et sont déjà présents dans le repo : `openai.svg`, `anthropic.svg`, `mistral.svg`, `google.svg`, `microsoft_copilot.svg`.
- **Pictos cas d'usage** : même principe que les logos fournisseurs, un fichier statique par cas d'usage dans `frontend/src/assets/use-cases/<id>.svg`, résolu depuis l'`id` du cas d'usage dans `use_cases.yaml`. Affiché en tête de chaque carte de cas d'usage (à côté du titre). Extraits du POC (icônes vectorielles de type Lucide, trait `currentColor` pour hériter la couleur du texte environnant) et déjà présents dans le repo sous les identifiants POC d'origine : `video.svg`, `image.svg`, `deep_research.svg`, `meet_summary.svg`, `doc_small.svg`, `doc_large.svg`, `ai_query.svg`, `email.svg` — à faire correspondre aux `id` finalement choisis pour `use_cases.yaml` lors de l'implémentation (renommage si les identifiants diffèrent).
- **`RangeGauge`** (existant) : conservé pour les panneaux de synthèse (impact individuel/entreprise), pas utilisé dans le détail replié de la carte (lignes compactes, pas de jauge).
- **`Co2Equivalents`** (existant) : inchangé, branché uniquement sur le GWP.
- **Répartition par fournisseur** : affiche le GWP par défaut ; les 4 autres indicateurs sont accessibles via un `<details>/<summary>` du même type que celui des cartes, même libellé d'interaction.
- **Panneaux impact individuel/entreprise** : structure existante (extrapolation annuelle, headcount) étendue pour porter les 5 indicateurs au lieu du seul GWP.

## Gestion des erreurs

- **Chargement `GET /api/use-cases` échoue** : état d'erreur pleine page avec retry (cohérent avec le comportement déjà en place pour les erreurs API du calculateur V1).
- **Combinaison fournisseur/profil absente de la config** : ce n'est pas une erreur réseau — le back ne l'inclut simplement pas dans la réponse, le front désactive/grise le select de profil correspondant (lecture seule, comme dans le POC).
- **Erreur de validation du `use_cases.yaml` au démarrage** (schéma invalide, provider/model EcoLogits inexistant référencé par un profil LLM) : échec explicite au démarrage du back (fail fast), pas de dégradation silencieuse en runtime.

## Tests

- **Back** :
  - Tests unitaires sur le chargement/validation de `use_cases.yaml` (schéma, résolution des mappings LLM vers `compute_unit_impacts()`, détection d'un provider/model EcoLogits inexistant référencé par erreur).
  - Test d'intégration sur `GET /api/use-cases` : vérifie que chaque combinaison valide retourne les 5 indicateurs en min-max, que les combinaisons absentes de la config sont bien omises, et que `selected_by_default` est répercuté sur les fournisseurs.
- **Front** :
  - Tests de composants sur la cascade fournisseur→profil (sélection, désactivation si non supporté).
  - Tests sur l'état replié/déplié des `<details>` (carte de cas d'usage, répartition par fournisseur).
  - Test sur l'état initial des chips fournisseurs piloté par `selected_by_default`, et leur toggle par l'utilisateur.
  - Test sur le fallback textuel affiché quand le logo d'un fournisseur est absent.
  - Test sur l'affichage du picto de cas d'usage correspondant à l'`id` de la carte.
- **E2E (Playwright)** : un scénario couvrant le parcours complet du calculateur catalogue-driven — chargement de la page, toggle d'un fournisseur "écosystème IA", changement fournisseur→profil sur une carte, ouverture du détail des 5 indicateurs, vérification que les panneaux impact individuel/entreprise se mettent à jour en cohérence.

## Dépendances

Aucune nouvelle dépendance runtime requise (le parsing YAML s'appuie sur une lib déjà standard dans l'écosystème Python, ex. `PyYAML`, à ajouter en dernière version stable vérifiée au moment de l'implémentation — cohérent avec la règle du projet de ne jamais épingler une version supposée depuis les données d'entraînement).
