/**
 * Nitro SSR Renderer Handler for Avalon
 *
 * This module provides the main SSR renderer for Nitro integration.
 * It handles page rendering using Avalon's existing SSR pipeline while
 * integrating with Nitro's h3 event handling system.
 *
 * The renderer acts as a catch-all handler for Nitro - it receives requests
 * that don't match any API routes or static files, and renders the appropriate
 * page using Avalon's SSR pipeline.
 *
 * Key design principle: This renderer relies on Nitro's built-in file-system
 * routing for route matching. Custom route matching logic has been removed
 * in favor of Nitro's native capabilities.
 *
 * Middleware Integration:
 * - Global middleware runs first (handled by Nitro's middleware/ directory)
 * - Route-scoped middleware runs after global middleware, before page rendering
 * - If global middleware terminates, route-scoped middleware does not run
 *
 * Custom Error Pages:
 * - Supports custom 404 page (src/pages/404.tsx)
 * - Supports custom 500 page (src/pages/500.tsx)
 * - Supports generic error page (src/pages/_error.tsx)
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.3, 9.1, 9.2, 9.3, 9.4, 10.5
 */

import type { H3Event } from "h3";
import { getRequestURL as h3GetRequestURL } from "h3";
import { h } from "preact";
import preactRenderToString from "preact-render-to-string";
import { inlineCriticalCSS } from "../islands/critical-css.ts";
import { injectModulepreloadLinks } from "../islands/modulepreload-collector.ts";
import { discoverScopedMiddleware, executeScopedMiddleware } from "../middleware/index.ts";
import type { MiddlewareRoute } from "../middleware/types.ts";
import {
	discoverErrorPages,
	type ErrorHandlerOptions,
	handleRenderError as handleRenderErrorWithCustomPages,
} from "./error-handler.ts";
import type {
	AvalonRuntimeConfig,
	HttpError,
	NitroRenderContext,
	PageModule,
	SSRRenderOptions,
	SSRRenderResult,
} from "./types.ts";
import { createNotFoundError, isHttpError } from "./types.ts";

/**
 * Resolved page route information
 */
export interface ResolvedPageRoute {
	/** File path to the page module */
	filePath: string;
	/** Route pattern that matched */
	pattern: string;
	/** Extracted route parameters */
	params: Record<string, string>;
	/** Layout files to apply (outermost first) */
	layouts?: string[];
}

/**
 * Render handler options
 *
 * Route resolution is handled by Nitro's file-system routing.
 * Custom resolvers are optional and primarily used for
 * development/testing scenarios.
 */
export interface RenderHandlerOptions {
	/** Avalon runtime configuration */
	avalonConfig: AvalonRuntimeConfig;
	/** Whether running in development mode */
	isDev?: boolean;
	/** Vite dev server URL for development */
	viteServerUrl?: string;
	/**
	 * Custom page resolver function (optional)
	 * In production, Nitro handles route resolution via file-system routing.
	 * This is primarily used for development with Vite's SSR module loading.
	 */
	resolvePageRoute?: (pathname: string, pagesDir: string) => Promise<ResolvedPageRoute | null>;
	/**
	 * Custom page module loader (optional)
	 * In production, modules are loaded from the build output.
	 * In development, Vite's ssrLoadModule is used.
	 */
	loadPageModule?: (filePath: string) => Promise<PageModule>;
	/** Custom layout resolver */
	resolveLayouts?: (routePath: string, config: AvalonRuntimeConfig) => Promise<string[]>;
	/**
	 * Wrap rendered page HTML with layout components.
	 *
	 * Called after the page component is rendered to HTML. The function
	 * receives the page HTML, page module, and render context, and should
	 * return the full HTML document string (including `<!DOCTYPE html>`).
	 *
	 * When provided, the renderer skips its default HTML shell generation
	 * and uses the returned string directly.
	 */
	wrapWithLayouts?: (
		pageHtml: string,
		pageModule: PageModule,
		context: NitroRenderContext,
	) => Promise<string> | string;
	/**
	 * Enable custom error pages (404.tsx, 500.tsx, _error.tsx)
	 * When enabled, the renderer will look for custom error pages in the pages directory
	 * Requirements: 10.5
	 */
	enableCustomErrorPages?: boolean;
}

/**
 * Creates a render context from an H3 event
 *
 * @param event - The H3 event from Nitro
 * @param params - Route parameters extracted from the URL
 * @returns NitroRenderContext for use in rendering
 */
export function createRenderContext(
	event: H3Event,
	params: Record<string, string> = {},
): NitroRenderContext {
	const url = getRequestURL(event);

	return {
		url,
		params,
		query: Object.fromEntries(url.searchParams),
		request: toRequest(event),
		event,
	};
}

/**
 * Creates a render context directly from a web Request.
 * Used by the `.fetch()` wrapper to avoid h3 event conversion issues
 * when Nitro's SSR dispatcher passes a plain Request.
 */
export function createRenderContextFromRequest(
	request: Request,
	params: Record<string, string> = {},
): NitroRenderContext {
	const url = new URL(request.url, "http://localhost");

	// Build a minimal event-like object that satisfies the H3Event interface
	// from types.ts without depending on h3's internal H3Event class.
	// Cast needed because the renderer imports h3's full H3Event type,
	// but at runtime only the minimal shape is accessed by downstream code.
	const event = {
		method: request.method,
		path: url.pathname + url.search,
		context: { params },
	} as unknown as H3Event;

	return {
		url,
		params,
		query: Object.fromEntries(url.searchParams),
		request,
		event,
	};
}

/**
 * Gets the request URL from an H3 event
 */
export function getRequestURL(event: H3Event): URL {
	// Use h3's getRequestURL for h3 v2 compatibility
	const protocol = "http";
	const host = "localhost";
	return new URL(h3GetRequestURL(event).pathname, `${protocol}://${host}`);
}

/**
 * Converts an H3 event to a standard Request object
 */
export function toRequest(event: H3Event): Request {
	const url = getRequestURL(event);
	return new Request(url, {
		method: event.req.method,
		headers: getRequestHeaders(event),
	});
}

/**
 * Gets request headers from an H3 event
 */
export function getRequestHeaders(_event: H3Event): Headers {
	const headers = new Headers();
	// In a real Nitro environment, headers would come from event.node.req.headers
	// This is a placeholder implementation
	return headers;
}

/**
 * Sets a response header on an H3 event
 */
export function setResponseHeader(event: H3Event, name: string, value: string): void {
	// In a real Nitro environment, this would use h3's setResponseHeader
	// Store in event context for now
	if (!event.context.responseHeaders) {
		event.context.responseHeaders = {};
	}
	(event.context.responseHeaders as Record<string, string>)[name] = value;
}

