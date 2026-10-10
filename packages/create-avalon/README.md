# create-avalon

Scaffold a new [Avalon](https://useavalon.dev) project in seconds.

## Usage

```bash
bun create avalon my-app
bun create avalon my-blog --template blog
```

Other package managers: `npm create avalon@latest`, `pnpm create avalon@latest`, or `yarn create avalon`.

Pass `--template blog` for an MDX blog under `/blog` with a [Pages CMS](https://pagescms.org/) config (`.pages.yml`) so editors can manage posts on GitHub. You still get the usual prompts for integrations, styling, deploy, and the rest.

The CLI walks you through:

- Starter template (`default` or `blog`)
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
│   │   ├── main/               # Site root (/)
│   │   │   ├── pages/          # File-system routes for this module
│   │   │   ├── components/
│   │   │   └── layouts/
│   │   └── about/              # /about — a module name is a URL prefix
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
