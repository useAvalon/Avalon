/**
 * Structured knowledge about Avalon's hydration directives.
 *
 * This is the single source of truth the MCP tools use to answer questions
 * about hydration. It is intentionally verbose so the model gets exact syntax
 * and the crucial "this is NOT Astro" framing.
 *
 * @module knowledge/directives
 */

/** A built-in hydration condition usable directly in the `island` prop. */
export interface HydrationCondition {
	/** The exact `condition` string, e.g. `"on:visible"`. */
	condition: string;
	/** Short human summary of when hydration fires. */
	summary: string;
	/** The browser mechanism used under the hood. */
	mechanism: string;
	/** Whether this condition takes a `conditionArg`. */
	takesArg: boolean;
	/** Description of the `conditionArg` value, when applicable. */
	argDescription?: string;
	/** A copy-paste-ready usage example. */
	example: string;
	/** When to reach for this condition. */
	useWhen: string;
	/** Whether it must be enabled via `registerBuiltinDirectives()`. */
	requiresRegistration: boolean;
}

/**
 * The five core conditions handled natively by the client runtime
 * (no registration required).
 */
export const CORE_CONDITIONS: HydrationCondition[] = [
	{
		condition: "on:client",
		summary: "Hydrates immediately when the page loads (the default).",
		mechanism: "Runs as soon as the island script is parsed.",
		takesArg: false,
		example: `<Counter island={{ condition: 'on:client' }} />`,
		useWhen: "The component must be interactive right away. This is the default if you omit `condition`.",
		requiresRegistration: false,
	},
	{
		condition: "on:visible",
		summary: "Hydrates when the element scrolls into the viewport.",
		mechanism: "IntersectionObserver with a 50px rootMargin.",
		takesArg: false,
		example: `<Chart island={{ condition: 'on:visible' }} />`,
		useWhen: "Below-the-fold content that doesn't need JS until seen.",
		requiresRegistration: false,
	},
	{
		condition: "on:interaction",
		summary: "Hydrates on the first user interaction (click, touch, hover, or focus).",
		mechanism: "Listens for click / touchstart / mouseenter / focusin, then hydrates.",
		takesArg: false,
		example: `<Dropdown island={{ condition: 'on:interaction' }} />`,
		useWhen: "Forms, dropdowns, menus — UI that only needs to react once the user engages.",
		requiresRegistration: false,
	},
	{
		condition: "on:idle",
		summary: "Hydrates when the browser is idle.",
		mechanism: "requestIdleCallback.",
		takesArg: false,
		example: `<Analytics island={{ condition: 'on:idle' }} />`,
		useWhen: "Low-priority widgets that shouldn't compete with critical rendering.",
		requiresRegistration: false,
	},
	{
		condition: "media:<query>",
		summary: "Hydrates only when a CSS media query matches.",
		mechanism: "matchMedia(query).",
		takesArg: false,
		argDescription: "The media query is written inline after the `media:` prefix.",
		example: `<MobileMenu island={{ condition: 'media:(max-width: 768px)' }} />`,
		useWhen: "Components that only exist at certain breakpoints.",
		requiresRegistration: false,
	},
];

/**
 * Built-in *custom* directives. They follow the `on:<name>` pattern, accept an
 * optional `conditionArg`, and are enabled by calling
 * `registerBuiltinDirectives()` in your server entry.
 */