/**
 * Creates an error response
 */
export function createErrorResponse(error: Error | HttpError, isDev: boolean): Response {
	const statusCode = isHttpError(error) ? error.statusCode : 500;

	if (isDev) {
		// Development: include full error details
		const errorHtml = generateDevErrorPage(error, statusCode);
		return new Response(errorHtml, {
			status: statusCode,
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	}

	// Production: generic error page
	const errorHtml = generateProdErrorPage(statusCode);
	return new Response(errorHtml, {
		status: statusCode,
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}

/**
 * Generates a development error page with full details
 */
function generateDevErrorPage(error: Error, statusCode: number): string {
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Error ${statusCode}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        padding: 40px;
        background: #1a1a1a;
        color: #fff;
      }
      .error-container {
        max-width: 800px;
        margin: 0 auto;
        background: #2d2d2d;
        padding: 40px;
        border-radius: 8px;
        border-left: 4px solid #ff6b6b;
      }
      h1 {
        color: #ff6b6b;
        margin-top: 0;
        font-size: 24px;
      }
      .status-code {
        font-size: 48px;
        font-weight: bold;
        color: #ff6b6b;
        margin-bottom: 10px;
      }
      .message {
        font-size: 18px;
        color: #ccc;
        margin-bottom: 20px;
      }
      pre {
        background: #1a1a1a;
        padding: 20px;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 14px;
        line-height: 1.5;
        color: #e0e0e0;
      }
      .stack-title {
        color: #888;
        font-size: 12px;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <div class="status-code">${statusCode}</div>
      <h1>${getStatusText(statusCode)}</h1>
      <p class="message">${escapeHtml(error.message)}</p>
      ${
				error.stack
					? `
      <div class="stack-title">Stack Trace</div>
      <pre>${escapeHtml(error.stack)}</pre>
      `
					: ""
			}
    </div>
  </body>
</html>`;
}

/**
 * Generates a production error page without sensitive details
 */
function generateProdErrorPage(statusCode: number): string {
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Error ${statusCode}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        padding: 40px;
        background: #f5f5f5;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        box-sizing: border-box;
      }
      .error-container {
        text-align: center;
        max-width: 400px;
      }
      .status-code {
        font-size: 72px;
        font-weight: bold;
        color: #333;
        margin-bottom: 10px;
      }
      h1 {
        color: #666;
        font-size: 24px;
        margin: 0 0 20px 0;
      }
      p {
        color: #888;
        margin: 0;
      }
      a {
        color: #0066cc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <div class="status-code">${statusCode}</div>
      <h1>${getStatusText(statusCode)}</h1>
      <p><a href="/">Return to home</a></p>
    </div>
  </body>
</html>`;
}

/**
 * Gets the status text for an HTTP status code
 */
function getStatusText(statusCode: number): string {
	const statusTexts: Record<number, string> = {
		400: "Bad Request",
		401: "Unauthorized",
		403: "Forbidden",
		404: "Page Not Found",
		405: "Method Not Allowed",
		500: "Internal Server Error",
		502: "Bad Gateway",
		503: "Service Unavailable",
	};
	return statusTexts[statusCode] || "Error";
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(str: string): string {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

/**
 * Island hydration marker information
 */
export interface IslandMarker {
	/** Framework identifier (react, vue, svelte, etc.) */
	framework: string;
	/** Source path to the island module */
	src: string;
	/** Serialized props for the island */
	props?: string;
	/** Hydration strategy (load, idle, visible, media) */
	hydrate?: string;
}

/**
 * Extracts island markers from HTML
 * Requirements: 9.1, 9.2, 9.3
 *
 * @param html - The rendered HTML string
 * @returns Array of island markers found in the HTML
 */
export function extractIslandMarkers(html: string): IslandMarker[] {
	const markers: IslandMarker[] = [];

	// Match island elements with data-framework attribute
	const islandRegex = /<[^>]*data-framework="([^"]+)"[^>]*>/g;
	let match: RegExpExecArray | null = islandRegex.exec(html);

	while (match !== null) {
		const fullMatch = match[0];
		const framework = match[1];

		// Extract data-src
		const srcMatch = /data-src="([^"]+)"/.exec(fullMatch);
		const src = srcMatch ? srcMatch[1] : "";

		// Extract data-props
		const propsMatch = /data-props="([^"]*)"/.exec(fullMatch);
		const props = propsMatch ? propsMatch[1] : undefined;

		// Extract data-hydrate (hydration strategy)
		const hydrateMatch = /data-hydrate="([^"]+)"/.exec(fullMatch);
		const hydrate = hydrateMatch ? hydrateMatch[1] : undefined;

		markers.push({
			framework,
			src,
			props,
			hydrate,
		});

		match = islandRegex.exec(html);
	}

	return markers;
}

/**
 * Ensures all required hydration markers are present on an island element
 * Requirements: 9.1, 9.2, 9.3
 *
 * @param element - The island element HTML string
 * @param marker - The island marker data to ensure
 * @returns The element with all required markers
 */
export function ensureHydrationMarkers(element: string, marker: Partial<IslandMarker>): string {
	let result = element;

	// Ensure data-framework is present
	if (marker.framework && !result.includes("data-framework=")) {
		result = result.replace(/>/, ` data-framework="${marker.framework}">`);
	}

	// Ensure data-src is present
	if (marker.src && !result.includes("data-src=")) {
		result = result.replace(/>/, ` data-src="${marker.src}">`);
	}

	// Ensure data-props is present (even if empty)
	if (marker.props !== undefined && !result.includes("data-props=")) {
		result = result.replace(/>/, ` data-props="${marker.props}">`);
	}

	return result;
}

/**
 * Unwrap per-island script wrappers from the HTML.
 *
 * During SSR, per-island scripts are wrapped in `<div data-island-script>`
 * because Preact's `h()` needs a real element for `dangerouslySetInnerHTML`.
 * This function strips those wrappers, leaving just the bare `<script type="module">`
 * tags inline.
 */
function unwrapPerIslandScripts(html: string): string {
	// Strip the wrapper <div data-island-script> around per-island <script> tags,
	// leaving just the <script> elements in the HTML output.
	return html.replaceAll(
		/<div[^>]*\bdata-island-script\b[^>]*>(<script[\s\S]*?<\/script>)<\/div>/g,
		"$1",
	);
}

/**
 * Injects the client hydration script into HTML
 * Requirements: 2.6, 9.4
 *
 * This function:
 * 1. Checks if there are islands that need hydration
 * 2. Injects the client script before </body> if not already present
 * 3. Supports both development and production script paths
 *
 * @param html - The rendered HTML string
 * @param isDev - Whether running in development mode
 * @param options - Additional injection options
 * @returns HTML with hydration script injected
 */
