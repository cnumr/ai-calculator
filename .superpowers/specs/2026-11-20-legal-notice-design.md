# Mentions légales et polices auto-hébergées — Design

Statut : validé (20/11/2026), implémenté. Branche : `feat/legal-notice-dhe` (depuis `develop`). Issue : cnumr/ai-calculator#43.

## Besoin

La page « Mentions légales » ne contenait qu'une ligne provisoire (« Éditeur : cnumr. Hébergement : à préciser. »). L'issue #43 demande de la rédiger à partir de celle de l'association (https://greenit.eco/mentions-legales/), en vérifiant les informations et en les adaptant au calculateur.

## Vérifications (20/11/2026)

| Information | Source | Résultat |
|---|---|---|
| Raison sociale, SIREN 923 875 744, RNA W595 040 531, SIRET du siège 923 875 744 00032, adresse | Annuaire des entreprises (`recherche-entreprises.api.gouv.fr`) | Conformes. Association active, siège à Nogent-sur-Marne. |
| Directeur de la publication, téléphone | Issue #43 et page de l'association | Repris tels quels ; absents des registres publics pour une association. |
| Hébergeur | DNS inverse du VPS (`yunohost.greenit.eco`) | Infomaniak : le calculateur tourne sur le VPS de l'association, chez Infomaniak. |
| Adresse d'Infomaniak | CGV d'Infomaniak | « Rue Eugène-Marziano 25, 1227 Les Acacias (GE), Suisse ». La page de l'association indique « 1227 Carrouge (Genève) », inexact. |
| Téléphone d'Infomaniak | Pages d'Infomaniak | Introuvable. Lien vers www.infomaniak.com, comme sur la page de l'association. |
| Licence EcoLogits | Métadonnées du paquet 0.11.3 | MPL-2.0. |
| Licence du code | `LICENSE` | MIT, © Collectif Conception Numérique Responsable. |

## Décisions (20/11/2026)

| Sujet | Choix |
|---|---|
| Polices | **Auto-hébergées dans cette PR.** Google Fonts transmettait l'IP de chaque visiteur à Google (États-Unis). Même sous-ensemble latin, mêmes fichiers woff2, servis depuis `/assets/` avec le cache d'un an. Licences SIL OFL 1.1 jointes aux fichiers. |
| Hébergeur | Nom, adresse vérifiée et lien du site, sans téléphone. |
| Journaux techniques | Mentionnés (IP, date, ressource, navigateur ; sécurité et bon fonctionnement ; intérêt légitime). Durée « limitée », **à fixer par l'association** avant la mise en prod. |
| Contact | Formulaire de GreenIT pour les données personnelles et les mentions ; issues GitHub pour les erreurs et suggestions, en rappelant qu'elles sont publiques. |

## Contenu de la page

Sections : Éditeur · Hébergement · Conception et code source · Propriété intellectuelle et réutilisation (code MIT, EcoLogits MPL-2.0 et ImpactCO2, polices OFL, marques des fournisseurs) · Portée des résultats (estimations en fourchettes, pas un bilan réglementaire) · Données personnelles (pas de compte, de cookie ni de tiers ; saisies non conservées ; deux préférences en stockage local ; journaux techniques ; responsable de traitement et droits ; CNIL) · Liens externes · Nous contacter. Date de mise à jour en tête. Bilingue FR/EN, espaces insécables en français.

## Implémentation

- `LegalNoticePage` est chargée à la demande (`React.lazy`), avec ses textes `legal.fr.json` / `legal.en.json` (espace i18next `legal`) : rien pour les visiteurs qui ne l'ouvrent pas (RWEB_0046).
- Liens dans les textes via `Trans`, balise `<anchor>` : `<link>` est un élément HTML vide, que `Trans` vide de son texte.
- Pied de page : le lien « Association GreenIT.fr » (www.greenit.fr) devient « Association Green IT » (greenit.eco), le site de l'éditeur.
- `@font-face` en tête d'`index.css` (Inter et Fraunces variables : un fichier chacune ; IBM Plex Mono 500 et 600), `font-display: swap`, `unicode-range` latin. Préconnexions et feuille Google retirées d'`index.html`.

## Mesures (20/11/2026)

Builds de production, `vite preview`, protocole EcoIndex du MCP GreenIT (1920 × 1080, cache froid, 3 s, défilement, 3 s).

| | `develop` (`bbbd9bc`) | Branche |
|---|---|---|
| Requêtes | 10 réelles, dont 5 vers Google (6 vues par la méthode MCP) | 9, toutes vers le site |
| Transféré | ≈ 297,8 Ko réels (155,2 Ko vus) | 297,6 Ko |
| EcoIndex | 66,87 – C estimé (68,07 avec la mesure MCP brute) | 67,00 – C |

Les polices Google sont téléchargées depuis `fonts.gstatic.com` mais n'apparaissent pas dans Resource Timing, car elles sont demandées par une feuille d'un autre domaine : la méthode MCP ne les compte pas. L'estimation ajoute leurs 4 requêtes et leur poids (142,6 Ko). À poids égal, la branche économise une requête et deux connexions vers des domaines tiers.

Page des mentions : fichier séparé de 8,4 Ko compressés, chargé à l'ouverture.

## Suites possibles

- Fraunces pèse 67 Ko pour les seuls titres : une police système à empattements, ou un sous-ensemble plus réduit, allégerait toutes les pages (RWEB_0032).
- Fixer et documenter la durée de conservation des journaux du VPS (nginx YunoHost et conteneurs).
