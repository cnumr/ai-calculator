# Paramètres propres à un modèle (vidéo) — Design

Statut : validé (choix du 2026-11-08). Branche : `feat/video-parameters-dhe`.

## Contexte

Le catalogue `use_cases.yaml` associe chaque couple cas d'usage × fournisseur × profil à **une seule** valeur d'impact. Il ne sait pas exprimer qu'un modèle accepte des paramètres (résolution, durée, audio pour la vidéo) ni que ces paramètres déplacent le résultat. Le spec POC V2 le relève (§ 1.5 et question ouverte 2) : « l'interface doit proposer des options par modèle, ce que la config YAML ne permet pas aujourd'hui ».

Depuis `fix/data-sources-locale-dhe`, la vidéo est calculée par EcoLogits (`ecologits_video`), avec des réglages figés (720p, 8 s, audio).

## Décisions

| Sujet | Choix |
|---|---|
| Architecture | **Précalcul dans le catalogue**, pas d'endpoint `/calculate` |
| Paramètres vidéo exposés | Résolution, durée, audio |
| Modèles vidéo | Google « Standard » (`google/veo-3.0`) et « Rapide » (`google/veo-3.0-fast`) ; OpenAI « Standard » (`openai/sora-2-pro`) |
| Image | Pas de paramètre : aucune donnée par taille ; un sélecteur ne changerait rien au résultat |

### Pourquoi le précalcul plutôt qu'un `/calculate`

Les capacités EcoLogits sont **discrètes et petites** : chaque modèle vidéo accepte 1 à 2 résolutions, 2 à 3 durées, audio oui/non (12 combinaisons au plus). On peut donc tout calculer au démarrage et l'envoyer dans `GET /api/use-cases` :

- aucune requête réseau quand l'utilisateur change un réglage, pas d'état asynchrone dans les cartes (source des bugs corrigés dans `fix/calculator-state-bugs-dhe`) ;
- le back reste seul garant du calcul et de la validation ;
- un endpoint à la demande reste possible plus tard si un paramètre devient continu (durée libre, nombre de tokens saisi).

## Capacités des modèles retenus (EcoLogits 0.11.3)

| Modèle | Résolutions | Durées (s) | Audio |
|---|---|---|---|
| `google/veo-3.0` | 720p, 1080p | 5, 8, 10 | oui/non |
| `google/veo-3.0-fast` | 720p, 1080p | 4, 6, 8 | oui/non |
| `openai/sora-2-pro` | 720p, 1080p | 4, 8, 12 | oui/non |

Aucun modèle EcoLogits ne gère la 4K demandée dans le spec V2. EcoLogits **ne valide pas** ces capacités dans `video_impacts` : la validation est faite par le back.

## Back

### YAML

Les options ne sont pas recopiées dans le YAML : elles sont **dérivées des capacités EcoLogits** du modèle (pas de dérive possible). Le YAML ne déclare que les valeurs par défaut, validées contre ces capacités au chargement :

```yaml
- id: video
  ecologits_video:
    model: google/veo-3.0
    defaults:
      resolution: 720p
      duration_s: 8
      with_audio: true
```

### Capacités

`video_capabilities(model)` lit `ecologits/data/video_models.json` (fichier de données du paquet) :

- résolutions : `[1280, 720]` → `720p`, `[1920, 1080]` → `1080p`, `[3840, 2160]` → `4k`, sinon `LxH` ;
- durées : `(frames_count - 1) / 24` (inverse de `duration_to_frames` d'EcoLogits) ;
- audio : `[true, false]` si `audio_generation`, sinon `[false]`.

Modèle inconnu ou défaut hors capacités → `UseCasesConfigError` au démarrage.

### Catalogue et API

Chaque profil peut porter des paramètres et des variantes précalculées. `impacts` reste la valeur de la combinaison par défaut, ce qui ne change rien pour les profils texte et image.

```json
{
  "id": "video",
  "impacts": { "...": "combinaison par défaut" },
  "parameters": [
    { "id": "resolution", "options": ["720p", "1080p"], "default": "720p" },
    { "id": "duration_s", "options": [5, 8, 10], "default": 8 },
    { "id": "with_audio", "options": [true, false], "default": true }
  ],
  "variants": [
    { "values": { "resolution": "720p", "duration_s": 5, "with_audio": true }, "impacts": { "...": "..." } }
  ]
}
```

Profils sans paramètre : `parameters: []`, `variants: []`.

## Front

- `CardState` gagne `parameters` : les valeurs choisies par l'utilisateur, vide au départ.
- Fonction pure `resolveParameters(profile, chosen)` : pour chaque paramètre du profil, la valeur choisie si elle fait partie des options, sinon la valeur par défaut. Un choix incompatible avec un autre modèle (ex. 5 s en passant de Veo 3.0 à Veo 3.0 Fast) retombe sur la valeur par défaut sans être perdu : il revient si l'on revient au modèle d'origine.
- Fonction pure `resolveImpacts(profile, chosen)` : impacts de la variante correspondante, sinon `profile.impacts`. Utilisée par la carte et par `computeAnnualEntries` : les totaux restent dérivés, sans état copié.
- `UseCaseCard` affiche un sélecteur par paramètre du profil courant, sur la même grille que fournisseur / profil / fréquence.
- Libellés i18n : `calculator.parameter.<id>` pour le champ ; options : résolution telle quelle, durée « 8 s », audio « Avec audio » / « Sans audio ».
- Nouveau profil `video_fast` : libellé « Rapide » / « Fast », indication « Pour générer une vidéo plus rapidement ».

## Hors périmètre

- Image : taille non exposée tant qu'aucune donnée par taille n'existe.
- Endpoint de calcul à la demande.
- Choix du modèle vidéo par défaut et des valeurs par défaut : à confirmer avec Brice (spec V2, question 2).

## Tests

- Back : capacités dérivées (Veo 3.0 : 2 × 3 × 2), défaut hors capacités refusé, modèle inconnu refusé, nombre de variantes, variante par défaut = `impacts`, 1080p > 720p, sérialisation API.
- Front : résolution des paramètres (choix valide, choix incompatible, aucun choix), impacts de la variante, totaux annuels avec paramètres, sélecteurs affichés uniquement pour les profils qui en ont, changement de résolution qui met à jour la valeur.
