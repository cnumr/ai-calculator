# Refonte UX des cartes de cas d'usage — Design

Statut : implémenté. Branche : `feat/ux-layout-dhe` (depuis `feat/video-parameters-dhe`).

Reprend les demandes « Interface » du spec POC V2 (§ 3.1 à 3.3), avec le POC V1 comme référence visuelle (fréquence « 0 /j » en haut à droite de la carte).

## Demandes

1. Largeur utile du site : 960 px → 1280 px.
2. Profil : afficher entre parenthèses le ou les modèles associés quand ils sont connus (« Éco (GPT-4o mini) »).
3. Fournisseur et profil côte à côte, sur la même ligne.
4. Fréquence par jour en haut à droite de la carte, comme dans le POC V1.
5. Revoir la place des émissions et de l'eau par usage en conséquence.
6. Paramètres de personnalisation (résolution, durée, audio) dans un menu dépliant, comme « Voir/Masquer le détail ».

## Modèles affichés (back)

Le nom des modèles est une donnée du catalogue, pas une traduction : il est porté par le back.

- `use_cases.yaml` gagne une table `model_labels` (identifiant EcoLogits → nom affiché), déclarée une seule fois : `gpt-4o-mini: GPT-4o mini`, `google/veo-3.0: Veo 3`…
- Chaque profil expose `models` : le nom affiché de son modèle (`ecologits_model` pour le texte, `ecologits_video.model` pour la vidéo, champ facultatif `model` pour les profils statiques, ex. image).
- Un modèle utilisé sans libellé dans `model_labels` est refusé au démarrage, pour que tout modèle affiché ait un nom lisible.
- API : `models: list[str]` sur chaque profil (liste vide si inconnu).

Limite : pour Microsoft Copilot, le modèle est l'hypothèse du catalogue (ex. GPT-4o mini pour « Éco »), comme dans le POC V1 (« ≈ GPT-4o mini »).

## Disposition de la carte (front)

```
┌────────────────────────────────────────────────────────────────┐
│ [icône] Titre                                       [ 1 ] /j   │
│         Sous-titre                                             │
│                                                                │
│ FOURNISSEUR        PROFIL                     ☁ 17,6 g CO2eq   │
│ [Google      ▾]    [Standard (Veo 3) ▾]       💧 140 mL        │
│ Pour générer une vidéo                        ⓘ note éventuelle │
│                                                                │
│ ▸ Personnaliser : 720p · 8 s · Avec audio   (si paramètres)    │
│ ▸ Voir/Masquer le détail de vos impacts pour cette tâche       │
└────────────────────────────────────────────────────────────────┘
```

- En-tête : titre à gauche, fréquence à droite. Le libellé « Fréquence par jour » reste le nom accessible du champ (masqué visuellement), le suffixe « /j » (« /day ») est affiché.
- Ligne principale : fournisseur et profil côte à côte, impacts (GES, eau) alignés à droite.
- « Personnaliser » : `<details>` replié par défaut, dont le résumé rappelle les valeurs en cours, pour qu'elles restent visibles sans ouvrir le menu.
- Mobile (≤ 640 px) : fournisseur et profil restent côte à côte si la place le permet, les impacts passent sous les sélecteurs.
- Les noms accessibles des champs sont inchangés.

## Ajustements après vérification visuelle

- Colonne des impacts de largeur fixe (12 rem) : la note de source de l'image passe à la ligne au lieu d'écraser les sélecteurs.
- Fournisseur et profil en proportion 2/5 et 3/5 : les libellés de profil avec modèle sont les plus longs.
- Sélecteurs de la carte en police de texte (Inter) plutôt qu'en police à chasse fixe, plus étroite.
- Profil « Recherche approfondie » renommé « Recherche » (« Research ») : le nom du modèle, « o4-mini Deep Research », le précise déjà, et le libellé complet ne tenait pas.
- Mobile : fournisseur et profil s'empilent sous 480 px.

## Retours du 2026-11-08

- Fréquence : libellé visible « Fréquence quotidienne moyenne » (« Average daily frequency ») à gauche du champ, aligné à droite, sur deux lignes au plus (10,5 rem) ; unité « /jour » (« /day »). Sur écran étroit, le bloc passe sous le titre.
- L'indication sous fournisseur et profil (« Pour générer une vidéo »…) n'apportait rien : elle est remplacée par l'hypothèse de calcul des profils texte, « Hypothèse de calcul : 300 tokens générés par action ». Elle rend visible une donnée jusqu'ici cachée, que le spec V2 met en question (§ 1.3). L'API expose `output_tokens` (null pour la vidéo et l'image). Les clés `profileHint` sont supprimées.
