/**
 * Route → CSS href matching for Nitro SSR. Pure: the layouts virtual module
 * imports this; a filesystem walker must not leak into the Nitro bundle.
 */

export interface DevCssRouteEntry {
	pattern: string;
	/** Page + matching layouts + global CSS. */
	hrefs: string[];
	/** Page + global CSS (used when the page skips layouts). */
	pageHrefs: string[];
}

export interface DevCssRouteTable {
	routes: DevCssRouteEntry[];
	/** Global CSS + root layout graph — used when no page matches. */
	fallbackHrefs: string[];
	globalHrefs: string[];
}

export function stripTrailingSlash(path: string): string {
	if (path === "/") return "/";
	return path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Avalon page-pattern match (`:param`, `**`) used for CSS table lookup. */
export function matchPathPattern(pathname: string, pattern: string): boolean {
	const path = stripTrailingSlash(pathname);
	const pat = stripTrailingSlash(pattern);
	if (path === pat) return true;

	const patternParts = pat.split("/");
	const pathParts = path.split("/");

	for (let i = 0; i < patternParts.length; i++) {
		const seg = patternParts[i];
		if (seg === "**") return true;
		if (i >= pathParts.length) return false;
		if (seg.startsWith(":")) {
			if (!pathParts[i]) return false;
			continue;
		}
		if (seg !== pathParts[i]) return false;
	}

	return pathParts.length <= patternParts.length;
}

/** Layout prefix match: `/` is root-only; `/blog` does not match `/blogger`. */
export function layoutPrefixMatches(pathname: string, prefix: string): boolean {
	if (prefix === "/") return pathname === "/";
	const clean = stripTrailingSlash(pathname);
	const norm = stripTrailingSlash(prefix);
	return clean === norm || clean.startsWith(`${norm}/`);
}

export function selectDevCssHrefs(
	table: DevCssRouteTable,
	pathname: string,
	skipLayouts: boolean,
): string[] {
	const clean = pathname.split("?")[0] ?? pathname;
	const route = table.routes.find((r) => matchPathPattern(clean, r.pattern));
	if (route) return skipLayouts ? route.pageHrefs : route.hrefs;
	if (skipLayouts) return table.globalHrefs;
	return table.fallbackHrefs;
}

function escapeAttr(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/** Vite URL for `\0virtual:avalon/dev-css-hmr` — loaded as its own module graph entry. */
export const DEV_CSS_HMR_CLIENT_SRC = "/@id/__x00__virtual:avalon/dev-css-hmr";

/**
 * Insert per-route `<link rel="stylesheet" href="…?direct">`. The browser
 * fetches hashed CSS from Vite on every document load, so a reload cannot
 * serve a baked snapshot. Also injects `/@vite/client` and the CSS HMR
 * listener — Nitro HTML never runs `transformIndexHtml`.
 */
export function appendDevCssLinks(html: string, hrefs: string[]): string {
	if (!html.includes("</head>")) return html;
	const tags = hrefs
		.map((href) => {
			const id = escapeAttr(href);
			return `<link rel="stylesheet" href="${id}?direct" data-avalon-css="${id}">`;
		})
		.join("\n");
	const parts: string[] = [];
	if (tags) parts.push(tags);
	if (!html.includes("/@vite/client")) {
		parts.push(`<script type="module" src="/@vite/client"></script>`);
	}
	if (!html.includes("virtual:avalon/dev-css-hmr")) {
		parts.push(`<script type="module" src="${DEV_CSS_HMR_CLIENT_SRC}"></script>`);
	}
	const inject = parts.join("\n");
	return html.replace("</head>", `${inject}${inject ? "\n" : ""}</head>`);
}

/**
 * Insert hashed CSS as `<style data-avalon-css>` so HMR can update
 * `textContent` in place. `</style` is neutralized so the tag cannot close early.
 */
export function appendDevStyleTags(
	html: string,
	sheets: Array<{ href: string; css: string }>,
): string {
	if (sheets.length === 0) return html;
	if (!html.includes("</head>")) return html;
	const tags = sheets
		.map((sheet) => {
			const css = sheet.css.replaceAll(/<\/style/gi, String.raw`<\/style`);
			return `<style type="text/css" data-avalon-css="${escapeAttr(sheet.href)}">${css}</style>`;
		})
		.join("\n");
	return html.replace("</head>", `${tags}\n</head>`);
}

const VITE_CLIENT_TAG = '<script type="module" src="/@vite/client"></script>';
const LEGACY_MAIN_JS = "/src/client/main.js";

/** Dev script `src` for the project client entry (`app/entry-client` → `/app/entry-client`). */
export function devClientEntrySrc(clientEntry: string): string {
	return clientEntry.startsWith("/") ? clientEntry : `/${clientEntry}`;
}

function devClientEntryTag(clientEntry: string): string {
	const src = devClientEntrySrc(clientEntry);
	return `<script type="module" src="${src}"></script>`;
}

function hasClientEntryScript(html: string, clientEntry: string): boolean {
	if (html.includes(LEGACY_MAIN_JS) || html.includes("entry-client")) return true;
	const src = devClientEntrySrc(clientEntry);
	return html.includes(src);
}

/**
 * Ensures Vite HMR and the Avalon client entry load in dev SSR HTML.
 * `appendDevCssLinks` may inject only `/@vite/client`; Nitro still needs the
 * project entry (for example `/app/entry-client`) that imports
 * `virtual:avalon/client-entry`.
 */
export function ensureDevClientScripts(html: string, clientEntry = "app/entry-client"): string {
	let result = html;

	if (!result.includes("/@vite/client") && result.includes("</head>")) {
		result = result.replace("</head>", `\n${VITE_CLIENT_TAG}\n</head>`);
	}

	if (!hasClientEntryScript(result, clientEntry)) {
		const tag = `\n${devClientEntryTag(clientEntry)}\n`;
		const bodyCloseIndex = result.lastIndexOf("</body>");
		if (bodyCloseIndex !== -1) {
			result = result.slice(0, bodyCloseIndex) + tag + result.slice(bodyCloseIndex);
		} else {
			result += tag;
		}
	}

	return result;
}
