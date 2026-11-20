# Détails des cartes de cas d'usage : « Configurer » et « Voir plus » — Design

Statut : validé (17/11/2026), implémenté. Branche : `feat/improve-usecase-ux-dhe` (depuis `develop`). Issue : cnumr/ai-calculator#40.

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

Retours du 17/11/2026 sur une première version, avec deux boutons texte (« ⚙ Configurer » à la suite du rappel, « Voir plus ▾ » dans une 4ᵉ colonne) :

- « Configurer » n'était pas aligné d'une ligne à l'autre, car il suivait la longueur du rappel ;
- les deux boutons prenaient beaucoup de place ;
- le rattachement de chaque bouton à ce qu'il concerne ne se voyait pas assez.

Retenu : **les zones sont elles-mêmes les boutons**.

```
┌──────────────────────────────────────────────────────────────────┐
│ [ic] Rédaction d'un mail court     [ 3 ] /jour ┌──────────────┐ │
│ ┌────────────────────────────────────┐          │☁ 57,2 mg   ▾ │ │
│ │⚙ Microsoft Copilot · Éco (GPT-6…) │          │💧 0,470 mL    │ │
│ │  300 tokens générés                │          └──────────────┘ │
│ └────────────────────────────────────┘                           │
│   zone « Configurer »                         zone « Voir plus »   │
├──────────────────────────────────────────────────────────────────┤
│  Panneau « Configurer » : sous-titre, fournisseur et profil,      │
│  personnalisation                                                 │
│  ou panneau « Voir plus » : jauges des 5 critères, source         │
└──────────────────────────────────────────────────────────────────┘
```

Retours du 20/11/2026, après revue :

- engrenage agrandi (0,875 → 1,125 rem) et centré verticalement sur le rappel, qu'il fasse une ou deux lignes ;
- même chevron qu'à droite des impacts, à droite du rappel ; chaque chevron pivote quand son propre panneau est ouvert ;
- titre de colonne « Paramètres du cas d'usage » (« Use case settings ») au-dessus des cartes, aligné sur leurs titres, en plus de « Fréquence moyenne » et « Impact par jour ouvré ». La case « Seulement mes usages » passe sur sa propre ligne, au-dessus des titres de colonnes.

### Zone « Configurer »

- Le rappel fournisseur · profil, puis paramètres (tokens, vidéo…), précédé d'un engrenage, est un bouton placé sous le titre : il commence au même endroit sur chaque ligne.
- Ouvre un panneau sous la ligne avec, dans l'ordre : sous-titre du cas d'usage, sélecteurs fournisseur et profil côte à côte, section « Personnalisation » si le profil a des paramètres. Contenu et comportement des champs inchangés.
- Absent quand le cas d'usage n'est pas pris en charge : le rappel, qui affiche « non pris en charge », reste un simple texte.

### Zone « Voir plus »

- Le bloc GES / eau, suivi d'un chevron, est un bouton. La 4ᵉ colonne de la grille disparaît : `minmax(0, 1fr) 9rem 10.5rem`, et le titre gagne la place.
- Ouvre un panneau sous la ligne avec « Détail des impacts par jour ouvré » (jauges des cinq critères) et la note de source. Ouvert avant le premier calcul, il affiche « … ».
- Absent quand le cas d'usage n'est pas pris en charge.

### Rattachement visuel

- Au repos, les deux zones sont discrètes (bordure transparente). Elles se terminent par le même chevron, et « Configurer » commence par un engrenage, tous couleur `--forest`.
- Au survol : bordure `--line`.
- Panneau ouvert : la zone correspondante prend une bordure `--forest` et un fond `--forest-tint`, et son chevron pivote. On voit ainsi quelle zone a ouvert le panneau.
- Infobulle (`title`) « Configurer » ou « Voir plus » / « Voir moins » au survol.

### Un seul panneau ouvert à la fois

L'état local de la carte passe de `open: boolean` à `panel: "configure" | "details" | null`. Ouvrir l'un ferme l'autre ; recliquer sur la zone active referme.

### Mobile (≤ 640 px)

Grille `"header header" / "frequency summary"` : titre et zone « Configurer » sur toute la largeur, puis fréquence et zone « Voir plus ».

### Panneau de droite : seul le total reste visible

