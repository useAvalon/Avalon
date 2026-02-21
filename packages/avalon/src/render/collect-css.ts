/**
 * Collect CSS from Vite's module graph for SSR.
 *
 * After ssrLoadModule loads a page, Vite's module graph knows about all
 * imported CSS files (including CSS modules). This utility walks the graph
 * starting from the page module and collects all CSS content so it can be
 * injected into the SSR HTML as <style> tags — preventing FOUC.
 */

import type { ViteDevServer, ModuleNode } from "vite";

/**
 * Collect all CSS imported (directly or transitively) by a given module URL.
 *
 * Walks Vite's module graph breadth-first, collecting the transformed CSS
 * source for every `.css` dependency (including `.module.css`).
 *
 * @param server - The Vite dev server instance
 * @param moduleUrl - The module URL to start from (e.g. "/src/pages/frameworks.tsx")
 * @returns Array of CSS strings ready to be injected as <style> tags
 */
export async function collectCssFromModuleGraph(
	server: ViteDevServer,
	moduleUrl: string,
): Promise<string[]> {
	const cssContents: string[] = [];
	const visited = new Set<string>();

	const entryModule = await server.moduleGraph.getModuleByUrl(moduleUrl);
	if (!entryModule) return cssContents;

	const queue: ModuleNode[] = [entryModule];

	while (queue.length > 0) {
		const mod = queue.shift()!;
		const id = mod.id ?? mod.url;

		if (visited.has(id)) continue;
		visited.add(id);

		// If this module is a CSS file, collect its transformed content
		if (isCssModule(id)) {
			const css = await getCssContent(server, mod);
			if (css) {
				cssContents.push(css);
			}
		}

		// Walk imported modules
		for (const imported of mod.importedModules) {
			const importedId = imported.id ?? imported.url;
			if (!visited.has(importedId)) {
				queue.push(imported);
			}
		}
	}

	return cssContents;
}

/**
 * Check if a module ID represents a CSS file.
 */
function isCssModule(id: string): boolean {
	// Strip query params for extension check
	const cleanId = id.split("?")[0];
	return (
		cleanId.endsWith(".css") ||
		cleanId.endsWith(".scss") ||
		cleanId.endsWith(".sass") ||
		cleanId.endsWith(".less") ||
		cleanId.endsWith(".styl") ||
		cleanId.endsWith(".stylus")
	);
}

/**
 * Get the transformed CSS content for a module.
 *
 * Uses Vite's transformRequest to get the processed CSS (with module
 * class name hashing, PostCSS transforms, etc. already applied).
 */
async function getCssContent(
	server: ViteDevServer,
	mod: ModuleNode,
): Promise<string | null> {
	try {
		// Use the module's URL for transform (includes query params Vite needs)
		const url = mod.url;
		const result = await server.transformRequest(url + "?direct");

		if (result && typeof result.code === "string") {
			// Vite wraps CSS in a JS module for HMR. For SSR injection we need
			// the raw CSS. The transformed code contains the CSS as a string
			// in an `__vite__css` or similar export. Try to extract it.
			const rawCss = extractCssFromTransformedModule(result.code);
			return rawCss;
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Extract raw CSS from Vite's transformed CSS module JS wrapper.
 *
 * Vite transforms CSS files into JS modules that look like:
 *   const __vite__css = "...actual css..."
 *   __vite__updateStyle(...)
 *
 * We extract the CSS string from this wrapper.
 */
function extractCssFromTransformedModule(code: string): string | null {
	// Pattern 1: __vite__css = "..."
	const viteVarMatch = code.match(
		/const\s+__vite__css\s*=\s*"((?:[^"\\]|\\.)*)"/,
	);
	if (viteVarMatch) {
		return unescapeJsString(viteVarMatch[1]);
	}

	// Pattern 2: __vite_ssr_exports__.default = "..."
	const ssrExportMatch = code.match(
		/__vite_ssr_exports__\.default\s*=\s*"((?:[^"\\]|\\.)*)"/,
	);
	if (ssrExportMatch) {
		return unescapeJsString(ssrExportMatch[1]);
	}

	// Pattern 3: export default "..."
	const exportDefaultMatch = code.match(
		/export\s+default\s+"((?:[^"\\]|\\.)*)"/,
	);
	if (exportDefaultMatch) {
		return unescapeJsString(exportDefaultMatch[1]);
	}

	// Pattern 4: the code itself might be raw CSS (no JS wrapper)
	if (!code.includes("export ") && !code.includes("__vite")) {
		return code;
	}

	return null;
}

/**
 * Unescape a JS string literal (handle \\n, \\t, etc.)
 */
function unescapeJsString(str: string): string {
	return str
		.replace(/\\n/g, "\n")
		.replace(/\\t/g, "\t")
		.replace(/\\r/g, "\r")
		.replace(/\\"/g, '"')
		.replace(/\\\\/g, "\\");
}

/**
 * Inject collected CSS into an HTML string before </head>.
 *
 * Each CSS string is wrapped in a <style data-avalon-ssr-css> tag.
 * CSS content is sanitized to prevent style tag breakout (XSS via </style> injection).
 * If no </head> is found, styles are prepended to the HTML.
 */
export function injectSsrCss(html: string, cssContents: string[]): string {
	if (cssContents.length === 0) return html;

	const styleTags = cssContents
		.map((css) => `<style data-avalon-ssr-css>${sanitizeCssForStyleTag(css)}</style>`)
		.join("\n");

	if (html.includes("</head>")) {
		return html.replace("</head>", `${styleTags}\n</head>`);
	}

	// Fallback: inject after <head> or at the start
	if (html.includes("<head>")) {
		return html.replace("<head>", `<head>\n${styleTags}`);
	}

	return styleTags + html;
}

/**
 * Sanitize CSS content for safe injection inside a <style> tag.
 *
 * The only way to break out of a <style> tag is with a closing </style> tag
 * (case-insensitive, with optional whitespace). We neutralize this by escaping
 * any occurrence of `</style` in the CSS content.
 *
 * This prevents XSS via:
 *   .foo {} </style><script>alert('xss')</script><style>
 *
 * The CSS source comes from Vite's module graph (local project files and
 * npm dependencies), so this is defense-in-depth against compromised deps.
 */
function sanitizeCssForStyleTag(css: string): string {
	// Replace </style (case-insensitive) with an escaped version that won't
	// close the tag. Using a backslash escape: <\/style
	// Browsers ignore the backslash in CSS context, so styles still work.
	return css.replace(/<\/style/gi, "<\\/style");
}
