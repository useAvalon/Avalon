# Integration Development Guide

This guide provides detailed instructions for developing custom framework integrations for Avalon.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Integration Structure](#integration-structure)
- [Implementing Core Methods](#implementing-core-methods)
- [Server-Side Rendering](#server-side-rendering)
- [Client-Side Hydration](#client-side-hydration)
- [Component Loading](#component-loading)
- [CSS Handling](#css-handling)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Publishing](#publishing)
- [Best Practices](#best-practices)

## Prerequisites

Before creating a custom integration, you should have:

- Understanding of the target framework's SSR and hydration APIs
- Familiarity with Deno and TypeScript
- Knowledge of Vite and its plugin system
- Understanding of Avalon's architecture

## Getting Started

### 1. Choose Your Framework

Identify the framework you want to integrate. Ensure it supports:
- Server-side rendering (SSR)
- Client-side hydration
- Component-based architecture

### 2. Study Existing Integrations

Review the official integrations to understand the patterns:

```bash
# Examine the Preact integration (simplest)
cat src/integrations/preact/mod.ts

# Examine the Vue integration (CSS handling)
cat src/integrations/vue/server/css-extractor.ts

# Examine the Solid integration (async rendering)
cat src/integrations/solid/server/renderer.ts

# Examine the Svelte integration (compiler integration)
cat src/integrations/svelte/server/renderer.ts
```

### 3. Set Up Your Development Environment

Create a new branch for your integration:

```bash
git checkout -b integration/my-framework
```

## Integration Structure

### Directory Layout

Create the following structure:

```
src/integrations/my-framework/
├── deno.json                 # Package metadata
├── mod.ts                    # Main export
├── README.md                 # Documentation
├── types.ts                  # TypeScript types
├── server/
│   ├── renderer.ts           # SSR implementation
│   ├── utils.ts              # Server utilities
│   └── renderer.test.ts      # Server tests
└── client/
    ├── hydration.ts          # Client hydration
    ├── index.ts              # Client entrypoint
    └── hydration.test.ts     # Client tests
```

### Package Metadata (deno.json)

Define your package metadata:

```json
{
  "name": "@avalon/integration-my-framework",
  "version": "0.1.0",
  "description": "My Framework integration for Avalon",
  "exports": {
    ".": "./mod.ts",
    "./server": "./server/renderer.ts",
    "./client": "./client/index.ts",
    "./types": "./types.ts"
  },
  "imports": {
    "my-framework": "npm:my-framework@^1.0.0",
    "my-framework/server": "npm:my-framework@^1.0.0/server",
    "@avalon/shared": "../../shared/types.ts"
  },
  "tasks": {
    "test": "deno test --allow-read --allow-env",
    "check": "deno check mod.ts"
  }
}
```

### Main Export (mod.ts)

Create the main integration export:

```typescript
import type { 
  Integration, 
  IntegrationConfig,
  RenderParams,
  RenderResult 
} from "../shared/types.ts";
import { render } from "./server/renderer.ts";
import { getHydrationScript } from "./client/hydration.ts";

/**
 * My Framework integration for Avalon
 */
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
        imports: [
          /^my-framework$/,
          /^my-framework\//,
          /from\s+['"]my-framework['"]/,
        ],
        content: [
          /\bmyFrameworkHook\b/,
          /\bMyFrameworkComponent\b/,
        ],
      },
    };
  },
  
  // Optional: Provide Vite plugins
  vitePlugin() {
    return myFrameworkVitePlugin();
  },
};

// Re-export public API
export { render } from "./server/renderer.ts";
export { hydrate, getHydrationScript } from "./client/hydration.ts";
export type * from "./types.ts";
```

## Implementing Core Methods

### The render() Method

The `render()` method is responsible for server-side rendering:

```typescript
// server/renderer.ts
import type { RenderParams, RenderResult } from "../../shared/types.ts";
import { renderToString } from "my-framework/server";
import { loadComponent } from "./utils.ts";

export async function render(params: RenderParams): Promise<RenderResult> {
  const { src, props, ssrOnly = false, isDev = false, viteServer } = params;
  
  try {
    // 1. Load the component
    const Component = await loadComponent(src, { isDev, viteServer });
    
    // 2. Render to HTML
    const html = await renderToString(Component, props);
    
    // 3. Extract CSS (if applicable)
    const css = await extractCSS(src);
    
    // 4. Return result
    return {
      html,
      css,
      hydrationData: ssrOnly ? undefined : {
        src,
        props,
        framework: "my-framework",
      },
    };
  } catch (error) {
    console.error(`Failed to render ${src}:`, error);
    throw error;
  }
}
```

### The getHydrationScript() Method

The `getHydrationScript()` method returns client-side hydration code:

```typescript
// client/hydration.ts
export function getHydrationScript(): string {
  return `
    import { hydrate } from '@avalon/integration-my-framework/client';
    
    // Find all islands for this framework
    const islands = document.querySelectorAll('[data-framework="my-framework"]');
    
    islands.forEach(async (island) => {
      const src = island.getAttribute('data-src');
      const propsJson = island.getAttribute('data-props');
      const condition = island.getAttribute('data-condition');
      
      // Check hydration condition
      if (!shouldHydrate(island, condition)) {
        return;
      }
      
      try {
        // Load component
        const module = await import(src);
        const Component = module.default || module;
        
        // Parse props
        const props = propsJson ? JSON.parse(propsJson) : {};
        
        // Hydrate
        hydrate(island, Component, props);
      } catch (error) {
        console.error('Hydration failed:', error);
      }
    });
    
    function shouldHydrate(island, condition) {
      if (!condition || condition === 'on:client') return true;
      
      if (condition === 'on:visible') {
        return setupIntersectionObserver(island);
      }
      
      if (condition === 'on:interaction') {
        return setupInteractionObserver(island);
      }
      
      if (condition === 'on:idle') {
        return setupIdleCallback(island);
      }
      
      if (condition.startsWith('media:')) {
        const query = condition.slice(6);
        return window.matchMedia(query).matches;
      }
      
      return true;
    }
    
    function setupIntersectionObserver(island) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            observer.disconnect();
            // Trigger hydration
          }
        });
      });
      observer.observe(island);
      return false; // Don't hydrate immediately
    }
    
    function setupInteractionObserver(island) {
      const events = ['click', 'touchstart', 'mouseenter', 'focus'];
      const handler = () => {
        events.forEach(event => island.removeEventListener(event, handler));
        // Trigger hydration
      };
      events.forEach(event => island.addEventListener(event, handler, { once: true }));
      return false; // Don't hydrate immediately
    }
    
    function setupIdleCallback(island) {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // Trigger hydration
        });
      } else {
        setTimeout(() => {
          // Trigger hydration
        }, 200);
      }
      return false; // Don't hydrate immediately
    }
  `;
}
```

