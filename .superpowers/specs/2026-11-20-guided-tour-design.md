# Visite guidée du calculateur — Design

Statut : validé (20/11/2026), implémenté. Branche : `feat/guided-tour-dhe` (depuis `develop`). Issue : cnumr/ai-calculator#42.

## Besoin

Un nouvel utilisateur arrive directement sur le calculateur (trois sections, douze cas d'usage, zones « Configurer » et « Voir plus », filtre, résultats, extrapolation entreprise) sans explication de ce que fait chaque élément.

## Décisions (20/11/2026)

| Sujet | Choix |
|---|---|
| Forme | Visite pas à pas sur les éléments réels du calculateur, lancée par un bouton. Page « Premiers pas » écartée : elle décrirait l'interface au lieu de la montrer, avec des captures à maintenir. |
| Libellé | « Visite guidée » / « Guided tour », à côté de « Réinitialiser ». |
| Invitation | Rappel discret (une pastille sur le bouton) tant que la visite n'a été ni terminée ni quittée. Repère en `localStorage`, jamais côté serveur. Pas de lancement automatique. |
| Étapes | 8, avec le fil rouge « Rédaction d'un mail court, 5 fois par jour ». |
| Mesure d'usage | Hors périmètre : future issue dédiée. |

## Étapes

| # | Cible (`data-tour`) | Contenu |
|---|---|---|
| 1 | `ecosystem` (fournisseurs) | Choisir les fournisseurs autorisés dans l'organisation. |
| 2 | `configure` du mail court | Changer de fournisseur, de modèle et de paramètres. |
| 3 | `frequency` du mail court | Fréquence et unité (/jour, /semaine, /mois). |
| 4 | `impacts` du mail court | Impact par jour ouvré ; « Voir plus » pour les 5 critères et la source. |
| 5 | `only-used` (filtre) | Ne garder que les cas d'usage renseignés. |
| 6 | `annual-total` | Total annuel par utilisateur, fourchette, détail, équivalences. |
| 7 | `headcount` (bulle sous `enterprise-total`) | Nombre de salariés et impact à l'échelle de l'entreprise. |
| 8 | `reset` | Repartir de zéro ; lien vers la Méthodologie. |

Les cibles de carte sont cherchées dans `[data-use-case="email"]`, puis dans la première carte si le mail court n'est pas affiché (filtre « Seulement mes usages », fournisseur désélectionné). Une cible absente (résultats pas encore calculés) donne une bulle sans élément surligné, placée sous le bouton de la visite.

## Interface

- **Bulle** : une seule, réutilisée d'une étape à l'autre. Titre « 3 / 8 · Fréquence », texte, puis Précédent, Suivant (Terminer à la dernière étape) et une croix « Quitter la visite ». Largeur `min(22rem, 100vw − 2rem)`.
- **Position** : sous la cible, alignée sur son bord gauche et ramenée dans la page. Coordonnées de page (absolues), calculées une fois par étape et au redimensionnement : rien n'est recalculé pendant le défilement.
- **Mise en évidence** : attribut `data-tour-active` posé sur la cible, avec un contour CSS. Pas de voile, pas de copie de la page. Un attribut plutôt qu'une classe, que React réécrirait au rendu suivant.
- **Défilement** : la cible puis la bulle sont amenées à l'écran (`scrollIntoView`, `block: "nearest"`), en douceur, sauf si `prefers-reduced-motion` est activé.
- **Couche** : la bulle utilise l'API Popover (`popover="manual"`) quand le navigateur la connaît, pour passer au-dessus du total collant. L'attribut n'est posé que dans ce cas, car ailleurs il pourrait masquer la bulle. Sinon, un `z-index` suffit.

## Accessibilité

- Bulle `role="dialog"`, non modale, nommée par son titre (`aria-labelledby`) et décrite par son texte (`aria-describedby`).
- À chaque étape, le focus va sur la bulle. À la fin, il revient au bouton « Visite guidée ».
- Échap quitte la visite. La navigation au clavier reste libre (pas de piège à focus).
- La pastille d'invitation a un équivalent textuel masqué : « (recommandée pour une première visite) ».

## Écoconception

- **RWEB_0046** : le composant et ses textes sont dans un fichier JS séparé, chargé par `import()` (`React.lazy`) au premier clic. Au chargement de la page, seul le bouton est ajouté. C'est le premier découpage de code du front.
- **RWEB_0015** : aucune dépendance ; API Popover et `scrollIntoView` natifs.
- **RWEB_0047** : une requête de plus, seulement au lancement (le fichier de la visite, haché donc mis en cache longtemps). Les styles de la visite (quelques règles) restent dans la feuille principale, pour ne pas ajouter une seconde requête CSS.
- **RWEB_0009** : pas de transition entre les étapes ; la pastille est immobile.
- La visite ne touche pas au scénario : aucun `POST /api/calculate` supplémentaire.

## Fichiers

| Fichier | Rôle |
|---|---|
| `frontend/src/components/GuidedTour.tsx` | Composant et liste des étapes (fichier chargé à la demande). |
| `frontend/src/i18n/tour.fr.json`, `tour.en.json` | Textes de la visite, ajoutés à i18next (espace `tour`) au chargement du fichier. |
| `frontend/src/domain/tourInvitation.ts` | Lecture et écriture du repère `localStorage`, protégées par `try/catch`. |
| `frontend/src/pages/CalculatorPage.tsx` | Bouton, chargement différé, attributs `data-tour`. |
| `frontend/src/components/UseCaseCard.tsx`, `ProviderChips.tsx`, `GwpSummary.tsx` | Attributs `data-use-case` et `data-tour` (`individual-total`, `enterprise-total` sur les totaux). |
| `frontend/src/index.css` | Bouton, pastille, bulle, contour de la cible. |

## Tests

- Unitaires : bouton et pastille (absente une fois le repère posé) ; chargement différé (pas de bulle avant le clic) ; navigation Précédent / Suivant / Terminer / Échap ; cible surlignée puis libérée ; focus rendu au bouton ; repère posé en fin de visite ; aucun appel de calcul déclenché.
- e2e : parcours complet, et aucun fichier de la visite chargé tant qu'on ne clique pas.
- Mesure EcoIndex avant/après, selon le protocole du MCP GreenIT, puis `audit-ecoconception`.

## Écarts à l'implémentation

- Les étapes sont dans `GuidedTour.tsx`, pas dans un fichier à part : elles n'ont pas d'autre usage, et restent ainsi dans le fichier chargé à la demande.
- Étape 7 : la bulle se place sous le total entreprise (option `below`), pour ne pas masquer le résultat dont elle parle.
- Les impacts d'une carte inutilisée sont atténués : ils reprennent leur pleine opacité quand la visite les montre.
- Textes français avec espaces insécables (« », :).

## Mesures (20/11/2026)

Builds de production servis par `vite preview`, protocole EcoIndex du MCP GreenIT (1920 × 1080, cache froid, 3 s, défilement, 3 s).

| | `develop` (`c4cf7d9`) | Branche |
|---|---|---|
| Nœuds DOM | 688 | 691 |
| Requêtes | 6 | 6 |
| Transféré | 154,4 Ko | 155,2 Ko |
| EcoIndex | 68,16 – C | 68,07 – C |

- Fichier de la visite : 3,0 Ko compressés, non préchargé par `index.html`.
- Bundle principal : JS +0,44 Ko et CSS +0,33 Ko compressés (bouton, chargement différé, styles de la visite).
- Lancement de la visite : +1 requête (3,2 Ko transférés) et +8 nœuds (la bulle).
