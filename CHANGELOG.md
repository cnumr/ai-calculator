# Changelog

## 0.4.0

### Minor Changes

- 89a13e9: La logique métier du calculateur passe côté backend : nouvel endpoint `POST /api/calculate`.

  - **Un seul calcul de scénario** : il reçoit tous les usages quotidiens et le nombre de salariés, et renvoie l'impact de chaque usage (par action, par jour et par an), les totaux annuels individuel et entreprise, la répartition par fournisseur et les équivalences CO2.
  - **Paramètres typés par type de cas d'usage** : les usages sont distingués par `kind` (`text`, `video`, `image`), chacun n'acceptant que ses propres paramètres, vérifiés contre les options du modèle. Un scénario invalide reçoit une erreur `422` avec un message explicite.
  - **Catalogue allégé** : `GET /api/use-cases` ne décrit plus que les choix possibles (de 59 à 11,5 Ko) et indique le `kind` de chaque cas d'usage ; les impacts EcoLogits sont calculés à la demande, avec un cache.
  - **Équivalences CO2** : les facteurs ImpactCO2 sont désormais gérés par le backend.
  - **Frontend** : il envoie le scénario 150 ms après le dernier changement, annule les requêtes dépassées et n'applique que la dernière réponse ; les valeurs en attente de mise à jour sont atténuées, et un calcul en échec conserve le dernier résultat avec un bouton « Réessayer ». Les résultats sont inchangés.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 20,9 M tokens (dont 20,7 M relus en cache, 97 k générés)._

