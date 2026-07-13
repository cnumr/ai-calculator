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
- **Front** : SPA React + Vite, consommant l'API back en JSON. Stateless (aucune base de données en V1).
- **Back** : API FastAPI stateless, dernières versions stables des librairies.

## Pages

- Calculateur (page principale)
- Méthodologie
- À propos
- Mentions légales

## Périmètre V1

- Calculateur reprenant le concept du POC : usage quotidien par modèle/fournisseur + extrapolation annuelle individuelle et entreprise.
- Modèles disponibles = ceux nativement supportés par EcoLogits (pas de référentiel enrichi custom).
- Pas de persistance : chaque calcul est stateless.
- Front bilingue FR/EN via sélecteur de langue en session (pas de routes préfixées par langue).

## Périmètre V2 (hors scope V1, à brainstormer séparément)

- **Référentiel de modèles enrichi via Hugging Face** : aller chercher sur Hugging Face les caractéristiques nécessaires (nombre de paramètres, architecture, etc.) pour construire nos propres fiches modèles et compléter/enrichir celles fournies nativement par EcoLogits, sur le principe utilisé dans le projet [ai-footprint](https://github.com/hrenaud/ai-footprint) (résolution de modèles tiers/locaux non reconnus).
- Ce référentiel sera un sous-projet à part entière (spec dédiée), consommé ensuite par le back du calculateur.

## Statut

Projet en phase de cadrage / brainstorm.
