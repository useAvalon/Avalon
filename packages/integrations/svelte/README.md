# @useavalon/svelte

Svelte 5 integration for [Avalon](https://useavalon.dev). Server-side rendering and client-side hydration for Svelte components as islands.

## Features

- Svelte 5 with runes (`$state`, `$derived`, `$effect`)
- Server-side rendering via `svelte/server`
- Automatic CSS extraction and scoping
- All hydration strategies (`on:client`, `on:visible`, `on:idle`, `on:interaction`)

## Usage

```svelte
<!-- components/Counter.svelte -->
<script>
  let count = $state(0);
</script>

<button onclick={() => count++}>
  Count: {count}
</button>
```

```tsx
// pages/index.tsx
import Counter from '../components/Counter.svelte';

export default function Home() {
  return <Counter island={{ condition: 'on:visible' }} />;
}
```

## Links

- [Documentation](https://useavalon.dev/docs/frameworks/svelte)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
