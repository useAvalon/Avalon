# Avalon API Routes (Nitro Format)

This directory contains API routes using Nitro's file-system routing.

## Directory Structure

```
api/
├── hello.ts              # GET /api/hello
├── time.ts               # GET /api/time
├── cached-time.ts        # GET /api/cached-time (cached)
├── stats.ts              # GET /api/stats?userId=123
├── users/
│   ├── [id].ts           # GET /api/users/:id
│   └── [id]/
│       └── profile.ts    # GET /api/users/:id/profile (cached)
└── github/
    └── [owner]/
        └── [repo]/
            └── stars.ts  # GET /api/github/:owner/:repo/stars
```

## Basic API Route

```typescript
// api/hello.ts
import { defineEventHandler, getQuery } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  return { message: `Hello, ${query.name || 'World'}!` };
});
```

## Dynamic Parameters

Use `[param]` syntax for dynamic route segments:

```typescript
// api/users/[id].ts
import { defineEventHandler, getRouterParam, createError } from 'h3';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  
  if (!id) {
    throw createError({ statusCode: 400, message: 'ID required' });
  }
  
  return { userId: id };
});
```

## Caching with defineCachedEventHandler

For caching entire HTTP responses, use `defineCachedEventHandler`:

```typescript
// api/cached-data.ts
import { defineCachedEventHandler, getRouterParam } from 'h3';

export default defineCachedEventHandler(
  async (event) => {
    // Expensive operation
    const data = await fetchExpensiveData();
    return data;
  },
  {
    maxAge: 60,           // Cache for 60 seconds
    swr: true,            // Stale-while-revalidate
    staleMaxAge: 300,     // Serve stale for up to 5 minutes
    name: 'cached-data',  // Cache name for debugging
    getKey: (event) => {  // Custom cache key
      return getRouterParam(event, 'id') || 'default';
    },
  }
);
```

### Cache Options

| Option | Type | Description |
|--------|------|-------------|
| `maxAge` | number | Cache duration in seconds |
| `swr` | boolean | Enable stale-while-revalidate |
| `staleMaxAge` | number | Max age for stale content (SWR) |
| `name` | string | Cache name for debugging |
| `group` | string | Group related caches |
| `getKey` | function | Custom cache key generator |
| `integrity` | boolean | Enable integrity checking |
| `varies` | string[] | Headers to vary cache by |

## Caching with defineCachedFunction

For caching function results (not HTTP handlers), use `defineCachedFunction`:

```typescript
// server/utils/cached-functions.ts
import { defineCachedFunction } from 'nitro/runtime';

export const getGitHubStars = defineCachedFunction(
  async (owner: string, repo: string) => {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`
    );
    const data = await response.json();
    return data.stargazers_count;
  },
  {
    maxAge: 3600,         // Cache for 1 hour
    name: 'github-stars',
    getKey: (owner, repo) => `${owner}/${repo}`,
  }
);

// Use in handlers
const stars = await getGitHubStars('denoland', 'deno');
```

### When to Use Each

| Use Case | Function |
|----------|----------|
| Cache entire HTTP response | `defineCachedEventHandler` |
| Cache external API calls | `defineCachedFunction` |
| Cache database queries | `defineCachedFunction` |
| Cache expensive computations | `defineCachedFunction` |
| Cache shared data | `defineCachedFunction` |

## Cache Storage Configuration

By default, Nitro uses in-memory caching. For production, configure persistent storage:

```typescript
// vite.config.ts
export default defineConfig({
  nitro: {
    storage: {
      cache: {
        driver: 'redis',
        url: process.env.REDIS_URL,
      },
    },
  },
});
```

Available drivers: `memory`, `redis`, `cloudflare-kv`, `vercel-kv`, `fs`

## Cache Invalidation

Nitro automatically invalidates cache entries when they expire. For manual invalidation:

```typescript
import { useStorage } from 'nitro/runtime';

// Clear specific cache entry
await useStorage('cache').removeItem('my-handler:key');

// Clear all entries in a group
await useStorage('cache').clear('api');
```

## Example Routes

- `/api/hello?name=World` - Basic query parameters
- `/api/time` - Current server time
- `/api/cached-time` - Cached time (10s cache)
- `/api/users/123` - Dynamic user lookup
- `/api/users/123/profile` - Cached user profile (5min cache)
- `/api/stats?userId=123` - Uses cached functions
- `/api/github/denoland/deno/stars` - Cached GitHub API call

## Migration from Custom Routing

These routes were migrated from `src/api/` to use Nitro's native file-system routing:

- `src/api/hello.ts` → `api/hello.ts`
- `src/api/time.ts` → `api/time.ts`
- `src/api/users/[id].ts` → `api/users/[id].ts`

The main changes:
1. Use `defineEventHandler` from `h3` instead of custom handlers
2. Use `getRouterParam` for dynamic parameters
3. Use `defineCachedEventHandler` for caching (replaces custom CacheManager)
