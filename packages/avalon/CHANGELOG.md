# @useavalon/avalon

## 0.5.6

### Patch Changes

- [#99](https://github.com/useAvalon/Avalon/pull/99) [`4fad323`](https://github.com/useAvalon/Avalon/commit/4fad3231625e060423efc68cf8b97b5cbb2b09f6) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Recommend `bun add` in the missing framework integration error message instead of Deno.
- Updated dependencies []:
  - @useavalon/core@0.5.6

## 0.5.5

### Patch Changes

- [#93](https://github.com/useAvalon/Avalon/pull/93) [`d31ae89`](https://github.com/useAvalon/Avalon/commit/d31ae89e4ce607919493fd119befdcecec77f8a3) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Limit published `.d.ts` files to the public export graph and prune orphan declarations after emit.

- [#92](https://github.com/useAvalon/Avalon/pull/92) [`dba71cd`](https://github.com/useAvalon/Avalon/commit/dba71cdb656fd319123c9b3102c3e4ab0efd4020) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Add `stream` and `integrity` to Nitro `CacheOptions` for streaming SSR cache fill and deploy-scoped invalidation.
- Updated dependencies []:
  - @useavalon/core@0.5.5

## 0.5.4

### Patch Changes

- [#90](https://github.com/useAvalon/Avalon/pull/90) [`9b4fe02`](https://github.com/useAvalon/Avalon/commit/9b4fe020b4b011782d1e68019f718577be023c19) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Raise the optional `vite-imagetools` peer to ^11 (patched `sharp` range), add npm overrides for `sharp`, `toml`, and `yaml`, and publish `main`/`module` entry fields for registry tooling.
- Updated dependencies []:
  - @useavalon/core@0.5.4

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
