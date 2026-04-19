#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/release/common.sh
source "${SCRIPT_DIR}/common.sh"

: "${PR_NUMBER:?PR_NUMBER is required}"

require_gh_auth
configure_git
ensure_release_labels

active_pr="$(get_active_release_pr || true)"

if [ -n "${active_pr}" ] && release_pr_tracks_source_branch "${active_pr}"; then
  echo "Cannot dequeue PR #${PR_NUMBER} while the active release PR tracks ${RELEASE_SOURCE_BRANCH} directly." >&2
  echo "Either close/promote the current ${RELEASE_SOURCE_BRANCH} -> ${RELEASE_TARGET_BRANCH} release PR, or switch back to a queued release branch flow before using dequeue." >&2
  exit 1
fi

dequeue_pr_from_active_release "${PR_NUMBER}" "Removed from the active release queue."
