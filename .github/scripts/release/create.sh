#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/release/common.sh
source "${SCRIPT_DIR}/common.sh"

require_gh_auth
configure_git
ensure_release_labels
assert_no_legacy_release_pr

bash "${SCRIPT_DIR}/enqueue.sh"
active_pr="$(get_active_release_pr || true)"
release_branch="${RELEASE_SOURCE_BRANCH}"

if [ -n "${active_pr}" ]; then
  release_number="$(printf '%s' "${active_pr}" | jq -r '.number')"
else
  release_number=""
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "release_pr_number=${release_number}" >> "${GITHUB_OUTPUT}"
  echo "release_branch=${release_branch}" >> "${GITHUB_OUTPUT}"
fi
