# Détails des cartes de cas d'usage : « Configurer » et « Voir plus » — Design

Statut : validé (17/11/2026). Branche : `feat/improve-usecase-ux-dhe` (depuis `develop`). Issue : cnumr/ai-calculator#40.

Fait suite à `2026-11-08-use-case-card-ux-design.md` (ligne compacte de la carte, bouton « Réglages »).

## Contexte

Chaque carte de cas d'usage est une ligne compacte : icône, titre, rappel des choix (fournisseur · profil, puis paramètres comme les tokens générés), fréquence, impacts GES et eau, et un unique bouton « Réglages ». Ce bouton déplie un panneau qui mélange deux besoins différents :

1. **Configurer le calcul** : fournisseur, profil (modèle), paramètres personnalisables (tokens générés, résolution, durée, audio…).
2. **Comprendre le résultat** : détail des cinq critères par jour ouvré (GES, énergie, ADPe, EP, eau) en jauges min/max, et note sur la source des données.

Le libellé « Réglages », placé à côté des impacts, ne dit pas qu'il donne aussi accès au détail des impacts, et l'utilisateur qui veut seulement changer de modèle doit déplier tout le détail.

## Demande

Remplacer le bouton unique par deux points d'entrée, chacun placé à côté de ce qu'il concerne :

- **« Configurer »**, à côté du rappel modèle / nombre de tokens : fournisseur, profil (modèle) et paramètres configurables éventuels.
- **« Voir plus »**, à côté des impacts GES et eau, à la place de « Réglages » : détail des impacts par jour ouvré.

## Disposition

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [ic] Rédiger un e-mail court                [ 1 ] /jour  ☁ 2,1 g  Voir ▾ │
│      Mistral · Éco (Mistral Small)  ⚙ Configurer          💧 18 mL  plus │
│      300 tokens générés                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│  Panneau « Configurer »                                                  │
│  Pour rédiger un e-mail de quelques lignes          (sous-titre)         │
│  FOURNISSEUR [Mistral ▾]   PROFIL [Éco (Mistral Small) ▾]                │
│  PERSONNALISATION  Tokens générés [ 300 ]                                │
└──────────────────────────────────────────────────────────────────────────┘
ou
├──────────────────────────────────────────────────────────────────────────┤
│  Panneau « Voir plus »                                                   │
│  DÉTAIL DES IMPACTS PAR JOUR OUVRÉ                                       │
│  ☁ GES  ▬▬▬▬▬▬▬▬  /  ⚡ Énergie  ▬▬▬▬  /  ADPe / EP / 💧 Eau            │
│  ⓘ Source des données…                                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Bouton « Configurer »

- Dans l'en-tête de la carte, à la suite du rappel fournisseur · profil (`use-case-card__meta`), en bouton discret (texte + icône d'engrenage SVG inline, couleur `--forest`) pour ne pas alourdir la ligne.
- Le rappel des choix reste affiché : il dit ce qui est configuré, le bouton permet de le changer.
- Ouvre un panneau sous la ligne avec, dans l'ordre : sous-titre du cas d'usage, sélecteurs fournisseur et profil côte à côte, section « Personnalisation » si le profil a des paramètres. Contenu et comportement des champs inchangés (conservation du profil au changement de fournisseur, champ libre pour les tokens, etc.).
- Absent quand le cas d'usage n'est pas pris en charge par les fournisseurs retenus (`!supported`) : le rappel affiche déjà « non pris en charge » et il n'y a rien à configurer.

### Bouton « Voir plus »

