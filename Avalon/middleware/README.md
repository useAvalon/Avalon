# Avalon Middleware System

Avalon uses two layers of middleware:

## 1. Global Middleware (`middleware/`)

Runs for all routes. Uses Nitro's native middleware directory convention.

Execution order is alphabetical by filename (use numbered prefixes):

```
middleware/
├── 01.security.ts    # Security headers + request logging
├── 02.api-cors.ts    # CORS headers for /api/* routes
└── 03.logging.ts     # Logging flag
```

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

## Handler Signature

Both types use the same `defineMiddleware` wrapper:

```typescript
import { defineMiddleware } from '@avalon/avalon/middleware';

export default defineMiddleware((event) => {
  // event.req    — standard Request object
  // event.res    — response headers/status
  // event.url    — parsed URL
  // event.context — shared context object

  // Return nothing → continue to next middleware
  // Return a Response → terminate chain
  // Throw an error → trigger error handling
});
```

## h3 v2 API (non-deprecated)

```typescript
// Request info
event.req.method              // instead of getMethod(event)
event.req.headers.get('name') // instead of getHeader(event, 'name')
event.url.pathname            // instead of getRequestURL(event).pathname

// Response headers
event.res.headers.set('name', 'value') // instead of setResponseHeader(event, ...)
```

## Execution Order

For a request to `/admin/dashboard`:

1. `middleware/01.security.ts` (global)
2. `middleware/02.api-cors.ts` (global, skips non-API)
3. `middleware/03.logging.ts` (global)
4. `src/pages/_middleware.ts` (root pages)
5. `src/pages/admin/_middleware.ts` (admin pages)
6. `src/pages/admin/dashboard.tsx` (page handler)

If any middleware returns a Response or throws, the chain stops.
