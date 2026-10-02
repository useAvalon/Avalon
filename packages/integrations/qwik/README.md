# @useavalon/qwik

Qwik integration for [Avalon](https://useavalon.dev). Server-side rendering and client-side resumability for Qwik components as islands.

## Features

- Qwik with resumability (not hydration) — zero JS on page load
- Server-side rendering via `@builder.io/qwik/server`
- Automatic code splitting at `$` boundaries
- Signals, stores, and tasks (`useSignal`, `useStore`, `useTask$`, `useVisibleTask$`)
- All hydration strategies (`on:client`, `on:visible`, `on:idle`, `on:interaction`)

## Usage

```tsx
// components/Counter.qwik.tsx
import { component$, useSignal } from "@builder.io/qwik";

export default component$(() => {
  const count = useSignal(0);
  return <button onClick$={() => count.value++}>Count: {count.value}</button>;
});
```

```tsx
// pages/index.tsx
import Counter from '../components/Counter.qwik.tsx';

export default function Home() {
  return <Counter island={{ condition: 'on:visible' }} />;
}
```

## Links

- [Documentation](https://useavalon.dev/docs/frameworks/qwik)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
