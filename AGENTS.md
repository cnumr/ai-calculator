# AGENTS.md

Instructions spécifiques au projet **ai-calculator**. Ce fichier complète (sans les remplacer) les instructions globales de l'utilisateur.

## Projet

Web application permettant d'évaluer les impacts environnementaux de cas d'usages de l'IA Générative. Réécriture en vraie application front/back du POC https://ia-calculator.greenit.eco/ (actuellement une page unique tout-en-un).

Voir [README.md](README.md) pour le cahier des charges complet.

## Conventions

- Tous les fichiers générés par le framework **superpowers** doivent être créés dans `.superpowers/`, jamais à la racine ni ailleurs.
- Le back s'appuie sur la librairie Python [EcoLogits](https://github.com/genai-impact/ecologits) (mlco2/genai-impact) pour convertir un nombre de tokens en impacts (GWP, Eau, ADPe, Énergie, PE).
- Pour l'ergonomie du front, s'appuyer sur le skill Claude Code `frontend-design`.
- Le front doit être bilingue (FR/EN).
- Se référer au projet [ai-footprint](https://github.com/hrenaud/ai-footprint) pour le mécanisme de résolution de modèles via Hugging Face (référentiel de modèles enrichi).

## Pages requises

- Calculateur (page principale)
- Méthodologie
- À propos
- Mentions légales
