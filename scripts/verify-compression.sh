#!/usr/bin/env bash
# Vérifie, sur la stack prod lancée (docker compose up), que les fichiers texte
# sont servis compressés (écoconception, GreenIT RWEB_0076) :
# - le JS et le CSS du build, et le catalogue JSON de l'API, en gzip pour un
#   navigateur qui l'accepte ;
# - le JS en clair pour un client qui n'accepte pas gzip.
# Usage : scripts/verify-compression.sh [URL de base, défaut http://localhost:${HTTP_PORT:-80}]
set -euo pipefail

BASE_URL="${1:-http://localhost:${HTTP_PORT:-80}}"

encoding() {
  # En-tête Content-Encoding de la réponse (vide si absente).
  curl -s -o /dev/null -D - -H "Accept-Encoding: $2" "$BASE_URL$1" \
    | tr -d '\r' | awk -F': ' 'tolower($1) == "content-encoding" { print $2 }'
}

transferred() {
  curl -s -o /dev/null -w '%{size_download}' -H "Accept-Encoding: $2" "$BASE_URL$1"
}

index=$(curl -s "$BASE_URL/")
js=$(echo "$index" | grep -o '/assets/[^"]*\.js' | head -1)
css=$(echo "$index" | grep -o '/assets/[^"]*\.css' | head -1)

if [ -z "$js" ] || [ -z "$css" ]; then
  echo "FAIL: impossible de trouver le JS et le CSS du build dans $BASE_URL/." >&2
  exit 1
fi

status=0
for path in "$js" "$css" /api/use-cases; do
  got=$(encoding "$path" "gzip")
  if [ "$got" = "gzip" ]; then
    echo "OK:   $path compressé ($(transferred "$path" gzip) octets au lieu de $(transferred "$path" identity))."
  else
    echo "FAIL: $path n'est pas compressé (Content-Encoding: '${got}')." >&2
    status=1
  fi
done

if [ -n "$(encoding "$js" "identity")" ]; then
  echo "FAIL: $js est compressé pour un client qui n'accepte pas gzip." >&2
  status=1
else
  echo "OK:   $js servi en clair pour un client qui n'accepte pas gzip."
fi

exit "$status"
