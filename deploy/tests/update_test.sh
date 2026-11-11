#!/usr/bin/env bash
# Tests de deploy/update.sh avec un faux docker et un faux curl : aucun réseau,
# aucun conteneur. Prérequis : bash, jq. Sans flock (macOS), un flock neutre est
# utilisé pour ce test seulement ; le VPS et la CI utilisent le vrai flock.
# Lancer : bash deploy/tests/update_test.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILS=0
STATUS=0
OUT=""

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
FLOCK_DIR="$TMP_ROOT/bin"
mkdir -p "$FLOCK_DIR"
if ! command -v flock >/dev/null 2>&1; then
  printf '#!/usr/bin/env bash\nexit 0\n' >"$FLOCK_DIR/flock"
  chmod +x "$FLOCK_DIR/flock"
fi

PROD_ENV='COMPOSE_PROJECT_NAME=ai-calculator-prod
HTTP_PORT=8085
IMAGE_TAG=v0.4.0
ALERT_WEBHOOK_URL=https://chat.example/hooks/test'

STAGING_ENV='COMPOSE_PROJECT_NAME=ai-calculator-staging
HTTP_PORT=8086
IMAGE_TAG=develop
ALERT_WEBHOOK_URL=https://chat.example/hooks/test'

# Nouvel environnement vide, avec le .env donné.
setup() {
  WORK="$(mktemp -d "$TMP_ROOT/case.XXXX")"
  export FAKE_STATE="$WORK/state"
  mkdir -p "$FAKE_STATE/remote" "$FAKE_STATE/local" "$FAKE_STATE/running"
  cp "$HERE/../update.sh" "$WORK/update.sh"
  : >"$WORK/compose.yml"
  printf '%s\n' "$1" >"$WORK/.env"
}

# publish TAG ID : les deux images du tag existent sur ghcr.io.
publish() {
  local svc
  for svc in backend frontend; do echo "$2" >"$FAKE_STATE/remote/$svc:$1"; done
}

# serving TAG ID : les conteneurs tournent sur ces images.
serving() {
  local svc
  for svc in backend frontend; do
    echo "$2" >"$FAKE_STATE/local/$svc:$1"
    echo "$2" >"$FAKE_STATE/running/$svc"
  done
}

release() { echo "$1" >"$FAKE_STATE/release"; }
broken() { echo "$1" >>"$FAKE_STATE/broken"; }

# Lance update.sh ; garde la sortie dans OUT et le code de sortie dans STATUS.
run_update() {
  : >"$FAKE_STATE/calls"
  STATUS=0
  OUT="$(PATH="$HERE/fake-bin:$FLOCK_DIR:$PATH" AIC_CHECK_TRIES=2 AIC_CHECK_INTERVAL=0 \
    AIC_RELEASES_URL=https://api.example/releases/latest \
    "$WORK/update.sh" "$@" 2>&1)" || STATUS=$?
}

env_value() { grep -E "^$1=" "$WORK/.env" | tail -n 1 | cut -d= -f2- || true; }
running_image() { cat "$FAKE_STATE/running/backend"; }
started() { grep -q " up -d" "$FAKE_STATE/calls"; }
alerted() { [[ -f "$FAKE_STATE/alerts" ]] && grep -qF "$1" "$FAKE_STATE/alerts"; }
not() { ! "$@"; }

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "ok   - $name"
  else
    echo "FAIL - $name"
    echo "       sortie : $OUT"
    FAILS=$((FAILS + 1))
  fi
}

echo "# prod : nouvelle release"
setup "$PROD_ENV"; serving v0.4.0 img-4; publish v0.4.0 img-4; publish v0.5.0 img-5; release v0.5.0
run_update prod
check "sort sans erreur" [ "$STATUS" -eq 0 ]
check "IMAGE_TAG passe à v0.5.0" [ "$(env_value IMAGE_TAG)" = v0.5.0 ]
check "PREVIOUS_TAG garde v0.4.0" [ "$(env_value PREVIOUS_TAG)" = v0.4.0 ]
check "les conteneurs tournent sur v0.5.0" [ "$(running_image)" = img-5 ]
check "les images inutiles sont purgées" grep -q "image prune -af --filter label=org.opencontainers.image.source=https://github.com/cnumr/ai-calculator" "$FAKE_STATE/calls"
check "aucune alerte" [ ! -f "$FAKE_STATE/alerts" ]

echo "# prod : rien à faire"
run_update prod
check "aucun redémarrage" not started

echo "# prod : release cassée, retour arrière"
setup "$PROD_ENV"; serving v0.4.0 img-4; publish v0.4.0 img-4; publish v0.5.0 img-5; broken img-5; release v0.5.0
run_update prod
check "code de sortie non nul" [ "$STATUS" -ne 0 ]
check "IMAGE_TAG revient à v0.4.0" [ "$(env_value IMAGE_TAG)" = v0.4.0 ]
check "les conteneurs reviennent sur v0.4.0" [ "$(running_image)" = img-4 ]
check "FAILED_TARGET vaut v0.5.0" [ "$(env_value FAILED_TARGET)" = v0.5.0 ]
check "alerte de retour arrière" alerted "v0.5.0 en échec, retour à v0.4.0"
rm "$FAKE_STATE/alerts"
run_update prod
check "la release en échec n'est pas retentée" not started
check "pas de nouvelle alerte" [ ! -f "$FAKE_STATE/alerts" ]
publish v0.5.1 img-51; release v0.5.1
run_update prod
check "une nouvelle release est déployée" [ "$(env_value IMAGE_TAG)" = v0.5.1 ]
check "FAILED_TARGET est effacé" [ -z "$(env_value FAILED_TARGET)" ]

