/**
 * Embedded, searchable documentation for the Avalon Framework.
 *
 * Each entry is a self-contained Markdown topic distilled from the official
 * docs so the MCP server works fully offline (no network access required).
 *
 * @module knowledge/docs
 */

export interface DocTopic {
	/** URL-safe slug, also used as the resource path (`avalon://docs/{id}`). */
	id: string;
	/** Human title. */
	title: string;
	/** Keywords that boost search relevance. */
	keywords: string[];
	/** Full Markdown content. */
	content: string;
}

export const DOC_TOPICS: DocTopic[] = [
	{
		id: "overview",
		title: "Avalon Overview",
		keywords: ["intro", "what", "framework", "islands", "ssr", "multi-framework"],
		content: `# Avalon Overview

Avalon is a multi-framework islands-architecture web framework built on **Vite 8** and **Nitro 3**. Pages are server-rendered and ship zero JavaScript by default; interactivity comes from **islands** that hydrate selectively.

Key differences from Astro (the most common source of agent confusion):
- **No \`.astro\` files.** Pages and components are ordinary framework files (\`.tsx\`, \`.jsx\`, \`.vue\`, \`.svelte\`, etc.).
- **No \`client:*\` template attributes.** Hydration is controlled by a single \`island={{ condition: '...' }}\` prop on an imported component.
- **No \`Astro\` global.** Pages receive an H3 \`event\` prop; props are read like ordinary function arguments.

Islands are discovered by usage — adding the \`island\` prop to any imported component turns it into an island.`,
	},
	{
		id: "islands-architecture",
		title: "Islands Architecture",
		keywords: [
			"island",
			"hydrate",
			"hydration",
			"on:client",
			"on:visible",
			"on:interaction",
			"on:idle",
			"media",
			"prop",
		],
		content: `# Islands Architecture

An **island** is an interactive component that hydrates on the client. Everything outside an island is static HTML.

## The \`island\` prop

Import a component and add the \`island\` prop to control hydration:

\`\`\`tsx
import Counter from '../islands/Counter.tsx';

export default function Page() {
  return <div><Counter island={{ condition: 'on:client' }} /></div>;
}
\`\`\`

## Built-in conditions

| Condition | When it hydrates |
|-----------|------------------|
| \`on:client\` | Immediately on load (default) |
| \`on:visible\` | When it enters the viewport (IntersectionObserver) |
| \`on:interaction\` | On first click/hover/touch/focus |
| \`on:idle\` | When the browser is idle (requestIdleCallback) |
| \`media:<query>\` | When a CSS media query matches |

\`\`\`tsx
<Chart island={{ condition: 'on:visible' }} />
<Dropdown island={{ condition: 'on:interaction' }} />
<MobileMenu island={{ condition: 'media:(max-width: 768px)' }} />
\`\`\`

## Gotchas
- Wrap a sole island child in a container element (e.g. a \`<div>\`).
- JSX islands need the right pragma, e.g. \`/** @jsxImportSource preact */\`.
- Islands are detected by the \`island\` prop, not by directory.`,
	},
	{
		id: "hydration-strategies",
		title: "Hydration Strategies (Custom Directives)",
		keywords: [
			"custom",
			"directive",
			"on:delay",
			"on:event",
			"on:scroll",
			"on:match",
			"conditionArg",
			"registerHydrationDirective",
		],
		content: `# Hydration Strategies

Beyond the five core conditions, Avalon ships built-in **custom directives** that follow the \`on:<name>\` pattern and accept an optional \`conditionArg\`. Enable them with \`registerBuiltinDirectives()\` in your server entry.

| Directive | conditionArg | Behaviour |
|-----------|--------------|-----------|
| \`on:delay\` | ms (default 1000) | Hydrate after a timeout |
| \`on:event\` | event name | Hydrate when a \`document\` event fires |
| \`on:scroll\` | px (default 100) | Hydrate past a scroll threshold |
| \`on:match\` | media query | Hydrate when a media query matches |

\`\`\`tsx
<Widget island={{ condition: 'on:delay', conditionArg: '3000' }} />
<Dashboard island={{ condition: 'on:event', conditionArg: 'data:loaded' }} />
<LazySection island={{ condition: 'on:scroll', conditionArg: '500' }} />
<Sidebar island={{ condition: 'on:match', conditionArg: '(min-width: 1024px)' }} />
\`\`\`

## Register your own

\`\`\`ts
import { registerHydrationDirective } from '@useavalon/avalon';

registerHydrationDirective('on:countdown', {
  name: 'on:countdown',
  script: (el, hydrate, arg) => {
    let n = parseInt(arg || '5', 10);
    const t = setInterval(() => { if (--n <= 0) { clearInterval(t); hydrate(); } }, 1000);
  },
});
\`\`\`

The \`script\` receives \`(el, hydrate, arg)\` and must call \`hydrate()\` exactly once.`,
	},
	{
		id: "server-islands",
		title: "Server Islands",
		keywords: ["server", "prop", "fallback", "personalized", "cache", "timeout", "encryption"],
		content: `# Server Islands

A **server island** is rendered on-demand from the server after the page loads, so a cached/prerendered page can still contain personalized content. Add the \`server\` prop:

\`\`\`tsx
<UserAvatar server={{ fallback: <AvatarSkeleton /> }} userId={session.id} />
\`\`\`

\`ServerIslandProp\`:
- \`fallback?: JSX.Element\` — placeholder shown until the server responds.
- \`cache?: string\` — Cache-Control header for the island endpoint (default \`private, no-store\`).
- \`timeout?: number\` — fetch timeout in ms (default 10000).

Combine with \`island\` for personalized + interactive:

\`\`\`tsx
<NotificationBell
  server={{ fallback: <BellIcon /> }}
  island={{ condition: 'on:client' }}
  userId={session.id}
/>
\`\`\`

Props are encrypted (AES-256-GCM). For multi-instance deploys set a stable \`AVALON_KEY\` (generate with \`npx avalon key\`). Props must be JSON-serializable.`,
	},
	{
		id: "server-actions",
		title: "Server Actions",
		keywords: [
			"action",
			"defineAction",
			"server",
			"zod",
			"ActionError",
			"form",
			"actions proxy",
			"rpc",
		],
		content: `# Server Actions

Type-safe server functions callable from the client. Define them from \`@useavalon/avalon/actions\` and export a \`server\` object (e.g. in \`app/actions/index.ts\`):

\`\`\`ts
import { defineAction, ActionError } from '@useavalon/avalon/actions';
import { z } from 'zod';

export const server = {
  greet: defineAction({
    input: z.object({ name: z.string().min(1) }),
    handler: async ({ name }) => ({ message: \`Hello, \${name}!\` }),
  }),
  user: {
    like: defineAction({
      input: z.object({ postId: z.string() }),
      handler: async ({ postId }, ctx) => {
        if (!ctx.cookies.get('uid')) throw new ActionError({ code: 'UNAUTHORIZED' });
        return { liked: postId };
      },
    }),
  },
};
\`\`\`

Call from the client via the typed proxy — it never throws, always returns \`{ data, error }\`:

\`\`\`ts
import { actions } from 'virtual:avalon/actions';
const { data, error } = await actions.greet({ name: 'World' });
\`\`\`

- Nested namespaces become dotted names (\`user.like\`).
- \`accept: 'form'\` parses form bodies for progressive enhancement (POST to \`/_actions/<name>\`).
- \`ActionError\` codes map to HTTP status: BAD_REQUEST 400, UNAUTHORIZED 401, FORBIDDEN 403, NOT_FOUND 404, METHOD_NOT_ALLOWED 405, CONFLICT 409, UNSUPPORTED_MEDIA_TYPE 415, INTERNAL_SERVER_ERROR 500.
- Handlers receive \`(input, context)\`; context has \`event\`, \`request\`, \`headers\`, \`cookies.get(name)\`.`,
	},
	{
		id: "file-system-routing",
		title: "File-System Routing",
		keywords: ["routing", "pages", "dynamic", "slug", "catch-all", "404", "params", "mdx"],
		content: `# File-System Routing

Routes are generated from files in \`src/pages/\`.

| File | URL |
|------|-----|
| \`src/pages/index.tsx\` | \`/\` |
| \`src/pages/about.tsx\` | \`/about\` |
| \`src/pages/blog/[slug].tsx\` | \`/blog/:slug\` |
| \`src/pages/docs/[...slug].tsx\` | \`/docs/*\` |

Read params from the H3 \`event\`:

\`\`\`tsx
export default function BlogPost({ event }: { event: H3Event }) {
  const slug = event.context.params?.slug;
  return <article><h1>{slug}</h1></article>;
}
\`\`\`

Special files: \`_layout.tsx\` (layout), \`_middleware.ts\` (scoped middleware), \`_error.tsx\` (error boundary), \`404.tsx\` (not found). \`.mdx\` files are pages too (with YAML frontmatter). API routes live in \`routes/api/\`, not \`src/pages/\`.`,
	},
	{
		id: "layouts",
		title: "Layouts",
		keywords: ["layout", "_layout", "nested", "skipLayouts", "frontmatter", "LayoutProps"],
		content: `# Layouts

Layouts live in \`src/layouts/\` and wrap pages based on directory structure.

\`\`\`tsx
import type { LayoutProps } from '@useavalon/avalon';

export default function RootLayout({ children, frontmatter }: LayoutProps) {
  return (
    <html lang="en">
      <head><title>{frontmatter?.title ?? 'My Site'}</title></head>
      <body><main>{children}</main></body>
    </html>
  );
}
\`\`\`

- \`src/layouts/_layout.tsx\` wraps everything; \`src/layouts/blog/_layout.tsx\` nests inside it for \`/blog/*\`.
- Skip layouts with \`export const layoutConfig = { skipLayouts: ['_layout'] };\`.
- \`.tsx\` pages provide metadata via \`export const metadata = { title, description }\`; \`.mdx\` pages use YAML frontmatter. Both surface on the layout's \`frontmatter\` prop.`,
	},
	{
		id: "middleware",
		title: "Middleware",
		keywords: ["middleware", "_middleware", "global", "scoped", "auth", "redirect", "h3", "nitro"],
		content: `# Middleware

Two kinds:

**Global** — files in the project-root \`middleware/\` directory run on every request (pages + API). Standard Nitro/h3 handlers:

\`\`\`ts
import { defineEventHandler } from 'h3';
export default defineEventHandler((event) => { console.log(event.method, event.path); });
\`\`\`

**Scoped** — a \`_middleware.ts\` in a pages directory runs only for those routes. Export a default function; return nothing to continue or a \`Response\` to stop:

\`\`\`ts
import type { H3Event } from 'h3';
export default async (event: H3Event) => {
  if (!event.req.headers.get('Authorization')) return new Response('Unauthorized', { status: 401 });
};
\`\`\`

Global runs first (alphabetical), then scoped parent-first by depth. Pass data downstream via \`event.context\`.`,
	},
	{
		id: "api-routes",
		title: "API Routes",
		keywords: ["api", "routes", "nitro", "defineEventHandler", "endpoint", "readBody", "getQuery"],
		content: `# API Routes

API routes are Nitro handlers in \`routes/\`:

\`\`\`ts
// routes/api/hello.ts  ->  GET /api/hello
export default defineEventHandler(() => ({ message: 'Hello from the API' }));
\`\`\`

| File | URL |
|------|-----|
| \`routes/api/users/index.ts\` | \`/api/users\` |
| \`routes/api/users/[id].ts\` | \`/api/users/:id\` |
| \`routes/api/posts/[...slug].ts\` | \`/api/posts/*\` |

Use \`event.context.params\`, \`readBody(event)\`, \`getQuery(event)\`, \`getHeader\`, \`getCookie\`, \`setHeader\`, \`setResponseStatus\`, and \`createError\` for errors. You can mount Hono/Elysia via \`routes/_app.ts\`.`,
	},
	{
		id: "cron-jobs",
		title: "Cron Jobs",
		keywords: ["cron", "task", "defineCronJob", "schedule", "nitro", "runCronJob"],
		content: `# Cron Jobs

A cron job is a Nitro task. Define it with \`defineCronJob\` from \`@useavalon/avalon/cron\` and default-export it from a file in \`tasks/\`:

\`\`\`ts
// tasks/cleanup.ts
import { defineCronJob } from '@useavalon/avalon/cron';

export default defineCronJob({
  meta: { description: 'Purge expired sessions' },
  async run({ payload }) {
    await db.sessions.deleteExpired();
    return { result: 'ok' };
  },
});
\`\`\`

Schedule it in your Vite config:

\`\`\`ts
avalon({ nitro: { cron: [{ schedule: '0 * * * *', handler: 'tasks/cleanup.ts' }] } });
\`\`\`

Trigger manually with \`runCronJob(name, { payload })\`.`,
	},
	{
		id: "built-in-components",
		title: "Built-in Components",
		keywords: [
			"components",
			"Image",
			"IslandErrorBoundary",
			"PersistentIsland",
			"StreamingLayout",
			"usePersistentState",
			"client",
		],
		content: `# Built-in Components

Import from \`@useavalon/avalon/client\`:

| Component | Purpose |
|-----------|---------|
| \`Image\` | Responsive images (srcset, format conversion, lazy) |
| \`IslandErrorBoundary\` | Isolate island failures |
| \`LayoutErrorBoundary\` | Catch layout errors with retry |
| \`StreamingLayout\` / \`StreamingSuspense\` | Suspense-like loading states |
| \`PersistentIsland\` | Persist island state across navigations |

\`\`\`tsx
import { Image, PersistentIsland, usePersistentState } from '@useavalon/avalon/client';

<PersistentIsland persistentId="my-counter" island={{ condition: 'on:client' }}>
  <MyCounter />
</PersistentIsland>
\`\`\`

\`usePersistentState('key', initial)\` behaves like \`useState\` but persists via sessionStorage.`,
	},
	{
		id: "client-scripts",
		title: "Client-Side Scripts",
		keywords: ["script", "vanilla", "analytics", "dangerouslySetInnerHTML", "third-party"],
		content: `# Client-Side Scripts

For global/third-party JS that isn't a component, use plain \`<script>\` tags. For interactive UI, use an **island** instead.

\`\`\`tsx
// External (place file in public/)
<script src="/animation.js" defer />

// Inline
<script dangerouslySetInnerHTML={{ __html: "/* ... */" }} />
\`\`\`

Bridge server data to scripts with \`data-*\` attributes. Reserve scripts for analytics, embeds, and page-level listeners.`,
	},
	{
		id: "styling",
		title: "Styling",
		keywords: ["css", "style", "styles", "module", "tailwind", "tokens", "scoped", "className"],
		content: `# Styling

Avalon uses standard CSS processed by Vite — no special runtime. Unlike Astro, there are **no scoped \`<style>\` blocks inside components**; use CSS Modules or plain CSS instead.

## CSS Modules

Any \`*.module.css\` file is scoped to the importing component (class names are hashed). Works in islands too — scoped styles are extracted into the page regardless of hydration.

\`\`\`tsx
import styles from './Button.module.css';

export default function Button() {
  return <button className={styles.button}>Click me</button>;
}
\`\`\`

## Global styles & tokens

Import a plain \`.css\` file (no \`.module\`) in your root layout for global styles. Define design tokens as CSS custom properties:

\`\`\`tsx
// layouts/_layout.tsx
import '../styles/main.css';
\`\`\`

## Islands & CSS-in-JS

Islands are server-rendered first, so styles must exist before JS loads. **Avoid runtime CSS-in-JS** (styled-components, Emotion) — they don't produce styles during SSR. Use CSS Modules or plain CSS. Conditional classes: concatenate \`className\` strings.`,
	},
	{
		id: "metadata",
		title: "Page Metadata (SEO)",
		keywords: [
			"metadata",
			"seo",
			"title",
			"description",
			"opengraph",
			"og",
			"twitter",
			"head",
			"json-ld",
			"frontmatter",
		],
		content: `# Page Metadata

Define SEO metadata by exporting a \`metadata\` object from a page. It is merged with any frontmatter and passed to the layout via the \`frontmatter\` prop. (There is no \`Astro\`-style head component; layouts render \`<head>\` directly.)

\`\`\`tsx
import type { PageMetadata } from '@useavalon/avalon';

export const metadata: PageMetadata = {
  title: 'Hello World',
  description: 'My first post.',
  openGraph: { title: 'Hello', description: '…', image: '/og.png' },
  head: [{ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } }],
};
\`\`\`

Fields: \`title\`, \`description\`, \`openGraph?: { title, description, image }\`, and \`head?: Array<{ tag, attrs?, content? }>\` for arbitrary tags (Twitter cards, canonical links, JSON-LD scripts).

In the layout, read from \`frontmatter\`:

\`\`\`tsx
export default function Layout({ children, frontmatter }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <title>{frontmatter?.title ?? 'My Site'}</title>
        {frontmatter?.description && (
          <meta name="description" content={String(frontmatter.description)} />
        )}
        {frontmatter?.head?.map((el, i) =>
          el.tag === 'script' ? (
            <script key={i} {...el.attrs}>{el.content}</script>
          ) : (
            <meta key={i} {...el.attrs} />
          ),
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
\`\`\`

\`.mdx\` pages provide the same fields via YAML frontmatter. When both exist, \`metadata\` wins.`,
	},
	{
		id: "mdx",
		title: "MDX & Markdown",
		keywords: ["mdx", "markdown", "gfm", "frontmatter", "remark", "rehype", "content"],
		content: `# MDX & Markdown

Any \`.mdx\` file in the pages directory becomes a route, like \`.tsx\`. Pre-configured plugins: \`remark-frontmatter\`, \`remark-mdx-frontmatter\`, \`remark-gfm\`, and \`rehype-highlight\`.

\`\`\`mdx
---
title: Interactive Demo
---

import Counter from '../islands/Counter.tsx';

# Demo

<Counter island={{ condition: 'on:visible' }} />
\`\`\`

- YAML frontmatter is exported and passed to layouts (integrates with metadata/SEO).
- The \`island\` prop works exactly as in \`.tsx\` pages — imported components used with it become islands.
- Code blocks get syntax highlighting (link \`syntax-highlighting.css\` in your root layout).
- Configure via \`avalon({ mdx: { jsxImportSource: 'preact', remarkPlugins: [], rehypePlugins: [] } })\`.
- Use MDX for content-heavy pages; use \`.tsx\` when you need async data fetching (MDX pages can't be async).`,
	},
	{
		id: "configuration",
		title: "Configuration & Project Setup",
		keywords: [
			"config",
			"vite",
			"vite.config",
			"avalon plugin",
			"integrations",
			"setup",
			"install",
			"create",
			"nitro",
		],
		content: `# Configuration & Project Setup

Scaffold a project with \`bun create avalon my-app\`, then \`bun install && bun run dev\`.

Avalon is configured through the async \`avalon()\` Vite plugin:

\`\`\`ts
// vite.config.ts
import { defineConfig } from 'vite';
import { avalon } from '@useavalon/avalon/vite';

export default defineConfig(async () => {
  const plugins = await avalon({
    pagesDir: 'src/pages',
    integrations: ['preact'],
    mdx: { jsxImportSource: 'preact' },
    nitro: { cron: [{ schedule: '0 * * * *', handler: 'tasks/cleanup.ts' }] },
  });
  return { plugins };
});
\`\`\`

Typical project structure:

\`\`\`
my-app/
├── src/
│   ├── islands/    # interactive components (hydrated on client)
│   ├── layouts/    # layout wrappers
│   └── pages/      # file-system routes
├── public/         # static assets
├── routes/         # API routes (Nitro)
├── nitro.config.ts
└── vite.config.ts
\`\`\`

Note: \`avalon()\` is async and returns an array of Vite plugins — always \`await\` it.`,
	},
	{
		id: "frameworks",
		title: "Framework Integrations",
		keywords: [
			"framework",
			"integration",
			"react",
			"preact",
			"vue",
			"svelte",
			"solid",
			"lit",
			"qwik",
			"jsxImportSource",
			"pragma",
		],
		content: `# Framework Integrations

Avalon is multi-framework. Enable frameworks in the \`integrations\` array and install their peer deps. Supported: \`preact\`, \`react\`, \`vue\`, \`svelte\`, \`solid\`, \`lit\`, \`qwik\`.

\`\`\`ts
const plugins = await avalon({ integrations: ['react', 'vue'] });
\`\`\`

\`\`\`bash
bun add react react-dom
\`\`\`

## JSX pragma

JSX-based frameworks require a pragma at the top of each island file so the correct JSX runtime is used:

\`\`\`tsx
/** @jsxImportSource react */   // or preact / solid-js
import { useState } from 'react';
\`\`\`

- \`.vue\` and \`.svelte\` islands are written in their native single-file formats (no pragma).
- The framework is auto-detected from the island file — you do not pick it at the call site (contrast with Astro's \`client:only="react"\`).
- Each island is an independent tree: **context/providers cannot span multiple islands**. For cross-island state use a global store or URL state.`,
	},
];

/** Simple keyword-weighted search across the embedded docs. */
export function searchDocs(query: string, limit = 5): DocTopic[] {
	const terms = query
		.toLowerCase()
		.split(/[^a-z0-9:]+/)
		.filter(Boolean);
	if (terms.length === 0) return [];

	const scored = DOC_TOPICS.map((topic) => {
		const haystackTitle = topic.title.toLowerCase();
		const haystackKeywords = topic.keywords.join(" ").toLowerCase();
		const haystackContent = topic.content.toLowerCase();
		let score = 0;
		for (const term of terms) {
			if (topic.id.includes(term)) score += 6;
			if (haystackTitle.includes(term)) score += 5;
			if (haystackKeywords.includes(term)) score += 4;
			if (haystackContent.includes(term)) score += 1;
		}
		return { topic, score };
	})
		.filter((s) => s.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);

	return scored.map((s) => s.topic);
}

/** Fetch a topic by id. */
export function getDoc(id: string): DocTopic | undefined {
	return DOC_TOPICS.find((t) => t.id === id);
}
