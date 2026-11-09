# Changelog

## 0.4.0

### Minor Changes

- 89a13e9: La logique métier du calculateur passe côté backend : nouvel endpoint `POST /api/calculate`.

  - **Un seul calcul de scénario** : il reçoit tous les usages quotidiens et le nombre de salariés, et renvoie l'impact de chaque usage (par action, par jour et par an), les totaux annuels individuel et entreprise, la répartition par fournisseur et les équivalences CO2.
  - **Paramètres typés par type de cas d'usage** : les usages sont distingués par `kind` (`text`, `video`, `image`), chacun n'acceptant que ses propres paramètres, vérifiés contre les options du modèle. Un scénario invalide reçoit une erreur `422` avec un message explicite.
  - **Catalogue allégé** : `GET /api/use-cases` ne décrit plus que les choix possibles (de 59 à 11,5 Ko) et indique le `kind` de chaque cas d'usage ; les impacts EcoLogits sont calculés à la demande, avec un cache.
  - **Équivalences CO2** : les facteurs ImpactCO2 sont désormais gérés par le backend.
  - **Frontend** : il envoie le scénario 150 ms après le dernier changement, annule les requêtes dépassées et n'applique que la dernière réponse ; les valeurs en attente de mise à jour sont atténuées, et un calcul en échec conserve le dernier résultat avec un bouton « Réessayer ». Les résultats sont inchangés.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 20,9 M tokens (dont 20,7 M relus en cache, 97 k générés)._

- 0c340d7: Nouvelle disposition des cartes, sources méthodologiques et hypothèses modifiables.

  - **Une ligne de sélection** : fournisseur (avec son logo), profil et fréquence quotidienne moyenne côte à côte ; résultats (émissions et eau) en dessous.
  - **Fréquence par défaut à 0** : aucun usage n'est compté tant que l'utilisateur n'a pas renseigné ses fréquences ; « Réinitialiser » y revient.
  - **Source méthodologique** : chaque carte indique la source de ses valeurs, par exemple « Source : EcoLogits 0.11.3, modélisation de l'inférence des LLM », avec un lien vers la méthodologie EcoLogits ; la génération d'images garde sa mention « valeur indicative, sans source publiée ». `GET /api/use-cases` expose une `source` par cas d'usage (identifiant, version d'EcoLogits installée, lien).
  - **Tokens modifiables** : pour les cas d'usage texte, le menu « Personnaliser » affiche le nombre de tokens générés par action (valeur du catalogue par défaut) et permet de le modifier ; `POST /api/calculate` accepte `parameters.output_tokens` (de 1 à 10 000 000).
  - **Logos des fournisseurs** : également affichés dans la répartition par fournisseur.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 26,6 M tokens (dont 25,9 M relus en cache, 59 k générés) ; Claude Haiku 5.5 : ≈ 50 k tokens (dont 13 k relus en cache, 2 k générés)._

- 3952ed2: Ajout d'un pied de page sur toutes les pages : version du site, lien vers l'association GreenIT.fr, lien vers le code source sur GitHub, sources de données avec leur version (EcoLogits 0.11.3, ImpactCO2 relevé du 8 nov. 2026) et rappel des liens Méthodologie, À propos et Mentions légales.

  - Les versions sont lues dans ce qui est réellement utilisé (version du site au build, version d'EcoLogits installée, date de relevé d'ImpactCO2) : elles restent à jour sans maintenance. `GET /api/use-cases` expose ces `data_sources`.
  - Le catalogue est désormais chargé une seule fois pour tout le site, et partagé entre le calculateur et le pied de page : revenir sur le calculateur ne le recharge plus.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 15,3 M tokens (dont 14,5 M relus en cache, 26 k générés)._

- 3ac6f44: Données sourcées et formatage localisé.

  - **Génération de vidéos** : calculée par EcoLogits (Veo 3, 720p, 8 s, avec audio par défaut) au lieu d'une valeur fixe sans source héritée du POC ; les cinq indicateurs sont désormais disponibles.
  - **Génération d'images** : EcoLogits ne la modélise pas ; les valeurs du POC sont conservées et signalées sur la carte comme indicatives, sans source publiée à ce jour.
  - **Équivalences CO2** : facteurs exacts d'ImpactCO2 (ADEME) pour le streaming vidéo, le smartphone et la voiture thermique, avec gestion des pluriels.
  - **Formatage des nombres** : séparateurs décimaux et de milliers selon la langue choisie (`22,0` en français, `22.0` en anglais).
  - **Unités** : espacées (`g CO2eq`, `mg Sbeq`).

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 13,8 M tokens (dont 13,4 M relus en cache, 48 k générés) ; Claude Haiku 5.5 : ≈ 412 k tokens (dont 258 k relus en cache, 20 k générés)._

