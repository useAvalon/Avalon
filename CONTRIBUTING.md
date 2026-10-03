# Contributing to Avalon

Thanks for wanting to help. Avalon is a multi-framework **islands** framework — it is not Astro. Hydration is `island={{ condition: 'on:client' }}` on an imported component. There are no `client:*` attributes.

Coding agents should read [AGENTS.md](./AGENTS.md) as well as this file.

## Setup

[Bun](https://bun.sh) is the package manager and runtime.

```bash
bun install
bun run lint
bun run test
bun run typecheck
```

`bun run dev` starts the `www` site. Prefer `bunx --bun` for Vite — Node cannot import `.tsx` directly.

## Where to change things

| Path | What it is |
|------|------------|
| `packages/avalon` | Core framework |
| `packages/integrations/<fw>` | React, Preact, Vue, Svelte, Solid, Lit, Qwik |
| `packages/create-avalon` | `npm create avalon` / `bun create avalon` |
| `packages/mcp` | MCP server for coding agents |
| `packages/agent-optimization` | LLMs.txt, sitemap, structured data |
| `www` | https://useavalon.dev (docs and marketing) |

## Issues

Search existing issues before opening a new one. Use the [bug](.github/ISSUE_TEMPLATE/bug.yml) or [feature](.github/ISSUE_TEMPLATE/feature.yml) template.

Large or breaking changes need an issue first so the approach can be discussed.

## Pull requests

1. Fork the repo and create a topic branch from `main`.
2. Keep the PR to **one concern**. Do not mix features, drive-by refactors, or formatting-only diffs.
3. Add or update tests next to the code (`__tests__` or `tests/`) when behavior changes.
4. Run `bun run lint`, `bun run test`, and `bun run typecheck`. Do not skip git hooks.
5. Open a PR from your fork against `main` and fill in the pull request template. Reference issues with `Fixes #123`.

CI on pull requests runs Biome, Vitest, `tsc --noEmit`, and an install smoke (`bun run test:install`: pack workspace packages → `create-avalon --yes` → install from those tarballs → production build). All four must pass.

**Do not** bump versions in `package.json` by hand or publish from a laptop. When a PR should change what ships on npm, run `bunx changeset` and commit the generated file under `.changeset/`. Merging to `main` opens or updates a **Version packages** PR; merging that PR runs the full CI smoke and publishes to npm. PRs get install previews via [pkg.pr.new](https://pkg.pr.new) (see `.github/workflows/preview.yml`), not npm canary tags.

**Do not** add a dependency without an issue discussing it. Only change `bun.lock` when the change needs it.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`.

- Types: `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`
- Scope is the area (`dev`, `mcp`, `react`, `vite-plugin`, …)
- Present tense. Explain why, not a list of files.

```
fix(dev): re-run route discovery after full reload
feat(actions): add type-safe server actions
```

Comments in source explain why or non-obvious what. No authors, ticket numbers, or changelog phrasing.

## Security

Report vulnerabilities privately — see [SECURITY.md](./SECURITY.md). Do not file a public issue.

## Releases (maintainers)

1. Contributors add changesets on feature PRs (`bunx changeset`).
2. Merge to `main`. The **Release** workflow opens or updates a **Version packages** PR (bumps + changelogs).
3. Review and merge **Version packages**. The same workflow runs lint, tests, typecheck, and `test:install`, then `bun run release` publishes bumped packages to npm and creates GitHub Releases.

A failed `test:install` or publish blocks shipping. `scripts/publish-packages.ts` skips versions already on npm so a retry can finish the same release.

Publish uses npm **trusted publishing** (OIDC). Each public package needs a Trusted Publisher on npmjs.com (Settings → Trusted Publisher → GitHub Actions):

- Organization or user: `useAvalon`
- Repository: `Avalon`
- Workflow filename: `release.yml`
- Allow `npm publish`

`create-avalon` is unscoped — `npm create avalon` depends on that package name. Register the same `release.yml` trusted publisher on its npm package page.

PR previews use **pkg.pr.new** (`.github/workflows/preview.yml`); install the pkg.pr.new GitHub App on the repo.

## License

By contributing you agree that your work is licensed under the [MIT License](./LICENSE), the same as the rest of the project.
