# Retours POC V2 (Brice) — spec de travail

Statut : brouillon à valider. Aucun code n'est modifié par ce document.

Sources : document « Feedback POC V2 - Brice » (mises à jour du 14 octobre et de septembre) ; POC V1 publié sur https://ia-calculator.greenit.eco (référence visuelle et de calcul).

## Périmètre

Trois chantiers, à traiter dans cet ordre :

1. **Données et calculs** : fiabilité des résultats (EcoLogits, modèles, tokens, vidéo, image).
2. **Use cases** : couverture et paramètres de chaque cas d'usage.
3. **Interface** : lisibilité, disposition et libellés.

Hors périmètre de cette spec : mentions légales et page « À propos » (texte à rédiger par l'équipe, non traité ici).

## 1. Données et calculs

### 1.2 Modèles épinglés (demande de Brice)

- Aujourd'hui les modèles sont codés en dur dans `backend/src/ai_calculator/data/use_cases.yaml`.
- Option A (recommandée pour démarrer) : un script de contrôle qui liste les modèles du YAML absents du catalogue EcoLogits installé, lancé à chaque montée de version. Simple, vérifiable.
- Option B : mise à jour automatique depuis l'API des fournisseurs. Plus lourd, à écarter tant que A n'est pas en place.

### 1.3 Tokens par use case

- Brice signale que les tokens ne correspondent ni à son POC initial ni à EcoLogits (ex. mail : 300 tokens chez nous, 250 chez EcoLogits).
- **À confirmer par l'équipe** : le nombre de tokens de chaque use case. Sans cette décision, les écarts entre notre calculateur et EcoLogits restent inexpliqués.

### 1.4 Écart avec l'interface EcoLogits

- Référence de Brice : mail de 250 tokens sur o4-mini → EcoLogits 8,89 mg CO2eq (8,23 à 9,54). Notre valeur ramenée à 250 tokens : 8,91 à 10,25 mg.
- Hypothèse à vérifier : l'écart vient de notre appel API, et non du modèle. À tester avec les mêmes entrées avant toute correction.

### 1.5 Vidéo : ce que change un paramètre

Constat (lecture du code EcoLogits 0.11.3, `estimations/video.py`) :

- Le calcul vidéo dépend de **trois** entrées : le modèle, la résolution et la durée. L'audio (`with_audio`) est aussi un paramètre.
- Les résolutions nommées sont `720p` (1280×720), `1080p` (1920×1080) et `4k` (3840×2160).
- Chaque modèle n'accepte que certaines résolutions et certaines durées de trame (`capabilities` dans `video_models.json`). Exemple : `klingai/kling-v1.6` n'accepte que 720p.
- Conséquence : une résolution plus haute ou une durée plus longue augmente l'impact. Ajouter une liste « 720p / 1080p / 4k » déplace donc directement les résultats.
- Aujourd'hui, la vidéo utilise des **impacts statiques** (`use_cases.yaml`, valeur fixe `gwp` 0,377061, unité à confirmer), pas le calcul EcoLogits. Brice demande de basculer vers EcoLogits.
- **Points à trancher** :
  - Durée de référence d'un cas vidéo (en secondes).
  - Modèle vidéo par défaut, et si la résolution choisie est compatible avec ce modèle.
  - Faut-il afficher l'audio comme paramètre.
  - Le POC V1 indique que ses valeurs image et vidéo incluent une estimation d'infrastructure plus large que l'inférence seule. Notre calcul doit-il l'inclure aussi, pour rester comparable ?

### 1.6 Image

- Paramètres demandés : 1024×1024 et 2048×2048.
- Brice demande aussi les données statiques issues de la méthodologie. À vérifier : la méthodologie fournit-elle une valeur par taille ? Sans cette valeur, la liste de paramètres ne change pas le résultat.

## 2. Use cases

Liste à ajouter ou à mettre à jour, d'après le doc :

| Use case | Action | Paramètre ou information |
|---|---|---|
| Assistance au développement | Ajouter | Session agentique de 2 jours |
| Génération de vidéos | Ajouter le paramètre | 720p, 1080p, 4k ; bascule vers EcoLogits |
| Génération d'images | Ajouter le paramètre | 1024×1024, 2048×2048 |
| Recherche approfondie | Mettre à jour | Synthèse de 5 pages ; tokens |
| Résumé de réunion | Mettre à jour | Synthèse de 1 à 2 pages ; tokens |
| Rédaction d'un document court | Mettre à jour | Synthèse de 2 pages ; tokens |
| Rédaction d'un document long | Mettre à jour | Synthèse de 5 pages ; tokens |
| Présentation automatique (Slides) | Mettre à jour | 8 à 12 slides, titres, puces, notes |
| Mail court | Ajouter | 100 à 250 mots |
| Mail long | Ajouter | 300 à 900 mots |
| Feuille de calcul | Ajouter | Tableau de 20 à 100 lignes |
| Question à un assistant | Mettre à jour | Réponse d'environ 200 mots ; tokens |
| Suggestion automatique | Retirer | Non pertinent dans l'interface |

Remarque : le POC V1 n'a pas ces use cases. Les libellés finaux sont à valider avec Brice.

## 3. Interface

### 3.1 Général

- Largeur : passer d'environ 900 px à au moins 1280 px.
- Espaces dans les unités : « g CO2eq », « mg CO2eq », etc.
- Titre de la section 1 : « Votre écosystème IA ».
- Page méthodologie : basculer vers le fichier `.md` dédié (demande de push à la racine).
- Numéro de version affiché dans le footer du produit. Demande de l'équipe, non remontée par Brice.

### 3.2 Paramètres

- Section 2 : paramètres à l'horizontale, comme le POC V1.
- Pas de libellé pour le fournisseur ni pour le modèle quand ils vont de soi ; afficher le modèle explicitement avec le profil.
- Fréquence d'utilisation en bout de ligne.
- Listes de paramètres vidéo et image (voir 1.5 et 1.6).

### 3.3 Résultats

- Afficher la **moyenne** en gros chiffre, comme EcoLogits, avec la fourchette min/max en secondaire.
- Par défaut : uniquement les GES. Les autres critères sont repliés.
- Profils : afficher le modèle directement. Une notion « léger / puissant » peut compléter, à valider.
- Maximiser le nombre de use cases visibles sur une même page.

## Ce qui est déjà fait

- Mise à jour EcoLogits 0.11.3 : PR #18 vers `develop`, 20/20 tests backend.
- Route de déploiement inchangée : `develop` puis `main`, après votre accord.

## Questions ouvertes

1. Tokens par use case : quelle source fait foi (POC initial, EcoLogits, ou nouvelle hypothèse) ?
2. Vidéo : durée de référence, modèle par défaut, audio, et inclusion de l'infrastructure.
3. Image : la méthodologie fournit-elle une valeur par taille ?
4. Écart API / EcoLogits : tester avant de corriger.

## Points à creuser et limites

À creuser :
- Tokens par use case : Brice demande de confirmer les nombres. Sans réponse, la question sur le cas « mail » reste ouverte.
- Mise à jour des modèles : Brice préfère un mécanisme via l'API, ou une revue manuelle régulière. Le spec retient l'option A, la B reste à valider avec lui.
- Méthodologie en `.md` : vérifier que la PR #12 (« Create METHODOLOGY.md ») couvre ce besoin avant de dupliquer.
- Feuille de calcul : le spec ne retient que « 20 à 100 lignes ». Les formules, contrôles et commentaires demandés par Brice ne sont pas pris en compte.
- Présentation (Slides) : 8 à 12 slides, mais aucun nombre de tokens.

Limites :
- Session agentique de 2 jours : EcoLogits ne modélise pas ce type de session. Il faut une méthode de calcul ou une hypothèse décidée par l'équipe.
- Vidéo 4k pour tous les modèles : chaque modèle n'accepte pas toutes les résolutions (kling-v1.6 : 720p seulement). L'interface doit proposer des options par modèle, ce que la config YAML ne permet pas aujourd'hui.
- Valeurs image par taille : si la méthodologie ne donne pas de valeur par taille, la liste 1024×1024 / 2048×2048 ne change pas le résultat.
- Écart avec l'interface EcoLogits : peut venir de notre appel API, non vérifié. À tester avec des entrées identiques avant toute correction.
- Mentions légales et « À propos » : texte à rédiger par l'équipe, hors périmètre.

## Tests attendus

- Un test vérifie que chaque modèle du YAML existe dans le catalogue EcoLogits installé (préventif pour 1.2).
- Pour la vidéo et l'image : un test par résolution, avec une valeur de référence calculée par EcoLogits.
- Pour l'interface : tests de la moyenne et du repli des critères, selon le modèle de `UseCaseCard`.