- Prend la place de « Réglages » dans la colonne `toggle` de la grille (même style, même chevron qui pivote à l'ouverture).
- Libellé « Voir plus » replié, « Voir moins » déplié (« See more » / « See less »).
- Ouvre un panneau sous la ligne avec la section « Détail des impacts par jour ouvré » (jauges des cinq critères) et la note de source. Contenu inchangé.
- Absent quand le cas d'usage n'est pas pris en charge (aucun impact à détailler). La colonne garde sa largeur pour que les lignes restent alignées.

### Un seul panneau ouvert à la fois

L'état local de la carte passe de `open: boolean` à `panel: "configure" | "details" | null`. Ouvrir l'un ferme l'autre ; recliquer sur le bouton actif referme. Cela garde la carte compacte et évite deux panneaux empilés dont l'ordre serait arbitraire.

Conséquence : après avoir changé de modèle dans « Configurer », l'utilisateur voit déjà l'effet sur GES et eau dans la ligne ; il ouvre « Voir plus » s'il veut le détail.

### Mobile (≤ 640 px)

- Grille actuelle conservée : `"header header header" / "frequency summary toggle"`.
- « Configurer » reste dans l'en-tête, sous le rappel des choix si la largeur manque ; son texte peut se réduire à l'icône (le nom accessible reste complet).
- « Voir plus » : le texte est masqué comme aujourd'hui pour « Réglages », seul le chevron reste visible.

## Accessibilité

- Deux `<button type="button">` avec `aria-expanded` et `aria-controls` (renseigné seulement quand le panneau existe, comme aujourd'hui).
- Noms accessibles distincts et explicites hors contexte : « Configurer : <titre du cas d'usage> », « Voir plus : <titre> » (suffixe masqué visuellement, comme l'actuel `settingsToggle`).
- Identifiants de panneaux distincts : `use-case-<id>-configure` et `use-case-<id>-details`.
- Ordre de tabulation : Configurer (en-tête) → fréquence → unité → Voir plus, conforme à l'ordre visuel.
- Icône d'engrenage `aria-hidden="true"`.

## Écoconception

- Pas de nouvelle requête, pas de dépendance, pas de changement d'API : uniquement du front.
- Rendu paresseux conservé (RWEB_0046) : chaque panneau n'est ajouté au DOM que lorsqu'il est ouvert ; un seul panneau à la fois limite encore le DOM.
- Icône d'engrenage en SVG inline (pas de requête image, pas de police d'icônes).
- Pas de calcul côté front : les impacts affichés restent ceux de `POST /api/calculate` (cf. `AGENTS.md`).

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `frontend/src/components/UseCaseCard.tsx` | État `panel`, deux boutons, contenu du panneau actuel scindé en deux. |
| `frontend/src/index.css` | Style du bouton « Configurer » dans l'en-tête ; `use-case-card--open` remplacé par `--configure-open` / `--details-open` si besoin pour le chevron. |
| `frontend/src/i18n/fr.json`, `en.json` | Suppression de `settingsToggle` ; ajout de `configureToggle` (« Configurer » / « Configure »), `detailsToggle` (« Voir plus » / « See more »), `detailsToggleOpen` (« Voir moins » / « See less »). |
| `frontend/tests/UseCaseCard.test.tsx` | Tests du bouton « Réglages » remplacés par ceux des deux boutons. |
| `frontend/tests/CalculatorPage.test.tsx` | Helper `openSettings` remplacé par `openConfigure` (sélecteurs, paramètres vidéo) et `openDetails` (jauges) selon le test. |

Backend, API et méthodologie : inchangés.

## Tests

- « Configurer » ouvre le panneau avec fournisseur, profil et paramètres ; il ne contient pas les jauges.
- « Voir plus » ouvre le panneau avec les jauges et la note de source ; il ne contient pas les sélecteurs.
- Ouvrir l'un ferme l'autre ; recliquer referme ; `aria-expanded` suit l'état.
- Le libellé passe de « Voir plus » à « Voir moins ».
- Cas non pris en charge : aucun des deux boutons.
- Panneaux absents du DOM tant qu'ils sont fermés.
- Les deux langues (FR/EN).

## Décisions (17/11/2026)

1. **Panneaux exclusifs** : un seul panneau ouvert à la fois par carte.
2. **Sous-titre du cas d'usage** dans « Configurer » : il décrit l'action dont on règle les hypothèses.
3. **Libellé alterné** : « Voir plus » replié, « Voir moins » déplié.

## Avant release

Lancer `audit-ecoconception` après implémentation (évolution notable de l'interface), puis vérification visuelle desktop et mobile dans les deux langues.