export function injectHydrationScript(
	html: string,
	isDev: boolean,
	options: {
		/** Custom script path override */
		scriptPath?: string;
		/** Additional scripts to inject */
		additionalScripts?: string[];
		/** Whether to force injection even without islands */
		forceInject?: boolean;
	} = {},
): string {
	// In per-island mode, each island has its own inline script — no shared runtime needed.
	// We still need to process the per-island script wrappers though.
	// The globalThis flag may not be set in the Nitro SSR runtime (separate JS realm),
	// so we also check !isDev — production always uses per-island mode.
	const isPerIsland = globalThis.__avalonHydrationMode === "per-island" || !isDev;
	if (isPerIsland) {
		return unwrapPerIslandScripts(html);
	}

	// Check if there are any islands that need hydration
	const hasIslands = html.includes("data-framework=") || html.includes("data-src=");

	if (!hasIslands && !options.forceInject) {
		// No islands found, no need to inject hydration script
		return html;
	}

	// Check if the client script is already included
	// In production, injectAssets adds the hashed entry script (e.g., /assets/entry-client-BqxPAKgE.js)
	// so we also check for any module script in the closing body area
	const existingScripts = [
		"/src/client/main.js",
		"/dist/client.js",
		"client/main.js",
		"entry-client",
	];

	if (existingScripts.some((script) => html.includes(script))) {
		return html;
	}

	// Determine the script path based on environment or override
	const scriptPath = options.scriptPath || (isDev ? "/src/client/main.js" : "/dist/client.js");

	// Build the script tags
	const scripts: string[] = [];

	// Main hydration script
	scripts.push(`<script type="module" src="${scriptPath}"></script>`);

	// Additional scripts if provided
	if (options.additionalScripts) {
		scripts.push(...options.additionalScripts);
	}

	const scriptBlock = scripts.join("\n");

	// Inject before closing </body> tag
	if (html.includes("</body>")) {
		return html.replace("</body>", `${scriptBlock}\n</body>`);
	}

	// Fallback: append to the end
	return html + scriptBlock;
}

/**
 * Validates that hydration markers are present in the HTML
 * Requirements: 2.3, 9.1, 9.2, 9.3
 *
 * @param html - The rendered HTML string
 * @returns Object with validation results
 */
export function validateHydrationMarkers(html: string): {
	hasFrameworkAttr: boolean;
	hasSrcAttr: boolean;
	hasPropsAttr: boolean;
	islandCount: number;
	islands: IslandMarker[];
	hasClientScript: boolean;
	isValid: boolean;
} {
	// Extract all island markers
	const islands = extractIslandMarkers(html);

	// Count islands with each attribute type
	const frameworkMatches = html.match(/data-framework="[^"]+"/g) || [];
	const srcMatches = html.match(/data-src="[^"]+"/g) || [];
	const propsMatches = html.match(/data-props="[^"]*"/g) || [];

	// Check for client script
	const hasClientScript =
		html.includes("/src/client/main.js") ||
		html.includes("/dist/client.js") ||
		html.includes("client/main.js");

	// Validation: all islands should have framework and src attributes
	const allIslandsValid = islands.every((island) => island.framework && island.src);

	// Overall validity: if there are islands, they should be valid and have client script
	const isValid = islands.length === 0 || (allIslandsValid && hasClientScript);

	return {
		hasFrameworkAttr: frameworkMatches.length > 0,
		hasSrcAttr: srcMatches.length > 0,
		hasPropsAttr: propsMatches.length > 0,
		islandCount: frameworkMatches.length,
		islands,
		hasClientScript,
		isValid,
	};
}

/**
 * Processes HTML to ensure all hydration requirements are met
 * Requirements: 2.3, 2.6, 9.1, 9.2, 9.3, 9.4
 *
 * This is a convenience function that:
 * 1. Validates existing hydration markers
 * 2. Injects the client script if needed
 * 3. Returns the processed HTML
 *
 * @param html - The rendered HTML string
 * @param isDev - Whether running in development mode
 * @returns Processed HTML with all hydration requirements met
 */
export function processHydrationRequirements(
	html: string,
	isDev: boolean,
): {
	html: string;
	validation: ReturnType<typeof validateHydrationMarkers>;
} {
	// First, inject the hydration script
	const processedHtml = injectHydrationScript(html, isDev);

	// Then validate the result
	const validation = validateHydrationMarkers(processedHtml);

	return {
		html: processedHtml,
		validation,
	};
}

/**
 * Renders a page to HTML string (non-streaming)
 * Requirements: 2.1, 2.2
 *
 * @param pageModule - The page module to render
 * @param context - The render context
 * @param options - Render options
 * @returns SSR render result
 */
export async function renderPage(
	pageModule: PageModule,
	context: NitroRenderContext,
	options: SSRRenderOptions = {},
	wrapWithLayouts?: RenderHandlerOptions["wrapWithLayouts"],
): Promise<SSRRenderResult> {
	try {
		// Get page props if getServerSideProps is defined
		let pageProps: Record<string, unknown> = {};
		if (pageModule.getServerSideProps) {
			pageProps = await pageModule.getServerSideProps(context);
		}

		// The actual rendering would integrate with Avalon's existing renderToHtml
		// For now, we return a placeholder that shows the structure
		const html = await renderPageComponent(
			pageModule,
			pageProps,
			context,
			options,
			wrapWithLayouts,
		);

		return {
			html,
			statusCode: 200,
			headers: {
				"Content-Type": "text/html; charset=utf-8",
			},
		};
	} catch (error) {
		console.error("[SSR Error]", error);

		if (options.onError && error instanceof Error) {
			options.onError(error);
		}

		throw error;
	}
}

/**
 * Renders a page component to HTML
 * Uses Preact SSR to render the actual component content.
 */
