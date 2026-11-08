# Changelog

## 0.2.1

### Patch Changes

- a4d13f6: Correction de la mise en page du calculateur : le bloc "Pour l'entreprise et par an" s'affiche désormais directement sous le champ "Nombre de salariés" (section 3), au lieu d'une colonne séparée à côté.

## 0.2.0

### Minor Changes

- e6763ef: Ajout d'une stack Docker Compose de production (`docker-compose.yml`, `Dockerfile.prod` back/front, proxy Nginx) : un seul point d'entrée HTTP exposé, le backend n'est plus jamais accessible directement depuis le navigateur. L'ancien `docker-compose.yml` de développement devient `docker-compose.dev.yml`. Voir `docs/PRODUCTION.md`.

### Patch Changes

- ae4033d: Fix critique prod : `frontend/.env` (contenant `VITE_API_BASE_URL=http://localhost:8000`) était commité dans le dépôt, ce qui figeait cette URL locale dans le build de production du front (`docker-compose.yml`), rendant le chargement du catalogue de cas d'usage impossible pour les visiteurs. Le fichier est retiré du suivi git et désormais exclu du contexte de build Docker (`frontend/.dockerignore`).

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Non publié]

### Ajouté

- Processus de release automatisé avec [Changesets](https://github.com/changesets/changesets) : version unique partagée entre `frontend/package.json` et `backend/pyproject.toml` (`package.json` racine + `scripts/sync-versions.mjs`), workflow `.github/workflows/release.yml` (PR « Version Packages » puis tag + GitHub Release via `scripts/create-release.mjs` au merge). **À partir de la prochaine version, `CHANGELOG.md` est généré par Changesets** (les entrées ci-dessous restent gérées manuellement) ; voir `docs/DEVELOPMENT.md` pour le détail du workflow (`npx changeset` à ajouter pour chaque changement notable).
- Convention de branches documentée (`AGENTS.md`, `docs/DEVELOPMENT.md`) : plus de travail direct sur `main`, branches `feat/*`/`fix/*` mergées sur `develop`, puis `develop` mergée sur `main` via PR pour déclencher la release.

- `docker-compose.yml` pour lancer le back et le front en local (hot-reload, dépendances isolées via volumes nommés).
- `backend/Dockerfile` et `frontend/Dockerfile` (images de développement, non adaptées à la production).
- `docs/DEVELOPMENT.md` : guide développeur/devops (démarrage Docker Compose ou manuel, variables d'environnement, tests, structure du dépôt, état des lieux CI/CD).
- Support CORS sur le back (`CORS_ALLOWED_ORIGINS`) pour autoriser les appels du front en développement, y compris depuis l'origine OrbStack (`https://frontend.ai-calculator.orb.local`).
- Port hôte du frontend variabilisable via `FRONTEND_PORT` dans `docker-compose.yml`.
- Lien vers `docs/DEVELOPMENT.md` dans le README.
- Habillage visuel du front (`frontend/src/index.css`) via le skill `frontend-design` : système de tokens couleur/typo (Fraunces pour les titres, Inter pour l'UI, IBM Plex Mono pour les valeurs numériques), palette vert forêt/ambre inspirée du végétal, mise en page carte/nav, et traitement signature des `RangeGauge` (dégradé vert→ambre→rouge avec segment actif en surbrillance). Complété par le CSS des composants du catalogue de cas d'usage (`.use-case-catalog`, `.use-case-card`, `.provider-chips`, `.provider-breakdown`), absent du premier passage.
- Calculateur refondu en catalogue de 8 cas d'usage (cascade fournisseur → profil, lecture seule si combinaison non supportée), configurable via `backend/src/ai_calculator/data/use_cases.yaml` (source unique, sans back-office) ; chips fournisseurs togglables et pictos par cas d'usage.
- Extension de l'affichage des impacts aux 5 indicateurs EcoLogits (GWP, Eau, ADPe, Énergie, PE) au lieu du seul CO2 du POC, sur les panneaux individuel/entreprise et la répartition par fournisseur.
- Nouvel endpoint `GET /api/use-cases` (additif, `GET /api/providers` et `POST /api/calculate` inchangés) servant le catalogue au chargement de la page.
- Tests end-to-end Playwright (`frontend/e2e/`) couvrant le parcours catalogue (bascule fournisseur, changement de profil/fréquence, mise à jour des totaux).
- Page calculateur restructurée en 3 sections numérotées reprenant la disposition du POC : (1) écosystème IA (fournisseurs, pleine largeur), (2) deux colonnes — cas d'usage à gauche, résultats individuels annuels + équivalences CO2 + répartition par fournisseur à droite, (3) deux colonnes — nombre de salariés à gauche, résultats entreprise annuels à droite.
- Colonne de résultats des sections à deux colonnes rendue collante (`position: sticky`) pour rester visible pendant le défilement de la colonne principale (cartes de cas d'usage plus longues que les résultats).

### Corrigé

- Le détail des impacts (`UseCaseCard`, panneau "Voir/Masquer le détail") reflète désormais la fréquence par jour de la carte au lieu de toujours afficher l'impact d'une seule action.
- Les jauges (`RangeGauge`) dans les panneaux de détail des cartes de cas d'usage étaient inutilisables : la colonne de libellé (`minmax(140px, 220px)`) écrasait la piste de la jauge à moins de 5px sur une carte étroite. Réduction de la colonne de libellé (`minmax(90px, 140px)`) et piste garantie à `minmax(60px, 1fr)`.
- Pour les cas d'usage Génération de vidéos/Génération d'images, les indicateurs Énergie, Énergie primaire et Eau ne sont pas mesurés par EcoLogits (seuls GWP et ADPe le sont) : ils affichaient à tort `0.0` au lieu d'être signalés comme non mesurés. Les critères non mesurés sont désormais représentés par `null` de bout en bout (YAML `use_cases.yaml` → dataclasses backend → schéma Pydantic → JSON → type TypeScript `Impacts`) et affichés comme "Non disponible" / "Not available" à la place de la jauge, dans le détail de chaque carte comme dans les totaux individuel/entreprise et la répartition par fournisseur.
- `sumImpacts` (`frontend/src/domain/aggregate.ts`) propageait `null` dès qu'un seul cas d'usage agrégé avait un critère non mesuré, masquant à tort en "Non disponible" les totaux "Par personne et par an" / "Pour l'entreprise et par an" et la répartition par fournisseur alors que d'autres cas d'usage disposaient bien de cette donnée. Un critère `null` est désormais traité comme une contribution nulle (0) tant qu'au moins un des cas d'usage agrégés le mesure ; il ne reste `null` que si aucun ne le mesure.
- Les valeurs d'impacts pouvaient s'afficher en notation scientifique (ex. `1.00e-8`) ou dans une unité peu lisible (ex. `0.001 kgCO2eq`) selon les ordres de grandeur. Nouveau module `frontend/src/domain/units.ts` (`formatNumber`/`scaleRange`) : formatage systématiquement en notation décimale (jamais scientifique), et unité affichée choisie automatiquement dans une échelle par critère (ex. GWP : mgCO2eq/gCO2eq/kgCO2eq/tCO2eq ; ADPe : mgSbeq/gSbeq/kgSbeq/tSbeq ; Énergie : Wh/kWh/MWh/GWh ; Énergie primaire : J/kJ/MJ/GJ/TJ ; Eau : mL/L/m³/ML), avec la même unité pour les bornes min et max d'une fourchette. Appliqué aux jauges (`RangeGauge`) et à la répartition par fournisseur (`CalculatorPage`).

## [0.1.0] - 2026-07-13

### Ajouté

- Calculateur d'impacts IA : formulaire de saisie, appel API, affichage des résultats en fourchettes min-max (`RangeGauge`).
- Comparaisons ImpactCO2 (composant `Co2Equivalents`, GWP uniquement).
- Extrapolation annuelle individuelle et entreprise.
- API back FastAPI : endpoints `GET /api/providers` et `POST /api/calculate`, adossés à EcoLogits.
- Front React/Vite bilingue FR/EN (react-i18next), routage et pages statiques (Méthodologie, À propos, Mentions légales).
- Scaffolding initial back (uv, EcoLogits) et front (Vite/React/TS).

[Non publié]: https://github.com/cnumr/ai-calculator/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cnumr/ai-calculator/releases/tag/v0.1.0
