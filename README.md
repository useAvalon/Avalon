<p align="center">
  <a href="https://useavalon.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./www/public/avalon-wordmark.svg">
      <img alt="Avalon" src="./www/public/avalon-wordmark-black.svg" height="56">
    </picture>
  </a>
</p>

<h3 align="center">The full-stack islands framework.<br>Any UI framework per component. Zero JavaScript by default.</h3>

<p align="center">
  <a href="https://useavalon.dev"><strong>useavalon.dev</strong></a> ·
  <a href="https://useavalon.dev/docs/quick-start"><strong>Quick start</strong></a> ·
  <a href="https://useavalon.dev/docs/introduction"><strong>Docs</strong></a> ·
  <a href="./CONTRIBUTING.md"><strong>Contributing</strong></a>
</p>

[![npm](https://img.shields.io/npm/v/@useavalon/avalon?label=%40useavalon%2Favalon&color=1F6AD3)](https://www.npmjs.com/package/@useavalon/avalon)
[![npm](https://img.shields.io/npm/v/@useavalon/react?label=%40useavalon%2Freact&color=61dafb)](https://www.npmjs.com/package/@useavalon/react)
[![npm](https://img.shields.io/npm/v/@useavalon/vue?label=%40useavalon%2Fvue&color=42b883)](https://www.npmjs.com/package/@useavalon/vue)
[![npm](https://img.shields.io/npm/v/@useavalon/svelte?label=%40useavalon%2Fsvelte&color=ff3e00)](https://www.npmjs.com/package/@useavalon/svelte)
[![npm](https://img.shields.io/npm/v/@useavalon/solid?label=%40useavalon%2Fsolid&color=4f88c6)](https://www.npmjs.com/package/@useavalon/solid)
[![npm](https://img.shields.io/npm/v/@useavalon/preact?label=%40useavalon%2Fpreact&color=673ab8)](https://www.npmjs.com/package/@useavalon/preact)
[![npm](https://img.shields.io/npm/v/@useavalon/lit?label=%40useavalon%2Flit&color=324fff)](https://www.npmjs.com/package/@useavalon/lit)
[![npm](https://img.shields.io/npm/v/@useavalon/qwik?label=%40useavalon%2Fqwik&color=ac7ef4)](https://www.npmjs.com/package/@useavalon/qwik)

---

Write your pages in plain JSX or MDX. They render to HTML on the server and ship **no JavaScript**. When a component needs to be interactive, give it an `island` prop and pick when it hydrates. That island can be React, Vue, Svelte, Solid, Preact, Lit or Qwik, and each one ships as its own chunk with only its own runtime.

```tsx
// app/modules/main/pages/index.tsx
import Search from '../components/Search.react.tsx';
import Cart from '../components/Cart.vue';
import Chart from '../components/Chart.svelte';

export default function Home() {
  return (
    <main>
      <h1>Static HTML. No JS for this heading.</h1>

      <Search island={{ condition: 'on:client' }} />      {/* React, hydrates right away */}
      <Cart island={{ condition: 'on:interaction' }} />   {/* Vue, hydrates on first click or hover */}
      <Chart island={{ condition: 'on:visible' }} />      {/* Svelte, hydrates when scrolled into view */}
    </main>
  );
}
```

Three frameworks on one route. The browser downloads each runtime only when that island actually hydrates.

**Learn more at [useavalon.dev](https://useavalon.dev).**

## Get started

```bash
bun create avalon my-app
```

Also works with `npm create avalon@latest`, `pnpm create avalon@latest` and `yarn create avalon`. The CLI asks which frameworks, styling and deploy target you want, then gives you a running app on `localhost:3000`. See [Installation](https://useavalon.dev/docs/installation) and the [Quick start](https://useavalon.dev/docs/quick-start).

## Why Avalon

- **Zero JS by default.** A page with no islands is pure HTML. You opt into JavaScript per component, never per page.
- **Seven frameworks, one project.** The filename picks the renderer: `.react.tsx`, `.solid.tsx`, `.qwik.tsx`, `.lit.ts`, `.vue`, `.svelte`, and plain `.tsx` for Preact. Migrate an app piece by piece, or use the best library for each widget.
- **Hydrate on your terms.** `on:client`, `on:visible`, `on:idle`, `on:interaction` and `media:` queries, plus `on:delay`, `on:scroll`, `on:event` and your own custom directives. Islands hydrate independently, so one heavy widget never blocks the rest of the page.
- **Pages in TSX or MDX.** Any `.mdx` file in your pages folder is a route, with frontmatter, GitHub Flavored Markdown and syntax highlighting built in. Drop islands straight into your Markdown.
- **Full stack.** Server islands, server actions, API routes, middleware and cron jobs live next to your pages.
- **Deploy anywhere.** Built on [Vite 8](https://vite.dev) and [Nitro](https://nitro.build), so the same app runs on Node, Bun, Deno, Cloudflare, Vercel and more.
- **Ready for AI agents.** `@useavalon/mcp` teaches coding agents the Avalon syntax, and `@useavalon/agent-optimization` serves `llms.txt`, markdown negotiation and structured data so your site reads well to LLMs.

## Features

| | |
|---|---|
| **Islands** | [Islands architecture](https://useavalon.dev/docs/islands-architecture) · [Hydration strategies](https://useavalon.dev/docs/hydration-strategies) · [Server islands](https://useavalon.dev/docs/server-islands) · [Cross-island state](https://useavalon.dev/docs/guides/cross-island-state) · `clientOnly` islands |
| **Routing and pages** | [File-system routing](https://useavalon.dev/docs/file-system-routing) with modules · [Nested layouts](https://useavalon.dev/docs/layouts) · [MDX pages](https://useavalon.dev/docs/mdx) · [Client navigation](https://useavalon.dev/docs/client-navigation) with View Transitions · [Metadata](https://useavalon.dev/docs/metadata) · [Error handling](https://useavalon.dev/docs/error-handling) |
| **Rendering** | [Streaming SSR](https://useavalon.dev/docs/streaming-ssr) · [Prerendering](https://useavalon.dev/docs/guides/prerendering) · [Caching](https://useavalon.dev/docs/guides/caching) · [Image optimization](https://useavalon.dev/docs/image-optimization) with WebP/AVIF and responsive `srcset` |
| **Server** | [API routes](https://useavalon.dev/docs/api-routes) · [Server actions](https://useavalon.dev/docs/server-actions) with Zod validation · [Middleware](https://useavalon.dev/docs/middleware) · [Cron jobs](https://useavalon.dev/docs/cron-jobs) |
| **Tooling** | Vite 8 with HMR · [TypeScript](https://useavalon.dev/docs/guides/typescript) · [Styling](https://useavalon.dev/docs/styling) · [Deployment](https://useavalon.dev/docs/guides/deployment) via Nitro presets · [SEO](https://useavalon.dev/docs/plugins/seo) and [agent optimization](https://useavalon.dev/docs/plugins/agent-optimization) plugins |

## Coming from Astro?

The islands model will feel familiar. The differences:

| | Astro | Avalon |
|---|---|---|
| Page syntax | `.astro` templates | Plain JSX/TSX or MDX |
| Hydration | `client:*` directives | One `island` prop |
| Runtime and deploy | Adapters | Nitro presets (Node, Bun, Deno, edge) |
| Scheduled jobs | Not built in | `defineCronJob` |

## Packages

| Package | Description |
|---------|-------------|
| [`@useavalon/avalon`](https://www.npmjs.com/package/@useavalon/avalon) | Core framework |
| [`@useavalon/react`](https://www.npmjs.com/package/@useavalon/react) | React integration |
| [`@useavalon/preact`](https://www.npmjs.com/package/@useavalon/preact) | Preact integration |
| [`@useavalon/vue`](https://www.npmjs.com/package/@useavalon/vue) | Vue integration |
| [`@useavalon/svelte`](https://www.npmjs.com/package/@useavalon/svelte) | Svelte integration |
| [`@useavalon/solid`](https://www.npmjs.com/package/@useavalon/solid) | Solid integration |
| [`@useavalon/lit`](https://www.npmjs.com/package/@useavalon/lit) | Lit integration |
| [`@useavalon/qwik`](https://www.npmjs.com/package/@useavalon/qwik) | Qwik integration |
| [`@useavalon/core`](https://www.npmjs.com/package/@useavalon/core) | Shared types and utilities for framework integrations |
| [`create-avalon`](https://www.npmjs.com/package/create-avalon) | Project scaffolding CLI |
| [`@useavalon/seo`](https://www.npmjs.com/package/@useavalon/seo) | Open Graph, Twitter cards, canonical URLs, JSON-LD and robots meta |
| [`@useavalon/agent-optimization`](https://www.npmjs.com/package/@useavalon/agent-optimization) | LLMs.txt, sitemap, and structured data plugin |
| [`@useavalon/mcp`](https://www.npmjs.com/package/@useavalon/mcp) | MCP server that teaches AI coding agents Avalon's syntax |

## Contributing

Contributions are welcome, from typo fixes to new framework integrations. Fork the repo and open a pull request against `main`. CI must pass and a maintainer reviews before merge. Start with [CONTRIBUTING.md](./CONTRIBUTING.md); coding agents should also read [AGENTS.md](./AGENTS.md).

```bash
bun install
bun run dev     # runs the useavalon.dev site locally
bun run test
```

Found a security issue? Report it through a [private advisory](https://github.com/useAvalon/Avalon/security/advisories/new), not a public issue. See [SECURITY.md](./SECURITY.md).

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md).

If Avalon is useful to you, a ⭐ helps other developers find it.

## License

[MIT](./LICENSE)
