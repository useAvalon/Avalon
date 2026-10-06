#!/usr/bin/env bash
# Apply GitHub repository rulesets for useAvalon/Avalon (Protect main + v* tags).
# Run once with gh authenticated as an org/repo admin. Idempotent: skips if names exist.

set -euo pipefail

REPO="${GITHUB_REPOSITORY:-useAvalon/Avalon}"

existing="$(gh api "repos/${REPO}/rulesets" --jq '.[].name' 2>/dev/null || true)"

if echo "$existing" | grep -qx 'Protect main'; then
	echo "Ruleset 'Protect main' already exists on ${REPO} — skip."
else
	gh api --method POST "repos/${REPO}/rulesets" \
		--input - <<'EOF'
{
  "name": "Protect main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": true,
        "required_review_thread_resolution": true,
        "require_extra_approval_for_unattributed_changes": true,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "Lint", "integration_id": 15368 },
          { "context": "Test", "integration_id": 15368 },
          { "context": "Type Check", "integration_id": 15368 },
          { "context": "Install smoke", "integration_id": 15368 }
        ]
      }
    }
  ]
}
EOF
	echo "Created ruleset: Protect main"
fi

if echo "$existing" | grep -qx 'Protect release tags'; then
	echo "Ruleset 'Protect release tags' already exists on ${REPO} — skip."
else
	gh api --method POST "repos/${REPO}/rulesets" \
		--input - <<'EOF'
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

echo "Done. Verify under: https://github.com/${REPO}/rules"