### The config() Method

The `config()` method returns integration configuration:

```typescript
config(): IntegrationConfig {
  return {
    // Unique name for the integration
    name: "my-framework",
    
    // File extensions this integration handles
    fileExtensions: [".mf", ".mfx"],
    
    // JSX import sources (for JSX-based frameworks)
    jsxImportSources: ["my-framework"],
    
    // Detection patterns
    detectionPatterns: {
      // Patterns to match import statements
      imports: [
        /^my-framework$/,              // import ... from "my-framework"
        /^my-framework\//,              // import ... from "my-framework/..."
        /from\s+['"]my-framework['"]/,  // Full import statement
      ],
      
      // Patterns to match code content
      content: [
        /\bmyFrameworkHook\b/,          // Framework-specific hooks
        /\bMyFrameworkComponent\b/,     // Framework-specific components
        /\bcreateMyFrameworkApp\b/,     // Framework-specific functions
      ],
    },
  };
}
```

## Server-Side Rendering

### Component Loading

Implement component loading for both development and production:

```typescript
// server/utils.ts
import type { ViteDevServer } from "vite";

export interface LoadOptions {
  isDev: boolean;
  viteServer?: ViteDevServer;
  buildOutput?: string;
}

export async function loadComponent(
  src: string,
  options: LoadOptions
): Promise<any> {
  const { isDev, viteServer, buildOutput = "./dist" } = options;
  
  if (isDev && viteServer) {
    // Development: Use Vite's SSR module loading
    try {
      const module = await viteServer.ssrLoadModule(src);
      return module.default || module;
    } catch (error) {
      throw new Error(`Failed to load component ${src} in dev mode`, {
        cause: error,
      });
    }
  } else {
    // Production: Load from build output
    const ssrPath = resolveBuildPath(src, buildOutput);
    try {
      const module = await import(ssrPath);
      return module.default || module;
    } catch (error) {
      throw new Error(`Failed to load component ${src} in production`, {
        cause: error,
      });
    }
  }
}

function resolveBuildPath(src: string, buildOutput: string): string {
  // Convert source path to build output path
  // Example: /islands/Counter.tsx -> ./dist/ssr/islands/Counter.js
  return src
    .replace(/^\//, "")
    .replace(/\.(tsx|ts|jsx|js|mf|mfx)$/, ".js")
    .replace(/^/, `${buildOutput}/ssr/`);
}
```

