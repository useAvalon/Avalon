/**
 * Server Islands Endpoint
 *
 * Nitro route handler for `/_server-islands/:componentId`.
 * Handles decrypting props, importing the component from the manifest,
 * rendering it with Preact SSR, and returning HTML with Cache-Control headers.
 *
 * Supports both GET (props in query param `p`) and POST (props in body) requests.
 *
 * @module server-islands/endpoint
 */

// Static import so the bundler resolves the virtual module and includes the
// server island component loaders in the server bundle. The Avalon Vite plugin
// (`avalon:server-islands`) provides this module via resolveId/load; the Nitro
// build receives it through `nitro.options.virtual` (see nitro-integration.ts).
// In dev the endpoint is handled by middleware and this module resolves to an
// empty manifest, so the static import is always safe.
import { serverIslandCSS, serverIslandLoaders } from "virtual:server-island-manifest";
import type { H3Event } from "h3";
import { h } from "preact";
import preactRenderToString from "preact-render-to-string";
import { loadIntegration } from "../islands/integration-loader.ts";
import { escapeJsonForScript, generatePerIslandScript } from "../islands/per-island-script.ts";
import { decrypt } from "./encryption.ts";
import { lookupComponent } from "./manifest.ts";

/** Hydration condition type (duplicated to avoid circular import from island.tsx) */
type HydrationCondition =
	| "on:visible"
	| "on:interaction"
	| "on:idle"
	| "on:client"
	| `media:${string}`
	| `on:${string}`;

/**
 * Server island component loaders, keyed by componentId. Generated at build time
 * from the manifest. Each loader dynamically imports its component module so the
 * bundler keeps the component reachable in the server bundle (no tree-shaking).
 */
const _loaders: Record<string, () => Promise<{ default: unknown }>> = serverIslandLoaders ?? {};

function getLoaders(): Record<string, () => Promise<{ default: unknown }>> {
	return _loaders;
}

/**
 * Options for configuring the server island endpoint handler.
 */
export interface ServerIslandEndpointOptions {
	/**
	 * Whether running in development mode.
	 * In dev mode, error messages are included in 500 responses.
	 */
	isDev?: boolean;

	/**
	 * Default Cache-Control header value.
	 * @default "private, no-store"
	 */
	defaultCacheControl?: string;
}

/**
 * Island metadata stored in the `__island` key of the props payload
 * for combined server + client islands.
 */
interface IslandMetadata {
	/** Hydration condition (e.g., "on:client", "on:visible") */
	condition: HydrationCondition;
	/** Optional condition argument for custom directives */
	conditionArg?: string;
	/** Framework identifier (e.g., "preact", "solid") */
	framework: string;
	/** Bundle path to the component module for client hydration */
	componentSrc?: string;
	/** The DOM element ID of the server island wrapper (for hydration targeting) */
	elementId?: string;
}

/** Decoded server-island payload: the component props plus optional metadata. */
interface DecodedPayload {
	props: Record<string, unknown>;
	islandMeta?: IslandMetadata;
	srcPath?: string;
}

/** Result of rendering the island component to HTML. */
interface RenderedIsland {
	html: string;
	ssrFailed: boolean;
	hydrationRenderId?: string;
}

/** Builds a plain-text response (used for error/status replies). */
function textResponse(message: string, status: number): Response {
	return new Response(message, { status, headers: { "Content-Type": "text/plain" } });
}

/**
 * Creates a Nitro-compatible event handler for the server islands endpoint.
 *
 * The handler extracts the componentId + encrypted props, decrypts them, imports
 * the component from the manifest, renders it, appends a hydration script for
 * combined islands, and returns HTML. Each phase is delegated to a helper that
 * returns either its result or an error `Response`.
 *
 * Error responses:
 * - 400 Bad Request: decryption failure or missing props
 * - 404 Not Found: component not in manifest
 * - 500 Internal Server Error: render failure
 *
 * @param options - Endpoint configuration options
 * @returns An async handler function compatible with H3/Nitro
 */
