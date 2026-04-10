#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/release/common.sh
source "${SCRIPT_DIR}/common.sh"

require_gh_auth
configure_git

git fetch origin "${RELEASE_TARGET_BRANCH}" "${RELEASE_SOURCE_BRANCH}" --prune
git checkout -B "${RELEASE_SOURCE_BRANCH}" "origin/${RELEASE_SOURCE_BRANCH}"

if git merge-base --is-ancestor "origin/${RELEASE_TARGET_BRANCH}" HEAD; then
  echo "${RELEASE_SOURCE_BRANCH} already contains ${RELEASE_TARGET_BRANCH}. Nothing to acknowledge."
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "acknowledged=false" >> "${GITHUB_OUTPUT}"
  fi
  exit 0
fi

merge_message="Acknowledge release history from ${RELEASE_TARGET_BRANCH}"
git merge -s ours --no-ff "origin/${RELEASE_TARGET_BRANCH}" -m "${merge_message}"
git push origin "HEAD:${RELEASE_SOURCE_BRANCH}"

echo "Acknowledged ${RELEASE_TARGET_BRANCH} history on ${RELEASE_SOURCE_BRANCH} using an ours merge."

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "acknowledged=true" >> "${GITHUB_OUTPUT}"
fi
