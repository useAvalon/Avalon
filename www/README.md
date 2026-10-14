# useavalon.dev

Marketing site, documentation, and demos for Avalon (`avalon-demo` workspace package).

## Development

From the repo root (recommended):

```bash
bun install
bun run --filter avalon-demo dev
```

From this directory:

```bash
bun install
bun run dev
```

## Production build

```bash
bun run build
bun run preview
```

Cloudflare Pages deploys from `main` via `.github/workflows/deploy-www.yml` (`NITRO_PRESET=cloudflare_pages`). Production custom domain `useavalon.dev` uses the same artifact as `useavalon.pages.dev`, but the zone CDN can keep **cached Pagefind worker responses** (including old `Content-Security-Policy` headers) after a deploy. The deploy workflow purges `dist/pagefind` URLs on the zone; if search breaks with WASM/CSP errors after a manual deploy, purge cache for `https://useavalon.dev/pagefind/*` in the Cloudflare dashboard.

Local production build:

```bash
NITRO_PRESET=cloudflare_pages bun run build
```
