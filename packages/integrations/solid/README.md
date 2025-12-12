# @avalon/integration-solid

Solid integration for the Avalon framework. Provides server-side rendering (SSR) and client-side hydration for Solid components.

## Features

- **Server-Side Rendering**: Full SSR support using `solid-js/web`'s `renderToStringAsync`
- **Client Hydration**: Efficient hydration with Solid's built-in `hydrate` function
- **Reactive System**: Full support for Solid's fine-grained reactivity
- **Async Resources**: Support for `createResource` and async data loading
- **Conditional Hydration**: Multiple hydration strategies (on:client, on:visible, on:interaction, on:idle, media queries)
- **TypeScript Support**: Full type safety with TypeScript definitions
- **Error Boundaries**: Built-in error handling for SSR failures

## Installation

```bash
deno add @avalon/integration-solid
```

## Usage

### Basic Component

Create a Solid component in your `src/islands/` directory:

```tsx
// src/islands/Counter.solid.tsx
import { createSignal } from "solid-js";

export default function Counter() {
  const [count, setCount] = createSignal(0);
  
  return (
    <div>
      <p>Count: {count()}</p>
      <button onClick={() => setCount(count() + 1)}>
        Increment
      </button>
    </div>
  );
}
```

### Using in Pages

Use the Island component to render your Solid component:

```tsx
// src/pages/index.tsx
import Island from "../islands/island.tsx";

export default function Home() {
  return (
    <div>
      <h1>My Solid App</h1>
      <Island 
        src="/src/islands/Counter.solid.tsx"
        condition="on:client"
      />
    </div>
  );
}
```

## Hydration Strategies

The Solid integration supports multiple hydration strategies:

### Immediate Hydration (default)

```tsx
<Island src="/src/islands/Counter.solid.tsx" condition="on:client" />
```

### Lazy Hydration (on visible)

```tsx
<Island src="/src/islands/Counter.solid.tsx" condition="on:visible" />
```

### Interaction-based Hydration

```tsx
<Island src="/src/islands/Counter.solid.tsx" condition="on:interaction" />
```

### Idle Hydration

```tsx
<Island src="/src/islands/Counter.solid.tsx" condition="on:idle" />
```

### Media Query Hydration

```tsx
<Island 
  src="/src/islands/Counter.solid.tsx" 
  condition="media:(min-width: 768px)" 
/>
```

## Solid-Specific Features

### Signals and Reactivity

Solid's fine-grained reactivity system works seamlessly with SSR:

```tsx
import { createSignal, createEffect } from "solid-js";

export default function ReactiveComponent() {
  const [count, setCount] = createSignal(0);
  
  createEffect(() => {
    console.log("Count changed:", count());
  });
  
  return <button onClick={() => setCount(c => c + 1)}>{count()}</button>;
}
```

### Control Flow Components

Use Solid's built-in control flow components:

```tsx
import { Show, For, Switch, Match } from "solid-js";

export default function ControlFlow(props: { items: string[] }) {
  return (
    <div>
      <Show when={props.items.length > 0} fallback={<p>No items</p>}>
        <For each={props.items}>
          {(item) => <div>{item}</div>}
        </For>
      </Show>
    </div>
  );
}
```

### Async Resources

Load data asynchronously with `createResource`:

```tsx
import { createResource } from "solid-js";

async function fetchUser(id: number) {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

export default function UserProfile(props: { userId: number }) {
  const [user] = createResource(() => props.userId, fetchUser);
  
  return (
    <div>
      <Show when={user()} fallback={<p>Loading...</p>}>
        <h2>{user()?.name}</h2>
      </Show>
    </div>
  );
}
```

### Error Boundaries

Handle errors gracefully:

```tsx
import { ErrorBoundary } from "solid-js";

export default function SafeComponent() {
  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
      <RiskyComponent />
    </ErrorBoundary>
  );
}
```

## API Reference

### Server API

