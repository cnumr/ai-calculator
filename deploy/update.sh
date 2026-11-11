#!/usr/bin/env bash
# Met à jour un environnement ai-calculator (staging ou prod) à partir des
# images publiées sur ghcr.io. Lancé toutes les 5 min par
# ai-calculator-update@<env>.timer. Procédure complète : deploy/README.md.
#
#   update.sh <staging|prod> [--dry-run] [--verbose]
#   update.sh prod vX.Y.Z      fige la prod sur cette version (PINNED=true)
#   update.sh prod --unpin     reprend le suivi de la dernière release
set -euo pipefail

readonly REPO="cnumr/ai-calculator"
readonly IMAGE_BASE="ghcr.io/cnumr/ai-calculator"
readonly SERVICES=(backend frontend)
# Surchargeables pour les tests (deploy/tests/update_test.sh).
readonly RELEASES_URL="${AIC_RELEASES_URL:-https://api.github.com/repos/${REPO}/releases/latest}"
readonly CHECK_TRIES="${AIC_CHECK_TRIES:-12}"
readonly CHECK_INTERVAL="${AIC_CHECK_INTERVAL:-5}"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly DIR
readonly ENV_FILE="${DIR}/.env"
readonly COMPOSE=(docker compose --project-directory "$DIR" -f "${DIR}/compose.yml" --env-file "$ENV_FILE")

ENV_NAME=""
TARGET_ARG=""
DRY_RUN=false
VERBOSE=false

usage() {
  echo "usage : update.sh <staging|prod> [vX.Y.Z|--unpin] [--dry-run] [--verbose]" >&2
  exit 2
}

log() { echo "[${ENV_NAME}] $*"; }
debug() { if [[ $VERBOSE == true ]]; then log "$*"; fi; }

# Valeur d'une variable du .env (vide si absente).
env_get() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  printf '%s' "${line#*=}"
}

