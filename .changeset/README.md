# Changesets

Package changes that should ship to npm need a changeset in this PR:

```bash
bunx changeset
```

## Fixed group (bump together)

`@useavalon/avalon`, `@useavalon/core`, `@useavalon/preact`, `@useavalon/seo`, `create-avalon` — the default install stack from `create-avalon`.

## Independent (own changeset / version line)

Framework integrations (`@useavalon/react`, `vue`, `svelte`, …), `@useavalon/mcp`, `@useavalon/agent-optimization`, and other packages outside the fixed group.

`avalon-demo` (`www/`) is in **`ignore`** — it never publishes to npm.

Merging to `main` opens a **Version packages** PR; merging that PR runs **`build:packages`**, then publishes.

## Automation

- **[Changeset Bot](https://github.com/apps/changeset-bot)** — install on **`useAvalon/Avalon`**; comments when a PR likely needs a changeset.
- **CI `changeset` job** — fails if publishable `packages/**` source changed without `.changeset/*.md`. Escape hatch: add the **`no changeset`** label.
- **`ci.yml`** — lint, test, typecheck, and **`test:install`** must pass before merging (including the Version packages PR).

## PR previews (pkg.pr.new)

Not npm. Install the [pkg.pr.new app](https://github.com/apps/pkg-pr-new) on **`useAvalon/Avalon`**. Add the **`pr preview`** label on the PR to run the Preview workflow.

The pkg.pr.new PR comment (and its StackBlitz link) is disabled: StackBlitz installs every package with npm into one project, and npm cannot reconcile Avalon's Vite 8 with the Vite <8 peer of `@builder.io/qwik`. Take the install URLs from the Preview job log or the **Continuous Releases** check and install the packages you need in a project that already uses Vite 8.
