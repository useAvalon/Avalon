/**
 * Collect CSS from Vite's module graph for SSR.
 *
 * After ssrLoadModule loads a page, Vite's module graph knows about all
 * imported CSS files (including CSS modules). This utility walks the graph
 * starting from the page module and collects all CSS content so it can be
 * injected into the SSR HTML as <style> tags — preventing FOUC.
 */

import type { ModuleNode, ViteDevServer } from "vite";

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
async function getCssContent(server: ViteDevServer, mod: ModuleNode): Promise<string | null> {
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
 * Vite 8 writes `const __vite__css = ${JSON.stringify(css)}`. `?direct`
 * skips that wrapper and returns hashed CSS as `result.code`.
 */
export function extractCssFromTransformedModule(code: string): string | null {
	if (!code) return null;

	const viteVarMatch = /const\s+__vite__css\s*=\s*("(?:[^"\\]|\\.)*")/.exec(code);
	if (viteVarMatch?.[1]) return parseJsStringLiteral(viteVarMatch[1]);

	const ssrExportMatch = /__vite_ssr_exports__\.default\s*=\s*("(?:[^"\\]|\\.)*")/.exec(code);
	if (ssrExportMatch?.[1]) return parseJsStringLiteral(ssrExportMatch[1]);

	const exportDefaultMatch = /export\s+default\s+("(?:[^"\\]|\\.)*")/.exec(code);
	if (exportDefaultMatch?.[1]) return parseJsStringLiteral(exportDefaultMatch[1]);

	if (looksLikeRawCss(code)) return code;
	return null;
}

function looksLikeRawCss(code: string): boolean {
	if (code.includes("__vite__updateStyle") || code.includes("import.meta.hot")) return false;
	if (code.includes("export ") || code.includes("import ")) return false;
	return true;
}

/** Decode a JS/JSON double-quoted string, including `\uXXXX` from `JSON.stringify`. */
function parseJsStringLiteral(quoted: string): string | null {
	try {
		return JSON.parse(quoted) as string;
	} catch {
		return unescapeJsString(quoted.slice(1, -1));
	}
}

/**
 * Unescape a JS string literal
 */
function unescapeJsString(str: string): string {
	return str
		.replaceAll(String.raw`\n`, "\n")
		.replaceAll(String.raw`\t`, "\t")
		.replaceAll(String.raw`\r`, "\r")
		.replaceAll(String.raw`\"`, '"')
		.replaceAll("\\\\", "\\");
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
export function sanitizeCssForStyleTag(css: string): string {
	// Replace </style (case-insensitive) with an escaped version that won't
	// close the tag. Using a backslash escape: <\/style
	// Browsers ignore the backslash in CSS context, so styles still work.
	return css.replaceAll(/<\/style/gi, String.raw`<\/style`);
}

/**
 * Vite strips `t=<13 digits>` from transform URLs (HMR timestamp). `v=`
 * stays, so each read is a new module id and cannot reuse a stale
 * `transformResult` for `?direct`.
 */
export function directCssRequestUrl(href: string, bust = Date.now()): string {
	return `${href}?direct&v=${bust}`;
}

/** Transform a `/`-rooted project CSS href to hashed CSS text for SSR/HMR. */
export async function readDirectCss(server: ViteDevServer, href: string): Promise<string> {
	try {
		const result = await server.transformRequest(directCssRequestUrl(href));
		if (!result || typeof result.code !== "string") return "";
		return extractCssFromTransformedModule(result.code) ?? "";
	} catch {
		return "";
	}
}
