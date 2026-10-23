# @useavalon/avalon

## 0.8.0

### Minor Changes

- [#147](https://github.com/useAvalon/Avalon/pull/147) [`bb9208c`](https://github.com/useAvalon/Avalon/commit/bb9208c8cbae4d57b2af8c958b35fb190e51a07f) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Skip island SSR with `ssr: false`. Remove the duplicate `clientOnly` field from the island prop.

### Patch Changes

- [#150](https://github.com/useAvalon/Avalon/pull/150) [`a2d015a`](https://github.com/useAvalon/Avalon/commit/a2d015a52526402d63d683e9cd74611398f8c312) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Run custom hydration directives as a parsed module instead of `new Function`. The inline bootstrap still needs `'unsafe-inline'`, a nonce, or a script hash; `'self'` alone is not enough.

- [#148](https://github.com/useAvalon/Avalon/pull/148) [`3a4bc3a`](https://github.com/useAvalon/Avalon/commit/3a4bc3abefe679a8b06621ab29ab833e3d8735f2) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Keep the live `data-theme` on `<html>` during client navigation instead of copying the next page's SSR default.
- Updated dependencies [[`a2d015a`](https://github.com/useAvalon/Avalon/commit/a2d015a52526402d63d683e9cd74611398f8c312), [`bb9208c`](https://github.com/useAvalon/Avalon/commit/bb9208c8cbae4d57b2af8c958b35fb190e51a07f), [`3a4bc3a`](https://github.com/useAvalon/Avalon/commit/3a4bc3abefe679a8b06621ab29ab833e3d8735f2)]:
  - @useavalon/core@0.8.0

## 0.7.5

### Patch Changes

- [#141](https://github.com/useAvalon/Avalon/pull/141) [`ea5e87d`](https://github.com/useAvalon/Avalon/commit/ea5e87d80afb142f256c98cc900c5c4aa9d7105c) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Add `ssr` to the public `island` prop type so islands can opt into server HTML while hydrating on the client.

- [#139](https://github.com/useAvalon/Avalon/pull/139) [`ab358be`](https://github.com/useAvalon/Avalon/commit/ab358be5aca33ef4eca91d83ecf2495a5bba9410) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Stop Vite CSS-module compile in the Nitro environment during dev and keep CSS HMR on the client graph.

- [#140](https://github.com/useAvalon/Avalon/pull/140) [`027abad`](https://github.com/useAvalon/Avalon/commit/027abad1330b871bdb8de0ba2c3d137ae627a2c5) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Restore window scroll after a full document reload when history.scrollRestoration is manual.

- [#146](https://github.com/useAvalon/Avalon/pull/146) [`0be2a67`](https://github.com/useAvalon/Avalon/commit/0be2a6760862e480e4cdc01cc269a943bcf254b7) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Print scaffold next steps for the installer that launched create-avalon, and preview the Nitro Node server instead of Vite's static preview.
  
  Render React `server.fallback` JSX with the page shell engine so placeholders are not empty HTML.
- Updated dependencies [[`ea5e87d`](https://github.com/useAvalon/Avalon/commit/ea5e87d80afb142f256c98cc900c5c4aa9d7105c), [`0be2a67`](https://github.com/useAvalon/Avalon/commit/0be2a6760862e480e4cdc01cc269a943bcf254b7)]:
  - @useavalon/core@0.7.5

## 0.7.4

### Patch Changes

- [#137](https://github.com/useAvalon/Avalon/pull/137) [`45087c9`](https://github.com/useAvalon/Avalon/commit/45087c9f10eff959024faa3ebdbca1455f56221c) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Add `@useavalon/avalon/page-discovery` for tooling route lists. Netlify scaffolds use Netlify CLI for `preview` instead of the Node server entry.
- Updated dependencies [[`45087c9`](https://github.com/useAvalon/Avalon/commit/45087c9f10eff959024faa3ebdbca1455f56221c)]:
  - @useavalon/core@0.7.4

## 0.7.3

### Patch Changes

- [#132](https://github.com/useAvalon/Avalon/pull/132) [`4ac6624`](https://github.com/useAvalon/Avalon/commit/4ac662420b34cecb83a50bc62235bccc4e258981) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Keep blocking `ssr-index` stylesheets when CSS exceeds the inline threshold, stop deferring `font-faces.css` in post-build, and support `on:event` in the entry-client hydrator.
- Updated dependencies []:
  - @useavalon/core@0.7.3

## 0.7.2

### Patch Changes

- [#129](https://github.com/useAvalon/Avalon/pull/129) [`8952ce1`](https://github.com/useAvalon/Avalon/commit/8952ce1e158d6b92dacec9ee43217116dd4a7250) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Improve Cloudflare Pages static routing: emit `404.html` to avoid SPA fallback, exclude all prerendered HTML paths from the Pages Function, and align prerendered route cache headers.

- [#131](https://github.com/useAvalon/Avalon/pull/131) [`d1cf0df`](https://github.com/useAvalon/Avalon/commit/d1cf0df40c10b8bd0dab84eaffa82543816f7e97) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Inline larger SSR CSS bundles in prerendered HTML and defer non-critical first-party stylesheets during post-build optimization.
- Updated dependencies []:
  - @useavalon/core@0.7.2

## 0.7.1

### Patch Changes

- [#125](https://github.com/useAvalon/Avalon/pull/125) [`353fd2e`](https://github.com/useAvalon/Avalon/commit/353fd2efa7d17c1969384b7e39316a176ecc24c9) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Exclude root font and syntax CSS from Cloudflare Pages Functions so static `_headers` CSP applies without duplicate Worker policies. Default Nitro `routeRules` disable cache on `/_server-islands/**` and `/_actions/**`.
- Updated dependencies []:
  - @useavalon/core@0.7.1

## 0.7.0

### Patch Changes

- [#122](https://github.com/useAvalon/Avalon/pull/122) [`1709b85`](https://github.com/useAvalon/Avalon/commit/1709b85e990aaf9559ef87a55159347893dd15a4) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Apply SEO HTML transforms in production SSR and post-build via Nitro HTML post-process hooks.
- Updated dependencies []:
  - @useavalon/core@0.7.0

## 0.6.0

### Patch Changes

- [#116](https://github.com/useAvalon/Avalon/pull/116) [`1bd47c2`](https://github.com/useAvalon/Avalon/commit/1bd47c25caa2421e544ad24484c079477882777f) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Load island JSX augmentations via triple-slash references so `compilerOptions.types` merges Preact and React `island` props correctly.
- Updated dependencies []:
  - @useavalon/core@0.6.0

## 0.5.9

### Patch Changes

- [#111](https://github.com/useAvalon/Avalon/pull/111) [`4b0bbbe`](https://github.com/useAvalon/Avalon/commit/4b0bbbeffaeaabb69606dc225cf0d55995470310) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Augment Preact `Attributes` so the global `island` prop type-checks on function components (Preact 11 jsx runtime uses `Attributes & P`).
- Updated dependencies []:
  - @useavalon/core@0.5.9

## 0.5.8

### Patch Changes

- Updated dependencies []:
  - @useavalon/core@0.5.8

## 0.5.7

### Patch Changes

- [#106](https://github.com/useAvalon/Avalon/pull/106) [`1fe0c65`](https://github.com/useAvalon/Avalon/commit/1fe0c659b7c19b2841d467dc70dfa450190ab5a4) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Add `island.preload` and `island.fetchPriority` to control SSR modulepreload hints and post-build dependency preloads for `on:client` islands.
- Updated dependencies []:
  - @useavalon/core@0.5.7

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
