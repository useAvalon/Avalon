# @avalon/avalon

The core Avalon framework package - a lightweight, framework-agnostic islands architecture library for building interactive web applications with minimal JavaScript.

## Overview

Avalon is built on a "zero-bundle" philosophy, serving components as individual ES modules directly from your source directory. This approach provides granular caching, eliminates build steps during development, and perfectly embodies the islands architecture by shipping only the JavaScript needed for interactivity.

## Features

- 🏝️ **Islands Architecture**: Ship only the JavaScript you need
- ⚡ **Framework Agnostic**: Support for Preact, Solid, Vue, and Svelte
- 🎯 **Selective Hydration**: Components hydrate only when needed
- 📦 **Minimal Bundle Size**: Tree-shakeable exports for optimal performance
- 🔧 **TypeScript First**: Full type safety and excellent DX
- 🚀 **SSR Ready**: Server-side rendering with client-side hydration
- 🛣️ **File-System Routing**: Automatic route discovery from your pages directory
- 📡 **API Routes**: Built-in API system with file-based routing
- 🎨 **Layout System**: Flexible layout composition with data loading
- 🔀 **Middleware**: Request/response middleware for pages and API routes
- 🔥 **Hot Reload**: Instant development feedback

## Installation

```bash
# Install from JSR (JavaScript Registry)
deno add jsr:@avalon/avalon
```

## Quick Start

### 1. Create a Server

```typescript
// server.ts
import { createServer } from '@avalon/avalon';
import HomePage from './src/pages/index.tsx';

const server = createServer({
  routes: {
    '/': {
      component: HomePage,
      options: {
        title: 'Home - My App'
      }
    }
  },
  port: 8000
});

server.listen();
```

### 2. Create a Page Component

```typescript
// src/pages/index.tsx
import { Island } from '@avalon/avalon';
import Counter from '../islands/Counter.tsx';

export default function HomePage() {
  return (
    <div>
      <h1>Welcome to Avalon</h1>
      <Island component={Counter} condition="on:visible" />
    </div>
  );
}
```

### 3. Create an Interactive Island

```typescript
// src/islands/Counter.tsx
import { useState } from 'preact/hooks';

export default function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
}
```

### 4. Run Your App

```bash
deno run --allow-all server.ts
```

## Core Concepts

### Islands Architecture

Components are static by default and only become interactive when explicitly requested:

```typescript
// Static: Pure HTML, no JavaScript
<Island component={MyComponent} />

// Interactive: Hydrates when visible
<Island component={MyComponent} condition="on:visible" />

// Interactive: Hydrates on interaction
<Island component={MyComponent} condition="on:interaction" />

// Interactive: Hydrates immediately
<Island component={MyComponent} condition="on:client" />
```

### File-System Routing

Avalon automatically discovers routes from your pages directory:

```
src/pages/
├── index.tsx           → /
├── about.tsx           → /about
├── blog/
│   ├── index.tsx       → /blog
│   └── [slug].tsx      → /blog/:slug
└── api/
    └── users.ts        → /api/users
```

### API Routes

Create API endpoints using file-based routing:

```typescript
// src/api/users.ts
import { ApiContext } from '@avalon/avalon';

export async function GET(ctx: ApiContext) {
  return ctx.json({ users: [] });
}

export async function POST(ctx: ApiContext) {
  const body = await ctx.request.json();
  return ctx.json({ created: true }, { status: 201 });
}
```

### Layout System

Create reusable layouts for your pages:

```typescript
// src/layouts/MainLayout.tsx
export default function MainLayout({ children }) {
  return (
    <html>
      <head>
        <title>My App</title>
      </head>
      <body>
        <nav>Navigation</nav>
        <main>{children}</main>
        <footer>Footer</footer>
      </body>
    </html>
  );
}
```

### Middleware

Add request/response middleware:

```typescript
// src/middleware/_middleware.ts
import { MiddlewareContext } from '@avalon/avalon';

export async function middleware(ctx: MiddlewareContext) {
  console.log(`Request: ${ctx.request.method} ${ctx.url.pathname}`);
  
  const response = await ctx.next();
  
  console.log(`Response: ${response.status}`);
  return response;
}
```

## Framework Integrations

Avalon supports multiple UI frameworks through integration packages:

- `@avalon/preact` - Preact integration
- `@avalon/vue` - Vue integration
- `@avalon/solid` - Solid integration
- `@avalon/svelte` - Svelte integration

Each integration is loaded automatically when you use components from that framework.

## Main Exports

### Server

```typescript
import {
  createServer,
  createServerSafe,
  renderToHtml
} from '@avalon/avalon';
```

### Islands

```typescript
import {
  Island,
  renderIsland,
  detectFramework,
  loadIntegration
} from '@avalon/avalon';
```

### API

```typescript
import {
  discoverApiRoutes,
  handleApiRequest,
  type ApiContext,
  type ApiHandler
} from '@avalon/avalon';
```

### Middleware

```typescript
import {
  MiddlewareDiscovery,
  MiddlewareExecutor,
  MiddlewareErrorHandler,
  type MiddlewareContext
} from '@avalon/avalon';
```

### Layout System

```typescript
import {
  type LayoutContext,
  type LayoutConfig,
  type LayoutProps
} from '@avalon/avalon';
```

### Build

```typescript
import {
  build,
  generateIslandManifest,
  loadIslandManifest
} from '@avalon/avalon';
```

## TypeScript Support

Avalon is written in TypeScript and provides comprehensive type definitions:

```typescript
import type {
  RenderOptions,
  ServerConfig,
  Routes,
  ApiContext,
  MiddlewareContext,
  LayoutContext,
  IslandProps
} from '@avalon/avalon';
```

## Configuration

### Server Configuration

```typescript
interface ServerConfig {
  routes: Routes;
  port?: number;
  defaultOptions?: RenderOptions;
  importMap?: ImportMap;
  hotReload?: HotReloadConfig;
}
```

### Render Options

```typescript
interface RenderOptions {
  title?: string;
  meta?: MetaTag[];
  scripts?: ScriptConfig[];
  styles?: string[];
  importMap?: ImportMap;
}
```

## Development

### Hot Reload

Hot reload is automatically enabled in development mode:

```typescript
const server = createServer({
  routes,
  port: 8000,
  hotReload: {
    debounceMs: 30,
    watchDirs: ['src'],
    watchExtensions: ['.ts', '.tsx', '.js', '.jsx', '.css']
  }
});
```

### Build for Production

```typescript
import { build } from '@avalon/avalon';

await build({
  entryPoints: ['./src/pages/**/*.tsx'],
  outDir: './dist',
  minify: true
});
```

## License

MIT

## Links

- [Documentation](https://github.com/yourusername/avalon/tree/main/docs)
- [Examples](https://github.com/yourusername/avalon/tree/main/examples)
- [GitHub](https://github.com/yourusername/avalon)
