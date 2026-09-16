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

**Do not** bump versions, edit release workflows, or publish to npm. Packages version independently. Maintainers ship **stable / beta / rc only from GitHub Actions → Release** (`workflow_dispatch` on `.github/workflows/release.yml`). That job re-runs lint, tests, typecheck, and the install smoke, then publishes. Do not `npm publish` from a laptop. Merges to `main` that touch `packages/**` already publish canary builds.

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

1. Open **Actions → Release**.
2. Choose the package (`core` is the default install set: avalon, core, preact, seo, create-avalon), bump, and channel.
3. Leave **dry-run** checked first. Confirm the install smoke passes.
4. Re-run with dry-run unchecked to publish.

A failed `test:install` blocks `npm publish`. That is intentional — a broken `latest` must not ship.

Already-published versions are skipped, so a retry after a partial publish can still commit tags. Do not re-run a finished release with a bump — that would cut the next version. `create-avalon` is unscoped; the Actions token must be granted publish access to that name on npm. If a core release warns that `create-avalon` is outside the token's grant, add the package to the token and re-run **Release** with package `create-avalon` and bump `none`.

## License

By contributing you agree that your work is licensed under the [MIT License](./LICENSE), the same as the rest of the project.
