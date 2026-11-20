 MÉTHODOLOGIE

- **Use cases**  
  Nous avons définis un ensemble de use cases représentatifs d’une utilisation personnelle de l’IA générative via les principaux fournisseurs d’outils d’IA génératives basés sur des LLM.   
  L’intéret par rapport aux autres calculateurs du marché est de pouvoir additionner ces uses cases pour en simuler l’impact de leur execution à l’échelle d’une journée ou d’une année, pour une ou plusieurs personnes (par exemple : à l’échelle d’une entreprise)  

- **Facteurs d’émission considérés**  
  Nous nous appuyons sur l’[API Ecologits](https://api.ecologits.ai/docs "https://api.ecologits.ai/docs"), en distinguant 3 cas  

  - Les use cases directement assimilables à un use case existant dans ecologits (source = Ecologits)  

  - Les use cases s’appuyant sur un nombre d’output tokens textuels spécifiques  (source=  Ecologits via nombre de token custom)  

    - Les output tokens considérés sont précisés dans la colonne dédiée  
    - La colonne “Fourchette output tokens” figure le nombre d’output token min/max considéré pour le use case, base de référence pour la valeur retenue d’output token

  - Les use cases de génération d’image : ceux-ci s’appuient sur une transposition des FE video ecologits selon une estimation en Wh par format d’image proposé. Voir section dédiée “*Source pour equivalence Wh image et FE video”*

- **Synthèse des use cases et FE associés**  

  |                                                                  |                                                                                                              |                    |                                  |                                                                    |
  | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------ | -------------------------------- | ------------------------------------------------------------------ |
  | **Use case**                                                     | **Commentaire**                                                                                              | **Output tokens*** | **Fourchette** **Output tokens** | **Source du FE considéré**                                         |
  | Assistance au développement                                      | Une session de développement agentique autonome1 à 2 jours de travail de développement assisté               | 100000             |                                  | Ecologits                                                          |
  | Génération de vidéos                                             | 720p                                                                                                         | NA                 |                                  | Ecologits                                                          |
  | Génération de vidéos                                             | 1080p                                                                                                        | NA                 |                                  | Ecologits                                                          |
  | Génération de vidéos                                             | 4K                                                                                                           | NA                 |                                  | Ecologits                                                          |
  | Génération d’images                                              | 1024*1024                                                                                                    | NA                 |                                  | Video 720p /30 sur base de Veo 3.1 pour la video*                  |
  | Génération d’images                                              | 2048*2048                                                                                                    | NA                 |                                  | Video 720p / 8 sur base de Veo 3.1 pour la video*                  |
  | Recherche approfondie                                            |                                                                                                              | 5000               |                                  | Ecologits (5p reporting)                                           |
  | Résumés automatiques de visioconférences                         | Synthèse de 1 à 2 pages                                                                                      | 1200               | 800 à 2000                       | Ecologits via nombre de token custom50 à 100% du résumé de 2 pages |
  | Analyse de rapports et synthèse documentaire : résumé de 2 pages | Synthèse de 2 pages                                                                                          | 2000               | 1500 à 3000                      | Ecologits via nombre de token custom40% de 5-page report           |
  | Analyse de rapports et synthèse documentaire : résumé de 5 pages |                                                                                                              | 5000               |                                  | Ecologits                                                          |
  | Génération de présentations automatiques dans Slides             | Présentation de 8 à 12 slides, titres, messages clés, puces, notes éventuelles et consignes de mise en forme | 2000               |                                  | Ecologits via nombre de token custom                               |
  | Rédaction assistée dans Gmail et Docs < 20 lignes                | environ 100 à 250 mots                                                                                       | 300                | 150 à 500                        | Ecologits via nombre de token custom                               |
  | Rédaction assistée dans Gmail et Docs > 20 lignes                | mail détaillé, environ 300 à 900 mots                                                                        | 1000               | 500 à 1800                       | Ecologits via nombre de token custom                               |
  | Génération d’une feuille de calcul                               | Tableau de 20 à 100 lignes avec en-têtes, formules, contrôles, commentaires                                  | 2500               | 1000 à 5000                      | Ecologits via nombre de token custom                               |
  | Requêtes conversationnelles via la recherche Gemini              |                                                                                                              | 250                |                                  | Ecologits                                                          |
  | Suggestion automatique                                           | environ 20 à 30 mots                                                                                         | 50                 | 20 à 80                          | Ecologits via nombre de token custom                               |

- **Source pour equivalence Wh image <> FE video**  

  | **Résolution de sortie de l’image** | **Valeur de référence (Wh)** | **Hypothèses**                                                                                                                                                                                                                                                                    |
  | ----------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | 512 × 512                           | **0,3 Wh**                   | Modèle de diffusion « courant » (type SDXL / équivalent), avec une configuration cloud et nombre de pas de diffusion typique. La Valeur retenue correspond au bas/de la fourchette 0,086–4,08 Wh.                                                                                 |
  | 1024 × 1024                         | **1,5 Wh**                   | Même famille de modèle, résolution doublée Facteur multiplicatif de x5, correspondant à la fourchette haute des ×1,3 à ×4,7 considérés dans l’étude quand on passe de 512 → 1024 px.                                                                                              |
  | 2048 × 2048                         | **5 Wh**                     | Extrapolation à partir de 1024 px en appliquant un nouveau doublement de résolution et des configurations plus lourdes (plus de pas, modèles transformers) Facteur multiplicatif de x3,33, dans la fourchette moyenne en conservant les mêmes ratios que pour les cas précédents. |

source : “The Hidden Cost of an Image: Quantifying the Energy Consumption of AI Image Generation” [ *https://arxiv.org/abs/2506.17016*](https://arxiv.org/abs/2506.17016 "https://arxiv.org/abs/2506.17016")

Nous retenons le **1024*1024** et **2048*2048** comme formats cibles. 

La valeur de référence (Wh) utilisée pour transposition est une génération de video 720p de 8s avec audio via le modèle Veo 3.1 donnée pour 44.1 Wh (27.7 - 60.6 Wh). source : [ecologits](https://calculator.ecologits.ai/ "https://calculator.ecologits.ai/") au 30/9/2026.

- **1024*1024 :** FE 30 fois inférieur au FE associé au use case “Génération de video 720p” pour le modèle Veo 3.1  

- **2048*2048**: FE 8 fois inférieur au FE associé au use case “Génération de video 720p” pour le modèle Veo 3.1
