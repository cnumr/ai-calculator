# AI Calculator

Web application permettant d'évaluer les impacts environnementaux de cas d'usages de l'IA Générative.

## Contexte

Un premier [POC](https://ia-calculator.greenit.eco/) a été réalisé sous forme de page unique (HTML/JS/données embarquées dans une seule page). L'objectif de ce projet est de transformer ce POC en une vraie web application, avec un back et un front séparés.

## Objectifs

- Permettre aux utilisateurs d'évaluer les impacts environnementaux de leurs usages de l'IA Générative.
- Revoir l'ergonomie du front par rapport au POC (voir [AGENTS.md](AGENTS.md) pour les conventions de développement).
- Rendre le front bilingue (FR/EN).

## Architecture

- **Back** : Python, s'appuyant sur la librairie [EcoLogits](https://github.com/genai-impact/ecologits) pour convertir un nombre de tokens en impacts environnementaux :
  - **GWP** : Gaz à effet de serre émis, en équivalent CO2.
  - **Eau** : Eau consommée pour refroidir les datacenters qui font tourner le modèle.
  - **ADPe** : Épuisement des ressources minérales rares utilisées pour fabriquer le matériel.
  - **Énergie** : Électricité consommée par les serveurs pour répondre à la requête.
  - **PE** : Énergie primaire nécessaire, en amont de la production d'électricité.
- **Back** : API FastAPI stateless, dernières versions stables des librairies. **Toute la logique métier est côté back** : calcul des impacts par action (EcoLogits pour le texte et la vidéo ; pour l'image, transposition depuis une vidéo EcoLogits de référence selon la méthodologie), extrapolation annuelle (218 jours ouvrés), totaux individuel et entreprise, répartition par fournisseur et équivalences CO2 (ImpactCO2, ADEME).
- **Front** : SPA React + Vite, consommant l'API back en JSON. Il gère l'interface (choix des fournisseurs, profils, fréquences et réglages) et l'affichage, sans calcul d'impact. Stateless (aucune base de données en V1).

### API

- `GET /api/use-cases` : catalogue des choix possibles (fournisseurs, cas d'usage et leur type `text` / `video` / `image`, familles, profils, modèles, paramètres réglables, source méthodologique) et sources de données utilisées avec leur version (EcoLogits, ImpactCO2). Source de vérité : `backend/src/ai_calculator/data/use_cases.yaml`.
- `POST /api/calculate` : calcul d'un scénario (usages quotidiens + nombre de salariés) → impacts par usage, totaux annuels, répartition par fournisseur, équivalences CO2. Les paramètres acceptés dépendent du type de cas d'usage (tokens générés pour le texte ; résolution, durée et audio pour la vidéo ; taille pour l'image).

La documentation interactive de l'API est servie par le back sur `/docs`.

## Pages

- Calculateur (page principale)
- Méthodologie
- À propos
- Mentions légales

## Périmètre V1

- Calculateur reprenant le concept du POC : usage quotidien par modèle/fournisseur + extrapolation annuelle individuelle et entreprise, avec des hypothèses de calcul réglables (tokens générés, paramètres vidéo).
- Modèles disponibles = ceux nativement supportés par EcoLogits (pas de référentiel enrichi custom).
- Pas de persistance : chaque calcul est stateless.
- Front bilingue FR/EN via sélecteur de langue en session (pas de routes préfixées par langue).

## Périmètre V2 (hors scope V1, à brainstormer séparément)

- **Référentiel de modèles enrichi via Hugging Face** : aller chercher sur Hugging Face les caractéristiques nécessaires (nombre de paramètres, architecture, etc.) pour construire nos propres fiches modèles et compléter/enrichir celles fournies nativement par EcoLogits, sur le principe utilisé dans le projet [ai-footprint](https://github.com/hrenaud/ai-footprint) (résolution de modèles tiers/locaux non reconnus).
- Ce référentiel sera un sous-projet à part entière (spec dédiée), consommé ensuite par le back du calculateur.

## Développement

Voir [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) pour lancer le projet (Docker Compose ou manuel), les tests, et les notes devops. Pour un déploiement en production, voir [docs/PRODUCTION.md](docs/PRODUCTION.md).

## Statut

V1 en développement : calculateur fonctionnel (12 cas d'usage, 5 fournisseurs), publié par versions successives. Voir [CHANGELOG.md](CHANGELOG.md) pour l'historique, et `.superpowers/specs/` pour les specs de design (dont les retours sur le POC V2).
