#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/release/common.sh
source "${SCRIPT_DIR}/common.sh"

require_gh_auth
configure_git
ensure_release_labels
assert_no_legacy_release_pr

active_pr="$(get_active_release_pr)"

if [ -z "${active_pr}" ]; then
  echo "No active release PR found."
  exit 1
fi

release_number="$(printf '%s' "${active_pr}" | jq -r '.number')"
release_branch="$(printf '%s' "${active_pr}" | jq -r '.headRefName')"

gh pr merge "${release_number}" --merge

echo "Promoted release PR #${release_number} from ${release_branch} into ${RELEASE_TARGET_BRANCH}."
