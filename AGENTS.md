# AGENTS.md

Instructions spécifiques au projet **ai-calculator**. Ce fichier complète (sans les remplacer) les instructions globales de l'utilisateur.

## Projet

Web application permettant d'évaluer les impacts environnementaux de cas d'usages de l'IA Générative. Réécriture en vraie application front/back du POC https://ia-calculator.greenit.eco/ (actuellement une page unique tout-en-un).

Voir [README.md](README.md) pour le cahier des charges complet.

## Conventions

- Tous les fichiers générés par le framework **superpowers** doivent être créés dans `.superpowers/`, jamais à la racine ni ailleurs. Cela inclut notamment les specs de design (`.superpowers/specs/`), même si le skill `brainstorming` propose par défaut `docs/superpowers/specs/`.
- Le back s'appuie sur la librairie Python [EcoLogits](https://github.com/genai-impact/ecologits) (mlco2/genai-impact) pour convertir un nombre de tokens en impacts (GWP, Eau, ADPe, Énergie, PE).
- Toute la logique métier (calcul des impacts, extrapolation annuelle, totaux, répartition, équivalences CO2) vit côté back, exposée par `POST /api/calculate`. Le front ne fait que l'interface et l'affichage : ne pas y réintroduire de calcul d'impact.
- Pour l'ergonomie du front, s'appuyer sur le skill Claude Code `frontend-design`.
- Écoconception (skills GreenIT) : appliquer `ecodesign` dès qu'on définit une fonctionnalité, un parcours, un modèle de données ou une dépendance, et `ecocode` à toute écriture ou modification de code front, back, build ou configuration (cache, nginx, Docker). Lancer `audit-ecoconception` avant chaque release (merge de `develop` sur `main`) et après toute évolution notable de l'interface.
- Chaque changeset écrit avec un assistant IA se termine par une ligne indiquant les tokens consommés et le ou les modèles utilisés pour ce changement. Avec Claude Code, la générer avec `scripts/claude-usage.py --since <début du travail> [--until <fin>]` : le début est l'heure de la demande qui a lancé le changement. Elle est à recalculer si le travail se poursuit avant le commit.
- Le front doit être bilingue (FR/EN).
- Se référer au projet [ai-footprint](https://github.com/hrenaud/ai-footprint) pour le mécanisme de résolution de modèles via Hugging Face (référentiel de modèles enrichi).
- On ne travaille jamais directement sur `main`. Chaque changement part d'une branche `feat/*` (fonctionnalité) ou `fix/*` (correctif), mergée sur `develop` pour y être testée, puis `develop` est mergée sur `main` via une pull request. C'est ce merge sur `main` qui déclenche le processus de release (voir `docs/DEVELOPMENT.md`).

## Pages requises

- Calculateur (page principale)
- Méthodologie
- À propos
- Mentions légales
