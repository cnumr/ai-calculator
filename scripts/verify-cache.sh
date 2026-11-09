#!/usr/bin/env bash
# Vérifie, sur la stack prod lancée (docker compose up), les en-têtes de cache
# navigateur (écoconception, GreenIT RWEB_0075) :
# - le JS et le CSS du build (/assets/, noms hachés) : gardés un an, immutable ;
# - index.html et les routes de l'application : no-cache, et 304 quand la page
#   n'a pas changé ;
# - un asset absent : 404 (et non index.html).
# Usage : scripts/verify-cache.sh [URL de base, défaut http://localhost:${HTTP_PORT:-80}]
set -euo pipefail

BASE_URL="${1:-http://localhost:${HTTP_PORT:-80}}"
BASE_URL="${BASE_URL%/}"  # sans / final

header() {
  # Valeur de l'en-tête $2 pour le chemin $1 (vide si absent).
  curl -s -o /dev/null -D - "$BASE_URL$1" \
    | tr -d '\r' | awk -F': ' -v name="$2" 'tolower($1) == tolower(name) { print $2 }'
}

status_of() {
  curl -s -o /dev/null -w '%{http_code}' "$@"
}

index=$(curl -s "$BASE_URL/" || true)
js=$(echo "$index" | grep -o '/assets/[^"]*\.js' | head -1 || true)
css=$(echo "$index" | grep -o '/assets/[^"]*\.css' | head -1 || true)

if [ -z "$js" ] || [ -z "$css" ]; then
  echo "FAIL: impossible de trouver le JS et le CSS du build dans $BASE_URL/ (stack de production lancée ? Le serveur de dev Vite ne passe pas par nginx)." >&2
  exit 1
fi

status=0
check() {
  # check <chemin> <Cache-Control attendu>
  got=$(header "$1" "Cache-Control")
  if [ "$got" = "$2" ]; then
    echo "OK:   $1 -> Cache-Control: $got"
  else
    echo "FAIL: $1 -> Cache-Control: '$got' (attendu : '$2')" >&2
    status=1
  fi
}

check "$js" "public, max-age=31536000, immutable"
check "$css" "public, max-age=31536000, immutable"
check / "no-cache"
check /index.html "no-cache"
check /methodologie "no-cache"

etag=$(header / "ETag")
got=$(status_of -H "If-None-Match: $etag" "$BASE_URL/")
if [ -n "$etag" ] && [ "$got" = "304" ]; then
  echo "OK:   / revalidé sans renvoyer la page (304)."
else
  echo "FAIL: / n'est pas revalidé en 304 (ETag '$etag', statut $got)." >&2
  status=1
fi

got=$(status_of "$BASE_URL/assets/absent-00000000.js")
if [ "$got" = "404" ]; then
  echo "OK:   un asset absent renvoie 404."
else
  echo "FAIL: un asset absent renvoie $got au lieu de 404." >&2
  status=1
fi

exit "$status"
