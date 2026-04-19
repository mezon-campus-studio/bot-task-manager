#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=ci/gcp/common.sh
source "${ROOT_DIR}/ci/gcp/common.sh"

usage() {
  cat <<'EOF'
Usage:
  ORGANIZATION_ID=123456789012 \
  BILLING_ACCOUNT=000000-000000-000000 \
  GITHUB_REPOSITORY=owner/repo \
  ./ci/gcp/init_gcp.sh <dev|prod> <project-id>

Optional environment variables:
  GCP_REGION=asia-southeast1
  DB_APP_PASSWORD=<strong-password>
  PROJECT_DISPLAY_NAME=<gcp-project-display-name>
  SQL_BACKUP_START_TIME=03:00
EOF
}

ENVIRONMENT="${1:-}"
PROJECT_ID="${2:-}"

if [[ -z "$ENVIRONMENT" || -z "$PROJECT_ID" ]]; then
  usage
  exit 1
fi

normalize_environment "$ENVIRONMENT"

require_command gcloud
require_command git

if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
  GITHUB_REPOSITORY="$(discover_github_repository || true)"
fi

require_env ORGANIZATION_ID BILLING_ACCOUNT GITHUB_REPOSITORY

REGION="$(gcp_region)"
GAR_REPOSITORY_NAME="$(gar_repository_name)"
SERVICE_NAME="$(cloud_run_service_name)"
JOB_NAME="$(cloud_run_job_name)"
SQL_INSTANCE="$(sql_instance_name)"
SQL_DATABASE="$(sql_database_name)"
SQL_USERNAME_VALUE="$(sql_username_name)"
RUNTIME_SA_EMAIL="$(runtime_service_account_email "$PROJECT_ID")"
DEPLOYER_SA_EMAIL="$(deployer_service_account_email "$PROJECT_ID")"
PROJECT_DISPLAY_NAME="${PROJECT_DISPLAY_NAME:-sample-campus-${ENVIRONMENT}}"
SQL_BACKUP_START_TIME="${SQL_BACKUP_START_TIME:-03:00}"
WIF_POOL="$(wif_pool_id)"
WIF_PROVIDER="$(wif_provider_id)"
DB_PASSWORD_VALUE=""

if [[ "$ENVIRONMENT" == "dev" ]]; then
  SQL_TIER="${SQL_TIER:-db-g1-small}"
  SQL_STORAGE_GB="${SQL_STORAGE_GB:-10}"
  ENABLE_PITR="false"
  ENABLE_DELETION_PROTECTION="false"
else
  SQL_TIER="${SQL_TIER:-db-custom-1-3840}"
  SQL_STORAGE_GB="${SQL_STORAGE_GB:-20}"
  ENABLE_PITR="true"
  ENABLE_DELETION_PROTECTION="true"
fi

create_project_if_missing() {
  if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
    log "INFO" "GCP project ${PROJECT_ID} already exists"
    return 0
  fi

  log "INFO" "Creating GCP project ${PROJECT_ID}"
  gcloud projects create "$PROJECT_ID" \
    --name="$PROJECT_DISPLAY_NAME" \
    --organization="$ORGANIZATION_ID" \
    >/dev/null
}

link_billing_if_needed() {
  local current_billing_account
  current_billing_account="$(
    gcloud beta billing projects describe "$PROJECT_ID" \
      --format='value(billingAccountName)' \
      2>/dev/null || true
  )"

  if [[ "$current_billing_account" == "billingAccounts/${BILLING_ACCOUNT}" ]]; then
    log "INFO" "Billing already linked to ${PROJECT_ID}"
    return 0
  fi

  log "INFO" "Linking billing account ${BILLING_ACCOUNT} to ${PROJECT_ID}"
  gcloud beta billing projects link "$PROJECT_ID" \
    --billing-account="$BILLING_ACCOUNT" \
    >/dev/null
}

enable_required_services() {
  log "INFO" "Enabling required Google APIs"
  gcloud services enable \
    artifactregistry.googleapis.com \
    iam.googleapis.com \
    iamcredentials.googleapis.com \
    logging.googleapis.com \
    monitoring.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    serviceusage.googleapis.com \
    sqladmin.googleapis.com \
    sts.googleapis.com \
    --project="$PROJECT_ID" \
    >/dev/null
}

