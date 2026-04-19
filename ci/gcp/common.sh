#!/usr/bin/env bash

readonly SAMPLE_CAMPUS_APP_NAME="sample-campus"
readonly SAMPLE_CAMPUS_GAR_REPOSITORY_DEFAULT="sample-campus"
readonly SAMPLE_CAMPUS_CLOUD_RUN_SERVICE_DEFAULT="sample-campus-api"
readonly SAMPLE_CAMPUS_CLOUD_RUN_JOB_DEFAULT="sample-campus-migrate"
readonly SAMPLE_CAMPUS_SQL_INSTANCE_DEFAULT="pg-main"
readonly SAMPLE_CAMPUS_SQL_DATABASE_DEFAULT="sample_campus"
readonly SAMPLE_CAMPUS_SQL_USERNAME_DEFAULT="app"
readonly SAMPLE_CAMPUS_RUNTIME_SERVICE_ACCOUNT_ID_DEFAULT="sample-campus-runtime"
readonly SAMPLE_CAMPUS_DEPLOYER_SERVICE_ACCOUNT_ID_DEFAULT="sample-campus-github-deployer"
readonly SAMPLE_CAMPUS_WIF_POOL_ID_DEFAULT="github-actions"
readonly SAMPLE_CAMPUS_WIF_PROVIDER_ID_DEFAULT="sample-campus"
readonly SAMPLE_CAMPUS_REGION_DEFAULT="asia-southeast1"

SAMPLE_CAMPUS_RUNTIME_SECRETS=(
  DB_USERNAME
  DB_PASSWORD
  JWT_SECRET
  JWT_REFRESH_SECRET
  CLIENT_ID
  CLIENT_SECRET
  MEZON_BOT_ID
  MEZON_BOT_TOKEN
)

log() {
  printf '\n[%s] %s\n' "$1" "$2"
}

die() {
  log "ERROR" "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_env() {
  local missing=()
  local name
  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      missing+=("$name")
    fi
  done

  if ((${#missing[@]} > 0)); then
    die "Missing required environment variables: ${missing[*]}"
  fi
}

normalize_environment() {
  case "$1" in
    dev | prod) ;;
    *) die "Environment must be one of: dev, prod" ;;
  esac
}

join_by() {
  local delimiter="$1"
  shift
  local first="true"
  local part
  for part in "$@"; do
    if [[ "$first" == "true" ]]; then
      printf '%s' "$part"
      first="false"
    else
      printf '%s%s' "$delimiter" "$part"
    fi
  done
}

generate_secret() {
  require_command openssl
  openssl rand -base64 32 | tr -d '\n'
}

project_number() {
  local project_id="$1"
  gcloud projects describe "$project_id" --format='value(projectNumber)'
}

service_account_email() {
  local account_id="$1"
  local project_id="$2"
  printf '%s@%s.iam.gserviceaccount.com' "$account_id" "$project_id"
}

runtime_service_account_email() {
  local project_id="$1"
  service_account_email \
    "${RUNTIME_SERVICE_ACCOUNT_ID:-$SAMPLE_CAMPUS_RUNTIME_SERVICE_ACCOUNT_ID_DEFAULT}" \
    "$project_id"
}

deployer_service_account_email() {
  local project_id="$1"
  service_account_email \
    "${DEPLOYER_SERVICE_ACCOUNT_ID:-$SAMPLE_CAMPUS_DEPLOYER_SERVICE_ACCOUNT_ID_DEFAULT}" \
    "$project_id"
}

wif_pool_id() {
  printf '%s' "${WIF_POOL_ID:-$SAMPLE_CAMPUS_WIF_POOL_ID_DEFAULT}"
}

wif_provider_id() {
  printf '%s' "${WIF_PROVIDER_ID:-$SAMPLE_CAMPUS_WIF_PROVIDER_ID_DEFAULT}"
}

cloud_run_service_name() {
  printf '%s' "${CLOUD_RUN_SERVICE:-$SAMPLE_CAMPUS_CLOUD_RUN_SERVICE_DEFAULT}"
}

cloud_run_job_name() {
  printf '%s' "${CLOUD_RUN_JOB:-$SAMPLE_CAMPUS_CLOUD_RUN_JOB_DEFAULT}"
}

gar_repository_name() {
  printf '%s' "${GAR_REPOSITORY:-$SAMPLE_CAMPUS_GAR_REPOSITORY_DEFAULT}"
}

sql_instance_name() {
  printf '%s' "${SQL_INSTANCE_NAME:-$SAMPLE_CAMPUS_SQL_INSTANCE_DEFAULT}"
}

sql_database_name() {
  printf '%s' "${SQL_DATABASE_NAME:-$SAMPLE_CAMPUS_SQL_DATABASE_DEFAULT}"
}

sql_username_name() {
  printf '%s' "${SQL_USERNAME:-$SAMPLE_CAMPUS_SQL_USERNAME_DEFAULT}"
}

gcp_region() {
  printf '%s' "${GCP_REGION:-$SAMPLE_CAMPUS_REGION_DEFAULT}"
}

cloudsql_instance_connection_name() {
  local project_id="$1"
  local region="$2"
  printf '%s:%s:%s' "$project_id" "$region" "$(sql_instance_name)"
}

cloudsql_socket_path() {
  local project_id="$1"
  local region="$2"
  printf '/cloudsql/%s' "$(cloudsql_instance_connection_name "$project_id" "$region")"
}

secret_exists() {
  local project_id="$1"
  local secret_name="$2"
  gcloud secrets describe "$secret_name" --project="$project_id" >/dev/null 2>&1
}

ensure_secret() {
  local project_id="$1"
  local secret_name="$2"
  if secret_exists "$project_id" "$secret_name"; then
    return 0
  fi

  log "INFO" "Creating Secret Manager secret ${secret_name}"
  gcloud secrets create "$secret_name" \
    --project="$project_id" \
    --replication-policy="automatic" \
    >/dev/null
}

secret_has_versions() {
  local project_id="$1"
  local secret_name="$2"
  [[ -n "$(gcloud secrets versions list "$secret_name" --project="$project_id" --limit=1 --format='value(name)' 2>/dev/null)" ]]
}

latest_secret_value() {
  local project_id="$1"
  local secret_name="$2"
  if ! secret_has_versions "$project_id" "$secret_name"; then
    return 0
  fi

  gcloud secrets versions access latest --secret="$secret_name" --project="$project_id"
}

add_secret_version() {
  local project_id="$1"
  local secret_name="$2"
  local secret_value="$3"
  printf '%s' "$secret_value" | gcloud secrets versions add "$secret_name" \
    --project="$project_id" \
    --data-file=- \
    >/dev/null
}

discover_github_repository() {
  local remote_url
  remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
  if [[ -z "$remote_url" ]]; then
    return 0
  fi

  remote_url="${remote_url%.git}"
  remote_url="${remote_url#https://github.com/}"
  remote_url="${remote_url#git@github.com:}"
  printf '%s' "$remote_url"
}
