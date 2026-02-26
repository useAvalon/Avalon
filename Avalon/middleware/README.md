# Avalon Middleware System

Avalon uses two layers of middleware:

## 1. Global Middleware (`middleware/`)

Runs for all routes. Uses Nitro's native middleware directory convention.

Execution order is alphabetical by filename (use numbered prefixes):

```
middleware/
├── 01.security.ts    # Security headers + request logging
└── 02.logging.ts     # Logging flag
```

CORS for `/api/**` is handled by Nitro's `routeRules` in `vite.config.ts` — no middleware needed.

## 2. Route-Scoped Middleware (`_middleware.ts`)

Runs only for routes in that directory tree. Placed inside `src/pages/`.

```
src/pages/
├── _middleware.ts           # All pages
├── admin/
│   ├── _middleware.ts       # /admin/* only
│   └── index.tsx
└── blog/
    └── index.tsx
```

## 3. API Routes (`routes/`)

API routes use Nitro's native file-system routing:

```
routes/
└── api/
    ├── hello.ts                        # GET /api/hello
    ├── time.ts                         # GET /api/time
    ├── stats.ts                        # GET /api/stats
    ├── users/
    │   ├── [id].ts                     # GET /api/users/:id
    │   └── [id]/profile.ts             # GET /api/users/:id/profile
    └── github/[owner]/[repo]/stars.ts  # GET /api/github/:owner/:repo/stars
```

All Nitro features (KV storage, cache, tasks, SQL, etc.) are available in route handlers via `nitro/h3`.

## Execution Order

For a request to `/admin/dashboard`:

1. `middleware/01.security.ts` (global)
2. `middleware/02.logging.ts` (global)
3. `src/pages/_middleware.ts` (root pages)
4. `src/pages/admin/_middleware.ts` (admin pages)
5. `src/pages/admin/dashboard.tsx` (page handler)

If any middleware returns a Response or throws, the chain stops.
