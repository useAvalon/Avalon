# @useavalon/avalon

Core framework package for [Avalon](https://useavalon.dev) — a multi-framework islands architecture for the modern web.

## Features

- Islands architecture with zero JavaScript by default
- Multi-framework support (React, Preact, Vue, Svelte, Solid, Lit, Qwik)
- Selective hydration (`on:client`, `on:visible`, `on:idle`, `on:interaction`)
- File-system routing with nested layouts
- API routes and middleware
- MDX support with rehype/remark plugins
- SSR with streaming support
- Edge deployment via Nitro (Node, Deno, Bun, Cloudflare, Vercel, etc.)
- Vite 8 powered with HMR

## Quick start

```bash
npm create avalon@latest
# or
bun create avalon
```

Or install manually:

```bash
bun add @useavalon/avalon
```

## Usage

```tsx
// pages/index.tsx
import Counter from '../components/Counter.tsx';

export default function Home() {
  return (
    <div>
      <h1>Hello Avalon</h1>
      <Counter island={{ condition: 'on:visible' }} />
    </div>
  );
}
```

## Links

- [Documentation](https://useavalon.dev/docs/introduction)
- [GitHub](https://github.com/useAvalon/Avalon)

## License

MIT
