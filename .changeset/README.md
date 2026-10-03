# Changesets

Package changes that should ship to npm need a changeset in this PR:

```bash
bunx changeset
```

Choose patch, minor, or major per package (the fixed group bumps together). Merging to `main` opens a **Version packages** PR; merging that PR runs tests and publishes.

PR previews install via [pkg.pr.new](https://pkg.pr.new) — not npm canary.