async function renderPageComponent(
	pageModule: PageModule,
	pageProps: Record<string, unknown>,
	context: NitroRenderContext,
	_options: SSRRenderOptions,
	wrapWithLayouts?: RenderHandlerOptions["wrapWithLayouts"],
): Promise<string> {
	const Component = pageModule.default as (props?: Record<string, unknown>) => unknown;
	const metadata = pageModule.metadata || {};
	const isDev = process.env.NODE_ENV !== "production";

	// Call the page component (supports async components)
	let vnode: unknown;
	try {
		const result = Component(pageProps);
		vnode = result instanceof Promise ? await result : result;
	} catch (err) {
		console.error("[renderer] Error calling page component:", err);
		vnode = h("div", null, "Error rendering page");
	}

	// Render the vnode to HTML string using Preact SSR
	let pageHtml: string;
	try {
		// biome-ignore lint/suspicious/noExplicitAny: preactRenderToString accepts VNode which is untyped here
		pageHtml = preactRenderToString(vnode as any);
	} catch (err) {
		console.error("[renderer] Error in preactRenderToString:", err);
		pageHtml = "<div>Error rendering page</div>";
	}

	// If a layout wrapper is provided, delegate full HTML generation to it
	if (wrapWithLayouts) {
		return await wrapWithLayouts(pageHtml, pageModule, context);
	}

	// In production, don't inject a script tag — the build pipeline handles client assets.
	// In dev, inject the Vite-served client entry.
	const clientScript = isDev
		? '\n    <script type="module" src="/src/client/main.js"></script>'
		: "";

	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(String(metadata.title || "Avalon App"))}</title>
    ${metadata.description ? `<meta name="description" content="${escapeHtml(String(metadata.description))}">` : ""}
  </head>
  <body>
    <div id="app">
      ${pageHtml}
    </div>${clientScript}
  </body>
</html>`;
}

/**
 * Streaming render state for tracking progress
 */
interface StreamingRenderState {
	shellSent: boolean;
	contentSent: boolean;
	closed: boolean;
	error: Error | null;
}

/**
 * Extended streaming options with additional callbacks
 */
export interface StreamingSSROptions extends SSRRenderOptions {
	/** Callback when shell rendering fails before streaming starts */
	onShellError?: (error: Error) => void;
	/** Timeout for shell ready in milliseconds */
	shellReadyTimeout?: number;
	/** Timeout for all content ready in milliseconds */
	allReadyTimeout?: number;
}

/**
 * Renders a page to a streaming response
 * Requirements: 2.4
 *
 * This function implements streaming SSR with proper shell/content separation:
 * 1. Shell (DOCTYPE, html, head, body opening) is sent first
 * 2. onShellReady callback is invoked when shell is ready
 * 3. Page content is streamed progressively
 * 4. onAllReady callback is invoked when all content is complete
 *
 * @param pageModule - The page module to render
 * @param context - The render context
 * @param options - Render options including streaming callbacks
 * @returns ReadableStream of HTML chunks
 */
export async function renderPageStream(
	pageModule: PageModule,
	context: NitroRenderContext,
	options: StreamingSSROptions = {},
): Promise<ReadableStream<Uint8Array>> {
	const encoder = new TextEncoder();
	let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

	const state: StreamingRenderState = {
		shellSent: false,
		contentSent: false,
		closed: false,
		error: null,
	};

	// Set up timeouts if specified
	const shellTimeout = options.shellReadyTimeout;
	const allReadyTimeout = options.allReadyTimeout;
	let shellTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let allReadyTimeoutId: ReturnType<typeof setTimeout> | null = null;

	const clearTimeouts = () => {
		if (shellTimeoutId) {
			clearTimeout(shellTimeoutId);
			shellTimeoutId = null;
		}
		if (allReadyTimeoutId) {
			clearTimeout(allReadyTimeoutId);
			allReadyTimeoutId = null;
		}
	};

	function handleStreamError(
		err: Error,
		isShellError: boolean,
		state: StreamingRenderState,
		ctrl: ReadableStreamDefaultController<Uint8Array> | null,
		encoder: TextEncoder,
		clearFn: () => void,
		opts: StreamingSSROptions,
	) {
		state.error = err;
		clearFn();

		console.error("[Streaming Error]", {
			message: err.message,
			stack: err.stack,
			shellSent: state.shellSent,
			isShellError,
			timestamp: new Date().toISOString(),
		});

		// Call appropriate error callback
		if (isShellError && opts.onShellError) {
			opts.onShellError(err);
		}
		if (opts.onError) {
			opts.onError(err);
		}

		if (!state.closed && ctrl) {
			if (state.shellSent) {
				// Inject error boundary into the stream
				const errorBoundary = generateStreamingErrorBoundary(err);
				ctrl.enqueue(encoder.encode(errorBoundary));

				// Close the HTML document gracefully
				const footer = generateStreamingFooter();
				ctrl.enqueue(encoder.encode(footer));
			} else {
				// Send complete error page if shell hasn't been sent
				const errorHtml = generateDevErrorPage(err, 500);
				ctrl.enqueue(encoder.encode(errorHtml));
			}

			state.closed = true;
			ctrl.close();
		}
	}

	async function executeStreamingRender(ctrl: ReadableStreamDefaultController<Uint8Array>) {
		controller = ctrl;

		// Get page props if getServerSideProps is defined
		let pageProps: Record<string, unknown> = {};
		if (pageModule.getServerSideProps) {
			pageProps = await pageModule.getServerSideProps(context);
		}

		const metadata = pageModule.metadata || {};

		// Generate the shell (DOCTYPE, html, head, body opening)
		const shell = generateStreamingShell(metadata, context);

		// Send the shell
		if (!state.closed) {
			ctrl.enqueue(encoder.encode(shell));
			state.shellSent = true;

			// Clear shell timeout
			if (shellTimeoutId) {
				clearTimeout(shellTimeoutId);
				shellTimeoutId = null;
			}

			// Notify that shell is ready
			if (options.onShellReady) {
				options.onShellReady();
			}
		}

		// Set up all ready timeout
		if (allReadyTimeout && allReadyTimeout > 0) {
			allReadyTimeoutId = setTimeout(() => {
				if (!state.contentSent && !state.closed) {
					const timeoutError = new Error(`All ready timeout after ${allReadyTimeout}ms`);
					handleStreamError(
						timeoutError,
						false,
						state,
						controller,
						encoder,
						clearTimeouts,
						options,
					);
				}
			}, allReadyTimeout);
		}

		// Send the page content
		if (!state.closed) {
			// Resolve async components before rendering
			const Component = pageModule.default as
				| ((props?: Record<string, unknown>) => unknown)
				| undefined;
			if (Component && typeof Component === "function") {
				const result = Component(pageProps);
				if (result && typeof (result as Promise<unknown>).then === "function") {
					// Async component — await it, then render the resolved vnode
					try {
						const resolved = await (result as Promise<unknown>);
						// biome-ignore lint/suspicious/noExplicitAny: preactRenderToString accepts VNode which is untyped here
						const pageHtml = preactRenderToString(resolved as any);
						ctrl.enqueue(encoder.encode(`    <div id="app">${pageHtml}</div>\n`));
					} catch (err) {
						console.error("[streaming] Async component error:", err);
						const content = generateStreamingContent(pageModule, pageProps);
						ctrl.enqueue(encoder.encode(content));
					}
				} else {
					const content = generateStreamingContent(pageModule, pageProps);
					ctrl.enqueue(encoder.encode(content));
				}
			} else {
				const content = generateStreamingContent(pageModule, pageProps);
				ctrl.enqueue(encoder.encode(content));
			}
			state.contentSent = true;
		}

		// Send the footer (closing body and html tags)
		if (!state.closed) {
			const footer = generateStreamingFooter();
			ctrl.enqueue(encoder.encode(footer));
		}

		// Clear all ready timeout
		clearTimeouts();

		// Notify that all content is ready
		if (options.onAllReady && !state.closed) {
			options.onAllReady();
		}

		if (!state.closed) {
			state.closed = true;
			ctrl.close();
		}
	}

	const stream = new ReadableStream<Uint8Array>({
		async start(ctrl) {
			controller = ctrl;

			// Set up shell timeout
			if (shellTimeout && shellTimeout > 0) {
				shellTimeoutId = setTimeout(() => {
					if (!state.shellSent && !state.closed) {
						const timeoutError = new Error(`Shell ready timeout after ${shellTimeout}ms`);
						handleStreamError(
							timeoutError,
							true,
							state,
							controller,
							encoder,
							clearTimeouts,
							options,
						);
					}
				}, shellTimeout);
			}

			try {
				await executeStreamingRender(ctrl);
			} catch (error) {
				handleStreamError(
					error instanceof Error ? error : new Error(String(error)),
					!state.shellSent,
					state,
					controller,
					encoder,
					clearTimeouts,
					options,
				);
			}
		},

		cancel() {
			clearTimeouts();
			if (!state.closed && controller) {
				state.closed = true;
				try {
					controller.close();
				} catch {
					// Already closed
				}
			}
		},
	});

	return stream;
}

/**
 * Generates the streaming shell (DOCTYPE, html, head, body opening)
 */
function generateStreamingShell(
	metadata: { title?: string; description?: string },
	_context: NitroRenderContext,
): string {
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(String(metadata.title || "Avalon App"))}</title>
    ${metadata.description ? `<meta name="description" content="${escapeHtml(String(metadata.description))}">` : ""}
  </head>
  <body>
`;
}

