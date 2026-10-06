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

Cloudflare Pages deploys from `main` via `.github/workflows/deploy-www.yml` (`NITRO_PRESET=cloudflare_pages`). Local production build:

```bash
NITRO_PRESET=cloudflare_pages bun run build
```
