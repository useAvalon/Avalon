# Changesets

Package changes that should ship to npm need a changeset in this PR:

```bash
bunx changeset
```

## Fixed group (bump together)

`@useavalon/avalon`, `@useavalon/core`, `@useavalon/preact`, `@useavalon/seo`, `create-avalon` — the default install stack from `create-avalon`.

## Independent (own changeset / version line)

Framework integrations (`@useavalon/react`, `vue`, `svelte`, …), `@useavalon/mcp`, `@useavalon/agent-optimization`, and other plugins. They publish when their changeset bumps them, not with the fixed group.

Merging to `main` opens a **Version packages** PR; merging that PR runs tests and publishes.

## PR previews (pkg.pr.new)

Not npm. Install the [pkg.pr.new GitHub App](https://github.com/apps/pkg-pr-new) on the **`useAvalon/Avalon`** repository (org install: Organization → Settings → GitHub Apps → pkg.pr.new → Repository access must include **Avalon**). A 404 “app is not installed” error means the app is missing on this repo, not on your user account alone.
