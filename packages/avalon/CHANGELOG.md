# @useavalon/avalon

## 0.5.3

### Patch Changes

- [#89](https://github.com/useAvalon/Avalon/pull/89) [`c7166b9`](https://github.com/useAvalon/Avalon/commit/c7166b9cab13d12cd903ed418d7beecce8df5bfe) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Fix Cloudflare Pages previews: apply static-first `_routes.json` only when prerender writes `index.html`, and stub Rolldown native bindings in Nitro’s worker bundle so SSR no longer 500s with missing `@rolldown/binding-*`.

- [#87](https://github.com/useAvalon/Avalon/pull/87) [`8d20e76`](https://github.com/useAvalon/Avalon/commit/8d20e76aed6c522ef9d653f7f9ff33d693785177) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Ship stable **0.5.3** for the packages that previously only published on the npm `canary` tag since **0.5.2** (Sep 2025).
  
  - **Islands / build:** per-framework JSX import source, hardened island transforms and actions type generation, post-build pipeline refactor, preserve `vite` ignore comments in package builds
  - **Router:** resume Qwik containers after client navigation; reset scroll inside view transitions
  - **create-avalon:** styled scaffold pages, layout CSS, Vite config types, per-framework `tsconfig` files
  - **Tooling:** TypeScript 7 / Vitest interop fixes on CI; Bun-based test runtime for island transforms
- Updated dependencies []:
  - @useavalon/core@0.5.3
