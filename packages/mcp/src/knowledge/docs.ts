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
- **No \`client:*\` template attributes.** Hydration is controlled by a single \`island={{ condition: '...' }}\` prop on an imported component. \`island={{ clientOnly: true }}\` skips SSR and mounts in the browser.
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
			"client-only",
			"clientOnly",
			"mount",
			"skip-ssr",
			"browser-only",
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
import Counter from '../components/Counter.tsx';

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
<BrowserWidget island={{ clientOnly: true }} />
\`\`\`

## Client-only islands

\`island={{ clientOnly: true }}\` skips server rendering. Avalon emits an empty \`<avalon-island data-render-strategy="client-only">\` placeholder and the browser **mounts** the component (it does not hydrate SSR HTML). Props are still serialized. There is no SSR HTML and no no-JS fallback for that component. Combine with \`condition\` to control when the mount runs.

Do not write \`<Widget client:only />\` — Avalon has no \`client:*\` attributes.

## File naming picks the framework

An island is detected by the \`island\` prop, but its **framework is inferred from the imported file's name/extension**. This matters in multi-framework or React projects:

| Filename | Framework |
|----------|-----------|
| \`Counter.tsx\` / \`Counter.jsx\` | **Preact** (the default) |
| \`Counter.react.tsx\` / \`.react.jsx\` | React |
| \`Counter.solid.tsx\` | Solid |
| \`Counter.preact.tsx\` | Preact (explicit) |
| \`Counter.lit.ts\` / PascalCase \`.ts\` | Lit |
| \`Counter.vue\` | Vue |
| \`Counter.svelte\` | Svelte |

So a plain \`.tsx\` island renders as **Preact**, not React. To ship a React island, name the file \`*.react.tsx\` (e.g. \`Counter.react.tsx\`). This is the single most common reason a React island renders but doesn't hydrate.

## The reference must be statically resolvable

The build transform (\`pageIslandTransform\`) rewrites the component used with the \`island\` prop by following its **import**. The imported component must be a direct, statically-analyzable reference:

\`\`\`tsx
// ✅ direct default import of the island file
import Counter from '../components/Counter.react.tsx';
<Counter island={{ condition: 'on:visible' }} />
\`\`\`

\`\`\`tsx
// ❌ will NOT hydrate — indirection hides the source file
import { Counter } from './barrel';           // re-export / barrel
import { Widget as Counter } from './widgets'; // aliased re-export
\`\`\`

Import the island directly from its \`*.<framework>.tsx\` file; avoid barrels, aliased re-exports, or dynamic indirection for anything used as an island.

## Other gotchas
- JSX islands need the right pragma, e.g. \`/** @jsxImportSource preact */\` (or \`react\` / \`solid-js\`).`,
	},
	{
		id: "state-management",
		title: "State & Cross-Island Communication",
		keywords: [
			"state",
			"store",
			"dispatch",
			"event",
			"cross-island",
			"communication",
			"usePersistentState",
			"PersistentIsland",
			"CustomEvent",
			"on:event",
			"signals",
			"shared",
		],
		content: `# State & Cross-Island Communication

Each island is an **independent component tree**. A framework Context/provider in one island cannot be read by another — they hydrate separately. There is **no built-in shared reactive store or signals API** in Avalon. Use one of the sanctioned patterns below.

## 1. Per-island persisted state — \`usePersistentState\`

Like \`useState\` but persisted to storage (keyed per id). Import from \`@useavalon/avalon\` or \`@useavalon/avalon/client\`:

\`\`\`tsx
import { usePersistentState } from '@useavalon/avalon/client';

const [count, setCount, clear] = usePersistentState('cart-count', 0);
// options: { storage: 'session' | 'local' }  (default 'session')
\`\`\`

## 2. Cross-island messaging — DOM CustomEvents

The de-facto channel between islands is the DOM. One island dispatches, another listens:

\`\`\`tsx
// Island A — broadcast
document.dispatchEvent(new CustomEvent('cart:add', { detail: { id } }));

// Island B — subscribe
useEffect(() => {
  const onAdd = (e: Event) => setCount((c) => c + 1);
  document.addEventListener('cart:add', onAdd);
  return () => document.removeEventListener('cart:add', onAdd);
}, []);
\`\`\`

The built-in \`on:event\` directive uses this same mechanism, but only as a **hydration trigger** (hydrate when an event fires) — not as an ongoing state channel:

\`\`\`tsx
<LivePanel island={{ condition: 'on:event', conditionArg: 'cart:add' }} />
\`\`\`

## 3. URL / query state

For state that should survive reloads and be shareable, read/write \`location.search\` (or \`history.pushState\`). Islands re-read it on hydration.

## 4. Persisted island state (storage, not live instances)

There is no automatic keep-alive of every island. Mark the ones that should keep their live instance across client navigations:

\`\`\`tsx
<ThemeToggle island={{ condition: 'on:idle', persist: 'theme-toggle' }} />
\`\`\`

Or wrap any element with \`data-router-persist="key"\`. Matching keys are moved into the next document (not cloned). Qwik islands are never persisted. For values that should survive a **full** reload, use \`usePersistentState\` from \`@useavalon/avalon/client\` (sessionStorage or localStorage).

\`PersistentIsland\` / \`usePersistentIslandContext\` remain typed placeholders on the package root — prefer \`island={{ persist }}\` / \`data-router-persist\`.

## Server-side request state

Not for client islands — for passing data through the request lifecycle:
- \`getContextValue\` / \`setContextValue\` (from \`@useavalon/avalon/middleware\`) — middleware → page/action data on \`event.context\`.
- \`getMiddlewareState\` / \`setMiddlewareState\` (from \`@useavalon/avalon/nitro/types\`) — h3-event-scoped state.

## Summary

| Need | Use |
|------|-----|
| State inside one island, persisted | \`usePersistentState\` |
| Notify other islands live | \`document.dispatchEvent(new CustomEvent(...))\` + \`addEventListener\` |
| Trigger hydration on an event | \`island={{ condition: 'on:event', conditionArg: '...' }}\` |
| Shareable / reloadable state | URL query params |
| Values across reloads / full navigations | \`usePersistentState\` (storage) |
| Live instance across client navigations | \`island={{ persist: 'key' }}\` or \`data-router-persist\` |
| Request-scoped server data | middleware context helpers |`,
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
			"clientOnly",
			"client-only",
		],
		content: `# Hydration Strategies

\`clientOnly: true\` is a rendering mode, not a condition. It skips SSR and **mounts** the component in the browser (\`data-render-strategy="client-only"\`). Combine it with any \`condition\` or custom directive to control when the mount runs:

\`\`\`tsx
<Chart island={{ clientOnly: true }} />
<Map island={{ clientOnly: true, condition: 'on:visible' }} />
\`\`\`

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

The \`script\` receives \`(el, hydrate, arg)\` and must call \`hydrate()\` exactly once. For a \`clientOnly\` island that callback mounts instead of hydrating SSR HTML.`,
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
		keywords: [
			"routing",
			"pages",
			"dynamic",
			"slug",
			"catch-all",
			"404",
			"params",
			"mdx",
			"clientNavigation",
		],
		content: `# File-System Routing

Two layouts are supported. **Module-based** (the default that \`create-avalon\` scaffolds) discovers pages inside feature modules; **flat** uses a single \`src/pages\` directory.

## Module-based (recommended)

Enable with \`modules: 'app/modules'\` in your config. Each module owns its own \`pages/\`:

| File | URL |
|------|-----|
| \`app/modules/main/pages/index.tsx\` | \`/\` |
| \`app/modules/about/pages/index.tsx\` | \`/about\` |
| \`app/modules/blog/pages/[slug].tsx\` | \`/blog/:slug\` |
| \`app/modules/docs/pages/[...slug].tsx\` | \`/docs/*\` |

A module name is a URL prefix. \`main\`, \`home\`, \`root\`, and \`index\` map to \`/\` instead of \`/main\`. \`create-avalon\` scaffolds \`main\` and \`about\` so that mapping is visible. Customize the sub-folder names with \`modules: { dir, pagesDirName, layoutsDirName }\`.

## Flat

Without \`modules\`, routes come from \`src/pages/\` (\`pagesDir\`, default \`'src/pages'\`):

| File | URL |
|------|-----|
| \`src/pages/index.tsx\` | \`/\` |
| \`src/pages/blog/[slug].tsx\` | \`/blog/:slug\` |
| \`src/pages/docs/[...slug].tsx\` | \`/docs/*\` |

## Params

Read params from the H3 \`event\`:

\`\`\`tsx
export default function BlogPost({ event }: { event: H3Event }) {
  const slug = event.context.params?.slug;
  return <article><h1>{slug}</h1></article>;
}
\`\`\`

Special files (in either layout): \`_layout.tsx\` (layout), \`_middleware.ts\` (scoped middleware), \`_error.tsx\` (error boundary), \`404.tsx\` (not found). \`.mdx\` files are pages too (with YAML frontmatter). API routes live in \`routes/api/\`, never in a \`pages/\` directory.

## Client navigation opt-out

When \`clientRouter: true\` is on, a page can force a full load:

\`\`\`tsx
export const clientNavigation = false;
\`\`\`

MDX: \`clientNavigation: false\` in frontmatter. Use this for routes whose document-level scripts or third-party widgets should not go through a DOM swap (\`data-router-reload\` remains the per-link opt-out). Full client-navigation and View Transitions reference: the \`client-navigation\` topic.`,
	},
	{
		id: "client-navigation",
		title: "Client Navigation",
		keywords: [
			"clientRouter",
			"clientNavigation",
			"navigate",
			"prefetch",
			"router",
			"viewTransition",
			"view transitions",
			"transition",
			"transitions",
			"startViewTransition",
			"data-router-transition",
			"data-router-reload",
			"data-router-persist",
			"data-router-prefetch",
			"persist",
			"ClientRouter",
			"ViewTransitions",
			"transition:animate",
		],
		content: `# Client Navigation

Avalon stays SSR-first and MPA-first. Every URL is still a normal server-rendered document. With \`clientRouter: true\`, internal navigations **progressively enhance**: the client fetches that same HTML, swaps it into the current page, and re-runs island hydration. There is no client-side page renderer and no second routing model.

This is **not** Astro's \`<ViewTransitions />\` / \`<ClientRouter />\` / \`astro:transitions\`. Avalon has none of those components. Enable the router on the Vite plugin; control the animation with \`navigate({ viewTransition })\` or \`data-router-transition\`.

JavaScript disabled, or a failed fetch, falls back to a full browser load. Direct requests still SSR-render that page.

## Enable it

\`\`\`ts
// vite.config.ts
import { defineConfig } from 'vite';
import { avalon } from '@useavalon/avalon';

export default defineConfig(async () => {
  const plugins = await avalon({ clientRouter: true });
  return { plugins };
});
\`\`\`

Default is \`false\`. When it is off, Avalon ships no extra client navigation JavaScript.

## How a navigation works

A same-origin link click or \`navigate()\` fetches the destination as HTML (the same document a full load would return). Title, meta, and other head tags update from that response; matching stylesheet \`href\`s are reused (no FOUC). Persist-marked islands are lifted out, everything else is disposed, the new body is swapped in, persist slots are restored, and the remaining islands hydrate. Deferred server islands boot afterward.

## Links

\`\`\`tsx
<a href="/about">Client navigation</a>
<a href="/about" data-router-reload>Full reload</a>
<a href="/docs" data-router-prefetch="false">No hover prefetch</a>
<a href="/blog" data-router-transition="slide-forward">Named transition</a>
<a href="/checkout" data-router-transition="false">No animation</a>
\`\`\`

The browser handles the click for \`download\`, non-\`_self\` targets, \`mailto:\` / \`tel:\` / cross-origin, modifier keys, non-primary buttons, hash-only updates, and \`data-router-reload\`.

## Persist islands

By default every island is torn down and rehydrated. Keep a live instance (theme toggle, search modal, audio player) with a persist key:

\`\`\`tsx
import ThemeToggle from '../components/ThemeToggle.tsx';

export default function Layout({ children }) {
  return (
    <header>
      <ThemeToggle island={{ condition: 'on:idle', persist: 'theme-toggle' }} />
      {children}
    </header>
  );
}
\`\`\`

\`persist: true\` uses the component source path as the key. Equivalent wrapper: \`<div data-router-persist="search-modal">\`. Qwik is never persisted. Nested persist nodes are ignored. This is not \`usePersistentState\` / \`PersistentIsland\` (those are \`sessionStorage\`).

## Prefetch

Eligible links prefetch on hover/focus (80ms). Skipped on Save-Data, \`2g\` / \`slow-2g\`, \`data-router-prefetch="false"\`, \`data-router-reload\`, or when the current page opted out. Cache TTL is 30 seconds.

\`\`\`ts
import { prefetch } from '@useavalon/avalon/client/router';
await prefetch('/docs');
\`\`\`

## Forms

Same-origin GET/POST forms swap the returned HTML. Native submit still works without JS. Full navigation when the form or submitter has \`data-router-reload\`, the method is not GET/POST, the target is not \`_self\`, or a file input has files.

## View Transitions

When \`document.startViewTransition\` is available and \`(prefers-reduced-motion: reduce)\` does not match, the DOM swap runs inside that call. Avalon does not inject transition CSS. The animation is the user-agent default. Astro \`transition:*\` attributes do not apply.

\`viewTransition\` on \`NavigateOptions\` and \`data-router-transition\` accept \`boolean | string\`.

- omitted, \`true\`, or \`"true"\` → user-agent View Transition
- \`false\` or \`"false"\` → instant swap
- any other string → user-agent View Transition; the string is the type name

Forms read \`data-router-transition\` from the submitter, then the form.

\`\`\`tsx
<a href="/about">Default transition</a>
<a href="/docs" data-router-transition="false">No animation</a>
<a href="/blog" data-router-transition="slide-forward">Named type</a>
\`\`\`

\`\`\`ts
import { navigate } from '@useavalon/avalon/client/router';
await navigate('/about', { viewTransition: false });
await navigate('/blog', { viewTransition: 'slide-forward' });
\`\`\`

A type name is written to \`document.documentElement.dataset.routerTransition\` for the duration of the swap. Where the browser accepts the options form, Avalon also calls \`startViewTransition({ update, types: [name] })\`.

\`\`\`css
::view-transition-old(root) { animation: 160ms ease-in both fade-out; }
::view-transition-new(root) { animation: 160ms ease-out both fade-in; }

html[data-router-transition="slide-forward"]::view-transition-old(root) {
  animation: 180ms ease-in both slide-out-left;
}

html:active-view-transition-type(slide-forward)::view-transition-old(root) {
  animation: 180ms ease-in both slide-out-left;
}
\`\`\`

Type names must be CSS custom-idents (letters, digits, hyphens). A persist island can set \`view-transition-name\` to participate as its own transition group.

## Opt a route out

\`\`\`tsx
export const clientNavigation = false;

export default function CheckoutPage() {
  return <section>Checkout</section>;
}
\`\`\`

MDX frontmatter: \`clientNavigation: false\`. SSR stamps \`data-client-navigation="false"\` on \`<html>\` and sends \`Avalon-Client-Navigation: false\`. Navigating **to** that route, or clicking links **while on it**, uses a full load.

## Programmatic API

\`\`\`ts
import { navigate, prefetch } from '@useavalon/avalon/client/router';

await navigate('/about', { history: 'push', viewTransition: 'slide-forward' });
await prefetch('/docs');
\`\`\`

\`NavigateOptions\`: \`history\` (\`'push' | 'replace' | 'auto'\`), \`scroll\` (default \`true\`), \`viewTransition\` (\`boolean | string\`).

Events on \`document\` (cancel \`avalon:before-navigate\` to abort): \`avalon:before-navigate\`, \`avalon:before-swap\`, \`avalon:after-swap\`, \`avalon:page-load\`, \`avalon:navigation-error\`. While in flight, \`document.documentElement.dataset.routerNavigating === "true"\`. Failures fall back to \`location.assign\`.

## Fallback

- No JavaScript → unchanged MPA
- Network / non-HTML response → \`location.assign\`
- Cross-origin, downloads, modified clicks → the browser handles them
- Route or link opt-out → full load

After a successful swap, Vue/Svelte SSR \`<style>\` tags are copied from the next document, Lit Declarative Shadow DOM is adopted (not cloned), and deferred server islands are fetched by the shared runtime.`,
	},
	{
		id: "layouts",
		title: "Layouts",
		keywords: ["layout", "_layout", "nested", "skipLayouts", "frontmatter", "LayoutProps"],
		content: `# Layouts

Layouts wrap pages based on directory structure. They live in \`app/shared/layouts/\` (module-based, what \`create-avalon\` scaffolds) or \`src/layouts/\` (flat, \`layoutsDir\`). A module can also have its own \`layouts/\` dir.

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

- A root \`_layout.tsx\` wraps everything; a nested \`blog/_layout.tsx\` nests inside it for \`/blog/*\`.
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

Use \`event.context.params\`, \`readBody(event)\`, \`getQuery(event)\`, \`getHeader\`, \`getCookie\`, \`setHeader\`, \`setResponseStatus\`, and \`createError\` for errors. In Nitro v3 / h3 v2, the web \`Request\` is exposed as \`event.req\` (not \`event.request\`).

## Per-route rules & runtime config

Set caching/headers/CORS per route with \`nitro.routeRules\`, and server-only config with \`nitro.runtimeConfig\` (read via \`useRuntimeConfig()\`):

\`\`\`ts
avalon({ nitro: {
  routeRules: { '/api/**': { cache: false, headers: { 'cache-control': 'no-store' } } },
  runtimeConfig: { tideApiToken: process.env.TIDE_TOKEN },
} });
\`\`\`

## Mounting Hono / Elysia

There is **no \`routes/_app.ts\`**. \`create-avalon\` generates a Nitro v3 web-fetch \`server.ts\` entry when you pick \`hono\` (\`new Hono()\`) or \`elysia\` (\`new Elysia()\`); \`h3\` needs no extra entry. Route files in \`routes/api/*\` use \`defineHandler\` from \`nitro\` regardless of the middleware choice.`,
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

Mind the import path — the two entry points expose **different** symbols.

## From \`@useavalon/avalon/client\`

| Export | Purpose |
|--------|---------|
| \`Image\` | Responsive images (srcset, format conversion, lazy) |
| \`IslandErrorBoundary\`, \`withIslandErrorBoundary\` | Isolate island failures |
| \`LayoutErrorBoundary\` | Catch layout errors with retry |
| \`usePersistentState\` | \`useState\` that persists to session/local storage |
| \`registerClientDirective\` | Register a client hydration directive |

\`\`\`tsx
import { Image, usePersistentState } from '@useavalon/avalon/client';
\`\`\`

## From \`@useavalon/avalon\` (root)

| Export | Purpose |
|--------|---------|
| \`PersistentIsland\`, \`usePersistentIslandContext\`, \`createPersistentIslandContext\` | Typed placeholders. Prefer \`island={{ persist: 'key' }}\` / \`data-router-persist\` for live instances across client navigations; \`usePersistentState\` for storage. |
| \`StreamingLayout\`, \`useStreamingState\` | Suspense-like streaming states |
| \`Image\`, error boundaries, \`usePersistentState\` | Also re-exported here |

\`PersistentIsland\` and \`StreamingLayout\` are **not** on \`/client\` — import types from the package root. Do not wrap islands in \`<PersistentIsland>\`; use \`island={{ persist: 'key' }}\` or \`data-router-persist="key"\` so the client router can move the live node.

\`\`\`tsx
import { usePersistentState } from '@useavalon/avalon/client';
\`\`\`

(There is no \`StreamingSuspense\` export — use \`StreamingLayout\` + \`useStreamingState\`.)`,
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

Bridge server data to scripts with \`data-*\` attributes. Reserve scripts for analytics, embeds, and page-level listeners.

## Optional client navigation

Client-side routing over SSR HTML, View Transitions, persist, prefetch, and forms live in the **client-navigation** topic. Enable with \`avalon({ clientRouter: true })\`. Imports: \`navigate\`, \`prefetch\` from \`@useavalon/avalon/client/router\`. Per-link: \`data-router-reload\`, \`data-router-prefetch\`, \`data-router-transition\`. Persist: \`island={{ persist: 'key' }}\` or \`data-router-persist\`. Route opt-out: \`export const clientNavigation = false\`.`,
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

Most islands are server-rendered first, so styles must exist before JS loads. **Avoid runtime CSS-in-JS** (styled-components, Emotion) — they don't produce styles during SSR. Use CSS Modules or plain CSS. Conditional classes: concatenate \`className\` strings. \`clientOnly: true\` islands have no SSR HTML; their styles apply only after the browser mounts them.`,
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

Define SEO metadata by exporting a \`metadata\` object from a page. It is merged with any frontmatter and passed to the layout via the \`frontmatter\` prop. (There is no \`Astro\`-style head component; layouts render \`<head>\` directly.) Pages usually export it untyped:

\`\`\`tsx
export const metadata = {
  title: 'Hello World',
  description: 'My first post.',
  openGraph: { title: 'Hello', description: '…', image: '/og.png' },
  head: [{ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } }],
};
\`\`\`

The \`PageMetadata\` type is available from \`@useavalon/avalon/nitro/types\` if you want annotation (it is not on the package root).

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

import Counter from '../components/Counter.tsx';

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

Avalon is configured through the async \`avalon()\` Vite plugin. The plugin is a **named export of \`@useavalon/avalon\`** — there is no \`@useavalon/avalon/vite\` subpath.

\`\`\`ts
// vite.config.ts
import { defineConfig } from 'vite';
import { avalon } from '@useavalon/avalon';

export default defineConfig(async () => {
  const plugins = await avalon({
    core: 'preact',                 // page/layout shell engine: 'preact' (default) | 'react'
    modules: 'app/modules',         // module-based routing (what create-avalon scaffolds)
    integrations: ['react'],        // island frameworks to enable
    mdx: { jsxImportSource: 'preact' },
    nitro: {
      preset: 'node_server',
      streaming: true,
      routeRules: { '/api/**': { cors: true } },
      cron: [{ schedule: '0 * * * *', handler: 'tasks/cleanup.ts' }],
    },
  });
  return { plugins };
});
\`\`\`

\`avalon()\` is async and returns an array of Vite plugins — always \`await\` it.

## \`AvalonPluginConfig\`

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| \`core\` | \`'preact' \\| 'react'\` | \`'preact'\` | Rendering engine for the page/layout shell. \`'react'\` enables React libs (Radix/shadcn) in pages. Islands can be any framework regardless. |
| \`pagesDir\` | \`string\` | \`'src/pages'\` | Flat routing directory. |
| \`layoutsDir\` | \`string\` | \`'src/layouts'\` | Flat layouts directory. |
| \`modules\` | \`string \\| { dir; pagesDirName?; layoutsDirName? }\` | — | Opt-in module routing (see routing topic). |
| \`integrations\` | \`IntegrationName[]\` | auto | \`'react' \\| 'preact' \\| 'vue' \\| 'svelte' \\| 'solid' \\| 'lit' \\| 'qwik'\`. |
| \`mdx\` | \`{ jsxImportSource?; syntaxHighlighting?; remarkPlugins?; rehypePlugins? }\` | — | MDX processing. |
| \`image\` | \`boolean \\| ImageConfig\` | \`true\` | vite-imagetools defaults. |
| \`nitro\` | \`AvalonNitroConfig\` | — | Server runtime (see below). |
| \`clientRouter\` | \`boolean\` | \`false\` | Opt-in client navigation over SSR HTML (see the client-navigation topic). Zero extra JS when off. |
| \`autoDiscoverIntegrations\` / \`validateIntegrations\` / \`showWarnings\` / \`lazyIntegrations\` / \`verbose\` | \`boolean\` | mostly \`true\` | Integration discovery + logging toggles. |

## \`AvalonNitroConfig\` (\`nitro\`)

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| \`preset\` | \`string\` | \`'node_server'\` | Deploy target: \`vercel\`, \`netlify\`, \`cloudflare_module\`, \`deno_deploy\`, \`static\`, … |
| \`streaming\` | \`boolean\` | \`true\` | Streaming SSR responses. |
| \`routeRules\` | \`Record<string, RouteRule>\` | — | Per-route \`cache\` / \`redirect\` / \`proxy\` / \`headers\` / \`cors\`. |
| \`runtimeConfig\` / \`publicRuntimeConfig\` | \`Record<string, unknown>\` | — | Server config via \`useRuntimeConfig()\` (e.g. proxy tokens). \`'nitro'\` key is reserved. |
| \`prerender\` | \`{ routes?; crawlLinks?; concurrency?; … }\` | — | SSG — fetch routes at build time to static HTML. |
| \`clientEntry\` | \`string\` | \`'app/entry-client'\` | Client entry (re-exports \`virtual:avalon/client-entry\`). |
| \`globalCSS\` | \`string[]\` | — | Extra global stylesheets, e.g. \`['app/shared/styles/main.css']\`. |
| \`cron\` | \`CronConfig\` | — | Scheduled jobs (see cron topic). |
| \`serverDir\`, \`serverEntry\`, \`renderer\`, \`compatibilityDate\`, \`compressPublicAssets\`, \`staticAssets\` | — | — | Advanced Nitro v3 knobs. |

\`RouteRule = { cache?: CacheOptions \\| boolean; redirect?; proxy?; headers?; cors? }\`; \`CacheOptions = { maxAge?; staleMaxAge?; swr? }\`.

## Project structure (module-based — what \`create-avalon\` generates)

\`\`\`
my-app/
├── app/
│   ├── entry-client.ts          # import "virtual:avalon/client-entry";
│   ├── actions/index.ts         # server actions (optional)
│   ├── modules/
│   │   ├── main/                # site root (/)
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── layouts/
│   │   └── about/               # /about — module name is the URL prefix
│   └── shared/
│       ├── layouts/             # shared layouts
│       ├── components/
│       └── styles/
├── middleware/                  # global middleware
├── routes/api/                  # API routes (Nitro)
├── server/renderer.ts           # export { default } from 'virtual:avalon/renderer' — see ssr-renderer
├── public/
└── vite.config.ts
\`\`\`

A simpler **flat** layout also works without \`modules\`: \`src/pages\`, \`src/layouts\`, \`src/components\`.`,
	},
	{
		id: "ssr-renderer",
		title: "SSR Renderer",
		keywords: [
			"renderer",
			"server/renderer",
			"virtual:avalon/renderer",
			"wrapWithLayouts",
			"injectAssets",
			"createNitroRenderer",
			"customize",
		],
		content: `# SSR Renderer

\`create-avalon\` writes \`server/renderer.ts\` as a one-line re-export. That file is Nitro's SSR catch-all.

\`\`\`ts
export { default } from 'virtual:avalon/renderer';
\`\`\`

Leave that export in place unless you have a reason to change it. Importing \`wrapWithLayouts\` or \`injectAssets\` by itself does nothing — those modules are already wired inside \`virtual:avalon/renderer\`.

## What the default renderer does

Resolves the page, renders it, wraps layouts (\`virtual:avalon/layouts\`), injects client assets (\`virtual:avalon/assets\`), and registers built-in hydration directives.

## When to customize

- **Custom \`on:*\` directive:** \`registerHydrationDirective(...)\` then keep the default export. See hydration-strategies.
- **Wrap every HTML response:** import the default renderer and call \`renderer.fetch(request)\`. Nitro's dispatcher needs \`.fetch\`.
- **Replace layout wrapping or asset injection:** \`createNitroRenderer\` from \`@useavalon/avalon/nitro/renderer\`, passing your own \`wrapWithLayouts\`. Only do this when the default path is wrong.

Most apps never leave the first case.`,
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
- The framework is auto-detected from the island **filename** (\`*.react.tsx\`, \`*.solid.tsx\`, \`*.vue\`, …) — you do not pick it at the call site (contrast with Astro's \`client:only="react"\`). A plain \`.tsx\` file is Preact. See the islands topic for the naming table.
- Each island is an independent tree: **context/providers cannot span multiple islands**. There is no built-in shared store — see the "State & Cross-Island Communication" topic.

## Integration packages

Each framework has its own package (\`@useavalon/react\`, \`@useavalon/preact\`, \`@useavalon/vue\`, \`@useavalon/svelte\`, \`@useavalon/solid\`, \`@useavalon/lit\`, \`@useavalon/qwik\`). Listing a framework in \`integrations\` activates its package; usually you never import from it directly.

The **React** integration (\`@useavalon/react\`) is the most feature-rich:
- \`import reactIntegration from '@useavalon/react'\` (default export; also named \`reactIntegration\`). There is **no** \`reactAdapter\` export.
- \`@useavalon/react/server\` → \`render\`, \`renderWithErrorBoundary\` (the SSR renderer used as the server entry).
- \`@useavalon/react\` also exports \`hydrate\`, \`serializeProps\`, \`getHydrationScript\`, \`loadComponent\`.
- \`@useavalon/react/client\` and \`@useavalon/react/client/hmr\` — client + HMR adapter.

Use \`core: 'react'\` when your **pages/layouts** (not just islands) need real React (e.g. Radix/shadcn).`,
	},
	{
		id: "cli",
		title: "CLI — create-avalon & avalon",
		keywords: [
			"cli",
			"create-avalon",
			"scaffold",
			"init",
			"new project",
			"avalon key",
			"AVALON_KEY",
			"styling",
			"tailwind",
			"shadcn",
			"middleware",
			"deploy",
		],
		content: `# CLI

## \`create-avalon\` — scaffold a project

\`\`\`bash
bun create avalon my-app
# or: npm create avalon@latest my-app
\`\`\`

Interactive by default. Pass \`--yes\` (or run without a TTY) to skip prompts and use flags + defaults:

| Prompt | Options | Notes |
|--------|---------|-------|
| Core (rendering engine) | \`preact\` (default) · \`react\` | Shell engine for pages/layouts. |
| Integrations | preact, react, vue, svelte, solid, lit, qwik | Multi-select (optional). React is force-added if core is \`react\`. |
| Styling | \`css-modules\` · \`tailwind\` · \`shadcn\` | \`shadcn\` only offered when core is \`react\` (Radix-based). |
| Plugins | \`seo\` (default) · \`agent-optimization\` | Multi-select. MDX syntax highlighting is always on. |
| Middleware | \`h3\` · \`hono\` · \`elysia\` | \`hono\`/\`elysia\` generate a \`server.ts\` entry. |
| Deploy | \`cloudflare\` · \`netlify\` · \`none\` | \`cloudflare\` emits \`wrangler.toml\`, \`public/_headers\`, \`DEPLOY.md\`, and Wrangler \`preview\`/\`deploy\` scripts. \`netlify\` emits \`netlify.toml\` + \`DEPLOY.md\`. Both always get \`build.mjs\` + \`post-build.mjs\`. |
| Cron | yes/no (default no) | Scaffolds an example task + \`nitro.cron\` config. |

Generates the module-based layout (\`app/modules/main\` → \`/\`, \`app/modules/about\` → \`/about\`, \`app/shared\`, \`middleware\`, \`routes/api\`, \`server\`, \`public\`) — see the configuration topic.

## \`avalon\` — project CLI

One command:

\`\`\`bash
npx avalon key
\`\`\`

Prints a cryptographically random AES-256-GCM key for server islands and tells you to \`export AVALON_KEY="…"\`. Set a stable \`AVALON_KEY\` for multi-instance deploys so encrypted server-island props stay decryptable across instances.`,
	},
	{
		id: "flora",
		title: "Flora — Grid & Layout System",
		keywords: [
			"flora",
			"grid",
			"layout",
			"css",
			"columns",
			"flora-grid",
			"flora-col",
			"bento",
			"masonry",
			"baseline",
			"responsive",
			"container queries",
		],
		content: `# Flora — Grid & Layout System

\`@useavalon/flora\` is a framework-agnostic, CSS-first responsive modular grid (zero runtime deps). It's independent of Avalon — just CSS custom properties inside a low-priority \`@layer flora\`, so any rule you write overrides it without specificity fights.

\`\`\`bash
npm install @useavalon/flora
\`\`\`

\`\`\`ts
import '@useavalon/flora/flora.css';
\`\`\`

## Placing items

Mobile-first 4 / 8 / 12 columns. Use utility classes (responsive per breakpoint) or custom properties:

\`\`\`html
<div class="flora-grid">
  <div class="flora-col-4 flora-col-lg-8">main</div>
  <div class="flora-col-4 flora-start-2 flora-col-lg-4">aside</div>
</div>

<!-- or inline -->
<div style="--flora-col-span: 6; --flora-col-start: 2">…</div>
\`\`\`

Breakpoint-prefixed spans: \`flora-col-{n}\`, \`flora-col-md-{n}\`, \`flora-col-lg-{n}\`, plus \`flora-start-{n}\`.

## Recipes (all in \`flora.css\`, all overridable)

- **Grid modes:** \`flora-condensed\` (1px), \`flora-narrow\` (16px), \`flora-wide\` (32px), \`flora-flush\` (0) gutters.
- **Subgrid:** \`flora-subgrid\` aligns nested items to the outer grid.
- **Aspect ratios:** \`flora-ratio-16x9\` (also 1x1, 2x1, 3x2, 4x3, 2x3, 3x4).
- **Auto cards:** \`flora-auto\` with \`--flora-auto-min\` (no media queries).
- **Bento:** \`flora-bento\` with \`flora-tile-big\` (2×2), \`flora-tile-wide\` (2×1), \`flora-tile-tall\` (1×2).
- **Masonry:** \`flora-masonry\` (progressive enhancement via CSS columns).
- **Vertical rhythm:** \`flora-flow\` (baseline-multiple spacing), \`flora-baseline-grid\` (debug overlay).
- **Templates** (\`templates.css\`): \`flora-tmpl-editorial\`, \`flora-tmpl-feature\`, \`flora-tmpl-gallery\`, \`flora-tmpl-split\`, \`flora-tmpl-team\`.

## Tokens

Retune with custom properties — no rebuild: \`--flora-columns\`, \`--flora-gutter\`, \`--flora-margin\`, \`--flora-max-width\`, \`--flora-baseline\`, \`--flora-col-span\`, \`--flora-col-start\`.

## Stylesheets & subpaths

| Import | Purpose |
|--------|---------|
| \`@useavalon/flora/flora.css\` | The grid + recipes (viewport \`@media\`) |
| \`@useavalon/flora/flora.container.css\` | Container-query flavour (respond to the slot, not the screen) |
| \`@useavalon/flora/flora.print.css\` | Opt-in \`@media print\` rules |
| \`@useavalon/flora/templates.css\` / \`templates.container.css\` | Named layout templates |
| \`@useavalon/flora/element\` | Self-registers the \`<flora-grid>\` web component |

## JS API (\`@useavalon/flora\`)

Pure functions — the generator is the single source of truth for the CSS:

\`\`\`ts
import { generateGridCss, generateTemplatesCss, typeScale, snapToBaseline, POWERS_OF_TWO_COLUMNS } from '@useavalon/flora';

const css = generateGridCss({ selector: '[data-grid]', columns: { xs: 2, md: 6, xl: 16 }, gutter: { xs: 16, lg: 32 }, layer: 'flora' });
snapToBaseline(20, 8);      // 24
typeScale(16, 'perfectFifth', { baseline: 8 });
\`\`\`

Also exports math helpers (\`columnWidth\`, \`spanWidth\`, \`spacing\`, \`gcd\`, \`lcm\`, \`divisors\`) and token constants (\`BASE_UNIT\`, \`BREAKPOINTS\`, \`DEFAULT_COLUMNS\`, \`GRID_MODES\`, \`ASPECT_RATIOS\`).`,
	},
];

/** Simple keyword-weighted search across the embedded docs. */
export function searchDocs(query: string, limit = 5): DocTopic[] {
	const raw = query.toLowerCase();
	const terms = raw.split(/[^a-z0-9:]+/).filter(Boolean);
	const phrases = raw.match(/[a-z0-9]+:[a-z0-9-]+|[a-z0-9]+-[a-z0-9-]+/g) ?? [];
	const allTerms = [...new Set([...terms, ...phrases])];
	if (allTerms.length === 0) return [];

	const scored = DOC_TOPICS.map((topic) => {
		const haystackTitle = topic.title.toLowerCase();
		const haystackKeywords = topic.keywords.join(" ").toLowerCase();
		const haystackContent = topic.content.toLowerCase();
		let score = 0;
		for (const term of allTerms) {
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
