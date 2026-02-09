# Avalon Middleware System

Avalon provides a unified middleware system that combines Nitro's global middleware with route-scoped middleware for fine-grained control.

## Two Types of Middleware

### 1. Global Middleware (`middleware/`)

Global middleware runs for **all routes** and uses Nitro's native middleware system.

**Location:** `middleware/` directory in project root

**Execution Order:** Alphabetical by filename (use numbered prefixes)

```
middleware/
├── 01.security.ts    # Runs first
├── 02.api-cors.ts    # Runs second
└── 03.logging.ts     # Runs third
```

### 2. Route-Scoped Middleware (`_middleware.ts`)

Route-scoped middleware runs only for routes in that directory tree.

**Location:** `_middleware.ts` files in `src/pages/` or `src/api/` directories

**Execution Order:** Parent directories before child directories

```
src/
├── pages/
│   ├── _middleware.ts        # Runs for all pages
│   ├── admin/
│   │   ├── _middleware.ts    # Runs for /admin/* only
│   │   └── index.tsx
│   └── blog/
│       └── index.tsx
└── api/
    ├── _middleware.ts        # Runs for all API routes
    └── admin/
        ├── _middleware.ts    # Runs for /api/admin/* only
        └── users.ts
```

## Middleware Handler Signature

Both global and route-scoped middleware use the same Nitro-aligned signature:

```typescript
import { defineMiddleware } from '@avalon/avalon/middleware';
import type { H3Event } from 'h3';

export default defineMiddleware((event: H3Event) => {
  // Your middleware logic here

  // Return nothing (void) → continue to next middleware
  // Return a Response → terminate chain and send response
  // Throw an error → trigger error handling
});
```

## Chain Continuation vs Termination

### Continue to Next Middleware

Return nothing (void/undefined) to continue:

```typescript
export default defineMiddleware((event) => {
  // Do something
  event.context.myData = 'value';
  // No return = continue to next middleware
});
```

### Terminate the Chain

Return a Response to stop processing:

```typescript
export default defineMiddleware((event) => {
  if (isUnauthorized(event)) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Continue if authorized
});
```

### Throw an Error

Throw to trigger Nitro's error handling:

```typescript
import { createError } from 'h3';

export default defineMiddleware((event) => {
  if (!isValid(event)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request',
    });
  }
});
```

## Context Passing

Middleware can store data in `event.context` for downstream handlers:

```typescript
// In middleware
export default defineMiddleware(async (event) => {
  const user = await validateToken(getHeader(event, 'Authorization'));
  event.context.user = user;
  event.context.timing = { start: Date.now() };
});

// In page/API handler
export default defineEventHandler((event) => {
  const user = event.context.user; // Access middleware data
  const startTime = event.context.timing?.start;
});
```

### Common Context Properties

| Property | Type | Description |
|----------|------|-------------|
| `event.context.user` | `{ id, email, roles }` | Authenticated user |
| `event.context.session` | `Record<string, unknown>` | Session data |
| `event.context.timing` | `{ start, middlewareEnd }` | Request timing |
| `event.context.requestId` | `string` | Unique request ID |

## Execution Order

For a request to `/admin/dashboard`:

1. **Global middleware** (from `middleware/`)
   - `01.security.ts`
   - `02.api-cors.ts`
   - `03.logging.ts`

2. **Route-scoped middleware** (from `src/pages/`)
   - `src/pages/_middleware.ts` (root)
   - `src/pages/admin/_middleware.ts` (admin)

3. **Page handler**
   - `src/pages/admin/dashboard.tsx`

**Note:** If any middleware returns a Response or throws an error, the chain stops.

## Examples

### Logging Middleware (Root Pages)

```typescript
// src/pages/_middleware.ts
import { defineMiddleware } from '@avalon/avalon/middleware';

export default defineMiddleware((event) => {
  event.context.timing = { start: Date.now() };
  event.context.requestId = crypto.randomUUID();

  if (import.meta.env?.DEV) {
    console.log(`[page] ${event.node.req.method} ${event.node.req.url}`);
  }
});
```

### Auth Guard (Admin Pages)

```typescript
// src/pages/admin/_middleware.ts
import { defineMiddleware } from '@avalon/avalon/middleware';
import { getHeader, createError } from 'h3';

export default defineMiddleware(async (event) => {
  const token = getHeader(event, 'Authorization');

  if (!token) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required',
    });
  }

  const user = await validateToken(token);

  if (!user.roles?.includes('admin')) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    });
  }

  event.context.user = user;
});
```

### CORS Middleware (API Routes)

```typescript
// src/api/_middleware.ts
import { defineMiddleware } from '@avalon/avalon/middleware';
import { setResponseHeader, getMethod } from 'h3';

export default defineMiddleware((event) => {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*');
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (getMethod(event) === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }
});
```

### Rate Limiting (API Admin)

```typescript
// src/api/admin/_middleware.ts
import { defineMiddleware } from '@avalon/avalon/middleware';
import { getHeader, createError } from 'h3';

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export default defineMiddleware((event) => {
  const apiKey = getHeader(event, 'X-API-Key');

  if (!apiKey) {
    throw createError({ statusCode: 401, message: 'API key required' });
  }

  // Simple rate limiting
  const now = Date.now();
  const record = requestCounts.get(apiKey) || { count: 0, resetAt: now + 60000 };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 60000;
  }

  record.count++;
  requestCounts.set(apiKey, record);

  if (record.count > 100) {
    throw createError({ statusCode: 429, message: 'Rate limit exceeded' });
  }
});
```

## Type Safety

Extend the H3EventContext interface for custom properties:

```typescript
// types/middleware.d.ts
declare module 'h3' {
  interface H3EventContext {
    user?: {
      id: string;
      email: string;
      roles: string[];
    };
    organization?: {
      id: string;
      name: string;
    };
  }
}
```

## Migration from Old Format

If you have middleware using the old `{ continue, response }` format:

**Old format (deprecated):**
```typescript
export default async (context, next) => {
  // ...
  return { continue: true };
};
```

**New format:**
```typescript
import { defineMiddleware } from '@avalon/avalon/middleware';

export default defineMiddleware((event) => {
  // ...
  // Return nothing to continue
});
```

## Best Practices

1. **Keep middleware focused** - Each middleware should do one thing well
2. **Use context for data passing** - Don't modify request/response directly when possible
3. **Handle errors properly** - Use `createError` for HTTP errors
4. **Log in development only** - Use `import.meta.env?.DEV` checks
5. **Order matters** - Use numbered prefixes for global middleware
6. **Type your context** - Extend H3EventContext for type safety
