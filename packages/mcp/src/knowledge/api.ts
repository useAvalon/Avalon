/**
 * A curated map of Avalon's public API — the correct import paths and the
 * symbols exposed by each. Agents often invent imports; this grounds them.
 *
 * @module knowledge/api
 */

export interface ApiEntry {
	/** The import specifier. */
	importPath: string;
	/** Named exports of interest. */
	exports: string[];
	/** What this entry point is for. */
	description: string;
}

export const API_ENTRIES: ApiEntry[] = [
	{
		importPath: "@useavalon/avalon",
		exports: [
			"avalon (Vite plugin — NAMED export, not '@useavalon/avalon/vite')",
			"Island",
			"renderIsland",
			"renderToHtml",
			"registerHydrationDirective",
			"unregisterHydrationDirective",
			"registerBuiltinDirectives",
			"getRegisteredDirectives",
			"usePersistentState",
			"PersistentIsland",
			"usePersistentIslandContext",
			"createPersistentIslandContext",
			"StreamingLayout",
			"useStreamingState",
			"getContextValue",
			"setContextValue",
			"type AvalonPluginConfig",
			"type AvalonNitroConfig",
			"type RenderEngine",
			"type RouteRule",
			"type CacheOptions",
			"type IntegrationName",
			"type IslandDirective",
			"type LayoutFrontmatter",
			"type LayoutProps",
			"type ServerIslandProp",
			"type IslandState",
		],
		description:
			"Main entry: the Vite plugin (named `avalon`), island utilities, hydration-directive registration, persistence + streaming components, request context helpers, and config/layout types. Note: PersistentIsland/StreamingLayout live HERE, not on /client.",
	},
	{
		importPath: "@useavalon/avalon/actions",
		exports: [
			"defineAction",
			"ActionError",
			"isActionError",
			"createActionClient",
			"ACTION_ERROR_STATUS",
			"type Action",
			"type ActionContext",
			"type ActionResult",
		],
		description: "Server Actions: define type-safe server functions and build typed clients.",
	},
	{
		importPath: "virtual:avalon/actions",
		exports: ["actions (typed client proxy)"],
		description:
			"Client-side virtual module exposing your `server` actions as an async proxy returning { data, error }.",
	},
	{
		importPath: "@useavalon/avalon/cron",
		exports: ["defineCronJob", "runCronJob", "type Task"],
		description: "Cron jobs implemented as Nitro tasks.",
	},
	{
		importPath: "@useavalon/avalon/client",
		exports: [
			"Image",
			"IslandErrorBoundary",
			"withIslandErrorBoundary",
			"LayoutErrorBoundary",
			"usePersistentState",
			"registerClientDirective",
		],
		description:
			"Client-safe components only: images, error boundaries, per-island persisted state, client directive registration. Does NOT export PersistentIsland/StreamingLayout — those are on the package root.",
	},
	{
		importPath: "@useavalon/avalon/client/router",
		exports: [
			"navigate",
			"installClientRouter",
			"prefetch",
			"ROUTER_EVENTS",
			"type NavigateOptions",
			"type ViewTransitionMode",
		],
		description:
			"Optional client navigation over SSR HTML (not Astro <ViewTransitions /> / <ClientRouter /> / astro:transitions). Enable with avalon({ clientRouter: true }). navigate(url, { history, scroll, viewTransition }); prefetch(url). viewTransition: false skips the animation; a string names it for CSS (also data-router-transition on links/forms). Persist islands with island={{ persist: 'key' }} or data-router-persist. Opt a route out with export const clientNavigation = false (or MDX frontmatter). Hover prefetch and same-origin GET/POST form enhancement are on when the router is enabled.",
	},
	{
		importPath: "@useavalon/avalon/middleware",
		exports: ["getContextValue", "setContextValue", "hasContextValue"],
		description:
			"Request-scoped middleware context helpers. Scoped `_middleware.ts` files just default-export a handler; global middleware lives in the root `middleware/` dir.",
	},
	{
		importPath: "@useavalon/avalon/nitro/renderer",
		exports: ["the SSR renderer handler (page/island server rendering)"],
		description: "Nitro SSR renderer entry — usually wired automatically via server/renderer.ts.",
	},
	{
		importPath: "@useavalon/avalon/nitro/config",
		exports: ["createNitroConfig", "helpers for building the Nitro config"],
		description: "Programmatic Nitro config construction (advanced).",
	},
	{
		importPath: "@useavalon/avalon/nitro/types",
		exports: [
			"type PageMetadata",
			"type AvalonEventContext",
			"getMiddlewareState",
			"setMiddlewareState",
		],
		description: "Nitro runtime types (PageMetadata) and h3-event-scoped middleware state helpers.",
	},
	{
		importPath: "@useavalon/react",
		exports: [
			"reactIntegration (default + named — NO `reactAdapter`)",
			"hydrate",
			"serializeProps",
			"getHydrationScript",
			"loadComponent",
			"render",
			"renderWithErrorBoundary",
			"type ReactRenderParams",
			"type ReactRenderResult",
		],
		description:
			"React integration package. `@useavalon/react/server` → `render`/`renderWithErrorBoundary` (SSR renderer); `@useavalon/react/client` + `/client/hmr` are the client + HMR adapters.",
	},
	{
		importPath: "@useavalon/flora",
		exports: [
			"generateGridCss",
			"generateTemplatesCss",
			"generatePrintCss",
			"typeScale",
			"snapToBaseline",
			"baselineLineHeight",
			"columnWidth",
			"spanWidth",
			"POWERS_OF_TWO_COLUMNS",
			"BASE_UNIT",
			"BREAKPOINTS",
			"DEFAULT_COLUMNS",
			"GRID_MODES",
		],
		description:
			"Framework-agnostic CSS-first grid. CSS via `@useavalon/flora/flora.css` (+ .container/.print), templates via `/templates.css`, web component via `/element`. JS exports are pure grid-maths + CSS generators.",
	},
	{
		importPath: "h3",
		exports: [
			"defineEventHandler",
			"readBody",
			"getQuery",
			"getHeader",
			"getCookie",
			"setHeader",
			"setResponseStatus",
			"createError",
			"type H3Event",
		],
		description: "Nitro's HTTP layer — used for API routes and global middleware.",
	},
];

/** Render the API reference as Markdown. */
export function apiReferenceMarkdown(): string {
	const lines = ["# Avalon Public API Reference", ""];
	for (const entry of API_ENTRIES) {
		lines.push(
			`## \`${entry.importPath}\``,
			"",
			entry.description,
			"",
			"Exports:",
			...entry.exports.map((ex) => `- \`${ex}\``),
			"",
		);
	}
	return lines.join("\n").trimEnd();
}
