# Vue Integration for Avalon

Official Vue 3 integration for the Avalon framework. Provides server-side rendering (SSR), client-side hydration, and scoped CSS extraction for Vue Single File Components.

## Features

- ✅ **Vue 3 SSR** - Full server-side rendering support using Vue's official SSR API
- ✅ **Scoped CSS** - Automatic extraction and scoping of component styles
- ✅ **Client Hydration** - Seamless hydration with conditional loading strategies
- ✅ **SFC Support** - Complete support for Vue Single File Components (.vue)
- ✅ **TypeScript** - Full TypeScript support with type definitions
- ✅ **Islands Architecture** - Works with Avalon's islands architecture for optimal performance

## Installation

```bash
deno add @avalon/vue
```

## Usage

### Basic Component

Create a Vue component in your `islands/` directory:

```vue
<!-- islands/Counter.vue -->
<template>
  <div class="counter">
    <h2>Count: {{ count }}</h2>
    <button @click="increment">Increment</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  initialCount: {
    type: Number,
    default: 0
  }
});

const count = ref(props.initialCount);

const increment = () => {
  count.value++;
};
</script>

<style scoped>
.counter {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

button {
  padding: 10px 20px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #35a372;
}
</style>
```

### Using in Pages

Use the Island component to render your Vue component:

```tsx
// pages/index.tsx
import Island from "@/islands/island.tsx";

export default function Home() {
  return (
    <div>
      <h1>Welcome to Avalon with Vue</h1>
      <Island 
        src="/islands/Counter.vue"
        props={{ initialCount: 10 }}
        condition="on:visible"
      />
    </div>
  );
}
```

## Hydration Strategies

The Vue integration supports all of Avalon's hydration strategies:

### Immediate Hydration (default)

```tsx
<Island src="/islands/Counter.vue" condition="on:client" />
```

### Lazy Hydration

```tsx
// Hydrate when visible
<Island src="/islands/Counter.vue" condition="on:visible" />

// Hydrate on interaction
<Island src="/islands/Counter.vue" condition="on:interaction" />

// Hydrate when idle
<Island src="/islands/Counter.vue" condition="on:idle" />

// Hydrate based on media query
<Island src="/islands/Counter.vue" condition="media:(min-width: 768px)" />
```

### SSR Only

```tsx
<Island src="/islands/Counter.vue" ssrOnly={true} />
```

## Scoped CSS

The Vue integration automatically extracts and applies scoped CSS from your components:

```vue
<style scoped>
/* These styles will be scoped to this component only */
.button {
  background: blue;
}
</style>

<style>
/* Global styles (not scoped) */
body {
  font-family: sans-serif;
}
</style>
```

Scoped styles are automatically:
- Extracted during SSR
- Applied with unique scope attributes
- Included in the server-rendered HTML
- Preserved during client hydration

## API Reference

### Server API

#### `render(params: RenderParams): Promise<RenderResult>`

Renders a Vue component to HTML string with SSR.

```typescript
import { render } from "@avalon/vue/server";

const result = await render({
  component: VueComponent,
  props: { message: "Hello" },
  src: "/islands/MyComponent.vue",
  condition: "on:client",
});

console.log(result.html); // Server-rendered HTML
console.log(result.css);  // Extracted CSS
```

#### `extractCSS(src: string): Promise<string>`

Extracts CSS from a Vue SFC file.

```typescript
import { extractCSS } from "@avalon/vue";

const css = await extractCSS("/islands/Counter.vue");
```

#### `applyScopedCSS(css: string, scopeId: string): string`

Applies scoping to CSS selectors.

```typescript
import { applyScopedCSS } from "@avalon/vue";

const scoped = applyScopedCSS(".button { color: red; }", "data-v-abc123");
// Result: ".button[data-v-abc123] { color: red; }"
```

### Client API

#### `hydrate(container: HTMLElement, component: any, props: object): void`

Hydrates a Vue component on the client.

```typescript
import { hydrate } from "@avalon/vue/client";
import Counter from "./Counter.vue";

const container = document.getElementById("island");
hydrate(container, Counter, { initialCount: 5 });
```

## Configuration

The Vue integration is automatically configured when you use Vue components. You can customize the integration in your `avalon.config.ts`:

```typescript
import { vueIntegration } from "@avalon/vue";

export default {
  integrations: [
    vueIntegration,
  ],
};
```

## TypeScript Support

The integration includes full TypeScript support:

```typescript
import type { VueRenderParams, VueRenderResult } from "@avalon/vue/types";

const params: VueRenderParams = {
  component: MyComponent,
  props: { message: "Hello" },
  src: "/islands/MyComponent.vue",
};

const result: VueRenderResult = await render(params);
```

## Vue 3 Features

This integration supports all Vue 3 features:

- ✅ Composition API (`<script setup>`)
- ✅ Options API
- ✅ Reactivity (`ref`, `reactive`, `computed`)
- ✅ Lifecycle hooks
- ✅ Watchers
- ✅ Slots
- ✅ Provide/Inject
- ✅ Teleport
- ✅ Suspense

## Performance

The Vue integration is optimized for performance:

- **Tree-shaking**: Only Vue components you use are bundled
- **Code splitting**: Each island is a separate chunk
- **Lazy loading**: Components can be loaded on-demand
- **SSR caching**: Server-rendered HTML is cached when possible
- **Minimal overhead**: Integration adds minimal runtime overhead

## Troubleshooting

### Component not rendering

Make sure your component exports a default export:

```vue
<script setup>
// This works automatically with <script setup>
</script>

<!-- OR with regular script -->
<script>
export default {
  name: 'MyComponent',
  // ...
}
</script>
```

### CSS not applying

Ensure your `<style>` blocks are properly formatted:

```vue
<style scoped>
/* Scoped styles */
</style>

<style>
/* Global styles */
</style>
```

### Hydration mismatch

Make sure props passed to the island match between server and client:

```tsx
// Server and client must receive the same props
<Island 
  src="/islands/Counter.vue"
  props={{ count: 0 }} // Must be serializable
/>
```

## Examples

Check out the [Avalon examples](https://github.com/avalon/examples) for more Vue integration examples.

## License

MIT

## Contributing

Contributions are welcome! Please see the [contributing guide](../../CONTRIBUTING.md) for details.