# env_set CLÉ VALEUR écrit la variable ; env_set CLÉ la retire.
# Le fichier est réécrit sur place : le dossier appartient à root, et le .env
# garde ainsi son propriétaire et son mode 600.
env_set() {
  local others
  others="$(grep -vE "^$1=" "$ENV_FILE" || true)"
  if [[ $# -ge 2 ]]; then
    printf '%s\n%s=%s\n' "$others" "$1" "$2" | sed '/^$/d' >"$ENV_FILE"
  else
    printf '%s\n' "$others" | sed '/^$/d' >"$ENV_FILE"
  fi
}

# Envoie une alerte Mattermost (si ALERT_WEBHOOK_URL est défini) avec les
# 20 dernières lignes de logs. Un échec d'envoi est seulement journalisé.
alert() {
  local url logs text
  log "ALERTE : $1"
  url="$(env_get ALERT_WEBHOOK_URL)"
  [[ -n $url ]] || return 0
  logs="$("${COMPOSE[@]}" logs --no-color --tail 20 2>&1 || true)"
  # Les backticks sont du Markdown Mattermost, pas une substitution.
  # shellcheck disable=SC2016
  text="$(printf ':warning: **ai-calculator %s** : %s\n\n```\n%s\n```' "$ENV_NAME" "$1" "$logs")"
  jq -n --arg text "$text" '{text: $text}' |
    curl -fsS --max-time 10 -X POST -H 'Content-Type: application/json' --data @- "$url" >/dev/null ||
    log "échec de l'envoi de l'alerte"
}

# Vrai si l'API répond un JSON valide (12 essais espacés de 5 s par défaut).
healthy() {
  local port i
  port="$(env_get HTTP_PORT)"
  for ((i = 1; i <= CHECK_TRIES; i++)); do
    if curl -fsS --max-time 5 "http://127.0.0.1:${port}/api/use-cases" 2>/dev/null | jq -e . >/dev/null 2>&1; then
      return 0
    fi
    if ((i < CHECK_TRIES)); then sleep "$CHECK_INTERVAL"; fi
  done
  return 1
}

# Démarre la version écrite dans IMAGE_TAG puis vérifie la santé.
start_and_check() {
  "${COMPOSE[@]}" up -d --quiet-pull --remove-orphans && healthy
}

# Identifiants des images locales d'un tag, un par service.
local_ids() {
  local svc
  for svc in "${SERVICES[@]}"; do
    docker image inspect -f '{{.Id}}' "${IMAGE_BASE}-${svc}:$1" 2>/dev/null || echo "absente"
  done | paste -sd ' ' -
}

# Identifiants des images des conteneurs en service, un par service.
running_ids() {
  local svc cid
  for svc in "${SERVICES[@]}"; do
    cid="$("${COMPOSE[@]}" ps -q "$svc" 2>/dev/null || true)"
    if [[ -n $cid ]]; then docker inspect -f '{{.Image}}' "$cid"; else echo "arrêté"; fi
  done | paste -sd ' ' -
}

# Vrai si les images du tag existent sur ghcr.io (lecture du manifeste seul).
remote_available() {
  local svc
  for svc in "${SERVICES[@]}"; do
    docker manifest inspect "${IMAGE_BASE}-${svc}:$1" >/dev/null 2>&1 || return 1
  done
}

# Commit (7 caractères) d'une image locale, lu dans ses labels OCI.
revision() {
  docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    "${IMAGE_BASE}-frontend:$1" 2>/dev/null | cut -c1-7 || true
}

# Supprime les images du projet qu'aucun conteneur n'utilise. Le filtre sur le
# label OCI protège les images des autres projets du serveur.
prune() {
  docker image prune -af --filter "label=org.opencontainers.image.source=https://github.com/${REPO}" >/dev/null
}

update_staging() {
  local ids rev
  if [[ $DRY_RUN == false ]] && ! "${COMPOSE[@]}" pull --quiet; then
    log "avertissement : pull impossible, rien n'est changé"
    exit 0
  fi
  ids="$(local_ids develop)"
  if [[ "$(running_ids)" == "$ids" ]]; then
    debug "à jour"
    exit 0
  fi
  if [[ "$(env_get FAILED_TARGET)" == "$ids" ]]; then
    debug "images déjà en échec, en attente d'un nouveau push"
    exit 0
  fi
  rev="$(revision develop)"
  if [[ $DRY_RUN == true ]]; then
    log "dry-run : redémarrerait sur develop (${rev:-images absentes}) ; pull non fait en dry-run"
    exit 0
  fi
  log "déploiement de develop (${rev})"
  if start_and_check; then
    env_set FAILED_TARGET
    prune
    log "en service : develop (${rev})"
  else
    env_set FAILED_TARGET "$ids"
    alert "déploiement de ${rev} en échec"
    exit 1
  fi
}

update_prod() {
  local current pinned target
  current="$(env_get IMAGE_TAG)"
  pinned="$(env_get PINNED)"

  if [[ $TARGET_ARG == v* ]]; then
    target="$TARGET_ARG"
  else
    if [[ $TARGET_ARG == --unpin ]]; then
      if [[ $DRY_RUN == true ]]; then
        log "dry-run : retirerait PINNED"
      else
        env_set PINNED
        log "suivi automatique des releases repris"
      fi
      pinned=""
    fi
    if [[ $pinned == true ]]; then
      log "version figée sur ${current}"
      exit 0
    fi
    if ! target="$(curl -fsS --max-time 10 "$RELEASES_URL" | jq -er .tag_name)" ||
      [[ ! $target =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      log "avertissement : dernière release illisible, rien n'est changé"
      exit 0
    fi
    if [[ $target == "$(env_get FAILED_TARGET)" ]]; then
      debug "${target} déjà en échec, en attente d'une nouvelle release"
      exit 0
    fi
  fi

  if [[ $target == "$current" ]]; then
    if [[ $TARGET_ARG == v* && $DRY_RUN == false ]]; then
      env_set PINNED true
      log "version figée sur ${target}"
    fi
    debug "déjà en ${target}"
    exit 0
  fi

  if ! remote_available "$target"; then
    if [[ $TARGET_ARG == v* ]]; then
      log "erreur : image ${target} introuvable sur ghcr.io"
      exit 1
    fi
    log "image ${target} pas encore publiée, nouvel essai au prochain passage"
    exit 0
  fi

  if [[ $DRY_RUN == true ]]; then
    log "dry-run : basculerait de ${current:-aucune version} vers ${target}"
    exit 0
  fi

  if [[ $TARGET_ARG == v* ]]; then env_set PINNED true; fi
  if [[ -n $current ]]; then env_set PREVIOUS_TAG "$current"; fi
  env_set IMAGE_TAG "$target"
  log "bascule de ${current:-aucune version} vers ${target}"
  if start_and_check; then
    env_set FAILED_TARGET
    prune
    log "en service : ${target}"
    return 0
  fi

  env_set FAILED_TARGET "$target"
  if [[ -z $current ]]; then
    alert "indisponible : ${target} en échec, aucune version précédente"
    exit 1
  fi
  env_set IMAGE_TAG "$current"
  if start_and_check; then
    alert "${target} en échec, retour à ${current}"
  else
    alert "indisponible : ${target} en échec, retour à ${current} en échec aussi"
  fi
  exit 1
}

main() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --dry-run) DRY_RUN=true ;;
      --verbose) VERBOSE=true ;;
      staging | prod)
        [[ -z $ENV_NAME ]] || usage
        ENV_NAME="$arg"
        ;;
      --unpin)
        [[ -z $TARGET_ARG ]] || usage
        TARGET_ARG="$arg"
        ;;
      *)
        [[ -z $TARGET_ARG && $arg =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || usage
        TARGET_ARG="$arg"
        ;;
    esac
  done
  [[ -n $ENV_NAME ]] || usage
  [[ $ENV_NAME == prod || -z $TARGET_ARG ]] || usage

  if [[ ! -f $ENV_FILE ]]; then
    echo "fichier absent : ${ENV_FILE}" >&2
    exit 1
  fi
  # Une seule exécution à la fois par environnement.
  exec 9<"$ENV_FILE"
  if ! flock -n 9; then
    debug "une mise à jour est déjà en cours"
    exit 0
  fi

  if [[ $ENV_NAME == staging ]]; then update_staging; else update_prod; fi
}

main "$@"
