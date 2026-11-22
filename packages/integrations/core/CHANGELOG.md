# @useavalon/core

## 0.9.0

### Minor Changes

- [#167](https://github.com/useAvalon/Avalon/pull/167) [`3e95951`](https://github.com/useAvalon/Avalon/commit/3e95951eef7c7bd0f8b7ca46a2d0f8d09747fa37) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Stream pages that use layouts. When a page has a pending `Suspense` boundary, the layout head and page shell are flushed first and each boundary follows as it resolves, using Preact's `renderToReadableStream`. Pages with nothing pending, development, the client router, HTML post-process hooks, `core: "react"` and `streaming: false` keep the buffered response with identical output. Streamed responses send `X-Accel-Buffering: no`.

- [#165](https://github.com/useAvalon/Avalon/pull/165) [`9f5eb19`](https://github.com/useAvalon/Avalon/commit/9f5eb194b762606f09eb8f74ece6a8d7bed969cb) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Precompile static JSX in page and layout files into constant templates. Preact renders them without building a virtual DOM for the static markup, which makes server rendering of large pages much faster. Output is unchanged, and components, hooks, context and async components keep working. Turn it off with `precompileJsx: false` (or `AVALON_PRECOMPILE=0`).

### Patch Changes

- [#165](https://github.com/useAvalon/Avalon/pull/165) [`9f5eb19`](https://github.com/useAvalon/Avalon/commit/9f5eb194b762606f09eb8f74ece6a8d7bed969cb) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Fall back to the monorepo copy of an integration when Bun reports an unresolved import. Bun throws a `ResolveMessage`, which is not an `Error` instance, so the not-found check returned false and `@useavalon/preact` could not be loaded from `packages/integrations`.

- [#165](https://github.com/useAvalon/Avalon/pull/165) [`9f5eb19`](https://github.com/useAvalon/Avalon/commit/9f5eb194b762606f09eb8f74ece6a8d7bed969cb) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - List each route that failed during prerender with its reason. The summary used to print only "N error(s)", which made a stale route list or a broken link impossible to track down.

- [#165](https://github.com/useAvalon/Avalon/pull/165) [`9f5eb19`](https://github.com/useAvalon/Avalon/commit/9f5eb194b762606f09eb8f74ece6a8d7bed969cb) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Serve the copied SSR stylesheet in production. The post-build step only recognised the old compact Nitro asset manifest, so with the current pretty-printed format `ssr-index-*.css` was copied to disk but never registered, and the page linked a stylesheet that returned 404. Both formats are handled, including the `.br` and `.gz` variants.

- [#165](https://github.com/useAvalon/Avalon/pull/165) [`9f5eb19`](https://github.com/useAvalon/Avalon/commit/9f5eb194b762606f09eb8f74ece6a8d7bed969cb) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Render responses without repeatedly copying the page HTML. Layout and asset injection run on the small layout markup around the page, the page is encoded once, and the head passes only scan the head. Islands emit their hydration script as a real `<script>` element, and pages with no client code no longer load an empty entry script.

## 0.8.2

### Patch Changes

- [#163](https://github.com/useAvalon/Avalon/pull/163) [`46ebf42`](https://github.com/useAvalon/Avalon/commit/46ebf4292d04266231a2e64d9dcdf234f419aa1f) Thanks [@MadsHaerup](https://github.com/MadsHaerup)! - Fix the per-island inline hydration script. The hydrate call was missing a statement terminator, so the generated code read `await fn(e,C,p)e.dataset.hydrated="true"` and the browser rejected the whole script with a syntax error, leaving islands unhydrated.

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

No changes in this release.

## 0.5.9

No changes in this release.

## 0.5.8

No changes in this release.

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
