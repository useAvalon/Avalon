# Avalon — agent instructions

Avalon is a multi-framework **islands** framework on Vite 8 + Nitro. Interactive UI hydrates only where an `island` prop is set. The rest is static HTML.

This file is the canonical brief for any coding agent. Cursor also loads `.cursor/rules/*.mdc` for file-scoped detail.

## Avalon is not Astro

- There are **no** `client:*` template attributes.
- Hydration is a single `island={{ condition: 'on:client' }}` prop on an **imported** component.
- When the Avalon MCP is available, use `avalon_hydration_directive` for condition syntax and `avalon_lint` on any page/component you write.

```tsx
import Counter from '../components/Counter.react.tsx';

export default function Page() {
  return (
    <div>
      <Counter island={{ condition: 'on:visible' }} count={0} />
    </div>
  );
}
```

## File naming picks the island framework

| Filename | Framework |
|----------|-----------|
| `Counter.tsx` / `.jsx` | **Preact** (default) |
| `Counter.react.tsx` | React |
| `Counter.solid.tsx` | Solid |
| `Counter.preact.tsx` | Preact (explicit) |
| `Counter.qwik.tsx` | Qwik |
| `Counter.lit.ts` | Lit |
| `Counter.vue` / `.svelte` | Vue / Svelte |

Plain `.tsx` is Preact, not React. Import the island file **directly** (no barrels or aliased re-exports).

Packages are scoped `@useavalon/*` (e.g. `@useavalon/avalon`, `@useavalon/react`).

## Comments

Write comments as if they have always been part of the codebase.

- Explain **why** something exists, or **what** a non-obvious piece does.
- Do not mention authors, PRs, issues, chat, or “previously / we changed / follow-up”.
- Objective, factual, useful to a future reader.

## TypeScript style

- Prefer **guard clauses** (early return) over nested `if`s.
- `String#replaceAll` instead of `replace` with `/g`.
- `String.raw` for regex / replacement strings that contain backslashes.
- No unnecessary character classes (`/\w+/` not `/[\w]+/`).
- No zero-fraction integers (`1` not `1.0`).
- Zod **v4**: `z.record(z.string(), value)`, `import { z } from "zod"`. Keep root and `packages/avalon` on the same Zod version.

## Tooling

- Package manager / runtime: **Bun**. Prefer `bunx --bun` for Vite (Node cannot import `.tsx` directly).
- Lint/format: Biome (`bun run lint`, `bun run format`).
- Tests: Vitest (`bun run test`). Inline `zod` in `vitest.config.ts` `server.deps`.

## Contributing

Process for humans: [CONTRIBUTING.md](./CONTRIBUTING.md). Issues and PRs use the templates in `.github/`. Security: [SECURITY.md](./SECURITY.md).

- Fork the repo, work on a branch, and open a PR against `main`. Do not push to `main` — merges there drive the Version packages release flow.
- One concern per PR. No drive-by refactors, formatting-only diffs, or unrelated files.
- Do not bump versions in `package.json` by hand or publish from a laptop. Add a changeset (`bunx changeset`) when npm should change; the Version packages PR handles bumps and publish after CI + `test:install`.
- Do not add a dependency without an issue. Only change `bun.lock` when the change needs it.
- Behavior change → tests next to the code (`__tests__` or `tests/`).
- Commits: `type(scope): summary` (`feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`). Present tense; why, not a file list.
- Before a PR: `bun run lint`, `bun run test`, `bun run typecheck`. Do not skip git hooks.
- Do not commit, push, merge, or open a PR unless asked.
- Vulnerabilities go to a private GitHub advisory — never a public issue or a PR that includes an exploit.

## Security (SSR HTML)

Never concatenate user input into HTML. Escape `& < > " '` for text/attributes. Before injecting into `<style>` / `<script>`, strip `</style` and `</script` (case-insensitive). `dangerouslySetInnerHTML` only for trusted pre-rendered HTML.
