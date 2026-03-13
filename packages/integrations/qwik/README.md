# @avalon/qwik

Qwik integration for the Avalon framework. Provides server-side rendering (SSR) and client-side resumability for Qwik components.

## Key Concept: Resumability, Not Hydration

Qwik is fundamentally different from other frameworks. Instead of hydrating (replaying application logic on the client), Qwik **resumes** from serialized state embedded in the DOM. This means:

- No JavaScript needs to execute on page load
- Event listeners are serialized as `on:` attributes in the HTML
- The Qwikloader (~1KB) sets up global event delegation
- Component code is lazy-loaded at `$` boundaries only when needed

## Features

- **Server-Side Rendering**: Full SSR support using `@builder.io/qwik/server`
- **Resumability**: Zero-cost startup via Qwik's resumable architecture
- **Lazy Loading**: Automatic code splitting at `$` boundaries
- **Conditional Hydration**: Multiple strategies (on:client, on:visible, on:interaction, on:idle, media queries)
- **TypeScript Support**: Full type safety with TypeScript definitions
- **Error Boundaries**: Built-in error handling for SSR failures

## Installation

```bash
bun add @avalon/qwik @builder.io/qwik
```

## Usage

### Basic Component

Create a Qwik component in your `src/islands/` directory:

```tsx
// src/islands/Counter.qwik.tsx
/** @jsxImportSource @builder.io/qwik */
import { component$, useSignal } from "@builder.io/qwik";

export default component$(() => {
  const count = useSignal(0);

  return (
    <div>
      <p>Count: {count.value}</p>
      <button onClick$={() => count.value++}>
        Increment
      </button>
    </div>
  );
});
```

### Using in Pages

Use the Island component to render your Qwik component:

```tsx
// src/pages/index.tsx
import Island from "../islands/island.tsx";

export default function Home() {
  return (
    <div>
      <h1>My Qwik App</h1>
      {/* No hydration directive needed — Qwik resumes automatically */}
      <Island src="/src/islands/Counter.qwik.tsx" />
    </div>
  );
}
```

## Qwik-Specific Features

### Signals

Qwik's fine-grained reactivity via signals:

```tsx
import { component$, useSignal, useComputed$ } from "@builder.io/qwik";

export default component$(() => {
  const count = useSignal(0);
  const doubled = useComputed$(() => count.value * 2);

  return <p>{count.value} × 2 = {doubled.value}</p>;
});
```

### Stores

For complex state, use `useStore`:

```tsx
import { component$, useStore } from "@builder.io/qwik";

export default component$(() => {
  const state = useStore({ items: ["a", "b"], filter: "" });

  return (
    <ul>
      {state.items
        .filter(i => i.includes(state.filter))
        .map(item => <li key={item}>{item}</li>)}
    </ul>
  );
});
```

### Tasks

Run side effects with `useTask$` and `useVisibleTask$`:

```tsx
import { component$, useSignal, useTask$, useVisibleTask$ } from "@builder.io/qwik";

export default component$(() => {
  const data = useSignal<string | null>(null);

  // Runs on server and client
  useTask$(async () => {
    const res = await fetch("/api/data");
    data.value = await res.text();
  });

  // Runs only on client, when component is visible
  useVisibleTask$(() => {
    console.log("Component is visible in the viewport");
  });

  return <p>{data.value ?? "Loading..."}</p>;
});
```

## File Naming Conventions

Qwik components can use any of these naming patterns:

- `Component.qwik.tsx` — Explicit Qwik component (recommended)
- `Component.tsx` with `@jsxImportSource @builder.io/qwik` — Detected by JSX pragma

The integration automatically detects Qwik components by:
1. File extension (`.qwik.tsx`)
2. Import statements (`import { component$ } from "@builder.io/qwik"`)
3. Qwik-specific APIs in the code (`component$`, `useSignal`, etc.)

## API Reference

### Server API

#### `render(params: RenderParams): Promise<RenderResult>`

Renders a Qwik component to HTML string on the server with embedded resumability state.

### Client API

#### `hydrate(container, Component, props): void`

For SSR'd components, this is a no-op — the Qwikloader handles resumption.
For client-only islands, this triggers a client-side render.

## Resources

- [Qwik Documentation](https://qwik.dev/docs/)
- [Qwik Resumability](https://qwik.dev/docs/concepts/resumable/)
- [Qwik Containers](https://qwik.dev/docs/advanced/containers/)
- [Avalon Documentation](../../../docs/README.md)
