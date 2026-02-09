# @avalon/svelte

Svelte 5 integration for Avalon framework. Provides server-side rendering (SSR) and client-side hydration for Svelte components in the Islands architecture.

## Features

- **Svelte 5 Support**: Built for Svelte 5 with the new `render()` API
- **Server-Side Rendering**: Full SSR support using `svelte/server`
- **Client Hydration**: Efficient hydration of server-rendered content
- **CSS Extraction**: Automatic CSS collection and scoping
- **Islands Architecture**: Works seamlessly with Avalon's Islands pattern
- **TypeScript Support**: Full type definitions included

## Installation

```bash
deno add @avalon/svelte
```

## Usage

### Basic Component

Create a Svelte component in your `islands/` directory:

```svelte
<!-- islands/Counter.svelte -->
<script>
  let count = $state(0);
  
  function increment() {
    count++;
  }
</script>

<button onclick={increment}>
  Count: {count}
</button>

<style>
  button {
    padding: 10px 20px;
    font-size: 16px;
    background: #ff3e00;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background: #ff5722;
  }
</style>
```

### Using in Pages

Use the Island component to render your Svelte component:

```tsx
// pages/index.tsx
import Island from "@avalon/islands";

export default function Home() {
  return (
    <div>
      <h1>Svelte Counter</h1>
      <Island 
        src="./islands/Counter.svelte"
        condition="on:visible"
        props={{ initialCount: 0 }}
      />
    </div>
  );
}
```

## Svelte 5 Features

This integration is built for Svelte 5 and supports all modern features:

### Runes

Svelte 5's new reactivity system using runes:

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  
  $effect(() => {
    console.log('Count changed:', count);
  });
</script>

<div>
  <p>Count: {count}</p>
  <p>Doubled: {doubled}</p>
  <button onclick={() => count++}>Increment</button>
</div>
```

### Snippets

Reusable template snippets:

```svelte
<script>
  let items = $state(['Apple', 'Banana', 'Cherry']);
</script>

