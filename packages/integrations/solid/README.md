# @useavalon/solid

Solid integration for [Avalon](https://useavalon.dev). Server-side rendering and client-side hydration for Solid components as islands.

## Features

- Solid.js with fine-grained reactivity
- Server-side rendering via `renderToStringAsync`
- Async resources with `createResource`
- All hydration strategies (`on:client`, `on:visible`, `on:idle`, `on:interaction`)

## Usage

```tsx
// components/Counter.solid.tsx
import { createSignal } from "solid-js";

export default function Counter() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count()}</button>;
}
```

```tsx
// pages/index.tsx
import Counter from '../components/Counter.solid.tsx';

export default function Home() {
  return <Counter island={{ condition: 'on:visible' }} />;
}
```

## Links

- [Documentation](https://useavalon.dev/docs/frameworks/solid)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
