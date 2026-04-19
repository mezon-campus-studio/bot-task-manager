#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/release/common.sh
source "${SCRIPT_DIR}/common.sh"

: "${PR_NUMBER:?PR_NUMBER is required}"

require_gh_auth
configure_git
ensure_release_labels

echo "Release Dequeue is not supported in the direct ${RELEASE_SOURCE_BRANCH} -> ${RELEASE_TARGET_BRANCH} release flow." >&2
echo "Use a revert PR on ${RELEASE_SOURCE_BRANCH} instead if a merged change must be kept out of the next release." >&2
exit 1