La colonne de droite (total annuel, détail par personne, équivalences, répartition) était entièrement collante (`sticky`) alors qu'elle est plus haute que l'écran : quand une carte s'agrandissait, elle sautait (jusqu'à 480 px). Le défaut existait déjà avec « Réglages ».

Désormais, seul le bloc « Impact annuel - 1 utilisateur » est collant. La colonne s'étire sur toute la hauteur de la section pour qu'il le reste tout du long, et le reste de la colonne défile normalement sous lui. En dessous de 800 px, rien n'est collant, comme avant.

## Accessibilité

- Deux `<button type="button">` avec `aria-expanded` et `aria-controls` (renseigné seulement quand le panneau existe).
- Nom accessible = action + cas d'usage + contenu visible, par exemple « Configurer – Rédaction d'un mail court : Microsoft Copilot · Éco (GPT-6 Luna) 300 tokens générés » ou « Voir plus – … : 57,2 mg CO2eq 0,470 mL ». Le préfixe est masqué visuellement, et le texte visible fait partie du nom (WCAG 2.5.3).
- Contenu des boutons en `<span>` seulement (le `<dl>` des impacts devient des `<span>`, un bouton n'acceptant que du contenu phrasé).
- Identifiants de panneaux distincts : `use-case-<id>-configure` et `use-case-<id>-details`.
- Ordre de tabulation : Configurer → fréquence → unité → Voir plus, conforme à l'ordre visuel.
- Engrenage et chevron `aria-hidden="true"`.

## Écoconception

- Pas de nouvelle requête, pas de dépendance, pas de changement d'API : uniquement du front.
- Rendu paresseux conservé (RWEB_0046) : chaque panneau n'est ajouté au DOM que lorsqu'il est ouvert ; un seul panneau à la fois limite encore le DOM.
- Icône d'engrenage en SVG inline (pas de requête image, pas de police d'icônes).
- Pas de calcul côté front : les impacts affichés restent ceux de `POST /api/calculate` (cf. `AGENTS.md`).

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `frontend/src/components/UseCaseCard.tsx` | État `panel` ; rappel des choix et impacts en boutons ; panneau unique scindé en deux. |
| `frontend/src/index.css` | Grille à 3 colonnes, styles des deux zones (survol, ouvert), `--configure-open` / `--details-open` ; seul `.gwp-summary` du panneau de droite est collant. |
| `frontend/src/pages/CalculatorPage.tsx` | Titre de colonne vide de l'ancienne colonne du bouton remplacé par « Paramètres du cas d'usage » (`columnUseCase`) en tête de ligne. |
| `frontend/src/i18n/fr.json`, `en.json` | Suppression de `settingsToggle` ; ajout de `configureToggle` (« Configurer » / « Configure »), `impactsToggle` (« Voir plus » / « See more »), `impactsToggleOpen` (« Voir moins » / « See less »). |
| `frontend/tests/UseCaseCard.test.tsx` | Tests du bouton « Réglages » remplacés par ceux des deux zones. |
| `frontend/tests/CalculatorPage.test.tsx` | Helper `openSettings` remplacé par `openConfigure` ; boutons fournisseurs cherchés par début de nom (`/^google/i`), le nom de « Configurer » contenant le fournisseur. |
| `frontend/e2e/catalogue.spec.ts` | Zones « Configurer » et « Voir plus » à la place de « Réglages » ; même ancrage des boutons fournisseurs. |

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
3. **Libellé alterné** : « Voir plus » replié, « Voir moins » déplié (infobulle et nom accessible).
4. **Zones cliquables** : le rappel des choix et les impacts sont eux-mêmes les boutons (retours du 17/11, cf. Disposition).
5. **Seul le total est collant** dans le panneau de droite.

## Écarts à l'implémentation

- Clés i18n `impactsToggle` / `impactsToggleOpen` et non `detailsToggle` : `calculator.detailsToggle` existe déjà (détail du résumé GES de la page).
- « Voir plus » ouvert avant le premier calcul : la section affiche « … » à la place des jauges, comme le résumé de la ligne.
- Les boutons fournisseurs se cherchent par début de nom dans les tests : le nom de « Configurer » contient aussi le fournisseur.

## Avant release

Lancer `audit-ecoconception` après implémentation (évolution notable de l'interface), puis vérification visuelle desktop et mobile dans les deux langues.
