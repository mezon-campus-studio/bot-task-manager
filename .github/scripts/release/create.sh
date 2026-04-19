#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/release/common.sh
source "${SCRIPT_DIR}/common.sh"

require_gh_auth
configure_git
ensure_release_labels

active_pr="$(get_active_release_pr || true)"

if [ -n "${active_pr}" ]; then
  release_number="$(printf '%s' "${active_pr}" | jq -r '.number')"
  release_branch="$(printf '%s' "${active_pr}" | jq -r '.headRefName')"

  if ! release_pr_tracks_source_branch "${active_pr}"; then
    sync_release_pr_body "${release_number}" "${release_branch}"
  fi
else
  release_branch="$(ensure_active_release_branch)"
  active_pr="$(ensure_active_release_pr_for_branch "${release_branch}" || true)"
fi

if [ -n "${active_pr}" ]; then
  release_number="$(printf '%s' "${active_pr}" | jq -r '.number')"
else
  release_number=""
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "release_pr_number=${release_number}" >> "${GITHUB_OUTPUT}"
  echo "release_branch=${release_branch}" >> "${GITHUB_OUTPUT}"
fi