### Rendering Components

Implement the actual rendering logic:

```typescript
// server/renderer.ts
import { renderToString } from "my-framework/server";

export async function renderComponent(
  Component: any,
  props: Record<string, unknown>
): Promise<string> {
  // Framework-specific rendering
  // This varies by framework
  
  // Example for a synchronous framework:
  return renderToString(Component, props);
  
  // Example for an async framework:
  // return await renderToStringAsync(Component, props);
  
  // Example for a framework with context:
  // const context = createContext();
  // return renderToString(Component, props, context);
}
```

### Error Handling

Implement robust error handling:

```typescript
export async function renderWithErrorBoundary(
  params: RenderParams,
  fallback?: string
): Promise<RenderResult> {
  try {
    return await render(params);
  } catch (error) {
    console.error(`Render error for ${params.src}:`, error);
    
    // Return fallback or empty result
    return {
      html: fallback || `<!-- Render failed for ${params.src} -->`,
      hydrationData: undefined,
    };
  }
}
```

## Client-Side Hydration

### Hydration Function

Implement the client-side hydration:

```typescript
// client/hydration.ts
import { hydrate as frameworkHydrate } from "my-framework";

export function hydrate(
  container: HTMLElement,
  Component: any,
  props: Record<string, unknown>
): void {
  try {
    // Framework-specific hydration
    frameworkHydrate(container, Component, props);
  } catch (error) {
    console.error("Hydration failed:", error);
    // Component remains static
  }
}
```

### Hydration Conditions

Support all hydration conditions:

```typescript
export function setupHydration(
  island: HTMLElement,
  Component: any,
  props: Record<string, unknown>,
  condition: string
): void {
  switch (condition) {
    case "on:client":
      hydrate(island, Component, props);
      break;
      
    case "on:visible":
      setupVisibleHydration(island, Component, props);
      break;
      
    case "on:interaction":
      setupInteractionHydration(island, Component, props);
      break;
      
    case "on:idle":
      setupIdleHydration(island, Component, props);
      break;
      
    default:
      if (condition.startsWith("media:")) {
        setupMediaHydration(island, Component, props, condition);
      } else {
        hydrate(island, Component, props);
      }
  }
}

function setupVisibleHydration(
  island: HTMLElement,
  Component: any,
  props: Record<string, unknown>
): void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        observer.disconnect();
        hydrate(island, Component, props);
      }
    });
  });
  observer.observe(island);
}

function setupInteractionHydration(
  island: HTMLElement,
  Component: any,
  props: Record<string, unknown>
): void {
  const events = ["click", "touchstart", "mouseenter", "focus"];
  const handler = () => {
    events.forEach(event => island.removeEventListener(event, handler));
    hydrate(island, Component, props);
  };
  events.forEach(event => 
    island.addEventListener(event, handler, { once: true })
  );
}

function setupIdleHydration(
  island: HTMLElement,
  Component: any,
  props: Record<string, unknown>
): void {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => hydrate(island, Component, props));
  } else {
    setTimeout(() => hydrate(island, Component, props), 200);
  }
}

function setupMediaHydration(
  island: HTMLElement,
  Component: any,
  props: Record<string, unknown>,
  condition: string
): void {
  const query = condition.slice(6); // Remove "media:" prefix
  const mediaQuery = window.matchMedia(query);
  
  if (mediaQuery.matches) {
    hydrate(island, Component, props);
  } else {
    mediaQuery.addEventListener("change", (e) => {
      if (e.matches) {
        hydrate(island, Component, props);
      }
    }, { once: true });
  }
}
```