ensure_artifact_registry_repository() {
  if gcloud artifacts repositories describe "$GAR_REPOSITORY_NAME" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    >/dev/null 2>&1; then
    log "INFO" "Artifact Registry repository ${GAR_REPOSITORY_NAME} already exists"
    return 0
  fi

  log "INFO" "Creating Artifact Registry repository ${GAR_REPOSITORY_NAME}"
  gcloud artifacts repositories create "$GAR_REPOSITORY_NAME" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --repository-format="docker" \
    --description="Container images for sample-campus" \
    >/dev/null
}

ensure_service_account() {
  local email="$1"
  local account_id="${email%@*}"
  if gcloud iam service-accounts describe "$email" --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "INFO" "Service account ${email} already exists"
    return 0
  fi

  log "INFO" "Creating service account ${email}"
  gcloud iam service-accounts create "$account_id" \
    --project="$PROJECT_ID" \
    --display-name="$account_id" \
    >/dev/null
}

ensure_workload_identity_pool() {
  if gcloud iam workload-identity-pools describe "$WIF_POOL" \
    --project="$PROJECT_ID" \
    --location="global" \
    >/dev/null 2>&1; then
    log "INFO" "Workload Identity Pool ${WIF_POOL} already exists"
    return 0
  fi

  log "INFO" "Creating Workload Identity Pool ${WIF_POOL}"
  gcloud iam workload-identity-pools create "$WIF_POOL" \
    --project="$PROJECT_ID" \
    --location="global" \
    --display-name="GitHub Actions" \
    >/dev/null
}

ensure_workload_identity_provider() {
  if gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
    --project="$PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="$WIF_POOL" \
    >/dev/null 2>&1; then
    log "INFO" "Workload Identity Provider ${WIF_PROVIDER} already exists"
    return 0
  fi

  log "INFO" "Creating Workload Identity Provider ${WIF_PROVIDER}"
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
    --project="$PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="$WIF_POOL" \
    --display-name="GitHub sample-campus" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.ref=assertion.ref,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository=='${GITHUB_REPOSITORY}'" \
    >/dev/null
}

apply_iam_bindings() {
  local project_number_value
  project_number_value="$(project_number "$PROJECT_ID")"

  log "INFO" "Applying IAM bindings for runtime and deploy identities"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
    --role="roles/cloudsql.client" \
    >/dev/null

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    >/dev/null

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER_SA_EMAIL}" \
    --role="roles/run.admin" \
    >/dev/null

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER_SA_EMAIL}" \
    --role="roles/artifactregistry.writer" \
    >/dev/null

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER_SA_EMAIL}" \
    --role="roles/secretmanager.viewer" \
    >/dev/null

  gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:${DEPLOYER_SA_EMAIL}" \
    --role="roles/iam.serviceAccountUser" \
    >/dev/null

  gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA_EMAIL" \
    --project="$PROJECT_ID" \
    --member="principalSet://iam.googleapis.com/projects/${project_number_value}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPOSITORY}" \
    --role="roles/iam.workloadIdentityUser" \
    >/dev/null
}

create_sql_instance_if_missing() {
  if gcloud sql instances describe "$SQL_INSTANCE" --project="$PROJECT_ID" >/dev/null 2>&1; then
    log "INFO" "Cloud SQL instance ${SQL_INSTANCE} already exists"
    return 0
  fi

  local create_args=(
    gcloud sql instances create "$SQL_INSTANCE"
    --project="$PROJECT_ID"
    --database-version="POSTGRES_15"
    --region="$REGION"
    --tier="$SQL_TIER"
    --storage-size="$SQL_STORAGE_GB"
    --availability-type="ZONAL"
    --backup-start-time="$SQL_BACKUP_START_TIME"
  )

  if [[ "$ENABLE_PITR" == "true" ]]; then
    create_args+=(--enable-point-in-time-recovery)
  fi

  if [[ "$ENABLE_DELETION_PROTECTION" == "true" ]]; then
    create_args+=(--deletion-protection)
  fi

  log "INFO" "Creating Cloud SQL instance ${SQL_INSTANCE}"
  "${create_args[@]}" >/dev/null
}

ensure_sql_database() {
  if gcloud sql databases describe "$SQL_DATABASE" \
    --instance="$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    >/dev/null 2>&1; then
    log "INFO" "Cloud SQL database ${SQL_DATABASE} already exists"
    return 0
  fi

  log "INFO" "Creating Cloud SQL database ${SQL_DATABASE}"
  gcloud sql databases create "$SQL_DATABASE" \
    --instance="$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    >/dev/null
}

