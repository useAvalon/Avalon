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

Cloudflare Pages deploys from `main` via `.github/workflows/deploy-www.yml` (`NITRO_PRESET=cloudflare_pages`). **Account ID** (used for Pages deploy) is not a **Zone ID**. A zone exists only when `useavalon.dev` is added under **Websites** in Cloudflare (not only under Workers & Pages → `useavalon`). Then **Overview → API** on that site shows **Zone ID** (optional `CLOUDFLARE_ZONE_ID` secret for automated purge). If you only manage the Pages project, purge manually after deploy: **Websites → useavalon.dev → Caching → Purge Cache → Prefix** `useavalon.dev/pagefind/`.

Local production build:

```bash
NITRO_PRESET=cloudflare_pages bun run build
```
