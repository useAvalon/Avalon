#!/usr/bin/env bash
# Harden useAvalon/Avalon: branch protection on main, tag ruleset, squash-only merges.
# Requires gh auth as repo admin. Idempotent.

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-useAvalon/Avalon}"

echo "Repository: ${REPO}"

visibility="$(gh api "repos/${REPO}" --jq .visibility)"
if [ "$visibility" = "private" ]; then
	echo "error: rulesets and branch protection need a public repo or GitHub Pro." >&2
	exit 1
fi

echo "Configuring squash-only merges…"
gh api --method PATCH "repos/${REPO}" \
	-f allow_squash_merge=true \
	-f allow_merge_commit=false \
	-f allow_rebase_merge=false >/dev/null

if gh api "repos/${REPO}/branches/main/protection" >/dev/null 2>&1; then
	echo "Branch protection on main already exists — updating required checks…"
else
	echo "Creating branch protection on main…"
fi

gh api --method PUT "repos/${REPO}/branches/main/protection" --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Lint" },
      { "context": "Test" },
      { "context": "Type Check" },
      { "context": "Install smoke" }
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF

existing="$(gh api "repos/${REPO}/rulesets" --jq '.[].name' 2>/dev/null || true)"

if echo "$existing" | grep -qx 'Protect release tags'; then
	echo "Ruleset 'Protect release tags' already exists — skip."
else
	gh api --method POST "repos/${REPO}/rulesets" --input - <<'EOF'
{
  "name": "Protect release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/tags/v*"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" }
  ]
}
EOF
	echo "Created ruleset: Protect release tags"
fi

echo "Enabling security notifications…"
gh api --method PUT "repos/${REPO}/vulnerability-alerts" >/dev/null 2>&1 || true
gh api --method PUT "repos/${REPO}/private-vulnerability-reporting" >/dev/null 2>&1 || true

echo "Done."
echo "  Branch: https://github.com/${REPO}/settings/branches"
echo "  Rules:  https://github.com/${REPO}/rules"
