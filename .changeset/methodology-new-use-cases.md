---
"ai-calculator": minor
---

Quatre nouveaux cas d'usage issus de la méthodologie, et modèles de texte mis à jour pour tous les cas d'usage.

- **Nouveaux cas d'usage** :
  - **Générer une présentation (slides)** : 2 000 tokens ;
  - **Génération d'une feuille de calcul** : 2 500 tokens ;
  - **Rédaction d'un mail long** : 1 000 tokens ;
  - **Assistance au développement** : 100 000 tokens, pour une session agentique (Anthropic par défaut).

  Ils sont proposés pour les cinq fournisseurs et ouverts par défaut sur le profil « Équilibré ».
- **Modèles récents** (EcoLogits 0.11.3), communs à tous les cas d'usage texte :

  | Fournisseur | Éco | Équilibré | Puissant | Ultra |
  |---|---|---|---|---|
  | OpenAI | GPT-6 Luna | GPT-6.1 Sol | GPT-6 Astra | GPT-5.5 Pro |
  | Anthropic | Claude Haiku 5.5 | Claude Sonnet 5.5 | Claude Opus 5.5 | Claude Fable 5.1 |
  | Mistral | Mistral Small | Mistral Medium 3.5 | Mistral Large 4 | — |
  | Google | Gemini 3.5 Flash-Lite | Gemini 3.8 Flash | Gemini 3.1 Pro | Gemini Pro |
  | Microsoft Copilot | GPT-6 Luna | GPT-6.1 Sol | Claude Opus 5.5 | Claude Fable 5.1 |

  Le profil « Recherche » d'OpenAI (o4-mini Deep Research) est conservé. Les impacts des cas d'usage existants changent en conséquence.
- **Nouveau profil « Ultra »** : le plus gros modèle de chaque fournisseur. Mistral n'en propose pas au-delà de Mistral Large 4.
- **Tous les fournisseurs sélectionnés par défaut** : l'utilisateur désélectionne ceux qu'il n'utilise pas. Les boutons des fournisseurs sélectionnés gardent leur logo en couleur, sur fond vert clair et avec une coche ; les autres sont grisés. Auparavant, un fournisseur sélectionné passait en noir et blanc, ce qui pouvait laisser croire le contraire.
- **Changement de fournisseur** : la carte garde le profil choisi si le nouveau fournisseur le propose, sinon elle prend le profil recommandé du cas d'usage. Auparavant, elle revenait au premier profil.
- **Catalogue** : les modèles de texte sont déclarés une seule fois, dans la table `text_models` de `use_cases.yaml`, au lieu d'être recopiés dans chaque cas d'usage. Le démarrage du back vérifie aussi que le fournisseur par défaut et le profil recommandé de chaque cas d'usage existent.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 13,1 M tokens (dont 13,0 M relus en cache, 38 k générés)._
