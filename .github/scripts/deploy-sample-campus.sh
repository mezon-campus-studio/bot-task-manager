#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=ci/gcp/common.sh
source "${ROOT_DIR}/ci/gcp/common.sh"

require_command gcloud
require_command curl

require_env \
  IMAGE_REF \
  DEPLOY_ENVIRONMENT \
  GCP_PROJECT_ID \
  GCP_REGION \
  GAR_REPOSITORY \
  CLOUD_RUN_SERVICE \
  CLOUD_RUN_JOB \
  FRONTEND_URL \
  OAUTH_URL \
  GCP_DEPLOY_SERVICE_ACCOUNT

normalize_environment "$DEPLOY_ENVIRONMENT"

PROJECT_ID="$GCP_PROJECT_ID"
REGION="$GCP_REGION"
SERVICE_NAME="$CLOUD_RUN_SERVICE"
JOB_NAME="$CLOUD_RUN_JOB"
IMAGE="${IMAGE_REF}"
INSTANCE_CONNECTION_NAME="$(cloudsql_instance_connection_name "$PROJECT_ID" "$REGION")"
DB_SOCKET_PATH="$(cloudsql_socket_path "$PROJECT_ID" "$REGION")"
RUNTIME_SA_EMAIL="$(runtime_service_account_email "$PROJECT_ID")"
MIN_INSTANCES="0"
MAX_INSTANCES="2"

if [[ "$DEPLOY_ENVIRONMENT" == "prod" ]]; then
  MIN_INSTANCES="1"
  MAX_INSTANCES="5"
fi

if [[ "$GCP_DEPLOY_SERVICE_ACCOUNT" != "$(deployer_service_account_email "$PROJECT_ID")" ]]; then
  die "GCP_DEPLOY_SERVICE_ACCOUNT does not match the expected sample-campus deployer service account"
fi

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q .; then
  die "gcloud is not authenticated. The workflow must run google-github-actions/auth first."
fi

for secret_name in "${SAMPLE_CAMPUS_RUNTIME_SECRETS[@]}"; do
  secret_exists "$PROJECT_ID" "$secret_name" || die "Missing Secret Manager secret ${secret_name} in ${PROJECT_ID}"
  secret_has_versions "$PROJECT_ID" "$secret_name" || die "Secret ${secret_name} has no versions yet. Run ci/gcp/sync_secrets.sh first."
done

set_env_vars="$(
  join_by "," \
    "NODE_ENV=production" \
    "PORT=4000" \
    "DB_HOST=${DB_SOCKET_PATH}" \
    "DB_PORT=5432" \
    "DB_DATABASE=$(sql_database_name)" \
    "FRONTEND_URL=${FRONTEND_URL}" \
    "OAUTH_URL=${OAUTH_URL}" \
    "NEZON_DISABLE_BOOTSTRAP=${NEZON_DISABLE_BOOTSTRAP:-true}"
)"

set_secrets="$(
  join_by "," \
    "DB_USERNAME=DB_USERNAME:latest" \
    "DB_PASSWORD=DB_PASSWORD:latest" \
    "JWT_SECRET=JWT_SECRET:latest" \
    "JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest" \
    "CLIENT_ID=CLIENT_ID:latest" \
    "CLIENT_SECRET=CLIENT_SECRET:latest" \
    "MEZON_BOT_ID=MEZON_BOT_ID:latest" \
    "MEZON_BOT_TOKEN=MEZON_BOT_TOKEN:latest"
)"

log "INFO" "Preparing Cloud Run migration job ${JOB_NAME}"
if gcloud run jobs describe "$JOB_NAME" --project="$PROJECT_ID" --region="$REGION" >/dev/null 2>&1; then
  gcloud run jobs update "$JOB_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --image="$IMAGE" \
    --service-account="$RUNTIME_SA_EMAIL" \
    --tasks=1 \
    --parallelism=1 \
    --max-retries=3 \
    --task-timeout=900s \
    --cpu=1 \
    --memory=512Mi \
    --set-cloudsql-instances="$INSTANCE_CONNECTION_NAME" \
    --set-env-vars="$set_env_vars" \
    --set-secrets="$set_secrets" \
    --command="sh" \
    --args="-c,yarn migrate:prod" \
    --labels="app=sample-campus,component=migrate,environment=${DEPLOY_ENVIRONMENT}" \
    >/dev/null
else
  gcloud run jobs create "$JOB_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --image="$IMAGE" \
    --service-account="$RUNTIME_SA_EMAIL" \
    --tasks=1 \
    --parallelism=1 \
    --max-retries=3 \
    --task-timeout=900s \
    --cpu=1 \
    --memory=512Mi \
    --set-cloudsql-instances="$INSTANCE_CONNECTION_NAME" \
    --set-env-vars="$set_env_vars" \
    --set-secrets="$set_secrets" \
    --command="sh" \
    --args="-c,yarn migrate:prod" \
    --labels="app=sample-campus,component=migrate,environment=${DEPLOY_ENVIRONMENT}" \
    >/dev/null
fi

log "INFO" "Executing migration job ${JOB_NAME}"
gcloud run jobs execute "$JOB_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --wait \
  >/dev/null

log "INFO" "Deploying Cloud Run service ${SERVICE_NAME}"
gcloud run deploy "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$IMAGE" \
  --service-account="$RUNTIME_SA_EMAIL" \
  --port=4000 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80 \
  --timeout=300s \
  --min-instances="$MIN_INSTANCES" \
  --max-instances="$MAX_INSTANCES" \
  --ingress="all" \
  --allow-unauthenticated \
  --set-cloudsql-instances="$INSTANCE_CONNECTION_NAME" \
  --set-env-vars="$set_env_vars" \
  --set-secrets="$set_secrets" \
  --command="sh" \
  --args="-c,yarn start:prod" \
  --labels="app=sample-campus,component=api,environment=${DEPLOY_ENVIRONMENT}" \
  >/dev/null

SERVICE_URL="$(
  gcloud run services describe "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(status.url)'
)"

[[ -n "$SERVICE_URL" ]] || die "Unable to resolve Cloud Run service URL after deploy"

log "INFO" "Waiting for ${SERVICE_URL}/healthz"
for _ in $(seq 1 20); do
  if curl --fail --silent --show-error "${SERVICE_URL}/healthz" >/dev/null; then
    log "INFO" "Deploy successful: ${SERVICE_URL}"
    exit 0
  fi
  sleep 5
done

die "Cloud Run service never became healthy at ${SERVICE_URL}/healthz"
