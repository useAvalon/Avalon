# Maintainer setup (open source)

Use this checklist when hardening [useAvalon/Avalon](https://github.com/useAvalon/Avalon) for public contribution.

## Contribution model

- **Fork + PR only.** Do not grant outside collaborators write access to `main` so forks cannot push upstream branches.
- **Squash merge** is the only merge method on `main`.
- **[CODEOWNERS](./CODEOWNERS)** + branch protection **`require_code_owner_reviews`** so every PR needs maintainer approval.
- **Required CI** before merge (job names must match [.github/workflows/ci.yml](./workflows/ci.yml)):
  - `Lint`
  - `Test`
  - `Type Check`
  - `Install smoke`

Fork PRs run the same CI workflow; they cannot merge without green checks and a review.

## GitHub repository rulesets

Apply rules in **Settings → Rules → Rulesets** (or run the script below as an org admin). Repository rulesets require the repo to be **public** (or GitHub Pro on a private repo).

### Protect `main`

Applied via **branch protection** (Settings → Branches → `main`) or `scripts/github-apply-rulesets.sh`:

| Rule | Setting |
|------|---------|
| Target | `main` |
| Pull request | ≥1 approval, dismiss stale reviews, **require CODEOWNERS**, resolve review threads |
| Required checks | `Lint`, `Test`, `Type Check`, `Install smoke` (strict: branch must be up to date) |
| Merge methods | Squash only (repo setting) |

### Protect release tags (optional)

| Rule | Setting |
|------|---------|
| Target | `refs/tags/v*` |
| Deletion / non-fast-forward | Block |

### Apply via CLI (admin token)

From repo root, after editing bypass actor if needed:

```bash
./scripts/github-apply-rulesets.sh
```

Requires `gh auth` with permission to manage rulesets on `useAvalon/Avalon`.

## Bots and automation

Documented in [CONTRIBUTING.md](../CONTRIBUTING.md):

- [Changeset Bot](https://github.com/apps/changeset-bot) on the repo
- [pkg.pr.new](https://github.com/apps/pkg-pr-new) for **`pr preview`** label
- **Settings → Actions → General:** allow GitHub Actions to create and approve pull requests (Version packages PR)

## Security

- Enable **Private vulnerability reporting** (Security → Advisories) — linked from [SECURITY.md](../SECURITY.md).
- Dependabot: [.github/dependabot.yml](./dependabot.yml) (Bun + GitHub Actions, weekly).

## npm trusted publishing

See CONTRIBUTING **Releases (maintainers)** for OIDC trusted publishers on `release.yml`.