ensure_runtime_secrets() {
  local secret_name
  for secret_name in "${SAMPLE_CAMPUS_RUNTIME_SECRETS[@]}"; do
    ensure_secret "$PROJECT_ID" "$secret_name"
  done
}

seed_db_runtime_secrets() {
  local db_username_current
  local db_password_current

  db_username_current="$(latest_secret_value "$PROJECT_ID" DB_USERNAME)"
  if [[ -z "$db_username_current" ]]; then
    log "INFO" "Seeding DB_USERNAME secret"
    add_secret_version "$PROJECT_ID" DB_USERNAME "$SQL_USERNAME_VALUE"
  elif [[ "$db_username_current" != "$SQL_USERNAME_VALUE" ]]; then
    die "DB_USERNAME secret already exists with value ${db_username_current}; expected ${SQL_USERNAME_VALUE}"
  fi

  if [[ -n "${DB_APP_PASSWORD:-}" ]]; then
    db_password_current="$DB_APP_PASSWORD"
  else
    db_password_current="$(latest_secret_value "$PROJECT_ID" DB_PASSWORD)"
  fi

  if [[ -z "$db_password_current" ]]; then
    db_password_current="$(generate_secret)"
    log "INFO" "Generated initial DB_PASSWORD secret version"
  fi

  if [[ "$(latest_secret_value "$PROJECT_ID" DB_PASSWORD)" != "$db_password_current" ]]; then
    add_secret_version "$PROJECT_ID" DB_PASSWORD "$db_password_current"
  fi

  DB_PASSWORD_VALUE="$db_password_current"
}

ensure_sql_user() {
  if gcloud sql users list \
    --instance="$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --format='value(name)' \
    | grep -qx "$SQL_USERNAME_VALUE"; then
    log "INFO" "Updating Cloud SQL user ${SQL_USERNAME_VALUE} password"
    gcloud sql users set-password "$SQL_USERNAME_VALUE" \
      --instance="$SQL_INSTANCE" \
      --project="$PROJECT_ID" \
      --password="$DB_PASSWORD_VALUE" \
      >/dev/null
    return 0
  fi

  log "INFO" "Creating Cloud SQL user ${SQL_USERNAME_VALUE}"
  gcloud sql users create "$SQL_USERNAME_VALUE" \
    --instance="$SQL_INSTANCE" \
    --project="$PROJECT_ID" \
    --password="$DB_PASSWORD_VALUE" \
    >/dev/null
}

print_summary() {
  local project_number_value
  project_number_value="$(project_number "$PROJECT_ID")"

  cat <<EOF

Bootstrap complete for ${PROJECT_ID}.

GitHub environment variables to configure:
  GCP_PROJECT_ID=${PROJECT_ID}
  GCP_PROJECT_NUMBER=${project_number_value}
  GCP_REGION=${REGION}
  GCP_WIF_PROVIDER=projects/${project_number_value}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}
  GCP_DEPLOY_SERVICE_ACCOUNT=${DEPLOYER_SA_EMAIL}
  GAR_REPOSITORY=${GAR_REPOSITORY_NAME}
  CLOUD_RUN_SERVICE=${SERVICE_NAME}
  CLOUD_RUN_JOB=${JOB_NAME}

Still set these manually per environment:
  FRONTEND_URL=<environment frontend url>
  OAUTH_URL=<environment oauth base url>

Next steps:
  1. Fill one of the templates under ci/gcp/templates/.
  2. Run ./ci/gcp/sync_secrets.sh ${ENVIRONMENT} ${PROJECT_ID} <path-to-secrets.env>
  3. Trigger the Sample Campus Deploy workflow.
EOF
}

create_project_if_missing
link_billing_if_needed
enable_required_services
ensure_artifact_registry_repository
ensure_service_account "$RUNTIME_SA_EMAIL"
ensure_service_account "$DEPLOYER_SA_EMAIL"
ensure_workload_identity_pool
ensure_workload_identity_provider
apply_iam_bindings
create_sql_instance_if_missing
ensure_sql_database
ensure_runtime_secrets
seed_db_runtime_secrets
ensure_sql_user
print_summary
