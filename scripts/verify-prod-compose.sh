#!/usr/bin/env bash
# Vérifie que la stack prod n'expose qu'un seul point d'entrée HTTP :
# le backend ne doit publier aucun port sur l'hôte, seul le frontend le fait.
set -euo pipefail

cd "$(dirname "$0")/.."

CONFIG=$(docker compose -f docker-compose.yml config --format json)

backend_ports=$(echo "$CONFIG" | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log((data.services.backend.ports || []).length);
')

frontend_ports=$(echo "$CONFIG" | node -e '
  const data = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log((data.services.frontend.ports || []).length);
')

if [ "$backend_ports" -ne 0 ]; then
  echo "FAIL: le service backend publie $backend_ports port(s) sur l'hôte, attendu 0." >&2
  exit 1
fi

if [ "$frontend_ports" -ne 1 ]; then
  echo "FAIL: le service frontend publie $frontend_ports port(s) sur l'hôte, attendu 1." >&2
  exit 1
fi

echo "OK: seul le frontend expose un port sur l'hôte (backend: $backend_ports, frontend: $frontend_ports)."
