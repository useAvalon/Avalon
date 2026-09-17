# create-avalon

Scaffold a new [Avalon](https://useavalon.dev) project in seconds.

## Usage

```bash
npm create avalon@latest
```

Or with other package managers:

```bash
pnpm create avalon@latest
yarn create avalon
bun create avalon
```

The CLI walks you through:

- Project name and directory
- Rendering engine (Preact or React) and island integrations
- Styling approach (CSS Modules, Tailwind, shadcn)
- Plugins (SEO, agent optimization). MDX syntax highlighting is always on.
- Middleware (h3, Hono, Elysia)
- Deploy target (**Cloudflare Pages**, Netlify, or none)
- Scheduled jobs (cron)

## Deploy targets

| Choice | What you get |
|--------|----------------|
| **Cloudflare Pages** | `wrangler.toml`, `public/_headers`, `DEPLOY.md`, `build` / `preview` / `deploy` scripts. `build.mjs` sets `NITRO_PRESET=cloudflare_pages` when unset. |
| **Netlify** | `netlify.toml` (`NITRO_PRESET=netlify`), soft SSR redirect, `DEPLOY.md`. |
| **None** | Node server preset; still gets `build.mjs` + `post-build.mjs`. |

Always run Avalon's post-build (`node post-build.mjs` via `bun run build`) — it patches the Cloudflare worker, CSS manifests, and prerenders HTML.

## What you get

A ready-to-run Avalon project with file-system routing, islands architecture, and zero JavaScript by default.

```
my-project/
├── app/
│   ├── modules/
│   │   └── main/
│   │       ├── pages/          # File-system routes
│   │       ├── components/     # Interactive components
│   │       └── layouts/        # Module layouts
│   └── shared/
│       ├── layouts/            # Root layout
│       ├── components/         # Shared components
│       └── styles/             # Global styles & tokens
├── middleware/                  # Server middleware
├── routes/
│   └── api/                    # API routes
├── tasks/                      # Scheduled jobs (cron) — optional
├── server/                     # Server config & env
├── public/                     # Static assets (+ _headers for Cloudflare)
├── build.mjs                   # Vite hang workaround + post-build
├── post-build.mjs              # Avalon production patches / prerender
├── DEPLOY.md                   # Platform-specific deploy steps
├── wrangler.toml               # Cloudflare Pages (optional)
├── netlify.toml                # Netlify (optional)
├── vite.config.ts
└── package.json
```

## Links

- [Documentation](https://useavalon.dev/docs/introduction)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