- 8cd68e8: Liste des cas d'usage plus compacte, regroupée par familles.

  - **Une ligne par cas d'usage** : titre, rappel du choix sur deux lignes (fournisseur et profil, par exemple « Microsoft Copilot · Éco (GPT-6 Luna) », puis les réglages, par exemple « 300 tokens générés »), fréquence quotidienne et impact par jour (GES, puis eau en dessous). Saisir une fréquence suffit à compter un usage, sans clic supplémentaire. Les lignes utilisées sont soulignées, les autres atténuées.
  - **Bouton « Réglages »** : il déplie, sous la ligne, le fournisseur et le profil, puis une section « Personnalisation » (tokens, résolution, durée, audio, taille d'image), puis le « Détail des impacts par jour » avec la source méthodologique. Ce contenu n'est rendu qu'à l'ouverture.
  - **Familles** : les cas d'usage sont listés sous un intertitre par famille (Rédaction, Analyse et synthèse, Production bureautique, Création visuelle, Développement), avec des titres de colonnes au-dessus de la liste. Les familles sont déclarées dans `use_cases.yaml`. `GET /api/use-cases` expose `families` et la `family` de chaque cas d'usage.
  - **Filtre « Seulement mes usages (n) »** : une case discrète, dans la ligne des titres de colonnes, ne garde que les cas d'usage avec une fréquence (et leurs familles). Elle retient les usages actifs au moment où on la coche : une ligne remise à 0 reste affichée, pour ne pas disparaître pendant la saisie. « Réinitialiser » la décoche.
  - **Effet** : sur ordinateur, la page passe de 5 900 à 3 000 px de haut, et de 831 à 609 éléments au chargement (−27 %).

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 28,7 M tokens (dont 28,5 M relus en cache, 68 k générés)._

- 6ffbaa7: Déploiement continu sur le VPS GreenIT : les images Docker sont publiées sur ghcr.io à chaque push sur `develop` (tags `develop` et `sha-<commit>`) et à chaque release (tags `vX.Y.Z` et `latest`). Le VPS les tire toutes les 5 minutes : le staging suit `develop`, la prod suit la dernière release. En cas d'échec, la prod revient à la version précédente et une alerte part sur Mattermost. La version affichée en pied de page inclut désormais le commit (`X.Y.Z+sha.<commit>`) en staging. La procédure est dans `deploy/README.md` et `docs/PRODUCTION.md`.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 507 k tokens (dont 476 k relus en cache, 5 k générés)._

- 4750895: Badge Ecoindex de la page en cours dans le pied de page, à droite de la version du site.

  - **Propre à chaque page** : accueil, méthodologie, à propos, mentions légales. Le lien mène à l'analyse de la page sur ecoindex.fr.
  - **Relayé par le serveur du site** (`/ecoindex-badge.svg?path=…`, lien `/ecoindex?path=…`) : le navigateur des visiteurs ne contacte pas ecoindex.fr, les mentions légales restent exactes. nginx récupère chaque badge au plus une fois par jour, sans en-tête du visiteur, et sert la dernière version si ecoindex.fr est injoignable. Seules les pages du site sont relayées.
  - **Domaine par environnement** : variable `ECOINDEX_DOMAIN` lue au démarrage du conteneur (`ai-calculator.greenit.eco` en prod, `ia-calculator-staging.greenit.eco` en staging) ; vide, pas de badge. La configuration nginx devient un modèle (`frontend/nginx.conf.template`).
  - **En développement**, le serveur Vite relaie le badge de la même façon quand `ECOINDEX_DOMAIN` est définie (`docker-compose.dev.yml`).

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 8,5 M tokens (dont 8,4 M relus en cache, 34 k générés)._

- 27dba84: Export et import des données du calculateur (#55). « Exporter » enregistre, dans un fichier JSON créé par le navigateur, les saisies et leurs impacts par cas d'usage, par personne et pour l'entreprise, avec la version du site et des sources de données. « Importer » recharge un tel fichier : les saisies sont reprises et les impacts recalculés en un seul appel, avec un avertissement si les versions diffèrent. L'API renvoie désormais ces versions (`meta`) et la valeur estimée de chaque fourchette (`value`), que le front affiche au lieu de la calculer. Les boutons de l'en-tête (visite guidée, export, import, réinitialisation) ont une infobulle qui décrit leur action.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 18,1 M tokens (dont 17,8 M relus en cache, 100 k générés)._

- 95ca166: Fréquence d'un usage par jour, par semaine ou par mois.

  - **Saisie** : à côté de la fréquence de chaque cas d'usage, un sélecteur discret « /jour · /semaine · /mois » (jour par défaut). Un usage occasionnel se saisit simplement, par exemple « 1 vidéo par mois », au lieu de « 0,05 par jour ».
  - **Calcul (back)** : sur la base de 218 jours ouvrés par an, une semaine compte 5 jours ouvrés (43,6 semaines par an) et une année compte 11 mois travaillés. Les impacts annuels en tiennent compte.
  - **Affichage par jour ouvré** : l'impact de chaque ligne et le détail des impacts restent exprimés par jour ouvré, quelle que soit l'unité, pour comparer les usages entre eux. Les titres le précisent (« Impact par jour ouvré »).
  - **API** : `POST /api/calculate` accepte `frequency` et `frequency_unit` (`day`, `week` ou `month`, `day` par défaut). L'ancien champ `frequency_per_day` reste accepté, avec les mêmes résultats qu'avant. La réponse renvoie la fréquence saisie, son unité et son équivalent par jour ouvré (`frequency_per_day`).
  - **Méthodologie** : nouvelle section « Fréquence d'usage », qui détaille la conversion.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 7,5 M tokens (dont 7,4 M relus en cache, 34 k générés)._

- eb94b35: Visite guidée du calculateur pour les nouveaux utilisateurs (#42).

  - **Bouton « Visite guidée »**, à côté de « Réinitialiser ». Il porte une pastille discrète tant que la visite n'a été ni terminée ni quittée. Ce repère reste dans le navigateur (`localStorage`) et n'est jamais envoyé au serveur.
  - **8 étapes sur les éléments réels du calculateur** : écosystème IA, configuration d'un cas d'usage, fréquence, impact par jour ouvré, filtre « Seulement mes usages », impact annuel, nombre de salariés, réinitialisation et méthodologie. Le fil rouge est « Rédaction d'un mail court, 5 fois par jour ». L'élément de chaque étape est entouré, et une bulle l'explique, avec Précédent, Suivant, Terminer et Échap.
  - **Sans coût pour qui ne la lance pas** : le code et les textes de la visite (3 Ko compressés) ne sont chargés qu'au clic, sans bibliothèque. Au chargement de la page : 6 requêtes, comme avant, et un EcoIndex de 68,07 (C) contre 68,16.
  - **Ne modifie pas le scénario** : la visite raconte l'exemple sans rien saisir, donc sans recalcul.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 11,9 M tokens (dont 11,8 M relus en cache, 41 k générés)._

- f88bae9: Mentions légales complètes et polices servies par le site (#43).

  - **Mentions légales** : éditeur (association Green IT, identifiants vérifiés dans l'annuaire des entreprises), directeur de la publication, hébergeur (Infomaniak, adresse vérifiée), conception et code source, propriété intellectuelle et licences, portée des résultats, données personnelles, liens externes et contacts. En français et en anglais. La page et ses textes ne sont chargés qu'à son ouverture.
  - **Pied de page** : le lien vers l'association pointe vers son site, greenit.eco (« Association Green IT »), au lieu de www.greenit.fr.
  - **Polices auto-hébergées** : Inter, Fraunces et IBM Plex Mono ne viennent plus de Google Fonts, qui recevait l'adresse IP de chaque visiteur. Mêmes fichiers (sous-ensemble latin, licences SIL OFL jointes), servis par le site avec un cache d'un an. La page ne contacte plus aucun domaine tiers : une requête de moins, poids inchangé.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 20,1 M tokens (dont 20,0 M relus en cache, 56 k générés) ; Claude Haiku 5.5 : ≈ 36 k tokens (dont 17 k relus en cache, 5 k générés)._

- 1fd07bf: Génération d'images : impacts calculés selon la méthodologie, au lieu des valeurs du POC sans source publiée.

  - **Méthode** : EcoLogits ne modélise pas la génération d'images. L'impact d'une image est celui d'une vidéo de référence calculée par EcoLogits (Veo 3.1, 720p, 8 s, avec audio : 27,7 à 60,6 Wh), divisé par un facteur selon la taille. Ce facteur vaut 30 en 1024 × 1024 (environ 1,5 Wh) et 8 en 2048 × 2048 (environ 5 Wh), d'après l'étude « The Hidden Cost of an Image » (arXiv 2506.17016).
  - **Les cinq critères** (émissions, énergie, ressources minérales, énergie primaire, eau) sont désormais renseignés. Avant, seuls les émissions et les ressources minérales l'étaient.
  - **Taille d'image** : réglable dans le menu « Personnaliser » (1024 × 1024 par défaut, ou 2048 × 2048). `POST /api/calculate` accepte `parameters.size` pour les usages d'image.
  - **Même méthode pour Google et OpenAI** : la carte garde le nom du modèle d'image utilisé (Gemini 2.5 Flash Image, DALL·E 3).
  - **Valeurs** : une image 1024 × 1024 émet en moyenne 0,75 g CO2eq, au lieu de 12,6 g pour la valeur du POC, qui incluait une estimation d'infrastructure plus large.
  - **Source** : la carte cite la transposition depuis la vidéo EcoLogits et l'étude, avec un lien vers la nouvelle section « Génération d'images » de la page Méthodologie.
  - **Code** : le mode de calcul « valeurs statiques » et la mention « sans source publiée », devenus inutilisés, sont supprimés.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 17,0 M tokens (dont 16,9 M relus en cache, 41 k générés)._

- ad0c3cd: Quatre nouveaux cas d'usage issus de la méthodologie, et modèles de texte mis à jour pour tous les cas d'usage.

  - **Nouveaux cas d'usage** :

    - **Générer une présentation (slides)** : 2 000 tokens ;
    - **Génération d'une feuille de calcul** : 2 500 tokens ;
    - **Rédaction d'un mail long** : 1 000 tokens ;
    - **Assistance au développement** : 100 000 tokens, pour une session agentique (Anthropic par défaut).

    Ils sont proposés pour les cinq fournisseurs et ouverts par défaut sur le profil « Équilibré ».

  - **Modèles récents** (EcoLogits 0.11.3), communs à tous les cas d'usage texte :

    | Fournisseur       | Éco                   | Équilibré          | Puissant        | Ultra            |
    | ----------------- | --------------------- | ------------------ | --------------- | ---------------- |
    | OpenAI            | GPT-6 Luna            | GPT-6.1 Sol        | GPT-6 Astra     | GPT-5.5 Pro      |
    | Anthropic         | Claude Haiku 5.5      | Claude Sonnet 5.5  | Claude Opus 5.5 | Claude Fable 5.1 |
    | Mistral           | Mistral Small         | Mistral Medium 3.5 | Mistral Large 4 | —                |
    | Google            | Gemini 3.5 Flash-Lite | Gemini 3.8 Flash   | Gemini 3.1 Pro  | Gemini Pro       |
    | Microsoft Copilot | GPT-6 Luna            | GPT-6.1 Sol        | Claude Opus 5.5 | Claude Fable 5.1 |

    Le profil « Recherche » d'OpenAI (o4-mini Deep Research) est conservé. Les impacts des cas d'usage existants changent en conséquence.

  - **Nouveau profil « Ultra »** : le plus gros modèle de chaque fournisseur. Mistral n'en propose pas au-delà de Mistral Large 4.
  - **Tous les fournisseurs sélectionnés par défaut** : l'utilisateur désélectionne ceux qu'il n'utilise pas. Les boutons des fournisseurs sélectionnés gardent leur logo en couleur, sur fond vert clair et avec une coche ; les autres sont grisés. Auparavant, un fournisseur sélectionné passait en noir et blanc, ce qui pouvait laisser croire le contraire.
  - **Changement de fournisseur** : la carte garde le profil choisi si le nouveau fournisseur le propose, sinon elle prend le profil recommandé du cas d'usage. Auparavant, elle revenait au premier profil.
  - **Catalogue** : les modèles de texte sont déclarés une seule fois, dans la table `text_models` de `use_cases.yaml`, au lieu d'être recopiés dans chaque cas d'usage. Le démarrage du back vérifie aussi que le fournisseur par défaut et le profil recommandé de chaque cas d'usage existent.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 13,1 M tokens (dont 13,0 M relus en cache, 38 k générés)._

- 5901de6: Nombres de tokens par action alignés sur la méthodologie du projet. Les impacts affichés baissent en conséquence.

  - **Recherche approfondie** : 5 000 tokens (rapport de 5 pages) au lieu de 200 000.
  - **Résumé de réunion** : 1 200 tokens (synthèse de 1 à 2 pages) au lieu de 8 000.
  - **Rédaction d'un document court** : 2 000 tokens (synthèse de 2 pages) au lieu de 3 000.
  - **Rédaction d'un document long** : 5 000 tokens (synthèse de 5 pages) au lieu de 15 000.
  - **Question à un assistant IA** : 250 tokens (réponse d'environ 200 mots) au lieu de 1 000.
  - **Rédaction d'un mail court** (anciennement « Rédaction d'un email ») : 300 tokens, inchangé ; le nouveau libellé le distingue du futur cas « mail long ».

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 4,6 M tokens (dont 4,6 M relus en cache, 10 k générés)._

- 024ee49: Génération de vidéos : passage à Veo 3.1, le modèle de référence de la méthodologie.

  - **Profils Google** : « Standard » utilise Veo 3.1 au lieu de Veo 3, et « Rapide » Veo 3.1 Fast au lieu de Veo 3 Fast. OpenAI garde Sora 2 Pro.
  - **Durées proposées** : 4, 6 ou 8 s pour Veo 3.1, au lieu de 5, 8 ou 10 s. La vidéo par défaut reste en 720p, 8 s, avec audio.
  - **Impact par vidéo** (720p, 8 s, avec audio) : 27,7 à 60,6 Wh, comme dans la méthodologie, au lieu de 21,6 à 47,4 Wh. Les émissions passent en moyenne de 17,6 à 22,5 g CO2eq.
  - **4K** : toujours non proposée. Aucun modèle vidéo d'EcoLogits 0.11.3 ne la prend en charge, au mieux 720p et 1080p.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 3,0 M tokens (dont 3,0 M relus en cache, 6 k générés)._

- 0c340d7: Nouvelle disposition des cartes, sources méthodologiques et hypothèses modifiables.

  - **Une ligne de sélection** : fournisseur (avec son logo), profil et fréquence quotidienne moyenne côte à côte ; résultats (émissions et eau) en dessous.
  - **Fréquence par défaut à 0** : aucun usage n'est compté tant que l'utilisateur n'a pas renseigné ses fréquences ; « Réinitialiser » y revient.
  - **Source méthodologique** : chaque carte indique la source de ses valeurs, par exemple « Source : EcoLogits 0.11.3, modélisation de l'inférence des LLM », avec un lien vers la méthodologie EcoLogits ; la génération d'images garde sa mention « valeur indicative, sans source publiée ». `GET /api/use-cases` expose une `source` par cas d'usage (identifiant, version d'EcoLogits installée, lien).
  - **Tokens modifiables** : pour les cas d'usage texte, le menu « Personnaliser » affiche le nombre de tokens générés par action (valeur du catalogue par défaut) et permet de le modifier ; `POST /api/calculate` accepte `parameters.output_tokens` (de 1 à 10 000 000).
  - **Logos des fournisseurs** : également affichés dans la répartition par fournisseur.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 26,6 M tokens (dont 25,9 M relus en cache, 59 k générés) ; Claude Haiku 5.5 : ≈ 50 k tokens (dont 13 k relus en cache, 2 k générés)._

- 3952ed2: Ajout d'un pied de page sur toutes les pages : version du site, lien vers l'association GreenIT.fr, lien vers le code source sur GitHub, sources de données avec leur version (EcoLogits 0.11.3, ImpactCO2 relevé du 8 nov. 2026) et rappel des liens Méthodologie, À propos et Mentions légales.

  - Les versions sont lues dans ce qui est réellement utilisé (version du site au build, version d'EcoLogits installée, date de relevé d'ImpactCO2) : elles restent à jour sans maintenance. `GET /api/use-cases` expose ces `data_sources`.
  - Le catalogue est désormais chargé une seule fois pour tout le site, et partagé entre le calculateur et le pied de page : revenir sur le calculateur ne le recharge plus.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 15,3 M tokens (dont 14,5 M relus en cache, 26 k générés)._

- 3ac6f44: Données sourcées et formatage localisé.

  - **Génération de vidéos** : calculée par EcoLogits (Veo 3, 720p, 8 s, avec audio par défaut) au lieu d'une valeur fixe sans source héritée du POC ; les cinq indicateurs sont désormais disponibles.
  - **Génération d'images** : EcoLogits ne la modélise pas ; les valeurs du POC sont conservées et signalées sur la carte comme indicatives, sans source publiée à ce jour.
  - **Équivalences CO2** : facteurs exacts d'ImpactCO2 (ADEME) pour le streaming vidéo, le smartphone et la voiture thermique, avec gestion des pluriels.
  - **Formatage des nombres** : séparateurs décimaux et de milliers selon la langue choisie (`22,0` en français, `22.0` en anglais).
  - **Unités** : espacées (`g CO2eq`, `mg Sbeq`).

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 13,8 M tokens (dont 13,4 M relus en cache, 48 k générés) ; Claude Haiku 5.5 : ≈ 412 k tokens (dont 258 k relus en cache, 20 k générés)._

- c41c4b8: Cartes de cas d'usage : « Configurer » et « Voir plus » à la place de « Réglages » (#40).

  - **« Configurer »** : le rappel du choix (par exemple « Microsoft Copilot · Éco (GPT-6 Luna) », puis « 300 tokens générés »), entre un engrenage et un chevron, est lui-même le bouton. Il déplie le sous-titre du cas d'usage, le fournisseur et le profil, puis la personnalisation (tokens, résolution, durée, audio, taille d'image).
  - **« Voir plus » / « Voir moins »** : le bloc GES / eau de la ligne, suivi d'un chevron, est lui-même le bouton. Il déplie le détail des impacts par jour ouvré et la source méthodologique.
  - **Un panneau à la fois** : ouvrir l'un ferme l'autre. La zone qui a ouvert le panneau est surlignée, et chaque panneau n'est rendu qu'à l'ouverture.
  - **Place gagnée** : la colonne du bouton « Réglages » disparaît, et les deux zones sont alignées d'une carte à l'autre.
  - **Titres de colonnes** : « Paramètres du cas d'usage » s'ajoute à « Fréquence moyenne » et « Impact par jour ouvré ». La case « Seulement mes usages » passe sur sa propre ligne, au-dessus.
  - **Panneau de droite** : seul le total annuel par utilisateur reste visible pendant le défilement. La colonne entière, plus haute que l'écran, sautait quand une carte s'agrandissait.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 11,4 M tokens (dont 11,0 M relus en cache, 70 k générés)._

- eb28e22: Lisibilité du calculateur.

  - **Largeur** : le contenu du site passe de 960 à 1280 px.
  - **Modèles affichés** : chaque profil indique son modèle, par exemple « Éco (GPT-4o mini) » ; le catalogue gagne une table `model_labels`.
  - **Menu « Personnaliser »** : les réglages d'un cas d'usage sont regroupés dans un menu repliable dont le titre rappelle les valeurs en cours (« Personnaliser : 720p · 8 s · Avec audio »).
  - **Libellé** : le profil « Recherche approfondie » devient « Recherche », le nom du modèle le précisant déjà.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 15,7 M tokens (dont 15,6 M relus en cache, 48 k générés)._

- 087d8b0: Paramètres propres au modèle pour la génération de vidéos.

  - **Réglages** : résolution, durée et audio, avec les options réellement acceptées par chaque modèle selon EcoLogits (aucun modèle EcoLogits ne gère la 4K).
  - **Modèles** : profils Google « Standard » (Veo 3) et « Rapide » (Veo 3 Fast), et OpenAI (Sora 2 Pro).
  - **Validation** : un modèle inconnu ou une valeur par défaut non supportée dans `use_cases.yaml` empêche le backend de démarrer.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 7,9 M tokens (dont 7,8 M relus en cache, 37 k générés)._

### Patch Changes

- 9b8dbe6: Écoconception : en-têtes de cache navigateur en production (bonne pratique GreenIT RWEB_0075). Le JavaScript et le CSS du build, dont le nom change à chaque version, sont gardés un an par le navigateur sans être revérifiés (`immutable`) : une visite suivante ne les retélécharge plus. La page `index.html` est revérifiée à chaque visite (`no-cache`, réponse 304 sans contenu si elle n'a pas changé), pour qu'une nouvelle version soit prise en compte immédiatement. Le script `scripts/verify-cache.sh` permet de le vérifier sur la stack lancée.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 1,0 M tokens (dont 1,0 M relus en cache, 8 k générés)._

- 0ffd009: Écoconception : le catalogue `GET /api/use-cases` est mis en cache par le navigateur (bonne pratique GreenIT RWEB_0021). Il ne change qu'au redéploiement mais était retéléchargé à chaque visite. Il est désormais gardé 5 minutes sans nouvelle requête (`Cache-Control: public, max-age=300`), puis revalidé par son `ETag` : tant qu'il n'a pas changé, le backend répond 304 sans renvoyer son contenu (17,9 Ko, 1,2 Ko compressé). Le catalogue est aussi sérialisé une seule fois au lieu d'à chaque requête. `scripts/verify-cache.sh` le vérifie sur la stack lancée.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 1,1 M tokens (dont 1,1 M relus en cache, 8 k générés)._

- 99d6187: Nombre de salariés par défaut : 1 000 au lieu de 1, à l'ouverture de la page comme après « Réinitialiser ». L'impact à l'échelle de l'entreprise donne d'emblée un ordre de grandeur parlant.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 2,0 M tokens (dont 1,9 M relus en cache, 5 k générés)._

- 4e4e3be: Correction des totaux annuels du calculateur : « Réinitialiser » ne les remet plus à zéro, un cas d'usage qu'aucun fournisseur sélectionné ne propose n'est plus compté, et la répartition par fournisseur attribue chaque carte au fournisseur qu'elle utilise réellement (y compris après un changement automatique de fournisseur).

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 3,4 M tokens (dont 3,3 M relus en cache, 31 k générés), analyse initiale du projet comprise._

- 63e7485: Jauges d'impact : la valeur marquée par le curseur est affichée.

  - **Avant** : dans « Par personne et par an », « Pour l'entreprise et par an » et le détail des impacts de chaque cas d'usage, on voyait le curseur et les bornes min et max, mais pas la valeur qu'il indique.
  - **Maintenant** : cette valeur est écrite en gras juste au-dessus du curseur (par exemple « 2,81 t CO2eq »), dans la même unité que les bornes. C'est la valeur centrale de la fourchette, comme dans le bandeau « Impact annuel ».
  - **Présentation revue** : le nom du critère tient sur une ligne, la jauge prend toute la largeur en dessous, avec le min à gauche et le max à droite. Près d'un bord, la valeur se cale sur ce bord sans quitter le curseur.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 1,8 M tokens (dont 1,7 M relus en cache, 12 k générés)._

- 5b66135: Écoconception : les fichiers texte sont désormais servis compressés en production (bonne pratique GreenIT RWEB_0076). Le JavaScript, le CSS, le HTML et le SVG sont précompressés une seule fois au build et servis tels quels par nginx ; les réponses JSON de l'API sont compressées à la volée. Au premier chargement du calculateur, le poids transféré passe de 354 à 107 Ko (JavaScript 318 → 99 Ko, CSS 14,6 → 3,2 Ko, catalogue de l'API 17,7 → 1,2 Ko). Le script `scripts/verify-compression.sh` permet de le vérifier sur la stack lancée.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 10,3 M tokens (dont 10,3 M relus en cache, 13 k générés)._

- d394195: Retours de relecture du calculateur (#50).

  - **« Électricité » au lieu d'« Énergie »** dans les impacts, pour ne plus confondre avec « Énergie primaire ».
  - **Titre** : « Calculateur d'impacts de l'IA générative ».
  - **Logo de l'Association Green IT** dans le header, à droite du choix de la langue (150 px de large, comme sur greenit.eco), avec un lien vers greenit.eco. Version pour fond clair du SVG officiel (5,6 Ko compressés, fichier mis en cache).
  - **Saisie de la fréquence** : une fréquence nulle s'affiche comme un « 0 » grisé, que la saisie remplace ; taper 10 donne « 10 » et non plus « 010 ».

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 3,9 M tokens (dont 3,9 M relus en cache, 10 k générés)._

- 989b226: Écoconception : le contenu des panneaux repliés n'est plus rendu tant qu'on ne les ouvre pas (bonne pratique GreenIT RWEB_0046). Cela concerne le détail des impacts et le menu « Personnaliser » de chaque carte, ainsi que le détail de la répartition par fournisseur. Le calculateur passe de 1 211 à 583 nœuds DOM au chargement, et son EcoIndex de 55 (C) à 71 (B).

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 11,5 M tokens (dont 11,5 M relus en cache, 14 k générés)._

- cdc2eb2: Jauges d'impact : la bande min–max et le repère de la valeur estimée s'affichent en couleur pleine. Ils étaient aussi pâles que le fond de la jauge, ce qui rendait la position de la valeur incompréhensible.

  _Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 1,6 M tokens (dont 1,5 M relus en cache, 6 k générés)._

- 90b89fd: Correction de `deploy/update.sh --dry-run` : sur le staging, la commande sortait en erreur sans message quand l'image `develop` n'était pas encore téléchargée sur le serveur. Elle annonce désormais le redémarrage prévu, sans rien modifier.

  _Réalisé avec Claude Code — Claude Haiku 5.5 : ≈ 8,1 M tokens (dont 7,3 M relus en cache, 99 k générés)._

## 0.3.1

### Patch Changes

- 82e5a91: Correction de la stack Docker Compose de production : les services `backend` et `frontend` ont `restart: unless-stopped`, ils repartent automatiquement après un redémarrage du serveur ou du démon Docker. Voir `docs/PRODUCTION.md`.
- 53a96f2: Met à jour la librairie `ecologits` en 0.11.3 et remplace les modèles retirés du catalogue (Claude Opus 4.0, Gemini 2.0 Flash et Flash-Lite) par leurs équivalents de palier.

## 0.3.0

### Minor Changes

- 0b8fc5d: Add configurable use-case cards with EcoLogits impact summaries, annual context, provider shares, reset controls, and ImpactCO2-aligned equivalences.
- 22edf28: Remove the legacy `POST /api/calculate` endpoint and its duplicate extrapolation logic: the calculator aggregates impacts on the frontend from `GET /api/use-cases`.

## 0.2.1

### Patch Changes

- a4d13f6: Correction de la mise en page du calculateur : le bloc "Pour l'entreprise et par an" s'affiche désormais directement sous le champ "Nombre de salariés" (section 3), au lieu d'une colonne séparée à côté.

## 0.2.0

### Minor Changes

- e6763ef: Ajout d'une stack Docker Compose de production (`docker-compose.yml`, `Dockerfile.prod` back/front, proxy Nginx) : un seul point d'entrée HTTP exposé, le backend n'est plus jamais accessible directement depuis le navigateur. L'ancien `docker-compose.yml` de développement devient `docker-compose.dev.yml`. Voir `docs/PRODUCTION.md`.

### Patch Changes

- ae4033d: Fix critique prod : `frontend/.env` (contenant `VITE_API_BASE_URL=http://localhost:8000`) était commité dans le dépôt, ce qui figeait cette URL locale dans le build de production du front (`docker-compose.yml`), rendant le chargement du catalogue de cas d'usage impossible pour les visiteurs. Le fichier est retiré du suivi git et désormais exclu du contexte de build Docker (`frontend/.dockerignore`).

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Non publié]

### Ajouté

- Processus de release automatisé avec [Changesets](https://github.com/changesets/changesets) : version unique partagée entre `frontend/package.json` et `backend/pyproject.toml` (`package.json` racine + `scripts/sync-versions.mjs`), workflow `.github/workflows/release.yml` (PR « Version Packages » puis tag + GitHub Release via `scripts/create-release.mjs` au merge). **À partir de la prochaine version, `CHANGELOG.md` est généré par Changesets** (les entrées ci-dessous restent gérées manuellement) ; voir `docs/DEVELOPMENT.md` pour le détail du workflow (`npx changeset` à ajouter pour chaque changement notable).
- Convention de branches documentée (`AGENTS.md`, `docs/DEVELOPMENT.md`) : plus de travail direct sur `main`, branches `feat/*`/`fix/*` mergées sur `develop`, puis `develop` mergée sur `main` via PR pour déclencher la release.

- `docker-compose.yml` pour lancer le back et le front en local (hot-reload, dépendances isolées via volumes nommés).
- `backend/Dockerfile` et `frontend/Dockerfile` (images de développement, non adaptées à la production).
- `docs/DEVELOPMENT.md` : guide développeur/devops (démarrage Docker Compose ou manuel, variables d'environnement, tests, structure du dépôt, état des lieux CI/CD).
- Support CORS sur le back (`CORS_ALLOWED_ORIGINS`) pour autoriser les appels du front en développement, y compris depuis l'origine OrbStack (`https://frontend.ai-calculator.orb.local`).
- Port hôte du frontend variabilisable via `FRONTEND_PORT` dans `docker-compose.yml`.
- Lien vers `docs/DEVELOPMENT.md` dans le README.
- Habillage visuel du front (`frontend/src/index.css`) via le skill `frontend-design` : système de tokens couleur/typo (Fraunces pour les titres, Inter pour l'UI, IBM Plex Mono pour les valeurs numériques), palette vert forêt/ambre inspirée du végétal, mise en page carte/nav, et traitement signature des `RangeGauge` (dégradé vert→ambre→rouge avec segment actif en surbrillance). Complété par le CSS des composants du catalogue de cas d'usage (`.use-case-catalog`, `.use-case-card`, `.provider-chips`, `.provider-breakdown`), absent du premier passage.
- Calculateur refondu en catalogue de 8 cas d'usage (cascade fournisseur → profil, lecture seule si combinaison non supportée), configurable via `backend/src/ai_calculator/data/use_cases.yaml` (source unique, sans back-office) ; chips fournisseurs togglables et pictos par cas d'usage.
- Extension de l'affichage des impacts aux 5 indicateurs EcoLogits (GWP, Eau, ADPe, Énergie, PE) au lieu du seul CO2 du POC, sur les panneaux individuel/entreprise et la répartition par fournisseur.
- Nouvel endpoint `GET /api/use-cases` (additif, `GET /api/providers` et `POST /api/calculate` inchangés) servant le catalogue au chargement de la page.
- Tests end-to-end Playwright (`frontend/e2e/`) couvrant le parcours catalogue (bascule fournisseur, changement de profil/fréquence, mise à jour des totaux).
- Page calculateur restructurée en 3 sections numérotées reprenant la disposition du POC : (1) écosystème IA (fournisseurs, pleine largeur), (2) deux colonnes — cas d'usage à gauche, résultats individuels annuels + équivalences CO2 + répartition par fournisseur à droite, (3) deux colonnes — nombre de salariés à gauche, résultats entreprise annuels à droite.
- Colonne de résultats des sections à deux colonnes rendue collante (`position: sticky`) pour rester visible pendant le défilement de la colonne principale (cartes de cas d'usage plus longues que les résultats).

### Supprimé

- Endpoint `POST /api/calculate` et son module d'extrapolation (`domain/extrapolation.py`) : la page calculateur agrège déjà les impacts côté front à partir de `GET /api/use-cases`, ce qui supprime une seconde implémentation de la même logique (et l'écart de 218/220 jours ouvrés entre les deux). Le calcul libre par l'API n'est plus disponible.
- Fonction `calculate()` du client front (`frontend/src/api/client.ts`), devenue inutilisée.

### Corrigé

- Le détail des impacts (`UseCaseCard`, panneau "Voir/Masquer le détail") reflète désormais la fréquence par jour de la carte au lieu de toujours afficher l'impact d'une seule action.
- Les jauges (`RangeGauge`) dans les panneaux de détail des cartes de cas d'usage étaient inutilisables : la colonne de libellé (`minmax(140px, 220px)`) écrasait la piste de la jauge à moins de 5px sur une carte étroite. Réduction de la colonne de libellé (`minmax(90px, 140px)`) et piste garantie à `minmax(60px, 1fr)`.
- Pour les cas d'usage Génération de vidéos/Génération d'images, les indicateurs Énergie, Énergie primaire et Eau ne sont pas mesurés par EcoLogits (seuls GWP et ADPe le sont) : ils affichaient à tort `0.0` au lieu d'être signalés comme non mesurés. Les critères non mesurés sont désormais représentés par `null` de bout en bout (YAML `use_cases.yaml` → dataclasses backend → schéma Pydantic → JSON → type TypeScript `Impacts`) et affichés comme "Non disponible" / "Not available" à la place de la jauge, dans le détail de chaque carte comme dans les totaux individuel/entreprise et la répartition par fournisseur.
- `sumImpacts` (`frontend/src/domain/aggregate.ts`) propageait `null` dès qu'un seul cas d'usage agrégé avait un critère non mesuré, masquant à tort en "Non disponible" les totaux "Par personne et par an" / "Pour l'entreprise et par an" et la répartition par fournisseur alors que d'autres cas d'usage disposaient bien de cette donnée. Un critère `null` est désormais traité comme une contribution nulle (0) tant qu'au moins un des cas d'usage agrégés le mesure ; il ne reste `null` que si aucun ne le mesure.
- Les valeurs d'impacts pouvaient s'afficher en notation scientifique (ex. `1.00e-8`) ou dans une unité peu lisible (ex. `0.001 kgCO2eq`) selon les ordres de grandeur. Nouveau module `frontend/src/domain/units.ts` (`formatNumber`/`scaleRange`) : formatage systématiquement en notation décimale (jamais scientifique), et unité affichée choisie automatiquement dans une échelle par critère (ex. GWP : mgCO2eq/gCO2eq/kgCO2eq/tCO2eq ; ADPe : mgSbeq/gSbeq/kgSbeq/tSbeq ; Énergie : Wh/kWh/MWh/GWh ; Énergie primaire : J/kJ/MJ/GJ/TJ ; Eau : mL/L/m³/ML), avec la même unité pour les bornes min et max d'une fourchette. Appliqué aux jauges (`RangeGauge`) et à la répartition par fournisseur (`CalculatorPage`).

## [0.1.0] - 2026-07-13

### Ajouté

- Calculateur d'impacts IA : formulaire de saisie, appel API, affichage des résultats en fourchettes min-max (`RangeGauge`).
- Comparaisons ImpactCO2 (composant `Co2Equivalents`, GWP uniquement).
- Extrapolation annuelle individuelle et entreprise.
- API back FastAPI : endpoints `GET /api/providers` et `POST /api/calculate`, adossés à EcoLogits.
- Front React/Vite bilingue FR/EN (react-i18next), routage et pages statiques (Méthodologie, À propos, Mentions légales).
- Scaffolding initial back (uv, EcoLogits) et front (Vite/React/TS).

[Non publié]: https://github.com/cnumr/ai-calculator/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cnumr/ai-calculator/releases/tag/v0.1.0
