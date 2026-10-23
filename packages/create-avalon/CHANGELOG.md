# create-avalon

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