- eb28e22: Lisibilité du calculateur.

  - **Largeur** : le contenu du site passe de 960 à 1280 px.
  - **Modèles affichés** : chaque profil indique son modèle, par exemple « Éco (GPT-4o mini) » ; le catalogue gagne une table `model_labels`.
  - **Menu « Personnaliser »** : les réglages d'un cas d'usage sont regroupés dans un menu repliable dont le titre rappelle les valeurs en cours (« Personnaliser : 720p · 8 s · Avec audio »).
  - **Libellé** : le profil « Recherche approfondie » devient « Recherche », le nom du modèle le précisant déjà.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 15,7 M tokens (dont 15,6 M relus en cache, 48 k générés)._

- 087d8b0: Paramètres propres au modèle pour la génération de vidéos.

  - **Réglages** : résolution, durée et audio, avec les options réellement acceptées par chaque modèle selon EcoLogits (aucun modèle EcoLogits ne gère la 4K).
  - **Modèles** : profils Google « Standard » (Veo 3) et « Rapide » (Veo 3 Fast), et OpenAI (Sora 2 Pro).
  - **Validation** : un modèle inconnu ou une valeur par défaut non supportée dans `use_cases.yaml` empêche le backend de démarrer.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 7,9 M tokens (dont 7,8 M relus en cache, 37 k générés)._

### Patch Changes

- 9b8dbe6: Écoconception : en-têtes de cache navigateur en production (bonne pratique GreenIT RWEB_0075). Le JavaScript et le CSS du build, dont le nom change à chaque version, sont gardés un an par le navigateur sans être revérifiés (`immutable`) : une visite suivante ne les retélécharge plus. La page `index.html` est revérifiée à chaque visite (`no-cache`, réponse 304 sans contenu si elle n'a pas changé), pour qu'une nouvelle version soit prise en compte immédiatement. Le script `scripts/verify-cache.sh` permet de le vérifier sur la stack lancée.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 1,0 M tokens (dont 1,0 M relus en cache, 8 k générés)._

- 4e4e3be: Correction des totaux annuels du calculateur : « Réinitialiser » ne les remet plus à zéro, un cas d'usage qu'aucun fournisseur sélectionné ne propose n'est plus compté, et la répartition par fournisseur attribue chaque carte au fournisseur qu'elle utilise réellement (y compris après un changement automatique de fournisseur).

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 3,4 M tokens (dont 3,3 M relus en cache, 31 k générés), analyse initiale du projet comprise._

- 5b66135: Écoconception : les fichiers texte sont désormais servis compressés en production (bonne pratique GreenIT RWEB_0076). Le JavaScript, le CSS, le HTML et le SVG sont précompressés une seule fois au build et servis tels quels par nginx ; les réponses JSON de l'API sont compressées à la volée. Au premier chargement du calculateur, le poids transféré passe de 354 à 107 Ko (JavaScript 318 → 99 Ko, CSS 14,6 → 3,2 Ko, catalogue de l'API 17,7 → 1,2 Ko). Le script `scripts/verify-compression.sh` permet de le vérifier sur la stack lancée.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 10,3 M tokens (dont 10,3 M relus en cache, 13 k générés)._

- 989b226: Écoconception : le contenu des panneaux repliés n'est plus rendu tant qu'on ne les ouvre pas (bonne pratique GreenIT RWEB_0046). Cela concerne le détail des impacts et le menu « Personnaliser » de chaque carte, ainsi que le détail de la répartition par fournisseur. Le calculateur passe de 1 211 à 583 nœuds DOM au chargement, et son EcoIndex de 55 (C) à 71 (B).

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 11,5 M tokens (dont 11,5 M relus en cache, 14 k générés)._

## 0.3.1

### Patch Changes

- 82e5a91: Correction de la stack Docker Compose de production : les services `backend` et `frontend` ont `restart: unless-stopped`, ils repartent automatiquement après un redémarrage du serveur ou du démon Docker. Voir `docs/PRODUCTION.md`.
- 53a96f2: Met à jour la librairie `ecologits` en 0.11.3 et remplace les modèles retirés du catalogue (Claude Opus 4.0, Gemini 2.0 Flash et Flash-Lite) par leurs équivalents de palier.

## 0.3.0

### Minor Changes

- 0b8fc5d: Add configurable use-case cards with EcoLogits impact summaries, annual context, provider shares, reset controls, and ImpactCO2-aligned equivalences.
- 22edf28: Remove the legacy `POST /api/calculate` endpoint and its duplicate extrapolation logic: the calculator aggregates impacts on the frontend from `GET /api/use-cases`.

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

### Supprimé

- Endpoint `POST /api/calculate` et son module d'extrapolation (`domain/extrapolation.py`) : la page calculateur agrège déjà les impacts côté front à partir de `GET /api/use-cases`, ce qui supprime une seconde implémentation de la même logique (et l'écart de 218/220 jours ouvrés entre les deux). Le calcul libre par l'API n'est plus disponible.
- Fonction `calculate()` du client front (`frontend/src/api/client.ts`), devenue inutilisée.

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
