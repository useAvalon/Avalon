# @useavalon/vue

Vue 3 integration for [Avalon](https://useavalon.dev). Server-side rendering and client-side hydration for Vue Single File Components as islands.

## Features

- Vue 3 with Composition API and `<script setup>`
- Server-side rendering via `@vue/server-renderer`
- Scoped CSS extraction from SFCs
- All hydration strategies (`on:client`, `on:visible`, `on:idle`, `on:interaction`)

## Usage

```vue
<!-- components/Counter.vue -->
<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>

<template>
  <button @click="count++">Count: {{ count }}</button>
</template>
```

```tsx
// pages/index.tsx
import Counter from '../components/Counter.vue';

export default function Home() {
  return <Counter island={{ condition: 'on:visible' }} />;
}
```

## Links

- [Documentation](https://useavalon.dev/docs/frameworks/vue)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
