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
bun create avalon my-app
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

## Scheduled jobs (cron)

Run serverless functions on a schedule. Drop a task file in `tasks/` and map a
schedule to it — Avalon wires up the right runner for your deployment preset
(Vercel Cron, Cloudflare Triggers, or the built-in scheduler for the node
server), built on Nitro's native task system.

```ts
// tasks/cleanup.ts
import { defineCronJob } from '@useavalon/avalon/cron';

export default defineCronJob({
  meta: { description: 'Purge expired sessions' },
  async run() {
    await db.sessions.deleteExpired();
    return { result: 'ok' };
  },
});
```

```ts
// vite.config.ts
avalon({
  nitro: {
    cron: [
      // Point at a task file (name is derived from the path -> "cleanup")
      { schedule: '0 * * * *', handler: 'tasks/cleanup.ts' },
      // Or schedule an auto-discovered task by name, with a named alias
      { schedule: '@daily', task: 'reports:digest' },
    ],
  },
});
```

Schedules accept standard 5- or 6-field cron expressions or aliases like
`@hourly` and `@daily`. Trigger a job on demand with `runCronJob(name)` from
`@useavalon/avalon/cron`.

## Links

- [Documentation](https://useavalon.dev/docs/introduction)
- [GitHub](https://github.com/useAvalon/Avalon)

## Bundle size tools

The root export is a **Node/Vite build-time framework** (Nitro, `node:fs`, native parsers). Tools like [Bundlephobia](https://bundlephobia.com/package/@useavalon/avalon) target browser webpack bundles and often return **BuildServiceError** or build failures for this package — that is expected, not a sign of a broken publish. For shipped browser bytes, measure **`@useavalon/avalon/client/main-slim`** in your app build instead.

Published tarballs include `main` / `module` pointing at `./dist/mod.js` for tools that require a legacy entry field alongside `exports`.

## License

MIT