/**
 * Generates the streaming content by actually rendering the page component.
 * Falls back to a data-attribute placeholder only if rendering fails.
 */
function generateStreamingContent(
	pageModule: PageModule,
	pageProps: Record<string, unknown>,
): string {
	const Component = pageModule.default as
		| ((props?: Record<string, unknown>) => unknown)
		| undefined;

	if (Component && typeof Component === "function") {
		try {
			const result = Component(pageProps);
			// Handle async components — resolve the promise synchronously isn't possible
			// in streaming we need to handle this. For now if it's a promise, fall through
			// to the placeholder. The executeStreamingRender caller should await it.
			if (result && typeof (result as Promise<unknown>).then === "function") {
				// Can't await here (sync function). The async path is handled in
				// executeStreamingRender which should be updated to await the component.
				// For now render what we can.
				const componentName = Component.name || "Page";
				return `    <div id="app" data-page="${escapeHtml(String(componentName))}" data-props='${escapeHtml(JSON.stringify(pageProps))}'>
      <!-- Async component — awaiting hydration -->
    </div>\n`;
			}
			// biome-ignore lint/suspicious/noExplicitAny: preactRenderToString accepts VNode which is untyped here
			const pageHtml = preactRenderToString(result as any);
			return `    <div id="app">${pageHtml}</div>\n`;
		} catch (err) {
			console.error("[streaming] Error rendering page component:", err);
		}
	}

	// Fallback
	const componentName = (pageModule.default as { name?: string })?.name || "Page";
	return `    <div id="app" data-page="${escapeHtml(String(componentName))}" data-props='${escapeHtml(JSON.stringify(pageProps))}'>
      <!-- Component render fallback -->
    </div>\n`;
}

/**
 * Generates the streaming footer (closing body and html tags)
 */
function generateStreamingFooter(): string {
	return `  </body>
</html>`;
}

/**
 * Generates an error boundary for mid-stream errors
 */
function generateStreamingErrorBoundary(error: Error): string {
	const isDev = process.env.NODE_ENV !== "production";

	const stackHtml = error.stack
		? `<pre style="
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
            margin-top: 10px;
          ">${escapeHtml(error.stack)}</pre>`
		: "";

	return `
    <div class="streaming-error-boundary" data-error-boundary="true" style="
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <span style="font-size: 24px;">⚠️</span>
        <h3 style="margin: 0; color: #856404;">Streaming Error</h3>
      </div>
      <p style="margin: 10px 0; color: #856404;">
        An error occurred while streaming this page.
      </p>
      ${
				isDev
					? `
      <details style="margin-top: 15px;">
        <summary style="cursor: pointer; color: #856404; font-weight: bold;">
          Error Details (Development Mode)
        </summary>
        <div style="margin-top: 10px;">
          <p><strong>Error:</strong> ${escapeHtml(error.message)}</p>
          ${stackHtml}
        </div>
      </details>
      `
					: ""
			}
    </div>
`;
}

/**
 * Creates a streaming response with proper headers
 * Requirements: 2.4
 *
 * @param stream - The ReadableStream to wrap
 * @param options - Additional response options
 * @returns Response object with streaming body
 */
export function createStreamingResponse(
	stream: ReadableStream<Uint8Array>,
	options: {
		status?: number;
		headers?: Record<string, string>;
	} = {},
): Response {
	const headers = new Headers({
		"Content-Type": "text/html; charset=utf-8",
		"Transfer-Encoding": "chunked",
		...options.headers,
	});

	return new Response(stream, {
		status: options.status || 200,
		headers,
	});
}

/**
 * Creates a scoped middleware getter that discovers and caches middleware routes.
 * Shared between createNitroRenderer and createNitroCatchAllRenderer.
 */
function createScopedMiddlewareGetter(
	routesRef: { value: MiddlewareRoute[] | null },
	srcDir: string,
	isDev: boolean,
): () => Promise<MiddlewareRoute[]> {
	return async () => {
		routesRef.value ??= await discoverScopedMiddleware({
			baseDir: srcDir,
			devMode: isDev,
		});
		return routesRef.value;
	};
}

/**
 * Creates an error handler with custom error page support.
 * Shared between createNitroRenderer and createNitroCatchAllRenderer.
 */
