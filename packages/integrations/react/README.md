# @useavalon/react

React integration for [Avalon](https://useavalon.dev). Server-side rendering and client-side hydration for React components as islands.

## Features

- React 19 with concurrent features
- Server-side rendering via `renderToString`
- Client-side hydration via `hydrateRoot`
- All hydration strategies (`on:client`, `on:visible`, `on:idle`, `on:interaction`)

## Usage

```tsx
// components/Counter.react.tsx
import { useState } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
```

```tsx
// pages/index.tsx
import Counter from '../components/Counter.react.tsx';

export default function Home() {
  return <Counter island={{ condition: 'on:visible' }} />;
}
```

## Links

- [Documentation](https://useavalon.dev/docs/frameworks/react)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
