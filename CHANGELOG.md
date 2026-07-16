# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Non publié]

### Ajouté

- `docker-compose.yml` pour lancer le back et le front en local (hot-reload, dépendances isolées via volumes nommés).
- `backend/Dockerfile` et `frontend/Dockerfile` (images de développement, non adaptées à la production).
- `docs/DEVELOPMENT.md` : guide développeur/devops (démarrage Docker Compose ou manuel, variables d'environnement, tests, structure du dépôt, état des lieux CI/CD).
- Support CORS sur le back (`CORS_ALLOWED_ORIGINS`) pour autoriser les appels du front en développement.
- Port hôte du frontend variabilisable via `FRONTEND_PORT` dans `docker-compose.yml`.
- Lien vers `docs/DEVELOPMENT.md` dans le README.
- Habillage visuel du front (`frontend/src/index.css`) via le skill `frontend-design` : système de tokens couleur/typo (Fraunces pour les titres, Inter pour l'UI, IBM Plex Mono pour les valeurs numériques), palette vert forêt/ambre inspirée du végétal, mise en page carte/nav, et traitement signature des `RangeGauge` (dégradé vert→ambre→rouge avec segment actif en surbrillance).
- Calculateur refondu en catalogue de 8 cas d'usage (cascade fournisseur → profil, lecture seule si combinaison non supportée), configurable via `backend/src/ai_calculator/data/use_cases.yaml` (source unique, sans back-office) ; chips fournisseurs togglables et pictos par cas d'usage.
- Extension de l'affichage des impacts aux 5 indicateurs EcoLogits (GWP, Eau, ADPe, Énergie, PE) au lieu du seul CO2 du POC, sur les panneaux individuel/entreprise et la répartition par fournisseur.
- Nouvel endpoint `GET /api/use-cases` (additif, `GET /api/providers` et `POST /api/calculate` inchangés) servant le catalogue au chargement de la page.
- Tests end-to-end Playwright (`frontend/e2e/`) couvrant le parcours catalogue (bascule fournisseur, changement de profil/fréquence, mise à jour des totaux).

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
