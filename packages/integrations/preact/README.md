# @avalon/preact

Preact integration for Avalon framework. Provides server-side rendering (SSR) and client-side hydration for Preact components.

## Installation

```bash
deno add @avalon/preact
```

## Usage

### Basic Setup

The Preact integration is automatically loaded when you use Preact components in your Avalon project. No manual configuration is required.

### Creating a Preact Island

Create a Preact component in your `islands/` directory:

```tsx
// islands/Counter.tsx
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

### Using the Island in a Page

```tsx
// pages/index.tsx
import { h } from "preact";
import Island from "../islands/island.tsx";

export default function Home() {
  return (
    <div>
      <h1>Welcome to Avalon</h1>
      <Island 
        src="/islands/Counter.tsx"
        condition="on:visible"
      />
    </div>
  );
}
```

## API Reference

### Server API

#### `render(params: RenderParams): Promise<RenderResult>`

Renders a Preact component to HTML string on the server.

**Parameters:**
- `params.component` - The Preact component to render (optional, will be loaded from `src` if not provided)
- `params.props` - Props to pass to the component
- `params.src` - Path to the component file
- `params.ssrOnly` - If true, component will not be hydrated on the client

**Returns:**
- `html` - Rendered HTML string
- `hydrationData` - Data needed for client-side hydration

**Example:**
```typescript
import { render } from "@avalon/preact";

const result = await render({
  src: "/islands/Counter.tsx",
  props: { initialCount: 0 },
});

console.log(result.html); // "<div>...</div>"
```

#### `renderWithErrorBoundary(params: RenderParams, fallback?: string): Promise<RenderResult>`

Renders a component with error handling. If rendering fails, returns a fallback.

**Parameters:**
- `params` - Same as `render()`
- `fallback` - Optional fallback HTML to use if rendering fails

#### `loadComponent(src: string): Promise<PreactComponent>`

Loads a Preact component from a file path. Handles both development and production environments.

**Parameters:**
- `src` - Path to the component file

**Returns:**
- The loaded Preact component

### Client API

#### `hydrate(container: HTMLElement, Component: any, props: Record<string, unknown>): void`

Hydrates a server-rendered Preact component on the client.

**Parameters:**
- `container` - The DOM element containing the server-rendered HTML
- `Component` - The Preact component to hydrate
- `props` - Props to pass to the component

**Example:**
```typescript
import { hydrate } from "@avalon/preact/client";
import Counter from "./Counter.tsx";

const container = document.getElementById("island-1");
hydrate(container, Counter, { initialCount: 0 });
```

#### `getHydrationScript(): string`

Returns the client-side hydration script for Preact islands.

### Utility Functions

#### `isPreactComponent(path: string): boolean`

Checks if a file path represents a Preact component based on its extension.

#### `normalizeProps(props: Record<string, unknown>): Record<string, unknown>`

Normalizes component props for rendering. Handles transformations like `class` to `className`.

## Configuration

The Preact integration is configured with the following defaults:

```typescript
{
  name: "preact",
  fileExtensions: [".tsx", ".jsx"],
  jsxImportSources: ["preact"],
  detectionPatterns: {
    imports: [/^preact$/, /^preact\//],
    content: [/\buseState\b/, /\buseEffect\b/, /\bh\(/],
  },
}
```

## Hydration Conditions

The Preact integration supports all Avalon hydration conditions:

- `on:client` - Hydrate immediately when the page loads (default)
- `on:visible` - Hydrate when the component becomes visible in the viewport
- `on:interaction` - Hydrate when the user interacts with the component
- `on:idle` - Hydrate when the browser is idle
- `media:query` - Hydrate when a media query matches

**Example:**
```tsx
<Island 
  src="/islands/Counter.tsx"
  condition="on:visible"
  props={{ initialCount: 0 }}
/>
```

## TypeScript Support

The integration includes full TypeScript support with type definitions for all APIs.

```typescript
import type { 
  PreactComponent,
  PreactRenderParams,
  PreactRenderResult,
  PreactHydrationOptions 
} from "@avalon/preact/types";
```

## Error Handling

The integration provides comprehensive error handling:

- **SSR Errors**: If server-side rendering fails, the component falls back to client-only rendering
- **Hydration Errors**: If hydration fails, the error is logged and the component remains static
- **Component Loading Errors**: Clear error messages indicate missing or invalid components

## Performance

- **Tree-shaking**: Only Preact code is bundled when using Preact components
- **Code splitting**: Components are dynamically imported for optimal loading
- **Caching**: Loaded components are cached to avoid redundant imports

## Compatibility

- **Preact Version**: 10.26.9
- **preact-render-to-string**: 6.5.13
- **Deno**: 1.x or higher
- **Node.js**: Not required (Deno-native)

## Development

### Running Tests

```bash
deno test src/integrations/preact/
```

### Building

The integration is built as part of the main Avalon build process.

## Contributing

Contributions are welcome! Please follow the [Avalon contribution guidelines](../../../docs/CONTRIBUTING.md).

## License

MIT License - see LICENSE file for details.

## Related

- [Avalon Documentation](../../../docs/README.md)
- [Integration API](../shared/types.ts)
- [Creating Custom Integrations](../../../docs/integrations/README.md)
