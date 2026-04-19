#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=ci/gcp/common.sh
source "${ROOT_DIR}/ci/gcp/common.sh"

usage() {
  cat <<'EOF'
Usage:
  ./ci/gcp/sync_secrets.sh <dev|prod> <project-id> <path-to-secrets.env>

The env file must define all runtime secrets:
  DB_USERNAME=app
  DB_PASSWORD=...
  JWT_SECRET=...
  JWT_REFRESH_SECRET=...
  CLIENT_ID=...
  CLIENT_SECRET=...
  MEZON_BOT_ID=...
  MEZON_BOT_TOKEN=...
EOF
}

ENVIRONMENT="${1:-}"
PROJECT_ID="${2:-}"
SECRETS_FILE="${3:-}"

if [[ -z "$ENVIRONMENT" || -z "$PROJECT_ID" || -z "$SECRETS_FILE" ]]; then
  usage
  exit 1
fi

normalize_environment "$ENVIRONMENT"
require_command gcloud

[[ -f "$SECRETS_FILE" ]] || die "Secrets file not found: ${SECRETS_FILE}"

declare -A SECRET_VALUES=()

trim_line() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

strip_wrapping_quotes() {
  local value="$1"
  if [[ "$value" =~ ^\".*\"$ ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  local_line="$(trim_line "$raw_line")"
  [[ -z "$local_line" || "${local_line:0:1}" == "#" ]] && continue
  [[ "$local_line" == *"="* ]] || die "Invalid line in ${SECRETS_FILE}: ${raw_line}"

  key="$(trim_line "${local_line%%=*}")"
  value="$(strip_wrapping_quotes "${local_line#*=}")"
  SECRET_VALUES["$key"]="$value"
done <"$SECRETS_FILE"

for secret_name in "${SAMPLE_CAMPUS_RUNTIME_SECRETS[@]}"; do
  [[ -n "${SECRET_VALUES[$secret_name]+set}" ]] || die "Missing ${secret_name} in ${SECRETS_FILE}"
done

if [[ "${SECRET_VALUES[DB_USERNAME]}" != "$(sql_username_name)" ]]; then
  die "DB_USERNAME must stay fixed to $(sql_username_name)"
fi

for secret_name in "${SAMPLE_CAMPUS_RUNTIME_SECRETS[@]}"; do
  ensure_secret "$PROJECT_ID" "$secret_name"
  current_value="$(latest_secret_value "$PROJECT_ID" "$secret_name")"
  next_value="${SECRET_VALUES[$secret_name]}"

  if [[ "$current_value" == "$next_value" ]]; then
    log "INFO" "Secret ${secret_name} already matches latest value"
    continue
  fi

  log "INFO" "Adding new Secret Manager version for ${secret_name}"
  add_secret_version "$PROJECT_ID" "$secret_name" "$next_value"
done

log "INFO" "Updating Cloud SQL password for user $(sql_username_name)"
gcloud sql users set-password "$(sql_username_name)" \
  --project="$PROJECT_ID" \
  --instance="$(sql_instance_name)" \
  --password="${SECRET_VALUES[DB_PASSWORD]}" \
  >/dev/null

log "INFO" "Secret sync complete for ${PROJECT_ID}"
