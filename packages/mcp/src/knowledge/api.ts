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
			"avalon (Vite plugin)",
			"Island",
			"renderIsland",
			"registerHydrationDirective",
			"registerBuiltinDirectives",
			"getRegisteredDirectives",
			"usePersistentState",
			"type IslandDirective",
			"type LayoutProps",
			"type ServerIslandProp",
		],
		description:
			"Main entry: the Vite plugin, island utilities, hydration-directive registration, layout types.",
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
			"PersistentIsland",
			"usePersistentIslandContext",
			"usePersistentState",
			"StreamingLayout",
			"StreamingSuspense",
		],
		description: "Client/runtime components: images, error boundaries, streaming, persistence.",
	},
	{
		importPath: "@useavalon/avalon/middleware",
		exports: [
			"discoverScopedMiddleware",
			"executeScopedMiddleware",
			"getContextValue",
			"setContextValue",
		],
		description:
			"Scoped middleware discovery/execution utilities (usually internal; scoped `_middleware.ts` files just default-export a handler).",
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
		lines.push(`## \`${entry.importPath}\``);
		lines.push("");
		lines.push(entry.description);
		lines.push("");
		lines.push("Exports:");
		for (const ex of entry.exports) lines.push(`- \`${ex}\``);
		lines.push("");
	}
	return lines.join("\n").trimEnd();
}