#### `render(params: RenderParams): Promise<RenderResult>`

Renders a Solid component to HTML string on the server.

```typescript
import { render } from "@avalon/integration-solid/server";

const result = await render({
  src: "/src/islands/Counter.solid.tsx",
  props: { initialCount: 0 },
  condition: "on:client",
});
```

#### `renderWithErrorBoundary(params: RenderParams): Promise<RenderResult | null>`

Renders with automatic error handling, returning null on failure.

### Client API

#### `hydrate(container: HTMLElement, Component: SolidComponent, props: Record<string, unknown>): void`

Hydrates a server-rendered Solid component on the client.

```typescript
import { hydrate } from "@avalon/integration-solid/client";

const container = document.getElementById("my-island");
const { default: Component } = await import("/src/islands/Counter.solid.tsx");

hydrate(container, Component, { initialCount: 0 });
```

### Utilities

#### `loadComponent(src: string): Promise<SolidComponent>`

Loads a Solid component from the given source path.

#### `isSolidComponent(value: unknown): boolean`

Type guard to check if a value is a valid Solid component.

#### `normalizeProps(props: unknown): Record<string, unknown>`

Normalizes props to ensure they're in the correct format.

## File Naming Conventions

Solid components can use any of these naming patterns:

- `Component.solid.tsx` - Explicit Solid component
- `Component.tsx` - Generic TSX (detected by imports)
- `Component.jsx` - Generic JSX (detected by imports)

The integration automatically detects Solid components by:
1. File extension (`.solid.tsx`)
2. Import statements (`import { createSignal } from "solid-js"`)
3. Solid-specific APIs in the code

## TypeScript Support

The integration provides full TypeScript support:

```typescript
import type { Component } from "solid-js";

interface CounterProps {
  initialCount?: number;
  onCountChange?: (count: number) => void;
}

const Counter: Component<CounterProps> = (props) => {
  const [count, setCount] = createSignal(props.initialCount ?? 0);
  
  return (
    <button onClick={() => {
      const newCount = count() + 1;
      setCount(newCount);
      props.onCountChange?.(newCount);
    }}>
      Count: {count()}
    </button>
  );
};

export default Counter;
```

## Performance Considerations

### Fine-Grained Reactivity

Solid's reactivity system is extremely efficient:
- Only the specific DOM nodes that depend on changed signals are updated
- No virtual DOM diffing overhead
- Minimal runtime overhead

### SSR Performance

- Uses `renderToStringAsync` for optimal async handling
- Supports streaming (future enhancement)
- Minimal hydration overhead

### Bundle Size

- Solid has a small runtime (~7KB gzipped)
- Tree-shaking removes unused Solid APIs
- No virtual DOM library needed

## Troubleshooting

### Component Not Hydrating

Ensure your component is properly exported:

```tsx
// ✅ Correct
export default function MyComponent() { ... }

// ❌ Incorrect
function MyComponent() { ... }
```

### SSR Errors

Check that your component doesn't use browser-only APIs during SSR:

```tsx
import { onMount } from "solid-js";

export default function BrowserComponent() {
  onMount(() => {
    // Browser-only code here
    console.log(window.location);
  });
  
  return <div>Safe for SSR</div>;
}
```

### Type Errors

Make sure you're using the correct Solid types:

```tsx
import type { Component, JSX } from "solid-js";

const MyComponent: Component<{ title: string }> = (props) => {
  return <h1>{props.title}</h1>;
};
```

## Examples

See the [Avalon examples directory](../../../examples/) for more Solid integration examples.

## Contributing

Contributions are welcome! Please see the [contributing guide](../../../docs/CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](../../../LICENSE) for details.

## Resources

- [Solid Documentation](https://www.solidjs.com/docs/latest)
- [Solid Tutorial](https://www.solidjs.com/tutorial/introduction_basics)
- [Avalon Documentation](../../../docs/README.md)
