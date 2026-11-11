---
"ai-calculator": patch
---

Écoconception : le catalogue `GET /api/use-cases` est mis en cache par le navigateur (bonne pratique GreenIT RWEB_0021). Il ne change qu'au redéploiement mais était retéléchargé à chaque visite. Il est désormais gardé 5 minutes sans nouvelle requête (`Cache-Control: public, max-age=300`), puis revalidé par son `ETag` : tant qu'il n'a pas changé, le backend répond 304 sans renvoyer son contenu (17,9 Ko, 1,2 Ko compressé). Le catalogue est aussi sérialisé une seule fois au lieu d'à chaque requête. `scripts/verify-cache.sh` le vérifie sur la stack lancée.

_Réalisé avec Claude Code — Claude Opus 5.5 : ≈ 1,1 M tokens (dont 1,1 M relus en cache, 8 k générés)._
