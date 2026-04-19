#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=ci/gcp/common.sh
source "${ROOT_DIR}/ci/gcp/common.sh"

usage() {
  cat <<'EOF'
Usage:
  ./ci/gcp/setup_monitoring.sh <dev|prod> <project-id>

Optional environment variables:
  GCP_REGION=asia-southeast1
  NOTIFICATION_CHANNELS=projects/<project>/notificationChannels/<id>,...
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
require_command python3

REGION="$(gcp_region)"
SERVICE_NAME="$(cloud_run_service_name)"
JOB_NAME="$(cloud_run_job_name)"
UPTIME_DISPLAY_NAME="sample-campus ${ENVIRONMENT} healthz"
UPTIME_PATH="/healthz"
SERVICE_URL="$(
  gcloud run services describe "$SERVICE_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --format='value(status.url)'
)"

[[ -n "$SERVICE_URL" ]] || die "Cloud Run service ${SERVICE_NAME} has no URL yet"

SERVICE_HOST="$(python3 - <<'PY' "$SERVICE_URL"
from urllib.parse import urlparse
import sys
print(urlparse(sys.argv[1]).netloc)
PY
)"

cleanup_existing_uptime_check() {
  local existing_name
  existing_name="$(
    gcloud monitoring uptime list \
      --project="$PROJECT_ID" \
      --format='value(name)' \
      --filter="displayName=\"${UPTIME_DISPLAY_NAME}\"" \
      2>/dev/null || true
  )"

  if [[ -n "$existing_name" ]]; then
    log "INFO" "Deleting existing uptime check ${UPTIME_DISPLAY_NAME}"
    gcloud monitoring uptime delete "$existing_name" --project="$PROJECT_ID" --quiet >/dev/null
  fi
}

delete_alert_policy_if_exists() {
  local display_name="$1"
  local existing_name
  existing_name="$(
    gcloud monitoring policies list \
      --project="$PROJECT_ID" \
      --format='value(name)' \
      --filter="displayName=\"${display_name}\"" \
      2>/dev/null || true
  )"

  if [[ -n "$existing_name" ]]; then
    log "INFO" "Deleting existing alert policy ${display_name}"
    gcloud monitoring policies delete "$existing_name" --project="$PROJECT_ID" --quiet >/dev/null
  fi
}

cleanup_existing_uptime_check

log "INFO" "Creating uptime check ${UPTIME_DISPLAY_NAME}"
gcloud monitoring uptime create "$UPTIME_DISPLAY_NAME" \
  --project="$PROJECT_ID" \
  --resource-type="uptime-url" \
  --resource-labels="host=${SERVICE_HOST},project_id=${PROJECT_ID}" \
  --path="$UPTIME_PATH" \
  --protocol="https" \
  --period="60s" \
  --timeout="10s" \
  --status-classes="2xx" \
  >/dev/null

UPTIME_RESOURCE_NAME="$(
  gcloud monitoring uptime list \
    --project="$PROJECT_ID" \
    --format='value(name)' \
    --filter="displayName=\"${UPTIME_DISPLAY_NAME}\""
)"
UPTIME_CHECK_ID="${UPTIME_RESOURCE_NAME##*/}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cat >"${TMP_DIR}/uptime-policy.json" <<EOF
{
  "displayName": "sample-campus ${ENVIRONMENT} service down",
  "combiner": "OR",
  "documentation": {
    "content": "Cloud Run service \`${SERVICE_NAME}\` failed the public /healthz uptime check in ${ENVIRONMENT}.",
    "mimeType": "text/markdown"
  },
  "conditions": [
    {
      "displayName": "sample-campus ${ENVIRONMENT} uptime failed",
      "conditionThreshold": {
        "filter": "metric.type=\\"monitoring.googleapis.com/uptime_check/check_passed\\" AND resource.type=\\"uptime_url\\" AND metric.label.check_id=\\"${UPTIME_CHECK_ID}\\"",
        "aggregations": [
          {
            "alignmentPeriod": "120s",
            "perSeriesAligner": "ALIGN_NEXT_OLDER"
          }
        ],
        "comparison": "COMPARISON_LT",
        "thresholdValue": 1,
        "duration": "120s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "enabled": true
}
EOF

cat >"${TMP_DIR}/job-policy.json" <<EOF
{
  "displayName": "sample-campus ${ENVIRONMENT} migration job failed",
  "combiner": "OR",
  "documentation": {
    "content": "Cloud Run job \`${JOB_NAME}\` reported failed executions in ${ENVIRONMENT}.",
    "mimeType": "text/markdown"
  },
  "conditions": [
    {
      "displayName": "sample-campus ${ENVIRONMENT} failed migrations",
      "conditionThreshold": {
        "filter": "metric.type=\\"run.googleapis.com/job/completed_execution_count\\" AND resource.type=\\"cloud_run_job\\" AND resource.label.job_name=\\"${JOB_NAME}\\" AND metric.label.result=\\"failed\\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "enabled": true
}
EOF

cat >"${TMP_DIR}/http-5xx-policy.json" <<EOF
{
  "displayName": "sample-campus ${ENVIRONMENT} 5xx traffic",
  "combiner": "OR",
  "documentation": {
    "content": "Cloud Run service \`${SERVICE_NAME}\` served 5xx responses in ${ENVIRONMENT}.",
    "mimeType": "text/markdown"
  },
  "conditions": [
    {
      "displayName": "sample-campus ${ENVIRONMENT} 5xx requests",
      "conditionThreshold": {
        "filter": "metric.type=\\"run.googleapis.com/request_count\\" AND resource.type=\\"cloud_run_revision\\" AND resource.label.service_name=\\"${SERVICE_NAME}\\" AND metric.label.response_code_class=\\"5xx\\"",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "trigger": {
          "count": 1
        }
      }
    }
  ],
  "enabled": true
}
EOF

create_policy() {
  local display_name="$1"
  local policy_file="$2"

  delete_alert_policy_if_exists "$display_name"
  log "INFO" "Creating alert policy ${display_name}"
  if [[ -n "${NOTIFICATION_CHANNELS:-}" ]]; then
    gcloud monitoring policies create \
      --project="$PROJECT_ID" \
      --policy-from-file="$policy_file" \
      --notification-channels="${NOTIFICATION_CHANNELS}" \
      >/dev/null
  else
    gcloud monitoring policies create \
      --project="$PROJECT_ID" \
      --policy-from-file="$policy_file" \
      >/dev/null
  fi
}

create_policy "sample-campus ${ENVIRONMENT} service down" "${TMP_DIR}/uptime-policy.json"
create_policy "sample-campus ${ENVIRONMENT} migration job failed" "${TMP_DIR}/job-policy.json"
create_policy "sample-campus ${ENVIRONMENT} 5xx traffic" "${TMP_DIR}/http-5xx-policy.json"

log "INFO" "Monitoring bootstrap complete for ${PROJECT_ID}"
