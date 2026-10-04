---
"@useavalon/avalon": patch
---

Ship stable **0.5.3** for the packages that previously only published on the npm `canary` tag since **0.5.2** (Sep 2025).

- **Islands / build:** per-framework JSX import source, hardened island transforms and actions type generation, post-build pipeline refactor, preserve `vite` ignore comments in package builds
- **Router:** resume Qwik containers after client navigation; reset scroll inside view transitions
- **create-avalon:** styled scaffold pages, layout CSS, Vite config types, per-framework `tsconfig` files
- **Tooling:** TypeScript 7 / Vitest interop fixes on CI; Bun-based test runtime for island transforms
