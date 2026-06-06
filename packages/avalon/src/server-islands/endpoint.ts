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
import { generatePerIslandScript } from "../islands/per-island-script.ts";
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
const _loaders: Record<string, () => Promise<{ default: unknown }>> =
	(serverIslandLoaders as Record<string, () => Promise<{ default: unknown }>>) ?? {};

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

/**
 * Creates a Nitro-compatible event handler for the server islands endpoint.
 *
 * The handler:
 * 1. Extracts the componentId from the URL path
 * 2. Extracts encrypted props from query param (GET) or body (POST)
 * 3. Decrypts the props using AES-256-GCM
 * 4. Looks up the component module path from the manifest
 * 5. Dynamically imports the component
 * 6. Renders it with Preact's renderToString
 * 7. Returns HTML with appropriate headers
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
		// 1. Extract componentId from the URL path
		const componentId = extractComponentId(event);
		if (!componentId) {
			return new Response("Missing component ID", {
				status: 400,
				headers: { "Content-Type": "text/plain" },
			});
		}

		// 2. Extract encrypted props from query (GET) or body (POST)
		let encryptedProps: string | undefined;
		try {
			encryptedProps = await extractEncryptedProps(event);
		} catch {
			return new Response("Failed to read request body", {
				status: 400,
				headers: { "Content-Type": "text/plain" },
			});
		}

		if (!encryptedProps) {
			return new Response("Missing encrypted props", {
				status: 400,
				headers: { "Content-Type": "text/plain" },
			});
		}

		// 3. Decrypt props (or decode in dev mode)
		let props: Record<string, unknown>;
		let islandMeta: IslandMetadata | undefined;
		let srcPath: string | undefined;
		try {
			let decrypted: string;
			if (encryptedProps.startsWith("dev.")) {
				// Dev mode: base64url-encoded (no encryption)
				const encoded = encryptedProps.slice(4);
				decrypted = Buffer.from(encoded, "base64url").toString("utf8");
			} else {
				decrypted = decrypt(encryptedProps);
			}
			const parsed = JSON.parse(decrypted);
			// Extract island metadata if present (combined server + client island)
			if (parsed.__island) {
				islandMeta = parsed.__island as IslandMetadata;
				delete parsed.__island;
			}
			// Extract source path (used for dev-mode component loading)
			if (parsed.__src) {
				srcPath = parsed.__src as string;
				delete parsed.__src;
			}
			props = parsed;
		} catch {
			return new Response("Bad Request: decryption failed", {
				status: 400,
				headers: { "Content-Type": "text/plain" },
			});
		}

		// 4. Look up component in manifest (fall back to srcPath from encrypted payload)
		const modulePath = lookupComponent(componentId) ?? srcPath;
		if (!modulePath) {
			return new Response("Component not found", {
				status: 404,
				headers: { "Content-Type": "text/plain" },
			});
		}

		// 5. Dynamically import the component module
		let componentModule: { default?: unknown };
		try {
			const loaders = getLoaders();
			const loader = loaders[componentId];
			if (loader) {
				componentModule = await loader();
			} else {
				if (isDev) console.log("[server-islands] Loading component from:", modulePath);
				componentModule = await import(/* @vite-ignore */ modulePath);
			}
			if (!componentModule.default) {
				throw new TypeError(`Module "${modulePath}" does not have a default export`);
			}
		} catch (err) {
			// For combined islands, import failure is recoverable via client render
			if (islandMeta && isDev) {
				console.warn(
					"[server-islands] Component import failed (will render client-side):",
					modulePath,
					err instanceof Error ? err.message : err,
				);
				componentModule = { default: null };
			} else {
				const message = isDev && err instanceof Error ? err.message : "Component import failed";
				return new Response(message, {
					status: 500,
					headers: { "Content-Type": "text/plain" },
				});
			}
		}

		// 6. Render the component — use framework integration if available, preact as default
		let html: string;
		let ssrFailed = false;
		// Framework-specific hydration data (e.g., Solid's renderId for matching data-hk markers)
		let hydrationRenderId: string | undefined;
		const framework = islandMeta?.framework ?? "preact";

		if (componentModule.default) {
			try {
				if (framework === "preact" || framework === "react") {
					// Preact and React (preact-compat) use the same SSR path
					const Component = componentModule.default as (props: Record<string, unknown>) => unknown;
					const vnode = h(Component as any, props);
					html = preactRenderToString(vnode as any);
				} else {
					// Use the framework integration's render function (solid, vue, etc.)
					const integration = await loadIntegration(framework);
					const renderResult = await integration.render({
						component: componentModule.default,
						props,
						src: modulePath,
						condition: islandMeta?.condition ?? "on:client",
						ssrOnly: false,
						viteServer: undefined,
						isDev,
					});
					html = renderResult.html;
					// Capture framework hydration data (Solid needs renderId to match data-hk markers)
					const hd = renderResult.hydrationData;
					if (hd?.renderId) {
						hydrationRenderId = hd.renderId as string;
					}
					// Include CSS from the integration (Solid/Svelte extract styles separately)
					// Place after HTML to avoid hydration mismatch (Vue expects component root first)
					if (renderResult.css) {
						html = `${html}<style>${renderResult.css}</style>`;
					} else if (serverIslandCSS[componentId]) {
						// Fallback: use build-time-extracted CSS (Svelte's SSR render
						// doesn't return CSS in production, so we embed it at build time).
						html = `${html}<style>${serverIslandCSS[componentId]}</style>`;
					}
				}
			} catch (err) {
				// If this is a combined island, SSR failure is recoverable —
				// the client hydration script will render the component.
				if (islandMeta && isDev) {
					// SSR failed for combined island — client hydration will handle it
					html = "";
					ssrFailed = true;
				} else {
					const message = isDev && err instanceof Error ? `${err.message}\n${err.stack}` : "";
					console.error("[server-islands] Render error for", modulePath, err);
					return new Response(message || "Internal Server Error", {
						status: 500,
						headers: { "Content-Type": "text/plain" },
					});
				}
			}
		} else {
			// Import failed — skip SSR, let client render handle it
			html = "";
			ssrFailed = true;
		}

		// 7. If combined island, append per-island hydration script
		if (islandMeta) {
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
			// If SSR failed, force immediate hydration regardless of condition
			const effectiveCondition = ssrFailed ? "on:client" : (islandMeta.condition ?? "on:client");

			if (isDev) {
				// Dev mode: Use the integration-based hydration helper.
				// It imports loadIntegrationModule from the virtual module, so it works
				// with all frameworks (preact, solid, vue, etc.) using the same system
				// as regular island hydration.
				const helperAbsPath = new URL("../client/server-island-hydrate.ts", import.meta.url)
					.pathname;
				const fw = islandMeta.framework ?? "preact";
				const renderIdArg = hydrationRenderId ? JSON.stringify(hydrationRenderId) : "undefined";
				const hydrationScript = `<script type="module">
import{hydrateServerIsland}from"/@fs${helperAbsPath}";
hydrateServerIsland(${JSON.stringify(islandId)},${JSON.stringify(componentPath)},${propsJson},${JSON.stringify(effectiveCondition)},${JSON.stringify(fw)},${renderIdArg});
</script>`;
				html += hydrationScript;
			} else {
				// Production: use the per-island script infrastructure
				const hydrationScript = generatePerIslandScript({
					islandId,
					componentSrc: componentPath,
					framework: islandMeta.framework,
					condition: islandMeta.condition,
					conditionArg: islandMeta.conditionArg,
					propsJson,
				});
				html += hydrationScript;
			}
		}

		// 8. Return HTML with Cache-Control headers
		return new Response(html, {
			status: 200,
			headers: {
				"Content-Type": "text/html",
				"Cache-Control": defaultCacheControl,
			},
		});
	};
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