export function defineServerIslandHandler(options: ServerIslandEndpointOptions = {}) {
	const {
		isDev = process.env.NODE_ENV !== "production",
		defaultCacheControl = "private, no-store",
	} = options;

	return async (event: H3Event): Promise<Response> => {
		const componentId = extractComponentId(event);
		if (!componentId) return textResponse("Missing component ID", 400);

		const payload = await readEncryptedProps(event);
		if (payload instanceof Response) return payload;

		const decoded = decodePayload(payload, isDev);
		if (decoded instanceof Response) return decoded;
		const { props, islandMeta, srcPath } = decoded;

		// The payload-provided `srcPath` (`__src`) is only trusted in development,
		// where the manifest may not be populated in the endpoint's module instance.
		// In production the target module must come from the build-time manifest —
		// never from the request — so a forged payload can't point the dynamic
		// import at an arbitrary module.
		const modulePath = lookupComponent(componentId) ?? (isDev ? srcPath : undefined);
		if (!modulePath) return textResponse("Component not found", 404);

		const loaded = await loadComponentModule(componentId, modulePath, isDev, Boolean(islandMeta));
		if (loaded instanceof Response) return loaded;

		const rendered = await renderIslandComponent({
			componentModule: loaded,
			props,
			islandMeta,
			componentId,
			modulePath,
			isDev,
		});
		if (rendered instanceof Response) return rendered;

		let html = rendered.html;
		if (islandMeta) {
			html += buildHydrationScript({
				componentId,
				islandMeta,
				modulePath,
				props,
				ssrFailed: rendered.ssrFailed,
				hydrationRenderId: rendered.hydrationRenderId,
				isDev,
			});
		}

		return new Response(html, {
			status: 200,
			headers: { "Content-Type": "text/html", "Cache-Control": defaultCacheControl },
		});
	};
}

/**
 * Reads the encrypted props payload from the request, returning an error
 * `Response` when it can't be read or is missing.
 */
async function readEncryptedProps(event: H3Event): Promise<string | Response> {
	let encryptedProps: string | undefined;
	try {
		encryptedProps = await extractEncryptedProps(event);
	} catch {
		return textResponse("Failed to read request body", 400);
	}
	if (!encryptedProps) return textResponse("Missing encrypted props", 400);
	return encryptedProps;
}

/**
 * Decrypts (or, in dev, decodes) the payload and extracts props + metadata.
 * Returns a 400 `Response` on any failure.
 *
 * The `dev.` prefix selects an unencrypted, unauthenticated payload and MUST
 * only be honored in development — otherwise an attacker could send a `dev.`
 * payload to a production endpoint and bypass AES-GCM entirely (forging props
 * and the `__src` import target). In production a `dev.` payload falls through
 * to `decrypt()` and fails the GCM auth check.
 */
function decodePayload(encryptedProps: string, isDev: boolean): DecodedPayload | Response {
	try {
		let decrypted: string;
		if (isDev && encryptedProps.startsWith("dev.")) {
			decrypted = Buffer.from(encryptedProps.slice(4), "base64url").toString("utf8");
		} else {
			decrypted = decrypt(encryptedProps);
		}
		const parsed = JSON.parse(decrypted);
		const result: DecodedPayload = { props: parsed };
		// Extract island metadata if present (combined server + client island).
		if (parsed.__island) {
			result.islandMeta = parsed.__island as IslandMetadata;
			delete parsed.__island;
		}
		// Extract source path (used for dev-mode component loading).
		if (parsed.__src) {
			result.srcPath = parsed.__src as string;
			delete parsed.__src;
		}
		return result;
	} catch {
		return textResponse("Bad Request: decryption failed", 400);
	}
}

/**
 * Imports the component module — via the build-time loader when available, else
 * a dynamic import of the resolved module path. Returns the module, or an error
 * `Response` for a fatal (non-combined) failure. For combined islands in dev, a
 * failed import is recoverable (client hydration renders it) and yields a module
 * with a `null` default.
 */
