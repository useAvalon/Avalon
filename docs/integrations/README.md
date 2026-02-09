# Avalon Integration System

The Avalon integration system provides a modular, extensible architecture for framework integrations. Each UI framework (Preact, Vue, Solid, Svelte) is an independent package with its own versioning, dependencies, and release cycle.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Integration Interface](#integration-interface)
- [Using Integrations](#using-integrations)
- [Creating Custom Integrations](#creating-custom-integrations)
- [Migration Guide](#migration-guide)
- [API Reference](#api-reference)
- [Examples](#examples)

## Overview

### What is an Integration?

An integration is a self-contained package that provides:
- **Server-side rendering (SSR)** - Render components to HTML on the server
- **Client-side hydration** - Attach interactivity to server-rendered HTML
- **Build-time processing** - Optional Vite plugins for framework-specific transformations
- **Component detection** - Patterns to identify framework usage

### Why Modular Integrations?

The modular architecture provides several benefits:

1. **Independent Versioning** - Update framework integrations without releasing the core framework
2. **Parallel Development** - Teams can work on different integrations simultaneously
3. **Tree-Shaking** - Only bundle the frameworks you actually use
4. **Extensibility** - Third-party developers can create custom integrations
5. **Isolation** - Framework dependencies are isolated to their respective packages

### Supported Frameworks

Avalon includes official integrations for:

- **Preact** - Lightweight React alternative with the same API
- **Vue** - Progressive JavaScript framework with SFC support
- **Solid** - Fine-grained reactive framework
- **Svelte** - Compile-time framework with minimal runtime

## Architecture

### Directory Structure

```
src/integrations/
├── shared/
│   ├── types.ts              # Common integration interfaces
│   ├── base-integration.ts   # Abstract base class
│   └── utils.ts              # Shared utilities
│
├── preact/
│   ├── deno.json             # Package metadata & dependencies
│   ├── mod.ts                # Main export
│   ├── README.md             # Integration documentation
│   ├── types.ts              # Preact-specific types
│   ├── server/
│   │   ├── renderer.ts       # SSR implementation
│   │   └── utils.ts          # Server utilities
│   └── client/
│       ├── hydration.ts      # Client hydration
│       └── index.ts          # Client entrypoint
│
├── vue/
│   ├── deno.json
│   ├── mod.ts
│   ├── README.md
│   ├── types.ts
│   ├── server/
│   │   ├── renderer.ts
│   │   └── css-extractor.ts  # Vue SFC CSS extraction
│   └── client/
│       ├── hydration.ts
│       └── index.ts
│
├── solid/
│   └── ... (similar structure)
│
└── svelte/
    └── ... (similar structure)
```

### Core Components

The integration system consists of several core components:

```
src/core/integrations/
├── registry.ts          # Manages loaded integrations
├── loader.ts            # Dynamic integration loading
├── validator.ts         # Integration validation
├── config-loader.ts     # Configuration file loading
├── startup.ts           # System initialization
└── cli.ts               # CLI commands
```

### Data Flow

```
┌─────────────────┐
│  User Component │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Island Wrapper │ ◄─── Detects framework
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Integration     │ ◄─── Loads integration
│ Loader          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Integration     │ ◄─── Calls render()
│ (Preact/Vue/etc)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rendered HTML  │ ◄─── Returns HTML + metadata
└─────────────────┘
```

## Integration Interface

All integrations must implement the `Integration` interface defined in `src/integrations/shared/types.ts`.

### Core Interface

```typescript
export interface Integration {
  /** Unique name of the integration (e.g., "preact", "vue") */
  name: string;
  
  /** Version of the integration package */
  version: string;

  /**
   * Render a component to HTML on the server
   * @param params - Rendering parameters
   * @returns Promise resolving to render result
   */
  render(params: RenderParams): Promise<RenderResult>;

  /**
   * Get the hydration script for client-side initialization
   * @returns JavaScript code as a string
   */
  getHydrationScript(): string;

  /**
   * Get the integration configuration
   * @returns Integration configuration object
   */
  config(): IntegrationConfig;

  /**
   * Optional: Provide Vite plugins for build-time processing
   * @returns Vite plugin or array of plugins
   */
  vitePlugin?(): any | any[];
}
```

### Required Methods

#### `render(params: RenderParams): Promise<RenderResult>`

Renders a component to HTML on the server.

**Parameters:**
```typescript
interface RenderParams {
  component: unknown;              // Component to render
  props: Record<string, unknown>;  // Component props
  src: string;                     // Path to component file
  condition?: HydrationCondition;  // Hydration condition
  ssrOnly?: boolean;               // Skip client hydration
  viteServer?: ViteDevServer;      // Vite dev server (dev mode)
  isDev?: boolean;                 // Development mode flag
}
```

**Returns:**
```typescript
interface RenderResult {
  html: string;                           // Rendered HTML
  css?: string;                           // Scoped CSS (if applicable)
  head?: string;                          // Additional head content
  hydrationData?: Record<string, unknown>; // Data for hydration
}
```

**Example Implementation:**
```typescript
async render(params: RenderParams): Promise<RenderResult> {
  const { src, props } = params;
  
  // Load the component
  const Component = await this.loadComponent(src);
  
  // Render to HTML
  const html = renderToString(h(Component, props));
  
  return {
    html,
    hydrationData: {
      src,
      props,
      framework: this.name,
    },
  };
}
```

#### `getHydrationScript(): string`

Returns JavaScript code for client-side hydration.

**Returns:** String containing JavaScript code

**Example Implementation:**
```typescript
getHydrationScript(): string {
  return `
    import { hydrate } from '@avalon/preact/client';
    
    document.querySelectorAll('[data-framework="preact"]').forEach(el => {
      const src = el.getAttribute('data-src');
      const props = JSON.parse(el.getAttribute('data-props') || '{}');
      
      import(src).then(module => {
        const Component = module.default || module;
        hydrate(el, Component, props);
      });
    });
  `;
}
```

#### `config(): IntegrationConfig`

Returns configuration for the integration.

**Returns:**
```typescript
interface IntegrationConfig {
  name: string;                    // Integration name
  fileExtensions: string[];        // Handled file extensions
  jsxImportSources?: string[];     // JSX import sources
  detectionPatterns: {
    imports: RegExp[];             // Import detection patterns
    content: RegExp[];             // Content detection patterns
  };
}
```

**Example Implementation:**
```typescript
config(): IntegrationConfig {
  return {
    name: "preact",
    fileExtensions: [".tsx", ".jsx"],
    jsxImportSources: ["preact"],
    detectionPatterns: {
      imports: [/^preact$/, /^preact\//],
      content: [/\buseState\b/, /\buseEffect\b/],
    },
  };
}
```

#### `vitePlugin?(): any | any[]` (Optional)

Provides Vite plugins for build-time processing.

**Returns:** Vite plugin or array of plugins

**Example Implementation:**
```typescript
vitePlugin() {
  return preactPlugin({
    devtools: true,
  });
}
```

### Hydration Conditions

Integrations must support these hydration conditions:

```typescript
type HydrationCondition =
  | "on:client"      // Hydrate immediately on page load
  | "on:visible"     // Hydrate when visible in viewport
  | "on:interaction" // Hydrate on first user interaction
  | "on:idle"        // Hydrate when browser is idle
  | `media:${string}`; // Hydrate when media query matches
```

## Using Integrations

### Installation

Integrations are included with Avalon by default. No additional installation is required for official integrations.

For third-party integrations:

```bash
deno add @vendor/integration-name
```

### Configuration

Create an `avalon.config.ts` file in your project root:

```typescript
export default {
  integrations: [
    { name: "preact", enabled: true },
    { name: "vue", enabled: true },
    { name: "solid", enabled: true },
    { name: "svelte", enabled: true },
  ],
  autoDiscoverIntegrations: true,
  validateIntegrations: true,
};
```

### Using Islands

Create a component in your `islands/` directory:

```tsx
// islands/Counter.tsx (Preact)
import { h } from "preact";
import { useState } from "preact/hooks";

export default function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

Use the island in a page:

```tsx
// pages/index.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Home() {
  return (
    <div>
      <h1>Welcome</h1>
      <Island 
        src="/islands/Counter.tsx"
        condition="on:visible"
        props={{ initialCount: 0 }}
      />
    </div>
  );
}
```

### Hydration Strategies

Control when islands become interactive:

```tsx
// Hydrate immediately (default)
<Island src="/islands/Counter.tsx" condition="on:client" />

// Hydrate when visible
<Island src="/islands/Counter.tsx" condition="on:visible" />

// Hydrate on interaction
<Island src="/islands/Counter.tsx" condition="on:interaction" />

// Hydrate when idle
<Island src="/islands/Counter.tsx" condition="on:idle" />

// Hydrate on media query match
<Island src="/islands/Counter.tsx" condition="media:(min-width: 768px)" />

// Server-only (no hydration)
<Island src="/islands/Counter.tsx" ssrOnly={true} />
```

## Creating Custom Integrations

### Step 1: Create Package Structure

Create a new directory for your integration:

```
src/integrations/my-framework/
├── deno.json
├── mod.ts
├── README.md
├── types.ts
├── server/
│   ├── renderer.ts
│   └── utils.ts
└── client/
    ├── hydration.ts
    └── index.ts
```

### Step 2: Define Package Metadata

Create `deno.json`:

```json
{
  "name": "@avalon/my-framework",
  "version": "0.1.0",
  "exports": {
    ".": "./mod.ts",
    "./server": "./server/renderer.ts",
    "./client": "./client/index.ts"
  },
  "imports": {
    "my-framework": "npm:my-framework@1.0.0",
    "@avalon/shared": "../../shared/types.ts"
  }
}
```

### Step 3: Implement the Integration

Create `mod.ts`:

```typescript
import type { Integration, IntegrationConfig } from "../shared/types.ts";
import { render } from "./server/renderer.ts";
import { getHydrationScript } from "./client/hydration.ts";

export const myFrameworkIntegration: Integration = {
  name: "my-framework",
  version: "0.1.0",
  
  render,
  getHydrationScript,
  
  config(): IntegrationConfig {
    return {
      name: "my-framework",
      fileExtensions: [".mf", ".mfx"],
      jsxImportSources: ["my-framework"],
      detectionPatterns: {
        imports: [/^my-framework$/],
        content: [/\bmyFrameworkHook\b/],
      },
    };
  },
};

export { render } from "./server/renderer.ts";
export { hydrate } from "./client/hydration.ts";
export type * from "./types.ts";
```

### Step 4: Implement Server Rendering

Create `server/renderer.ts`:

```typescript
import type { RenderParams, RenderResult } from "../../shared/types.ts";
import { renderToString } from "my-framework/server";

export async function render(params: RenderParams): Promise<RenderResult> {
  const { src, props } = params;
  
  // Load component
  const Component = await loadComponent(src);
  
  // Render to HTML
  const html = renderToString(Component, props);
  
  return {
    html,
    hydrationData: {
      src,
      props,
      framework: "my-framework",
    },
  };
}

async function loadComponent(src: string): Promise<any> {
  // Implementation depends on your framework
  const module = await import(src);
  return module.default || module;
}
```

### Step 5: Implement Client Hydration

Create `client/hydration.ts`:

```typescript
import { hydrate as frameworkHydrate } from "my-framework";

export function hydrate(
  container: HTMLElement,
  component: any,
  props: Record<string, unknown>
): void {
  frameworkHydrate(container, component, props);
}

export function getHydrationScript(): string {
  return `
    import { hydrate } from '@avalon/my-framework/client';
    
    document.querySelectorAll('[data-framework="my-framework"]').forEach(el => {
      const src = el.getAttribute('data-src');
      const props = JSON.parse(el.getAttribute('data-props') || '{}');
      
      import(src).then(module => {
        const Component = module.default || module;
        hydrate(el, Component, props);
      });
    });
  `;
}
```

### Step 6: Add Documentation

Create `README.md` documenting your integration's usage, API, and examples.

### Step 7: Register the Integration

Add your integration to `avalon.config.ts`:

```typescript
export default {
  integrations: [
    { name: "my-framework", enabled: true },
  ],
};
```

### Step 8: Test the Integration

Create tests to verify your integration:

```typescript
// server/renderer.test.ts
import { assertEquals } from "std/assert/mod.ts";
import { render } from "./renderer.ts";

Deno.test("renders component to HTML", async () => {
  const result = await render({
    src: "/test/Component.mf",
    props: { message: "Hello" },
  });
  
  assertEquals(typeof result.html, "string");
  assertEquals(result.hydrationData?.framework, "my-framework");
});
```

### Best Practices

1. **Error Handling** - Provide clear error messages for common issues
2. **Performance** - Cache loaded components and minimize overhead
3. **TypeScript** - Include full type definitions
4. **Documentation** - Document all public APIs and provide examples
5. **Testing** - Write comprehensive tests for SSR and hydration
6. **Compatibility** - Ensure compatibility with Avalon's build system

## Migration Guide

### Migrating from Old Renderer System

If you're upgrading from an older version of Avalon that used the monolithic renderer system, follow these steps:

#### 1. Update Import Paths

**Before:**
```typescript
import { renderPreact } from "../islands/renderers/preact-renderer.ts";
```

**After:**
```typescript
import { render } from "@avalon/preact";
```

#### 2. Update Island Usage

The Island component API remains the same, but the internal implementation has changed. No changes needed to your island usage:

```tsx
// This still works the same way
<Island 
  src="/islands/Counter.tsx"
  condition="on:visible"
  props={{ count: 0 }}
/>
```

#### 3. Update Configuration

Create an `avalon.config.ts` file if you don't have one:

```typescript
export default {
  integrations: [
    { name: "preact", enabled: true },
    { name: "vue", enabled: true },
    { name: "solid", enabled: true },
    { name: "svelte", enabled: true },
  ],
};
```

#### 4. Update Dependencies

The framework dependencies are now managed by integration packages. Update your `deno.json`:

**Before:**
```json
{
  "imports": {
    "preact": "npm:preact@10.26.9",
    "vue": "npm:vue@3.4.0",
    "solid-js": "npm:solid-js@1.8.0",
    "svelte": "npm:svelte@5.0.0"
  }
}
```

**After:**
```json
{
  "imports": {
    "@avalon/preact": "./src/integrations/preact/mod.ts",
    "@avalon/vue": "./src/integrations/vue/mod.ts",
    "@avalon/solid": "./src/integrations/solid/mod.ts",
    "@avalon/svelte": "./src/integrations/svelte/mod.ts"
  }
}
```

#### 5. Remove Old Renderer Files

After verifying everything works, you can remove the old renderer files:

```bash
rm -rf src/islands/renderers/
```

#### 6. Update Custom Renderers

If you created custom renderers, convert them to integrations following the [Creating Custom Integrations](#creating-custom-integrations) guide.

### Breaking Changes

- **Import paths** - Renderer imports have changed
- **Direct renderer calls** - Use the integration API instead
- **Framework dependencies** - Now managed by integration packages

### Backward Compatibility

The following remain unchanged:
- Island component API
- Hydration conditions
- SSR behavior
- Component props
- Error handling

## API Reference

### Core Types

#### `Integration`

Main integration interface that all integrations must implement.

```typescript
interface Integration {
  name: string;
  version: string;
  render(params: RenderParams): Promise<RenderResult>;
  getHydrationScript(): string;
  config(): IntegrationConfig;
  vitePlugin?(): any | any[];
}
```

#### `RenderParams`

Parameters passed to the render function.

```typescript
interface RenderParams {
  component: unknown;
  props: Record<string, unknown>;
  src: string;
  condition?: HydrationCondition;
  ssrOnly?: boolean;
  viteServer?: ViteDevServer;
  isDev?: boolean;
}
```

#### `RenderResult`

Result returned from the render function.

```typescript
interface RenderResult {
  html: string;
  css?: string;
  head?: string;
  hydrationData?: Record<string, unknown>;
}
```

#### `IntegrationConfig`

Configuration for an integration.

```typescript
interface IntegrationConfig {
  name: string;
  fileExtensions: string[];
  jsxImportSources?: string[];
  detectionPatterns: {
    imports: RegExp[];
    content: RegExp[];
  };
}
```

#### `HydrationCondition`

Conditions for when to hydrate an island.

```typescript
type HydrationCondition =
  | "on:client"
  | "on:visible"
  | "on:interaction"
  | "on:idle"
  | `media:${string}`;
```

### Integration Registry

#### `registry.load(name: string): Promise<Integration>`

Load an integration by name.

```typescript
import { registry } from "./src/core/integrations/registry.ts";

const integration = await registry.load("preact");
```

#### `registry.get(name: string): Integration | undefined`

Get a loaded integration.

```typescript
const integration = registry.get("preact");
```

#### `registry.has(name: string): boolean`

Check if an integration is loaded.

```typescript
if (registry.has("vue")) {
  // Vue integration is loaded
}
```

#### `registry.getAll(): Integration[]`

Get all loaded integrations.

```typescript
const all = registry.getAll();
```

### Integration Loader

#### `loadIntegration(name: string): Promise<Integration>`

Load an integration with caching.

```typescript
import { loadIntegration } from "./src/core/integrations/loader.ts";

const integration = await loadIntegration("solid");
```

#### `preloadIntegrations(names: string[]): Promise<void>`

Preload multiple integrations.

```typescript
await preloadIntegrations(["preact", "vue", "solid"]);
```

#### `isIntegrationLoaded(name: string): boolean`

Check if an integration is loaded.

```typescript
if (isIntegrationLoaded("svelte")) {
  // Svelte is loaded
}
```

### Validation

#### `validateIntegration(integration: Integration): ValidationResult`

Validate an integration against the required interface.

```typescript
import { validateIntegration } from "./src/core/integrations/validator.ts";

const result = validateIntegration(integration);

if (!result.valid) {
  console.error("Errors:", result.errors);
}
```

## Examples

### Example 1: Basic Preact Island

```tsx
// islands/Greeting.tsx
import { h } from "preact";

interface GreetingProps {
  name: string;
}

export default function Greeting({ name }: GreetingProps) {
  return <h1>Hello, {name}!</h1>;
}
```

```tsx
// pages/index.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Home() {
  return (
    <Island 
      src="/islands/Greeting.tsx"
      props={{ name: "World" }}
    />
  );
}
```

### Example 2: Vue Component with Scoped Styles

```vue
<!-- islands/Card.vue -->
<template>
  <div class="card">
    <h2>{{ title }}</h2>
    <p>{{ content }}</p>
  </div>
</template>

<script setup>
defineProps({
  title: String,
  content: String,
});
</script>

<style scoped>
.card {
  border: 1px solid #ccc;
  padding: 1rem;
  border-radius: 8px;
}
</style>
```

```tsx
// pages/cards.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Cards() {
  return (
    <Island 
      src="/islands/Card.vue"
      props={{ 
        title: "My Card",
        content: "Card content here"
      }}
    />
  );
}
```

### Example 3: Solid Component with Reactivity

```tsx
// islands/Timer.solid.tsx
import { createSignal, onCleanup } from "solid-js";

export default function Timer() {
  const [count, setCount] = createSignal(0);
  
  const interval = setInterval(() => {
    setCount(c => c + 1);
  }, 1000);
  
  onCleanup(() => clearInterval(interval));
  
  return <div>Seconds: {count()}</div>;
}
```

```tsx
// pages/timer.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function TimerPage() {
  return (
    <Island 
      src="/islands/Timer.solid.tsx"
      condition="on:visible"
    />
  );
}
```

### Example 4: Svelte Component with Stores

```svelte
<!-- islands/Counter.svelte -->
<script>
  import { writable } from 'svelte/store';
  
  const count = writable(0);
  
  function increment() {
    count.update(n => n + 1);
  }
</script>

<button on:click={increment}>
  Count: {$count}
</button>

<style>
  button {
    padding: 0.5rem 1rem;
    font-size: 1rem;
  }
</style>
```

```tsx
// pages/counter.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function CounterPage() {
  return (
    <Island 
      src="/islands/Counter.svelte"
      condition="on:interaction"
    />
  );
}
```

### Example 5: Multiple Frameworks on One Page

```tsx
// pages/multi-framework.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function MultiFramework() {
  return (
    <div>
      <h1>Multiple Frameworks</h1>
      
      {/* Preact island */}
      <Island 
        src="/islands/PreactCounter.tsx"
        condition="on:client"
      />
      
      {/* Vue island */}
      <Island 
        src="/islands/VueCard.vue"
        condition="on:visible"
      />
      
      {/* Solid island */}
      <Island 
        src="/islands/SolidTimer.solid.tsx"
        condition="on:idle"
      />
      
      {/* Svelte island */}
      <Island 
        src="/islands/SvelteForm.svelte"
        condition="on:interaction"
      />
    </div>
  );
}
```

### Example 6: Custom Integration

```typescript
// src/integrations/lit/mod.ts
import type { Integration, IntegrationConfig } from "../shared/types.ts";
import { render } from "./server/renderer.ts";
import { getHydrationScript } from "./client/hydration.ts";

export const litIntegration: Integration = {
  name: "lit",
  version: "0.1.0",
  
  render,
  getHydrationScript,
  
  config(): IntegrationConfig {
    return {
      name: "lit",
      fileExtensions: [".lit.ts", ".lit.js"],
      jsxImportSources: [],
      detectionPatterns: {
        imports: [/^lit$/, /^lit\//],
        content: [/\bLitElement\b/, /\bcustomElement\b/],
      },
    };
  },
};
```

## Related Documentation

- [Integration Configuration](../integration-configuration.md)
- [Build System Integrations](../build-system-integrations.md)
- [Core Integration System](../../src/core/integrations/README.md)
- [Preact Integration](../../src/integrations/preact/README.md)
- [Vue Integration](../../src/integrations/vue/README.md)
- [Solid Integration](../../src/integrations/solid/README.md)
- [Svelte Integration](../../src/integrations/svelte/README.md)

## Contributing

Contributions to the integration system are welcome! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

## License

MIT License - see LICENSE file for details.
