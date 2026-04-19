#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/release/common.sh
source "${SCRIPT_DIR}/common.sh"

next_release_title() {
  local date="$1"
  local last_number next_number

  last_number="$(gh pr list \
    --base "${RELEASE_TARGET_BRANCH}" \
    --state all \
    --json title \
    --jq '[.[].title
      | capture("^Release-'"${date}"'_(?<n>[0-9]+)$")?.n
      | select(. != null)
      | tonumber] | max // 0')"
  next_number="$((last_number + 1))"

  printf 'Release-%s_%s\n' "${date}" "${next_number}"
}

resolve_merged_pr_json() {
  local repo

  if [ -n "${PR_NUMBER:-}" ]; then
    gh pr view "${PR_NUMBER}" --json number,title,url,baseRefName,mergedAt
    return 0
  fi

  if [ -z "${GITHUB_SHA:-}" ]; then
    return 0
  fi

  repo="$(repo_name_with_owner)"

  gh api \
    -H "Accept: application/vnd.github+json" \
    "repos/${repo}/commits/${GITHUB_SHA}/pulls" \
    --jq --arg base "${RELEASE_SOURCE_BRANCH}" '
      map(select(.base.ref == $base and .merged_at != null))
      | first
      | if . == null then
          empty
        else
          {
            number,
            title,
            url: .html_url,
            baseRefName: .base.ref,
            mergedAt: .merged_at
          }
        end
    '
}

build_release_body() {
  local merged_entry="${1:-}"

  if [ -n "${merged_entry}" ]; then
    printf '## Merged PRs\n%s\n' "${merged_entry}"
    return 0
  fi

  printf '## Merged PRs\n'
}

require_gh_auth

merged_pr_json="$(resolve_merged_pr_json || true)"
merged_entry=""

if [ -n "${merged_pr_json}" ] && [ "${merged_pr_json}" != "null" ]; then
  pr_number="$(printf '%s' "${merged_pr_json}" | jq -r '.number // empty')"
  pr_title="$(printf '%s' "${merged_pr_json}" | jq -r '.title // empty')"
  pr_url="$(printf '%s' "${merged_pr_json}" | jq -r '.url // empty')"
  base_ref="$(printf '%s' "${merged_pr_json}" | jq -r '.baseRefName // empty')"
  merged_at="$(printf '%s' "${merged_pr_json}" | jq -r '.mergedAt // empty')"

  if [ -n "${pr_number}" ] && [ "${base_ref}" = "${RELEASE_SOURCE_BRANCH}" ] && [ -n "${merged_at}" ]; then
    merged_entry="- #${pr_number} ${pr_title}"
  else
    echo "Resolved PR is not a merged ${RELEASE_SOURCE_BRANCH} PR. Skipping merged PR entry update."
    pr_number=""
    pr_url=""
  fi
else
  pr_number=""
  pr_url=""
fi

date="$(release_date)"
active_pr="$(get_active_release_pr || true)"
existing_pr_number=""

if [ -n "${active_pr}" ]; then
  existing_pr_number="$(printf '%s' "${active_pr}" | jq -r '.number')"
fi

if [ -z "${existing_pr_number}" ] && [ -z "${merged_entry}" ] && [ "${GITHUB_EVENT_NAME:-}" != "workflow_dispatch" ]; then
  echo "No merged ${RELEASE_SOURCE_BRANCH} PR was associated with this push. Skipping release PR update."
  exit 0
fi

if [ -n "${existing_pr_number}" ]; then
  echo "Release PR #${existing_pr_number} already exists. Updating..."

  current_title="$(gh pr view "${existing_pr_number}" --json title --jq '.title')"
  current_date="$(printf '%s' "${current_title}" | sed -n 's/^Release-\([0-9]\{8\}\)_.*/\1/p')"

  if release_pr_tracks_source_branch "${active_pr}" && [ "${current_date}" != "${date}" ]; then
    new_title="$(next_release_title "${date}")"
    gh pr edit "${existing_pr_number}" --title "${new_title}"
    echo "Updated title: ${current_title} -> ${new_title}"
  fi

  if ! release_pr_tracks_source_branch "${active_pr}"; then
    release_branch="$(printf '%s' "${active_pr}" | jq -r '.headRefName')"
    echo "Active release PR tracks ${release_branch}, not ${RELEASE_SOURCE_BRANCH}. Syncing that PR instead of creating a second release PR."
    sync_release_pr_body "${existing_pr_number}" "${release_branch}"
  elif [ -n "${merged_entry}" ]; then
    current_body="$(gh pr view "${existing_pr_number}" --json body --jq '.body // ""')"

    if ! printf '%s' "${current_body}" | grep -qF "#${pr_number} "; then
      if [ -n "${current_body}" ]; then
        new_body="${current_body}
${merged_entry}"
      else
        new_body="$(build_release_body "${merged_entry}")"
      fi

      gh pr edit "${existing_pr_number}" --body "${new_body}"
      echo "Appended: ${merged_entry}"
    else
      echo "PR #${pr_number} is already listed in release PR #${existing_pr_number}. Skipping."
    fi
  fi

  exit 0
fi

title="$(next_release_title "${date}")"
body="$(build_release_body "${merged_entry}")"

gh pr create \
  --base "${RELEASE_TARGET_BRANCH}" \
  --head "${RELEASE_SOURCE_BRANCH}" \
  --title "${title}" \
  --body "${body}"

echo "Created release PR: ${title}"

if [ -n "${pr_number}" ] && [ -n "${pr_url}" ]; then
  echo "Included merged PR #${pr_number}: ${pr_url}"
fi