export const CUSTOM_DIRECTIVES: HydrationCondition[] = [
	{
		condition: "on:delay",
		summary: "Hydrates after a fixed timeout.",
		mechanism: "setTimeout(hydrate, ms).",
		takesArg: true,
		argDescription: "Delay in milliseconds (default 1000).",
		example: `<Widget island={{ condition: 'on:delay', conditionArg: '3000' }} />`,
		useWhen: "Defer hydration by a fixed duration — e.g. a tooltip not needed in the first seconds.",
		requiresRegistration: true,
	},
	{
		condition: "on:event",
		summary: "Hydrates when a custom DOM event fires on `document`.",
		mechanism: "document.addEventListener(arg, hydrate, { once: true }).",
		takesArg: true,
		argDescription: "The event name to wait for, e.g. `data:loaded`.",
		example: `<Dashboard island={{ condition: 'on:event', conditionArg: 'data:loaded' }} />`,
		useWhen: "Hydration depends on an external signal (data fetch complete, third-party ready).",
		requiresRegistration: true,
	},
	{
		condition: "on:scroll",
		summary: "Hydrates when the page scrolls past a pixel threshold.",
		mechanism: "scroll listener comparing window.scrollY to the threshold.",
		takesArg: true,
		argDescription: "Scroll depth in pixels (default 100).",
		example: `<LazySection island={{ condition: 'on:scroll', conditionArg: '500' }} />`,
		useWhen: "Activate based on scroll depth rather than viewport intersection.",
		requiresRegistration: true,
	},
	{
		condition: "on:match",
		summary: "Hydrates when a media query matches (custom-directive variant of `media:`).",
		mechanism: "matchMedia(arg) with a change listener.",
		takesArg: true,
		argDescription: "The media query string, e.g. `(min-width: 1024px)`.",
		example: `<Sidebar island={{ condition: 'on:match', conditionArg: '(min-width: 1024px)' }} />`,
		useWhen: "You prefer the custom-directive system and want the query passed as `conditionArg`.",
		requiresRegistration: true,
	},
];

/** Everything the model needs to know about the `island` prop itself. */
export const ISLAND_PROP_REFERENCE = {
	summary:
		"Avalon controls hydration with a SINGLE `island` prop object passed to an imported component. There are NO `client:*` template attributes like Astro has.",
	fields: [
		{
			name: "condition",
			type: "'on:client' | 'on:visible' | 'on:interaction' | 'on:idle' | `media:${string}` | `on:${string}`",
			required: false,
			default: "'on:client'",
			description: "When the island's JavaScript loads and executes.",
		},
		{
			name: "id",
			type: "string",
			required: false,
			description:
				"Stable identifier for the island instance (used for state persistence with PersistentIsland). Auto-generated from the component path if omitted.",
		},
		{
			name: "conditionArg",
			type: "string",
			required: false,
			description:
				"Optional argument passed to custom hydration directives — e.g. the delay for `on:delay` or the query for `on:match`.",
		},
	],
	canonicalExample: `import Counter from '../islands/Counter.tsx';

export default function Page() {
  return (
    <div>
      {/* Hydrate as soon as the page loads */}
      <Counter island={{ condition: 'on:client' }} initialCount={5} />
    </div>
  );
}`,
	gotchas: [
		"Islands are discovered by USAGE (the `island` prop), not by a special directory. Any imported component becomes an island when you add the prop.",
		"When an island is the only child returned from a page or layout, wrap it in a container element (e.g. a <div>). Returning it bare may break.",
		"JSX islands need the right pragma for their renderer, e.g. `/** @jsxImportSource preact */` at the top of the file.",
		"`on:delay`, `on:event`, `on:scroll`, and `on:match` are built-in CUSTOM directives — enable them by calling `registerBuiltinDirectives()` in your server entry.",
	],
	registerCustomExample: `// server/renderer.ts
import { registerHydrationDirective } from '@useavalon/avalon';

registerHydrationDirective('on:countdown', {
  name: 'on:countdown',
  // Runs on the client. Call hydrate() exactly once.
  script: (el, hydrate, arg) => {
    let remaining = parseInt(arg || '5', 10);
    const tick = setInterval(() => {
      if (--remaining <= 0) { clearInterval(tick); hydrate(); }
    }, 1000);
  },
});

export { default } from 'virtual:avalon/renderer';`,
};

/** All conditions in one array for search/enumeration. */
export const ALL_CONDITIONS: HydrationCondition[] = [...CORE_CONDITIONS, ...CUSTOM_DIRECTIVES];

/** Look up a condition by its `condition` string (normalising `media:` queries). */
export function findCondition(condition: string): HydrationCondition | undefined {
	const normalized = condition.trim();
	if (normalized.startsWith("media:")) {
		return CORE_CONDITIONS.find((c) => c.condition === "media:<query>");
	}
	return ALL_CONDITIONS.find((c) => c.condition === normalized);
}