{#snippet listItem(item)}
  <li>{item}</li>
{/snippet}

<ul>
  {#each items as item}
    {@render listItem(item)}
  {/each}
</ul>
```

### Event Handlers

Modern event handling with `onclick`, `oninput`, etc.:

```svelte
<script>
  let value = $state('');
  
  function handleInput(event) {
    value = event.target.value;
  }
</script>

<input 
  type="text" 
  value={value}
  oninput={handleInput}
/>
```

## Hydration Conditions

Control when your Svelte components hydrate:

```tsx
// Hydrate immediately on page load
<Island src="./islands/Counter.svelte" condition="on:client" />

// Hydrate when visible in viewport
<Island src="./islands/Counter.svelte" condition="on:visible" />

// Hydrate on user interaction
<Island src="./islands/Counter.svelte" condition="on:interaction" />

// Hydrate when browser is idle
<Island src="./islands/Counter.svelte" condition="on:idle" />

// Hydrate based on media query
<Island src="./islands/Counter.svelte" condition="media:(min-width: 768px)" />
```

## Server-Only Rendering

For components that don't need interactivity:

```tsx
<Island 
  src="./islands/StaticContent.svelte" 
  ssrOnly={true}
/>
```

## API Reference

### Server API

#### `render(params: RenderParams): Promise<RenderResult>`

Renders a Svelte component to HTML on the server.

```typescript
import { render } from "@avalon/svelte/server";

const result = await render({
  src: "./islands/Counter.svelte",
  props: { count: 0 },
});

console.log(result.html); // Rendered HTML
console.log(result.css);  // Extracted CSS
console.log(result.head); // Head content (from svelte:head)
```

### Client API

#### `hydrate(container: HTMLElement, Component: SvelteComponent, props: Record<string, unknown>)`

Hydrates a server-rendered Svelte component.

```typescript
import { hydrate } from "@avalon/svelte/client";
import Counter from "./Counter.svelte";

const container = document.getElementById("counter");
hydrate(container, Counter, { count: 0 });
```

#### `mount(container: HTMLElement, Component: SvelteComponent, props: Record<string, unknown>)`

Mounts a Svelte component without hydration (client-only rendering).

```typescript
import { mount } from "@avalon/svelte/client";
import Counter from "./Counter.svelte";

const container = document.getElementById("counter");
mount(container, Counter, { count: 0 });
```

### CSS Utilities

#### `extractCss(renderResult): CssCollectionResult | null`

Extracts CSS from a Svelte render result.

```typescript
import { render } from "@avalon/svelte/server";
import { extractCss } from "@avalon/svelte";

const result = await render({ src: "./Counter.svelte", props: {} });
const css = extractCss(result);
```

#### `combineCss(cssResults: CssCollectionResult[]): string`

Combines multiple CSS results into a single stylesheet.

#### `scopeCss(css: string, scopeId: string): string`

Applies scoping to CSS selectors.

#### `minifyCss(css: string): string`

Minifies CSS by removing whitespace and comments.

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import type { 
  SvelteComponent,
  SvelteComponentInstance,
  SvelteRenderParams,
  SvelteRenderResult 
} from "@avalon/svelte/types";
```

## Configuration

The integration is automatically configured with sensible defaults:

```typescript
{
  name: "svelte",
  fileExtensions: [".svelte"],
  detectionPatterns: {
    imports: [/^svelte$/, /^svelte\//],
    content: [/<script[^>]*>/, /<style[^>]*>/, /\$:/]
  }
}
```

## Performance

- **Automatic CSS Extraction**: CSS is extracted during SSR and injected into the page
- **Efficient Hydration**: Only interactive components are hydrated
- **Tree-Shaking**: Unused components are automatically excluded from builds
- **Code Splitting**: Components are loaded on-demand based on hydration conditions

## Compatibility

- **Svelte Version**: 5.41.0+
- **Deno**: 2.0+
- **Node.js**: 20+ (via Deno compatibility layer)

## Migration from Svelte 4

If you're migrating from Svelte 4, note these key changes:

1. **Runes**: Replace `let` with `$state` for reactive variables
2. **Event Handlers**: Use `onclick` instead of `on:click`
3. **Reactivity**: Use `$derived` instead of `$:` for computed values
4. **Effects**: Use `$effect` instead of `$:` for side effects

See the [Svelte 5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide) for more details.

## Examples

### Form Component

```svelte
<script>
  let name = $state('');
  let email = $state('');
  let submitted = $state(false);
  
  function handleSubmit(event) {
    event.preventDefault();
    submitted = true;
    console.log({ name, email });
  }
</script>

<form onsubmit={handleSubmit}>
  <input 
    type="text" 
    placeholder="Name"
    bind:value={name}
  />
  <input 
    type="email" 
    placeholder="Email"
    bind:value={email}
  />
  <button type="submit">Submit</button>
  
  {#if submitted}
    <p>Thank you, {name}!</p>
  {/if}
</form>
```

### Data Fetching

```svelte
<script>
  let data = $state(null);
  let loading = $state(true);
  
  $effect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        data = d;
        loading = false;
      });
  });
</script>

{#if loading}
  <p>Loading...</p>
{:else if data}
  <pre>{JSON.stringify(data, null, 2)}</pre>
{/if}
```

## Troubleshooting

### Component Not Hydrating

Ensure the `data-framework="svelte"` attribute is present on the island container.

### CSS Not Applied

Check that CSS extraction is working by inspecting the render result's `css` property.

### Import Errors

Make sure Svelte is installed:

```bash
deno add npm:svelte@^5.41.0
```

## Contributing

Contributions are welcome! Please see the [main Avalon repository](https://github.com/avalon/avalon) for contribution guidelines.

## License

MIT License - see LICENSE file for details.