## Component Loading

### Development Mode

In development, use Vite's SSR module loading:

```typescript
async function loadComponentDev(
  src: string,
  viteServer: ViteDevServer
): Promise<any> {
  const module = await viteServer.ssrLoadModule(src);
  return module.default || module;
}
```

### Production Mode

In production, load from the build output:

```typescript
async function loadComponentProd(
  src: string,
  buildOutput: string
): Promise<any> {
  const ssrPath = `${buildOutput}/ssr${src.replace(/\.(tsx|ts|jsx|js)$/, ".js")}`;
  const module = await import(ssrPath);
  return module.default || module;
}
```

## CSS Handling

### Extracting CSS (for frameworks with scoped styles)

If your framework supports scoped styles (like Vue or Svelte), extract CSS during SSR:

```typescript
// server/css-extractor.ts
export async function extractCSS(src: string): Promise<string | undefined> {
  try {
    const content = await Deno.readTextFile(src);
    
    // Extract style blocks
    const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
    let css = "";
    let match;
    
    while ((match = styleRegex.exec(content)) !== null) {
      const attrs = match[1];
      const styleContent = match[2];
      const isScoped = attrs.includes("scoped");
      
      if (isScoped) {
        css += applyScopedCSS(styleContent, src);
      } else {
        css += styleContent;
      }
    }
    
    return css || undefined;
  } catch {
    return undefined;
  }
}

function applyScopedCSS(css: string, src: string): string {
  const scopeId = generateScopeId(src);
  
  // Add scope attribute to selectors
  return css.replace(/([^{}]+)\{/g, (match, selector) => {
    if (selector.trim().startsWith("@")) {
      return match; // Don't scope at-rules
    }
    return `${selector.trim()}[${scopeId}] {`;
  });
}

function generateScopeId(src: string): string {
  // Generate a unique scope ID based on the file path
  const hash = src.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `data-v-${hash}`;
}
```

### Injecting CSS

Include extracted CSS in the render result:

```typescript
export async function render(params: RenderParams): Promise<RenderResult> {
  const { src, props } = params;
  
  const Component = await loadComponent(src);
  const html = await renderToString(Component, props);
  const css = await extractCSS(src);
  
  return {
    html,
    css, // Will be injected into <head>
    hydrationData: { src, props, framework: "my-framework" },
  };
}
```

## Error Handling

### Server Errors

Handle SSR errors gracefully:

```typescript
export async function render(params: RenderParams): Promise<RenderResult> {
  try {
    // Rendering logic
  } catch (error) {
    console.error(`SSR failed for ${params.src}:`, error);
    
    // Return fallback for client-only rendering
    return {
      html: `<!-- SSR failed, will hydrate on client -->`,
      hydrationData: {
        src: params.src,
        props: params.props,
        framework: "my-framework",
      },
    };
  }
}
```

### Client Errors

Handle hydration errors:

```typescript
export function hydrate(
  container: HTMLElement,
  Component: any,
  props: Record<string, unknown>
): void {
  try {
    frameworkHydrate(container, Component, props);
  } catch (error) {
    console.error("Hydration failed:", error);
    // Component remains static, no interactivity
  }
}
```

### Component Loading Errors

Provide helpful error messages:

```typescript
async function loadComponent(src: string): Promise<any> {
  try {
    const module = await import(src);
    return module.default || module;
  } catch (error) {
    throw new Error(
      `Failed to load component ${src}. ` +
      `Make sure the file exists and exports a component.`,
      { cause: error }
    );
  }
}
```

## Testing

### Server Tests

Test server-side rendering:

```typescript
// server/renderer.test.ts
import { assertEquals, assertExists } from "std/assert/mod.ts";
import { render } from "./renderer.ts";

Deno.test("renders component to HTML", async () => {
  const result = await render({
    src: "/test/fixtures/Component.mf",
    props: { message: "Hello" },
    component: null,
  });
  
  assertExists(result.html);
  assertEquals(typeof result.html, "string");
  assertEquals(result.hydrationData?.framework, "my-framework");
});

Deno.test("handles render errors gracefully", async () => {
  const result = await render({
    src: "/test/fixtures/BrokenComponent.mf",
    props: {},
    component: null,
  });
  
  // Should return fallback
  assertExists(result.html);
});
```

### Client Tests

Test client-side hydration:

```typescript
// client/hydration.test.ts
import { assertEquals } from "std/assert/mod.ts";
import { hydrate } from "./hydration.ts";

Deno.test("hydrates component", () => {
  const container = document.createElement("div");
  container.innerHTML = "<div>Static content</div>";
  
  const Component = () => "<div>Hydrated content</div>";
  const props = {};
  
  hydrate(container, Component, props);
  
  assertEquals(container.innerHTML, "<div>Hydrated content</div>");
});
```

### Integration Tests

Test the full SSR + hydration cycle:

```typescript
// integration.test.ts
import { assertEquals } from "std/assert/mod.ts";
import { myFrameworkIntegration } from "./mod.ts";

Deno.test("full SSR + hydration cycle", async () => {
  // 1. Render on server
  const renderResult = await myFrameworkIntegration.render({
    src: "/test/fixtures/Component.mf",
    props: { count: 0 },
    component: null,
  });
  
  assertExists(renderResult.html);
  assertExists(renderResult.hydrationData);
  
  // 2. Get hydration script
  const script = myFrameworkIntegration.getHydrationScript();
  assertExists(script);
  assertEquals(typeof script, "string");
  
  // 3. Verify config
  const config = myFrameworkIntegration.config();
  assertEquals(config.name, "my-framework");
  assertEquals(config.fileExtensions.length > 0, true);
});
```

## Publishing

### Prepare for Publishing

1. **Update version** in `deno.json`
2. **Write documentation** in `README.md`
3. **Add examples** to demonstrate usage
4. **Run tests** to ensure everything works
5. **Check types** with `deno check`

### Publish to JSR

```bash
# Login to JSR
deno publish --dry-run

# Publish
deno publish
```

### Version Management

Follow semantic versioning:
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes

## Best Practices

### Performance

1. **Cache loaded components** to avoid redundant imports
2. **Minimize SSR overhead** by optimizing rendering
3. **Use code splitting** for large components
4. **Lazy load** framework code when possible

### Error Handling

1. **Provide clear error messages** with actionable information
2. **Fail gracefully** with fallbacks
3. **Log errors** for debugging
4. **Don't crash** the entire application

### TypeScript

1. **Export all types** from `types.ts`
2. **Use strict mode** for type checking
3. **Document types** with JSDoc comments
4. **Provide type guards** for runtime checks

### Documentation

1. **Document all public APIs** with examples
2. **Include usage examples** for common scenarios
3. **Explain framework-specific features**
4. **Provide migration guides** if applicable

### Testing

1. **Test SSR and hydration** separately
2. **Test error scenarios** and edge cases
3. **Use fixtures** for consistent test data
4. **Mock external dependencies** when appropriate

### Compatibility

1. **Support both dev and production** modes
2. **Handle missing dependencies** gracefully
3. **Test with different Vite configurations**
4. **Ensure Deno compatibility**

## Troubleshooting

### Common Issues

**Issue: Component not loading**
- Check file path resolution
- Verify component exports
- Check Vite configuration

**Issue: Hydration mismatch**
- Ensure SSR and client render the same output
- Check prop serialization
- Verify component state initialization

**Issue: CSS not applied**
- Check CSS extraction logic
- Verify scope ID generation
- Ensure CSS is injected into <head>

**Issue: Build errors**
- Check Vite plugin configuration
- Verify import paths
- Check TypeScript types

## Resources

- [Avalon Integration System](./README.md)
- [Integration API Reference](../../src/integrations/shared/types.ts)
- [Official Integrations](../../src/integrations/)
- [Vite Plugin API](https://vitejs.dev/guide/api-plugin.html)

## Support

For help with integration development:
- Open an issue on GitHub
- Join the Avalon Discord
- Check existing integrations for examples

## Contributing

Contributions are welcome! Please follow the [Contributing Guide](../CONTRIBUTING.md).