function createErrorHandler(
	enableCustomErrorPages: boolean,
	errorHandlerOptions: ErrorHandlerOptions,
	isDev: boolean,
): (error: Error | HttpError, event: H3Event) => Promise<Response> {
	return async (error, event) => {
		if (enableCustomErrorPages) {
			return handleRenderErrorWithCustomPages(error, event, errorHandlerOptions);
		}
		return createErrorResponse(error, isDev);
	};
}

/**
 * Creates the main Nitro renderer handler
 *
 * This is the catch-all handler for Nitro that renders pages not matched
 * by API routes or static files. It integrates with Nitro's routing system:
 *
 * 1. Nitro's file-system routing handles API routes (api/ directory)
 * 2. Nitro's static asset handling serves files from public/
 * 3. This renderer catches all remaining requests for SSR page rendering
 *
 * Middleware execution order:
 * 1. Global middleware (from middleware/ directory) - handled by Nitro
 * 2. Route-scoped middleware (from _middleware.ts files) - handled here
 * 3. Page rendering
 *
 * If global middleware terminates the chain, this handler is not called.
 * If route-scoped middleware terminates, page rendering is skipped.
 *
 * The renderer relies on Nitro's event context for route information when
 * available, falling back to pathname-based resolution for development.
 *
 * Requirements: 2.1, 2.2, 2.4, 5.1, 5.3, 10.5
 *
 * @param options - Render handler options
 * @returns Handler function for Nitro
 */
