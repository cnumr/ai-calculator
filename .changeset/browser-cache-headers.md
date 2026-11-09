---
"ai-calculator": patch
---

Écoconception : en-têtes de cache navigateur en production (bonne pratique GreenIT RWEB_0075). Le JavaScript et le CSS du build, dont le nom change à chaque version, sont gardés un an par le navigateur sans être revérifiés (`immutable`) : une visite suivante ne les retélécharge plus. La page `index.html` est revérifiée à chaque visite (`no-cache`, réponse 304 sans contenu si elle n'a pas changé), pour qu'une nouvelle version soit prise en compte immédiatement. Le script `scripts/verify-cache.sh` permet de le vérifier sur la stack lancée.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 1,0 M tokens (dont 1,0 M relus en cache, 8 k générés)._