echo "# prod : retour arrière impossible"
setup "$PROD_ENV"; serving v0.4.0 img-4; publish v0.4.0 img-4; publish v0.5.0 img-5; broken img-5; broken img-4; release v0.5.0
run_update prod
check "code de sortie non nul" [ "$STATUS" -ne 0 ]
check "alerte prod indisponible" alerted "indisponible : v0.5.0 en échec, retour à v0.4.0 en échec aussi"

echo "# prod : image pas encore publiée"
setup "$PROD_ENV"; serving v0.4.0 img-4; publish v0.4.0 img-4; release v0.5.0
run_update prod
check "sort sans erreur" [ "$STATUS" -eq 0 ]
check "IMAGE_TAG reste v0.4.0" [ "$(env_value IMAGE_TAG)" = v0.4.0 ]
check "aucun redémarrage" not started
check "aucune alerte" [ ! -f "$FAKE_STATE/alerts" ]

echo "# prod : API GitHub en erreur"
setup "$PROD_ENV"; serving v0.4.0 img-4; publish v0.4.0 img-4
run_update prod
check "sort sans erreur" [ "$STATUS" -eq 0 ]
check "aucun redémarrage" not started
check "avertissement écrit" grep -q "illisible" <<<"$OUT"

echo "# prod : version figée à la main, puis --unpin"
setup "$PROD_ENV"; serving v0.4.0 img-4; publish v0.4.0 img-4; publish v0.3.0 img-3; publish v0.5.0 img-5; release v0.5.0
run_update prod v0.3.0
check "IMAGE_TAG passe à v0.3.0" [ "$(env_value IMAGE_TAG)" = v0.3.0 ]
check "PINNED=true" [ "$(env_value PINNED)" = true ]
run_update prod
check "la tâche planifiée garde v0.3.0" [ "$(env_value IMAGE_TAG)" = v0.3.0 ]
check "message version figée" grep -q "version figée sur v0.3.0" <<<"$OUT"
run_update prod --unpin
check "--unpin revient à la dernière release" [ "$(env_value IMAGE_TAG)" = v0.5.0 ]
check "PINNED est retiré" [ -z "$(env_value PINNED)" ]

echo "# prod : version demandée introuvable"
setup "$PROD_ENV"; serving v0.4.0 img-4; publish v0.4.0 img-4
run_update prod v9.9.9
check "code de sortie non nul" [ "$STATUS" -ne 0 ]
check "PINNED n'est pas écrit" [ -z "$(env_value PINNED)" ]

echo "# prod : --dry-run"
setup "$PROD_ENV"; serving v0.4.0 img-4; publish v0.4.0 img-4; publish v0.5.0 img-5; release v0.5.0
before="$(cat "$WORK/.env")"
run_update prod --dry-run
check "annonce la bascule" grep -q "basculerait de v0.4.0 vers v0.5.0" <<<"$OUT"
check ".env inchangé" [ "$(cat "$WORK/.env")" = "$before" ]
check "aucun redémarrage" not started

echo "# staging : à jour"
setup "$STAGING_ENV"; serving develop img-a; publish develop img-a
run_update staging
check "sort sans erreur" [ "$STATUS" -eq 0 ]
check "aucun redémarrage" not started

echo "# staging : nouveau push"
setup "$STAGING_ENV"; serving develop img-a; publish develop img-b
run_update staging
check "sort sans erreur" [ "$STATUS" -eq 0 ]
check "les conteneurs tournent sur la nouvelle image" [ "$(running_image)" = img-b ]

echo "# staging : push cassé"
setup "$STAGING_ENV"; serving develop img-a; publish develop img-b; broken img-b
run_update staging
check "code de sortie non nul" [ "$STATUS" -ne 0 ]
check "alerte staging" alerted "déploiement de abcdef1 en échec"
check "FAILED_TARGET est écrit" [ -n "$(env_value FAILED_TARGET)" ]
rm "$FAKE_STATE/alerts"
run_update staging
check "le push cassé n'est pas retenté" not started
check "pas de nouvelle alerte" [ ! -f "$FAKE_STATE/alerts" ]

echo "# staging : --dry-run sans image locale"
setup "$STAGING_ENV"; echo img-old >"$FAKE_STATE/running/backend"; publish develop img-a
run_update staging --dry-run
check "sort sans erreur" [ "$STATUS" -eq 0 ]
check "annonce le dry-run" grep -q "dry-run : redémarrerait sur develop" <<<"$OUT"
check "aucun redémarrage" not started

echo "# arguments"
setup "$PROD_ENV"
run_update staging v1.0.0
check "staging refuse une version" [ "$STATUS" -eq 2 ]
run_update
check "environnement obligatoire" [ "$STATUS" -eq 2 ]

if ((FAILS > 0)); then
  echo "${FAILS} test(s) en échec"
  exit 1
fi
echo "tous les tests passent"