export function createNitroRenderer(options: RenderHandlerOptions) {
	const { avalonConfig, isDev = false, enableCustomErrorPages = true } = options;

	// Middleware routes cache - discovered once at startup
	const scopedMiddlewareRoutes: MiddlewareRoute[] | null = null;

	// Error handler options for custom error pages
	const errorHandlerOptions: ErrorHandlerOptions = {
		isDev,
		avalonConfig,
		loadPageModule: options.loadPageModule,
		pagesDir: avalonConfig.pagesDir,
	};

	// Pre-discover error pages if custom error pages are enabled
	if (enableCustomErrorPages) {
		discoverErrorPages(errorHandlerOptions).catch((err) => {
			console.warn("[renderer] Failed to discover error pages:", err);
		});
	}

	/**
	 * Gets scoped middleware routes, discovering them on first call
	 * Routes are cached for performance in production
	 */
	const middlewareRef = { value: scopedMiddlewareRoutes };
	const getScopedMiddleware = createScopedMiddlewareGetter(
		middlewareRef,
		avalonConfig.srcDir || "src",
		isDev,
	);

	/**
	 * Handles errors with custom error page support
	 */
	const handleError = createErrorHandler(enableCustomErrorPages, errorHandlerOptions, isDev);

	async function nitroRendererHandler(event: H3Event): Promise<Response> {
		const url = getRequestURL(event);
		const pathname = url.pathname;

		// Skip server islands requests — handled by the dedicated handler
		if (pathname.startsWith("/_server-islands/")) {
			return new Response("Not handled by renderer", { status: 404 });
		}

		try {
			// Execute route-scoped middleware before page rendering
			// Global middleware has already run (handled by Nitro's middleware/ directory)
			// Requirements: 5.1, 5.3
			const middlewareRoutes = await getScopedMiddleware();
			const middlewareResponse = await executeScopedMiddleware(event, middlewareRoutes, {
				devMode: isDev,
			});

			// If middleware returned a response, use it and skip page rendering
			if (middlewareResponse) {
				if (isDev) {
					console.log(`[renderer] Middleware terminated request for ${pathname}`);
				}
				return middlewareResponse;
			}

			// Check if Nitro has already resolved route information in the event context
			// This happens when Nitro's file-system routing has matched a route
			const nitroRouteContext = event.context.route as ResolvedPageRoute | undefined;

			let route: ResolvedPageRoute | null = null;

			if (nitroRouteContext) {
				// Use Nitro's resolved route information
				route = nitroRouteContext;
			} else {
				// Fall back to custom resolution (primarily for development)
				// In production with Nitro, this path is rarely taken as Nitro
				// handles route resolution before reaching the catch-all renderer
				route = options.resolvePageRoute
					? await options.resolvePageRoute(pathname, avalonConfig.pagesDir)
					: await defaultResolvePageRoute(pathname, avalonConfig.pagesDir);
			}

			if (!route) {
				// No page found, return 404 with custom error page support
				const error = createNotFoundError(`Page not found: ${pathname}`);
				return handleError(error, event);
			}

			// Load the page module
			const pageModule = options.loadPageModule
				? await options.loadPageModule(route.filePath)
				: await defaultLoadPageModule(route.filePath);

			// Create render context with route params from Nitro or custom resolution
			// Nitro provides params via event.context.params when using its routing
			const routeParams = (event.context.params as Record<string, string>) || route.params;
			const renderContext = createRenderContext(event, routeParams);

			// Resolve layouts if available
			if (options.resolveLayouts) {
				const layouts = await options.resolveLayouts(pathname, avalonConfig);
				renderContext.layoutContext = { layouts };
			}

			// Render the page.
			// When wrapWithLayouts is provided, use buffered rendering so
			// layouts can wrap the page HTML. Streaming bypasses layouts
			// because it emits the HTML shell before the page is rendered.
			const useStreaming = avalonConfig.streaming && !options.wrapWithLayouts;

			if (useStreaming) {
				// Streaming SSR (no layout wrapping)
				const stream = await renderPageStream(pageModule, renderContext, {
					onShellReady: () => {
						setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
					},
				});

				return new Response(stream, {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			} else {
				// Buffered SSR with layout wrapping
				const result = await renderPage(pageModule, renderContext, {}, options.wrapWithLayouts);

				// Inject hydration script
				let html = injectHydrationScript(result.html as string, isDev);

				// Inline critical CSS and defer non-critical stylesheets
				html = inlineCriticalCSS(html);

				// Inject modulepreload links for above-the-fold island chunks
				html = injectModulepreloadLinks(html);

				return new Response(html, {
					status: result.statusCode,
					headers: result.headers,
				});
			}
		} catch (error) {
			console.error("[Nitro Renderer Error]", error);

			const err = error instanceof Error ? error : new Error(String(error));
			return handleError(err, event);
		}
	}

	// Return a srvx-compatible server object.
	// Nitro's internal SSR dispatcher (ssr-renderer) calls
	// `__nitro_vite_envs__["ssr"].fetch(request)` which expects
	// the SSR entry's default export to have a `.fetch()` method
	// that accepts a web Request and returns a Response.
	//
	// Instead of converting Request → H3Event (which breaks because
	// the bundled h3 has a different H3Event class than the npm package),
	// we render directly from the Request, bypassing h3 entirely.
	const handler = Object.assign(nitroRendererHandler, {
		async fetch(request: Request): Promise<Response> {
			const url = new URL(request.url, "http://localhost");
			const pathname = url.pathname;

			// Skip server islands requests — handled by the dedicated handler
			if (pathname.startsWith("/_server-islands/")) {
				return new Response("Not handled by renderer", { status: 404 });
			}

			try {
				// Resolve the page route
				let route: ResolvedPageRoute | null = null;
				route = options.resolvePageRoute
					? await options.resolvePageRoute(pathname, avalonConfig.pagesDir)
					: await defaultResolvePageRoute(pathname, avalonConfig.pagesDir);

				if (!route) {
					return createErrorResponse(createNotFoundError(`Page not found: ${pathname}`), isDev);
				}

				// Load the page module
				const pageModule = options.loadPageModule
					? await options.loadPageModule(route.filePath)
					: await defaultLoadPageModule(route.filePath);

				// Create render context directly from the Request
				const renderContext = createRenderContextFromRequest(request, route.params);

				// Render the page (non-streaming for prerender/fetch path)
				const result = await renderPage(pageModule, renderContext, {}, options.wrapWithLayouts);
				let html = injectHydrationScript(result.html as string, isDev);

				// Inline critical CSS and defer non-critical stylesheets
				html = inlineCriticalCSS(html);

				// Inject modulepreload links for above-the-fold island chunks
				html = injectModulepreloadLinks(html);

				return new Response(html, {
					status: result.statusCode,
					headers: result.headers,
				});
			} catch (error) {
				console.error("[Nitro Renderer .fetch() Error]", error);
				const err = error instanceof Error ? error : new Error(String(error));
				return createErrorResponse(err, isDev);
			}
		},
	});

	return handler;
}

/**
 * Default page route resolver
 *
 * This is a fallback resolver used primarily in development when Nitro's
 * file-system routing hasn't resolved the route. In production with Nitro,
 * route resolution is handled by Nitro's native routing system.
 *
 * The resolver converts URL pathnames to potential file paths in the pages
 * directory. It's intentionally simple as the heavy lifting of route matching
 * is delegated to Nitro's routing system.
 *
 * @param pathname - URL pathname to resolve
 * @param _pagesDir - Pages directory (unused, kept for interface compatibility)
 * @returns Resolved page route or null if not found
 */
async function defaultResolvePageRoute(
	pathname: string,
	_pagesDir: string,
): Promise<ResolvedPageRoute | null> {
	// Handle root path
	if (pathname === "/" || pathname === "") {
		return {
			filePath: "src/pages/index.tsx",
			pattern: "/",
			params: {},
		};
	}

	// Convert pathname to potential file path
	// This is a simple conversion - Nitro's routing handles complex patterns
	const cleanPath = pathname.replace(/^\//, "").replace(/\/$/, "");
	const filePath = `src/pages/${cleanPath}.tsx`;

	return {
		filePath,
		pattern: pathname,
		params: {},
	};
}

/**
 * Default page module loader
 *
 * This is a placeholder implementation that returns a minimal page module.
 * In actual usage:
 * - Development: Vite's ssrLoadModule is used via the loadPageModule option
 * - Production: Modules are imported from the build output
 *
 * The actual module loading is handled by the integration layer (nitro-integration.ts)
 * which provides the appropriate loader based on the environment.
 *
 * @param _filePath - File path to load (unused in placeholder)
 * @returns Minimal page module
 */
async function defaultLoadPageModule(_filePath: string): Promise<PageModule> {
	// This is a placeholder - actual loading is done by:
	// - Vite's ssrLoadModule in development
	// - Direct imports from build output in production

	return {
		default: () => null,
		metadata: {
			title: "Avalon Page",
		},
	};
}

/**
 * Options for the Nitro catch-all renderer
 */
export interface NitroCatchAllOptions {
	/** Avalon runtime configuration */
	avalonConfig: AvalonRuntimeConfig;
	/** Whether running in development mode */
	isDev?: boolean;
	/**
	 * Page module loader function
	 * In development, this should use Vite's ssrLoadModule
	 * In production, this imports from the build output
	 */
	loadPageModule: (filePath: string) => Promise<PageModule>;
	/** Optional layout resolver */
	resolveLayouts?: (routePath: string, config: AvalonRuntimeConfig) => Promise<string[]>;
	/** Wrap rendered page HTML with layout components (same as RenderHandlerOptions) */
	wrapWithLayouts?: RenderHandlerOptions["wrapWithLayouts"];
	/**
	 * Enable custom error pages (404.tsx, 500.tsx, _error.tsx)
	 * When enabled, the renderer will look for custom error pages in the pages directory
	 * Requirements: 10.5
	 */
	enableCustomErrorPages?: boolean;
}

/**
 * Creates a Nitro catch-all renderer handler
 *
 * This is the recommended way to create a renderer for Nitro's catch-all pattern.
 * It's designed to work with Nitro's file-system routing where:
 *
 * 1. API routes are handled by files in the api/ directory
 * 2. Static assets are served from public/
 * 3. This catch-all handles all remaining requests for SSR
 *
 * Middleware execution order:
 * 1. Global middleware (from middleware/ directory) - handled by Nitro
 * 2. Route-scoped middleware (from _middleware.ts files) - handled here
 * 3. Page rendering
 *
 * The handler expects Nitro to provide route information via event.context:
 * - event.context.params: Route parameters from dynamic segments
 * - event.context.route: Optional resolved route information
 *
 * Usage in Nitro routes/[...slug].ts:
 * ```ts
 * import { createNitroCatchAllRenderer } from '@useavalon/nitro/renderer';
 *
 * export default createNitroCatchAllRenderer({
 *   avalonConfig: useRuntimeConfig().avalon,
 *   isDev: import.meta.dev,
 *   loadPageModule: async (filePath) => {
 *     return await import(filePath);
 *   }
 * });
 * ```
 *
 * Requirements: 2.1, 2.2, 2.6, 5.1, 5.3, 10.5
 *
 * @param options - Catch-all renderer options
 * @returns Nitro event handler function
 */
export function createNitroCatchAllRenderer(options: NitroCatchAllOptions) {
	const {
		avalonConfig,
		isDev = false,
		loadPageModule,
		resolveLayouts,
		enableCustomErrorPages = true,
	} = options;

	// Middleware routes cache - discovered once at startup
	const scopedMiddlewareRoutes: MiddlewareRoute[] | null = null;

	// Error handler options for custom error pages
	const errorHandlerOptions: ErrorHandlerOptions = {
		isDev,
		avalonConfig,
		loadPageModule,
		pagesDir: avalonConfig.pagesDir,
	};

	// Pre-discover error pages if custom error pages are enabled
	if (enableCustomErrorPages) {
		discoverErrorPages(errorHandlerOptions).catch((err) => {
			console.warn("[renderer] Failed to discover error pages:", err);
		});
	}

	/**
	 * Gets scoped middleware routes, discovering them on first call
	 * Routes are cached for performance in production
	 */
	const middlewareRef = { value: scopedMiddlewareRoutes };
	const getScopedMiddleware = createScopedMiddlewareGetter(
		middlewareRef,
		avalonConfig.srcDir || "src",
		isDev,
	);

	/**
	 * Handles errors with custom error page support
	 */
	const handleError = createErrorHandler(enableCustomErrorPages, errorHandlerOptions, isDev);

	async function nitroCatchAllHandler(event: H3Event): Promise<Response> {
		const url = getRequestURL(event);
		const pathname = url.pathname;

		// Skip server islands requests — handled by the dedicated handler
		if (pathname.startsWith("/_server-islands/")) {
			return new Response("Not handled by renderer", { status: 404 });
		}

		try {
			// Execute route-scoped middleware before page rendering
			// Global middleware has already run (handled by Nitro's middleware/ directory)
			// Requirements: 5.1, 5.3
			const middlewareRoutes = await getScopedMiddleware();
			const middlewareResponse = await executeScopedMiddleware(event, middlewareRoutes, {
				devMode: isDev,
			});

			// If middleware returned a response, use it and skip page rendering
			if (middlewareResponse) {
				if (isDev) {
					console.log(`[renderer] Middleware terminated request for ${pathname}`);
				}
				return middlewareResponse;
			}

			// Get route params from Nitro's routing (e.g., from [...slug].ts)
			const params = (event.context.params as Record<string, string>) || {};

			// Reconstruct the page file path from the pathname
			// Nitro's catch-all provides the slug, we map it to the pages directory
			const slug = params.slug || pathname.replace(/^\//, "") || "index";
			const filePath = `${avalonConfig.pagesDir}/${slug}.tsx`;

			// Try to load the page module
			let pageModule: PageModule;
			try {
				pageModule = await loadPageModule(filePath);
			} catch (loadError) {
				// Direct path failed — try index file in directory
				try {
					const indexPath = `${avalonConfig.pagesDir}/${slug}/index.tsx`;
					pageModule = await loadPageModule(indexPath);
				} catch (indexLoadError) {
					// Neither direct path nor index path found
					if (isDev) {
						console.debug(`[renderer] Page not found: ${filePath}`, loadError);
						console.debug(
							`[renderer] Index fallback not found: ${avalonConfig.pagesDir}/${slug}/index.tsx`,
							indexLoadError,
						);
					}
					const error = createNotFoundError(`Page not found: ${pathname}`);
					return handleError(error, event);
				}
			}

			// Create render context
			const renderContext = createRenderContext(event, params);

			// Resolve layouts if available
			if (resolveLayouts) {
				const layouts = await resolveLayouts(pathname, avalonConfig);
				renderContext.layoutContext = { layouts };
			}

			// Render the page.
			// When wrapWithLayouts is provided, use buffered rendering so
			// layouts can wrap the page HTML. Streaming bypasses layouts
			// because it emits the HTML shell before the page is rendered.
			const useStreaming = avalonConfig.streaming && !options.wrapWithLayouts;

			if (useStreaming) {
				// Streaming SSR (no layout wrapping)
				const stream = await renderPageStream(pageModule, renderContext, {
					onShellReady: () => {
						setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
					},
				});

				return new Response(stream, {
					headers: { "Content-Type": "text/html; charset=utf-8" },
				});
			} else {
				// Buffered SSR with layout wrapping
				const result = await renderPage(pageModule, renderContext, {}, options.wrapWithLayouts);

				// Inject hydration script - ensures client-side hydration works
				let html = injectHydrationScript(result.html as string, isDev);

				// Inline critical CSS and defer non-critical stylesheets
				html = inlineCriticalCSS(html);

				// Inject modulepreload links for above-the-fold island chunks
				html = injectModulepreloadLinks(html);

				return new Response(html, {
					status: result.statusCode,
					headers: result.headers,
				});
			}
		} catch (error) {
			console.error("[Nitro Catch-All Renderer Error]", error);

			const err = error instanceof Error ? error : new Error(String(error));
			return handleError(err, event);
		}
	}

	// Return a srvx-compatible server object (same pattern as createNitroRenderer)
	const handler = Object.assign(nitroCatchAllHandler, {
		async fetch(request: Request): Promise<Response> {
			const url = new URL(request.url, "http://localhost");
			const pathname = url.pathname;

			// Skip server islands requests — handled by the dedicated handler
			if (pathname.startsWith("/_server-islands/")) {
				return new Response("Not handled by renderer", { status: 404 });
			}

			try {
				// Reconstruct the page file path from the pathname
				const slug = pathname.replace(/^\//, "") || "index";
				const filePath = `${avalonConfig.pagesDir}/${slug}.tsx`;

				// Try to load the page module
				let pageModule: PageModule;
				try {
					pageModule = await loadPageModule(filePath);
				} catch {
					try {
						const indexPath = `${avalonConfig.pagesDir}/${slug}/index.tsx`;
						pageModule = await loadPageModule(indexPath);
					} catch {
						return createErrorResponse(createNotFoundError(`Page not found: ${pathname}`), isDev);
					}
				}

				// Create render context directly from the Request
				const renderContext = createRenderContextFromRequest(request);

				// Render the page (non-streaming for prerender/fetch path)
				const result = await renderPage(pageModule, renderContext, {}, options.wrapWithLayouts);
				let html = injectHydrationScript(result.html as string, isDev);

				// Inline critical CSS and defer non-critical stylesheets
				html = inlineCriticalCSS(html);

				// Inject modulepreload links for above-the-fold island chunks
				html = injectModulepreloadLinks(html);

				return new Response(html, {
					status: result.statusCode,
					headers: result.headers,
				});
			} catch (error) {
				console.error("[Nitro CatchAll .fetch() Error]", error);
				const err = error instanceof Error ? error : new Error(String(error));
				return createErrorResponse(err, isDev);
			}
		},
	});

	return handler;
}

/**
 * Re-export middleware cache clearing for hot reload support
 *
 * Call this function when middleware files change during development
 * to ensure the latest version is loaded on the next request.
 *
 * @example
 * ```ts
 * // In your HMR handler
 * if (file.endsWith('_middleware.ts')) {
 *   clearRendererMiddlewareCache();
 * }
 * ```
 */
export { clearMiddlewareCache as clearRendererMiddlewareCache } from "../middleware/index.ts";