async function loadComponentModule(
	componentId: string,
	modulePath: string,
	isDev: boolean,
	isCombined: boolean,
): Promise<{ default?: unknown } | Response> {
	try {
		const loader = getLoaders()[componentId];
		let componentModule: { default?: unknown };
		if (loader) {
			componentModule = await loader();
		} else {
			if (isDev) console.log("[server-islands] Loading component from:", modulePath);
			componentModule = await import(/* @vite-ignore */ modulePath);
		}
		if (!componentModule.default) {
			throw new TypeError(`Module "${modulePath}" does not have a default export`);
		}
		return componentModule;
	} catch (err) {
		// For combined islands, import failure is recoverable via client render.
		if (isCombined && isDev) {
			console.warn(
				"[server-islands] Component import failed (will render client-side):",
				modulePath,
				err instanceof Error ? err.message : err,
			);
			return { default: null };
		}
		const message = isDev && err instanceof Error ? err.message : "Component import failed";
		return textResponse(message, 500);
	}
}

/**
 * Renders the island component to HTML. Preact/React use `preactRenderToString`;
 * other frameworks use their integration's `render`. Returns the rendered HTML,
 * or — for a fatal, non-combined render failure — an error `Response`. A missing
 * default export (recoverable import failure) yields empty HTML + `ssrFailed`.
 */
async function renderIslandComponent(args: {
	componentModule: { default?: unknown };
	props: Record<string, unknown>;
	islandMeta?: IslandMetadata;
	componentId: string;
	modulePath: string;
	isDev: boolean;
}): Promise<RenderedIsland | Response> {
	const { componentModule, props, islandMeta, componentId, modulePath, isDev } = args;

	// Import failed (recoverable) — skip SSR, let client render handle it.
	if (!componentModule.default) {
		return { html: "", ssrFailed: true };
	}

	const framework = islandMeta?.framework ?? "preact";
	try {
		if (framework === "preact" || framework === "react") {
			// Preact and React (preact-compat) use the same SSR path.
			const Component = componentModule.default as (props: Record<string, unknown>) => unknown;
			return { html: preactRenderToString(h(Component as any, props) as any), ssrFailed: false };
		}
		return await renderWithIntegration({
			framework,
			component: componentModule.default,
			props,
			islandMeta,
			componentId,
			modulePath,
			isDev,
		});
	} catch (err) {
		// If this is a combined island, SSR failure is recoverable — the client
		// hydration script will render the component.
		if (islandMeta && isDev) {
			return { html: "", ssrFailed: true };
		}
		const message = isDev && err instanceof Error ? `${err.message}\n${err.stack}` : "";
		console.error("[server-islands] Render error for", modulePath, err);
		return textResponse(message || "Internal Server Error", 500);
	}
}

/**
 * Renders a non-Preact island via its framework integration, appending any CSS
 * the integration extracts (or the build-time-embedded CSS fallback).
 */
async function renderWithIntegration(args: {
	framework: string;
	component: unknown;
	props: Record<string, unknown>;
	islandMeta?: IslandMetadata;
	componentId: string;
	modulePath: string;
	isDev: boolean;
}): Promise<RenderedIsland> {
	const { framework, component, props, islandMeta, componentId, modulePath, isDev } = args;
	const integration = await loadIntegration(framework);
	const renderResult = await integration.render({
		component,
		props,
		src: modulePath,
		condition: islandMeta?.condition ?? "on:client",
		ssrOnly: false,
		viteServer: undefined,
		isDev,
	});

	let html = renderResult.html;
	// Include CSS from the integration (Solid/Svelte extract styles separately).
	// Place after HTML to avoid hydration mismatch (Vue expects component root first).
	if (renderResult.css) {
		html = `${html}<style>${renderResult.css}</style>`;
	} else if (serverIslandCSS[componentId]) {
		// Fallback: use build-time-extracted CSS (Svelte's SSR render doesn't
		// return CSS in production, so we embed it at build time).
		html = `${html}<style>${serverIslandCSS[componentId]}</style>`;
	}

	// Capture framework hydration data (Solid needs renderId to match data-hk markers).
	const hydrationRenderId = renderResult.hydrationData?.renderId as string | undefined;
	return { html, ssrFailed: false, hydrationRenderId };
}

/**
 * Builds the per-island hydration script appended to a combined island's HTML.
 * Uses the integration-based dev helper in development and the per-island script
 * infrastructure in production.
 */
