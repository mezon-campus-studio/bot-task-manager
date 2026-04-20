#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=ci/gcp/common.sh
source "${ROOT_DIR}/ci/gcp/common.sh"

require_command gcloud
require_command curl

require_env ROLLBACK_TARGET DEPLOY_ENVIRONMENT GCP_PROJECT_ID GCP_REGION CLOUD_RUN_SERVICE

normalize_environment "$DEPLOY_ENVIRONMENT"

PROJECT_ID="$GCP_PROJECT_ID"
REGION="$GCP_REGION"
SERVICE_NAME="$CLOUD_RUN_SERVICE"
REVISION_NAME="$ROLLBACK_TARGET"

if [[ -n "${ROLLBACK_REASON:-}" ]]; then
  log "INFO" "Rollback reason: ${ROLLBACK_REASON}"
fi

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q .; then
  die "gcloud is not authenticated. The workflow must run google-github-actions/auth first."
fi

gcloud run revisions describe "$REVISION_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  >/dev/null

OWNING_SERVICE="$(
  gcloud run revisions describe "$REVISION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(metadata.labels."serving.knative.dev/service")'
)"

[[ "$OWNING_SERVICE" == "$SERVICE_NAME" ]] || die "Revision ${REVISION_NAME} does not belong to ${SERVICE_NAME}"

log "INFO" "Routing 100% of traffic for ${SERVICE_NAME} to revision ${REVISION_NAME}"
gcloud run services update-traffic "$SERVICE_NAME" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --to-revisions="${REVISION_NAME}=100" \
  >/dev/null

SERVICE_URL="$(
  gcloud run services describe "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(status.url)'
)"

[[ -n "$SERVICE_URL" ]] || die "Unable to resolve Cloud Run service URL after rollback"

for _ in $(seq 1 20); do
  if curl --fail --silent --show-error "${SERVICE_URL}/health" >/dev/null; then
    log "INFO" "Rollback successful. ${SERVICE_NAME} now serves ${REVISION_NAME}"
    exit 0
  fi
  sleep 5
done

die "Rolled back traffic to ${REVISION_NAME}, but ${SERVICE_URL}/health never became healthy"
