# AI Calculator — Design V1

## Contexte

Un [POC](https://ia-calculator.greenit.eco/) existe sous forme de page unique (HTML/JS/données embarquées). Ce projet transforme ce POC en une vraie web application front/back.

## Objectif

Permettre aux utilisateurs d'évaluer les impacts environnementaux (GWP, Eau, ADPe, Énergie, PE) de leurs usages de l'IA Générative, à partir du concept fonctionnel du POC (usage quotidien par modèle/fournisseur + extrapolation individuelle et entreprise), avec un front bilingue FR/EN et un back qui s'appuie sur [EcoLogits](https://github.com/genai-impact/ecologits).

## Périmètre V1

- Calculateur : usage quotidien par modèle/fournisseur + extrapolation annuelle individuelle et entreprise (même concept que le POC).
- Modèles disponibles = catalogue natif EcoLogits (pas de référentiel enrichi custom).
- Stateless : aucune persistance, aucune base de données.
- Front bilingue FR/EN via sélecteur de langue en session (pas de routes préfixées par langue).
- Pages : Calculateur, Méthodologie, À propos, Mentions légales.

## Hors périmètre V1 (V2, sous-projet séparé)

**Référentiel de modèles enrichi via Hugging Face** : construire nos propres fiches modèles en allant chercher sur Hugging Face les caractéristiques nécessaires (paramètres, architecture, etc.), sur le principe utilisé dans [ai-footprint](https://github.com/hrenaud/ai-footprint) (résolution de modèles tiers/locaux non reconnus). Ce référentiel sera brainstormé et spécifié séparément, puis consommé par le back du calculateur une fois prêt.

## Architecture

```
┌─────────────────────┐        HTTP/JSON        ┌──────────────────────┐
│  Front : React+Vite  │  ───────────────────►   │  Back : FastAPI       │
│  (SPA statique)       │  ◄───────────────────   │  (stateless)          │
└─────────────────────┘                          └───────────┬──────────┘
                                                               │
                                                     ┌─────────▼──────────┐
                                                     │   EcoLogits (lib)   │
                                                     │ données modèles +   │
                                                     │ calcul d'impacts    │
                                                     └─────────────────────┘
```

- **Front** : SPA React (Vite), buildée en statique, servie par nginx. Aucune logique métier côté front, uniquement présentation et appels API.
- **Back** : API FastAPI stateless. Toute la logique métier (calcul unitaire + extrapolation) est en Python, testée en TDD.
- **Déploiement** : deux images Docker indépendantes (front nginx, back uvicorn), déployables séparément. Pas d'hébergeur imposé à ce stade.
- **Repo** : monorepo `ai-calculator` avec `frontend/` et `backend/` à la racine.

## API

- **`GET /api/providers`** : liste des fournisseurs/modèles disponibles (nom, provider, capacités), dérivée du catalogue EcoLogits. Alimente les sélecteurs du front.
- **`POST /api/calculate`** : reçoit les paramètres d'usage (provider, model, tokens_in/out ou nb de requêtes/jour, nb de jours, nb de salariés pour l'extrapolation entreprise) et retourne les 5 impacts (GWP, Eau, ADPe, Énergie, PE), agrégés à trois niveaux : usage unitaire, annuel individuel, annuel entreprise.

L'extrapolation (jours ouvrés, facteur voiture, etc.) est calculée côté back, pas dans le front, pour que toute la logique métier soit couverte par les tests Python.

## Comparaisons concrètes (ImpactCO2)

Pour rendre le résultat GWP (CO2) parlant, on affiche des équivalences concrètes (ex. "= X km en voiture", "= Y burgers") à partir des données ouvertes d'[ImpactCO2](https://impactco2.fr/) (ADEME, [repo MIT](https://github.com/incubateur-ademe/impactco2)).

- Composant React maison (pas d'embed du widget `<script>` tiers) : cohérent avec le design system du projet (skill `frontend-design`), pas de dépendance runtime à un domaine externe, pas de poids JS ajouté par un tiers (cohérent avec l'esprit écoconception du projet).
- Données d'équivalences (liste "equivalents.csv" ou API publique ImpactCO2) importées et versionnées dans le repo (`frontend/src/data/co2-equivalents.json` ou équivalent back), avec une procédure de mise à jour manuelle documentée (pas de fetch runtime vers impactco2.fr).
- Périmètre : uniquement pour l'impact **GWP**. Les impacts Eau, ADPe, Énergie, PE n'ont pas d'équivalent ImpactCO2 et restent affichés sous forme de valeur brute + unité en V1.
- Sélection des comparaisons affichées : un sous-ensemble pertinent et sobre (2-3 équivalences), pas la liste exhaustive des 250+ équivalents.

## Gestion des erreurs

- **Validation d'entrée** : schémas Pydantic sur `POST /api/calculate` (provider/model doivent exister dans le catalogue EcoLogits, tokens/requêtes positifs) → `422` avec message clair si invalide.
- **Modèle non supporté par EcoLogits** : `404` explicite, message indiquant que le modèle n'est pas (encore) dans le référentiel.
- **Erreurs EcoLogits internes** (ex. données manquantes pour un provider) : `502` avec message générique, loggé côté back.
- **Front** : message d'erreur localisé (FR/EN) affiché à la place du résultat, sans casser le reste du formulaire.

## i18n

- **Back** : neutre, ne retourne que des données brutes (nombres, clés d'identification provider/modèle) — pas de texte traduit, pas d'i18n côté back.
- **Front** : `react-i18next`, fichiers de traduction `fr.json` / `en.json` par domaine (calculateur, méthodologie, à propos, mentions légales). Détection de la langue du navigateur au premier chargement, puis sélecteur manuel persisté en `localStorage`.
- Les 3 pages de contenu (Méthodologie, À propos, Mentions légales) sont des pages statiques du SPA, texte géré via les fichiers de traduction (pas de CMS en V1).

## Structure de projet

```
ai-calculator/
├── backend/
│   ├── src/ai_calculator/
│   │   ├── api/            # routes FastAPI (providers, calculate)
│   │   ├── domain/         # logique métier pure (extrapolation, agrégation)
│   │   └── schemas/        # modèles Pydantic
│   ├── tests/
│   │   ├── unit/           # logique domain (extrapolation, calcul) — cœur du TDD
│   │   └── integration/    # tests API (TestClient FastAPI)
│   └── pyproject.toml      # dépendances en dernières versions stables (fastapi, ecologits, pytest, ...)
├── frontend/
│   ├── src/
│   │   ├── pages/           # Calculateur, Méthodologie, À propos, Mentions légales
│   │   ├── components/
│   │   └── i18n/            # fr.json, en.json
│   ├── tests/                # tests de composants clés (Vitest + Testing Library)
│   └── package.json          # dépendances en dernières versions stables (react, vite, ...)
├── .superpowers/specs/
├── AGENTS.md / CLAUDE.md
└── README.md
```

## Tests (TDD)

- **Back** : pour chaque règle métier (calcul unitaire, extrapolation individuelle, extrapolation entreprise), un test est écrit et vérifié rouge avant l'implémentation. Tests unitaires sur `domain/`, tests d'intégration sur l'API via `TestClient` FastAPI.
- **Front** : tests de composants clés (formulaire de calcul, affichage des résultats) écrits avant l'implémentation, via Vitest + Testing Library.

## Dépendances

Toutes les dépendances (back et front) sont installées dans leur dernière version stable disponible au moment de l'implémentation, vérifiée explicitement plutôt que supposée depuis les données d'entraînement.
