# create-avalon

## 0.8.1

### Patch Changes

- [#161](https://github.com/useAvalon/Avalon/pull/161) [`05c607e`](https://github.com/useAvalon/Avalon/commit/05c607e50543f4eececb46a454375301eaee7dc2) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - The scaffolded `build.mjs` detects finished `cloudflare_pages` (`dist/nitro.json` + `dist/_worker.js`) and `cloudflare_module` (`.output/server/index.mjs` + `nitro.json`) output, so Cloudflare builds finish without waiting for the 240s timeout.

- [#161](https://github.com/useAvalon/Avalon/pull/161) [`05c607e`](https://github.com/useAvalon/Avalon/commit/05c607e50543f4eececb46a454375301eaee7dc2) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Update dependencies: Preact 11.2.0 and preact-render-to-string 6.8.3 (also the versions `create-avalon` now scaffolds), h3 2.0.8, oxc 0.158, `@babel/core` 8.1.2 and linkedom 0.18.15 for Lit, and vite-plugin-solid 2.11.16.

- [#161](https://github.com/useAvalon/Avalon/pull/161) [`05c607e`](https://github.com/useAvalon/Avalon/commit/05c607e50543f4eececb46a454375301eaee7dc2) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - The Cloudflare post-build patch rewrites `createRequire(import.meta.url)` only in real calls. Text inside strings, template literals, comments and regexes is left alone, so it can no longer break a Worker with a SyntaxError.

- [#161](https://github.com/useAvalon/Avalon/pull/161) [`05c607e`](https://github.com/useAvalon/Avalon/commit/05c607e50543f4eececb46a454375301eaee7dc2) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - `create-avalon` writes versions tested with the Avalon release instead of `latest`: Avalon packages at the release's caret range, and pinned or tilde ranges for React, Vite, Nitro and Tailwind.

- [#161](https://github.com/useAvalon/Avalon/pull/161) [`05c607e`](https://github.com/useAvalon/Avalon/commit/05c607e50543f4eececb46a454375301eaee7dc2) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Keep build tooling out of the server bundle. Generated renderer, page and MDX code imports Avalon through runtime subpaths (`@useavalon/avalon/islands/island`, `@useavalon/avalon/islands/builtin-directives`) instead of the package barrel, which re-exports the Vite plugin. Edge builds (`cloudflare_module`, `cloudflare_pages`) no longer contain Vite, `nitro/vite`, rolldown or `@vercel/nft`, or the unused framework integrations, and render on workerd.

- [#161](https://github.com/useAvalon/Avalon/pull/161) [`05c607e`](https://github.com/useAvalon/Avalon/commit/05c607e50543f4eececb46a454375301eaee7dc2) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Integration load errors keep the original import error as `cause` and repeat its message. "Is it installed?" is suggested only when `@useavalon/<name>` itself cannot be found.

- [#161](https://github.com/useAvalon/Avalon/pull/161) [`05c607e`](https://github.com/useAvalon/Avalon/commit/05c607e50543f4eececb46a454375301eaee7dc2) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Prerender runs `cloudflare_module` output (`.output/server/index.mjs` with a `cloudflare-module` `nitro.json`) behind the Worker wrapper, so Workers builds get static-first HTML. Prerender stops as soon as the server process exits instead of waiting 15s. Preset names accept both spellings (`cloudflare-module` and `cloudflare_module`).

## 0.8.0

### Minor Changes

- [#147](https://github.com/useAvalon/Avalon/pull/147) [`bb9208c`](https://github.com/useAvalon/Avalon/commit/bb9208c8cbae4d57b2af8c958b35fb190e51a07f) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Skip island SSR with `ssr: false`. Remove the duplicate `clientOnly` field from the island prop.

### Patch Changes

- [#150](https://github.com/useAvalon/Avalon/pull/150) [`a2d015a`](https://github.com/useAvalon/Avalon/commit/a2d015a52526402d63d683e9cd74611398f8c312) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Run custom hydration directives as a parsed module instead of `new Function`. The inline bootstrap still needs `'unsafe-inline'`, a nonce, or a script hash; `'self'` alone is not enough.

- [#148](https://github.com/useAvalon/Avalon/pull/148) [`3a4bc3a`](https://github.com/useAvalon/Avalon/commit/3a4bc3abefe679a8b06621ab29ab833e3d8735f2) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Keep the live `data-theme` on `<html>` during client navigation instead of copying the next page's SSR default.

## 0.7.5

### Patch Changes

- [#141](https://github.com/useAvalon/Avalon/pull/141) [`ea5e87d`](https://github.com/useAvalon/Avalon/commit/ea5e87d80afb142f256c98cc900c5c4aa9d7105c) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Add `ssr` to the public `island` prop type so islands can opt into server HTML while hydrating on the client.

- [#146](https://github.com/useAvalon/Avalon/pull/146) [`0be2a67`](https://github.com/useAvalon/Avalon/commit/0be2a6760862e480e4cdc01cc269a943bcf254b7) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Print scaffold next steps for the installer that launched create-avalon, and preview the Nitro Node server instead of Vite's static preview.
  
  Render React `server.fallback` JSX with the page shell engine so placeholders are not empty HTML.

## 0.7.4

### Patch Changes

- [#137](https://github.com/useAvalon/Avalon/pull/137) [`45087c9`](https://github.com/useAvalon/Avalon/commit/45087c9f10eff959024faa3ebdbca1455f56221c) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Add `@useavalon/avalon/page-discovery` for tooling route lists. Netlify scaffolds use Netlify CLI for `preview` instead of the Node server entry.

## 0.7.3

No changes in this release.

## 0.7.2

No changes in this release.

## 0.7.1

No changes in this release.

## 0.7.0

No changes in this release.

## 0.6.0

### Minor Changes

- [#118](https://github.com/useAvalon/Avalon/pull/118) [`c158bb3`](https://github.com/useAvalon/Avalon/commit/c158bb37a0ea32197b5154ba79ca72ff46dd701f) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Add the Atelier Kō–style storefront starter (`--template storefront`) with catalogue, cart, theme assets, client router styles, and React shell JSX via `jsxForCore`.

### Patch Changes

- [#117](https://github.com/useAvalon/Avalon/pull/117) [`bc3ac15`](https://github.com/useAvalon/Avalon/commit/bc3ac157166fc771acb34f6a94542245cafdc977) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Scaffold `app/island-jsx.d.ts` for Preact and React shell typings and include it in `tsconfig` app includes.

## 0.5.9

### Patch Changes

- [#112](https://github.com/useAvalon/Avalon/pull/112) [`84556db`](https://github.com/useAvalon/Avalon/commit/84556db20873b1ad1fef5166dede5922faf19062) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Add `--template blog` with MDX posts, client router, view transitions, and Pages CMS config.

## 0.5.8

### Patch Changes

- [#108](https://github.com/useAvalon/Avalon/pull/108) [`48e60a8`](https://github.com/useAvalon/Avalon/commit/48e60a8ff9996cdfe6461e647fb5ea4e86678595) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Scaffold JSX tsconfig siblings only for selected integrations and pre-select the page shell engine in the integrations prompt.

## 0.5.7

No changes in this release.

## 0.5.6

No changes in this release.

## 0.5.5

No changes in this release.

## 0.5.4

No changes in this release.

## 0.5.3

No changes in this release.
