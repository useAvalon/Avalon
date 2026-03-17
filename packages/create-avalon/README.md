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
- Framework selection (React, Preact, Vue, Svelte, Solid, Lit, Qwik — or multiple)
- Styling approach (CSS Modules, Tailwind, vanilla CSS)
- Optional features (API routes, middleware, layouts, MDX)
- Package manager preference

## What you get

A ready-to-run Avalon project with file-system routing, islands architecture, and zero JavaScript by default.

```
my-project/
├── app/
│   ├── modules/
│   │   └── home/
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
├── server/                     # Server config & env
├── public/                     # Static assets
├── vite.config.ts
└── package.json
```

## Links

- [Documentation](https://useavalon.dev/docs/introduction)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
