# @useavalon/preact

Preact integration for [Avalon](https://useavalon.dev). Server-side rendering and client-side hydration for Preact components as islands.

## Features

- Preact 10 with hooks support
- Server-side rendering via `preact-render-to-string`
- Client-side hydration via `preact/compat`
- All hydration strategies (`on:client`, `on:visible`, `on:idle`, `on:interaction`)

## Usage

```tsx
// components/Counter.preact.tsx
import { useState } from "preact/hooks";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
```

```tsx
// pages/index.tsx
import Counter from '../components/Counter.preact.tsx';

export default function Home() {
  return <Counter island={{ condition: 'on:visible' }} />;
}
```

## Links

- [Documentation](https://useavalon.dev/docs/frameworks/preact)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