function buildHydrationScript(args: {
	componentId: string;
	islandMeta: IslandMetadata;
	modulePath: string;
	props: Record<string, unknown>;
	ssrFailed: boolean;
	hydrationRenderId?: string;
	isDev: boolean;
}): string {
	const { componentId, islandMeta, modulePath, props, ssrFailed, hydrationRenderId, isDev } = args;
	const islandId = islandMeta.elementId ?? `si-${componentId}`;
	const componentPath = islandMeta.componentSrc ?? modulePath;

	let propsJson: string;
	try {
		propsJson = JSON.stringify(props);
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Failed to serialize props for server island (componentId=${componentId}, ` +
				`module=${modulePath}, elementId=${islandId}): ${detail}`,
		);
	}

	if (isDev) {
		// Dev mode: use the integration-based hydration helper. It imports
		// loadIntegrationModule from the virtual module, so it works with all
		// frameworks (preact, solid, vue, etc.) using the same system as regular
		// island hydration. If SSR failed, force immediate hydration.
		const effectiveCondition = ssrFailed ? "on:client" : (islandMeta.condition ?? "on:client");
		const helperAbsPath = new URL("../client/server-island-hydrate.ts", import.meta.url).pathname;
		const fw = islandMeta.framework ?? "preact";
		const renderIdArg = hydrationRenderId ? JSON.stringify(hydrationRenderId) : "undefined";
		return `<script type="module">
import{hydrateServerIsland}from"/@fs${helperAbsPath}";
hydrateServerIsland(${JSON.stringify(islandId)},${JSON.stringify(componentPath)},${escapeJsonForScript(propsJson)},${JSON.stringify(effectiveCondition)},${JSON.stringify(fw)},${renderIdArg});
</script>`;
	}

	// Production: use the per-island script infrastructure.
	return generatePerIslandScript({
		islandId,
		componentSrc: componentPath,
		framework: islandMeta.framework,
		condition: islandMeta.condition,
		conditionArg: islandMeta.conditionArg,
		propsJson,
	});
}

/**
 * Extracts the componentId from the event's URL path.
 * Expects the path pattern: `/_server-islands/:componentId`
 */
function extractComponentId(event: H3Event): string | undefined {
	// Try event context params first (Nitro file-system routing)
	const params = event.context?.params;
	if (params?.componentId) {
		return params.componentId;
	}

	// Fallback: parse from the URL pathname
	const pathname = getEventPathname(event);
	const regex = /\/_server-islands\/([^/?]+)/;
	const match = regex.exec(pathname);
	return match?.[1];
}

/**
 * Gets the pathname from an H3Event, deriving from the request when needed
 * (avoids the deprecated `event.path`).
 */
function getEventPathname(event: H3Event): string {
	if (event.url) {
		return event.url.pathname;
	}
	const reqUrl = (event as any).req?.url as string | undefined;
	if (reqUrl) {
		return new URL(reqUrl, "http://localhost").pathname;
	}
	return "/";
}

/**
 * Gets the request method from an H3Event (avoids the deprecated `event.method`).
 */
function getEventMethod(event: H3Event): string {
	return (event as any).req?.method ?? "GET";
}

/**
 * Extracts the encrypted props payload from the request.
 * - GET: reads from the `p` query parameter
 * - POST: reads from the request body (text/plain)
 */
async function extractEncryptedProps(event: H3Event): Promise<string | undefined> {
	const method = getEventMethod(event).toUpperCase();

	if (method === "GET") {
		// Extract from query parameter `p`
		const searchParams = event.url ? event.url.searchParams : new URLSearchParams("");
		const p = searchParams.get("p");
		return p || undefined;
	}

	// POST: read body as text
	if (method === "POST") {
		// Use web standard Request if available on the event
		const webRequest = (event as any).web?.request as Request | undefined;
		if (webRequest) {
			return await webRequest.text();
		}

		// Fallback: read from node request stream
		if ((event as any).node?.req) {
			return await readNodeRequestBody((event as any).node.req);
		}

		// Last resort: check if body is already parsed
		if ((event as any)._body !== undefined) {
			return String((event as any)._body);
		}
	}

	return undefined;
}

/**
 * Reads the body from a Node.js IncomingMessage stream.
 */
function readNodeRequestBody(req: { on: Function; readable?: boolean }): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}
