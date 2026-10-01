/**
 * Qwik server-side renderer
 *
 * Handles SSR for Qwik components using @builder.io/qwik/server.
 * Qwik's SSR produces HTML with serialized state embedded in the DOM,
 * enabling resumability on the client without a hydration step.
 */

import type { RenderParams, RenderResult } from "@useavalon/core/types";
import { loadComponent } from "./utils.ts";

// Lazy-load Qwik modules — they're peer dependencies that may not be available
// during the Vite build phase (integration activation). Loaded on first render call.
let _jsx: typeof import("@builder.io/qwik").jsx | null = null;
let _renderToString: typeof import("@builder.io/qwik/server").renderToString | null = null;

async function getQwikModules() {
	if (!_jsx || !_renderToString) {
		const [qwikCore, qwikServer] = await Promise.all([
			import("@builder.io/qwik"),
			import("@builder.io/qwik/server"),
		]);
		_jsx = qwikCore.jsx;
		_renderToString = qwikServer.renderToString;
	}
	return { jsx: _jsx, renderToString: _renderToString };
}

/**
 * Render a Qwik component to HTML string
 *
 * Uses Qwik's renderToString for SSR. The output includes:
 * - Rendered HTML with q:container attributes
 * - Serialized state in <script type="qwik/json"> blocks
 * - Event listener declarations as on: attributes
 *
 * @param params - Render parameters including component, props, and source path
 * @returns Render result with HTML and resumability data
 */
export async function render(params: RenderParams): Promise<RenderResult> {
	const {
		component: preloaded,
		props = {},
		src,
		condition = "on:client",
		ssrOnly = false,
	} = params;

	try {
		const Component = preloaded || (await loadComponent(src));

		if (!Component) {
			throw new Error(`Invalid Qwik component in ${src}: component not found`);
		}

		// Import Qwik's SSR utilities
		const { jsx, renderToString } = await getQwikModules();

		const containerId = `qwik-island-${src.replaceAll(/[^a-zA-Z0-9]/g, "-")}`;

		// Create JSX element using Qwik's jsx function
		const jsxElement = jsx(Component as any, props || {});

		// Qwik's renderToString takes (rootNode, opts) - rootNode is the first argument
		// The q:container attribute marks the resumable boundary
		// Set base to "/" so QRL URLs resolve from the web root in dev mode
		//
		// symbolMapper: Qwik's SSR platform needs to resolve QRL symbol hashes to
		// [symbolName, bundleURL] pairs. Without this, it falls back to the
		// @qwik-client-manifest virtual module which is empty in Avalon's build.
		// With the 'hoist' entry strategy, all QRL handlers are exported from the
		// same module file, so we map every symbol back to the component's URL.
		//
		// In dev mode, the QRL middleware intercepts ?qrl= requests.
		// In production, the qwikloader imports the bundle module directly and
		// looks up the symbol as a named export — no query string needed.
		const isDev = process.env.NODE_ENV !== "production";
		const componentUrl = src.startsWith("/") ? src : `/${src}`;
		let qrlBase: string;
		if (isDev) {
			// Dev: use source path — the ?qrl= middleware handles transformation
			qrlBase = componentUrl;
		} else {
			// Production: point to the island client bundle
			const srcWithoutLeadingSlash = componentUrl.replace(/^\//, "");
			qrlBase = `/islands/${srcWithoutLeadingSlash.replace(/\.(tsx?|jsx?)$/, ".js")}`;
		}
		// biome-ignore lint/correctness/useQwikValidLexicalScope: server-side SSR function, not a Qwik component
		const symbolMapper = (symbolName: string) => {
			return [symbolName, qrlBase] as const;
		};

		const result = await renderToString(jsxElement, {
			containerTagName: "div",
			containerAttributes: {
				"data-island-id": containerId,
			},
			base: "/",
			symbolMapper,
			// Inline the Qwikloader so activateQwikLoader can evaluate it after
			// client-side navigation. With 'module' (the default), Qwik emits
			// <script type="module" src="..."> which is skipped by DOMParser
			// and cannot be re-evaluated by activateQwikLoader.
			qwikLoader: "inline",
		});

		const html = typeof result === "string" ? result : result.html;

		if (!html || typeof html !== "string") {
			throw new Error(`renderToString returned invalid result: ${typeof html}`);
		}

		// Post-process: strip any absolute filesystem paths that may leak through.
		// The symbolMapper handles QRL URL mapping, but the Qwik compiler may
		// embed absolute paths in other metadata.
		let processedHtml = html;
		const root = process.cwd();
		if (root) {
			const forwardRoot = root.replaceAll("\\", "/");
			if (processedHtml.includes(forwardRoot)) {
				processedHtml = processedHtml.replaceAll(forwardRoot, "");
			}
			if (root !== forwardRoot && processedHtml.includes(root)) {
				processedHtml = processedHtml.replaceAll(root, "");
			}
		}
		processedHtml = processedHtml.replaceAll(/[A-Z]:[/\\](?:[^"'`\s]*[/\\])*(?=app\/)/gi, "/");

		return {
			html: processedHtml,
			hydrationData: { src, props, framework: "qwik", condition, containerId, ssrOnly },
		};
	} catch (error) {
		throw new Error(
			`Failed to render Qwik component ${src}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

/**
 * Render a Qwik component with error boundary
 */
export async function renderWithErrorBoundary(params: RenderParams): Promise<RenderResult | null> {
	try {
		return await render(params);
	} catch {
		return null;
	}
}
