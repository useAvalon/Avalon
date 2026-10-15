/**
 * Cloudflare Pages worker post-build patches.
 *
 * 1. Rolldown emits `createRequire(import.meta.url)` — undefined on workerd.
 * 2. Lit SSR reads `document` at module eval; the inlined DOM stub runs too late
 *    because ESM static imports of `@lit-labs/ssr` evaluate first.
 * 3. Nitro's `_routes.json` includes `/*`, so prerendered HTML hits the Function
 *    instead of ASSETS — amplify any SSR boot failure into a site-wide 500.
 */

import {
	copyFileSync,
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { ssrDomStubFileSource } from "../vite-plugin/ssr-dom-shim-module.ts";

const CREATE_REQUIRE_RE = /createRequire\(\s*import\.meta\.url\s*\)/g;
const CREATE_REQUIRE_SAFE = 'createRequire(import.meta.url || "file:///")';
const DOM_STUB_NAME = "_dom_stub.mjs";

function collectJsFiles(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			collectJsFiles(full, out);
			continue;
		}
		if (entry.isFile() && /\.(?:m?js)$/.test(entry.name)) out.push(full);
	}
	return out;
}

/** Rewrite createRequire(import.meta.url) so workerd can boot the worker. */
export function patchCloudflareCreateRequire(workerDir: string): number {
	let patched = 0;
	for (const file of collectJsFiles(workerDir)) {
		const before = readFileSync(file, "utf-8");
		if (!CREATE_REQUIRE_RE.test(before)) continue;
		CREATE_REQUIRE_RE.lastIndex = 0;
		const after = before.replaceAll(CREATE_REQUIRE_RE, CREATE_REQUIRE_SAFE);
		if (after === before) continue;
		writeFileSync(file, after);
		patched += 1;
	}
	return patched;
}

export interface CloudflareWranglerPatch {
	compatibilityDate: string;
	compatibilityFlags: string[];
}

/** Merge compatibility_date / flags into Nitro's emitted wrangler.json. */
export function patchCloudflareWranglerJson(
	workerDir: string,
	patch: CloudflareWranglerPatch,
): boolean {
	const path = join(workerDir, "wrangler.json");
	if (!existsSync(path) || !statSync(path).isFile()) return false;

	const config = JSON.parse(readFileSync(path, "utf-8")) as {
		compatibility_date?: string;
		compatibility_flags?: string[];
		[key: string]: unknown;
	};

	config.compatibility_date = patch.compatibilityDate;
	const flags = new Set(config.compatibility_flags ?? []);
	for (const flag of patch.compatibilityFlags) flags.add(flag);
	config.compatibility_flags = [...flags];

	writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
	return true;
}

function prependImport(filePath: string, importSpec: string): boolean {
	if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
	const code = readFileSync(filePath, "utf-8");
	const stmt = `import "${importSpec}";\n`;
	if (code.startsWith(stmt) || code.includes(`import "${importSpec}"`)) return false;
	writeFileSync(filePath, `${stmt}${code}`);
	return true;
}

/**
 * Install a separate DOM stub module and import it before Lit / the SSR graph.
 * Inlined stubs cannot run before static `import` of `@lit-labs/ssr`.
 */
export function injectCloudflareDomStub(workerDir: string): boolean {
	const stubPath = join(workerDir, DOM_STUB_NAME);
	writeFileSync(stubPath, `${ssrDomStubFileSource().trim()}\n`);

	let changed = false;
	changed = prependImport(join(workerDir, "index.js"), `./${DOM_STUB_NAME}`) || changed;
	changed = prependImport(join(workerDir, "_ssr", "ssr.mjs"), `../${DOM_STUB_NAME}`) || changed;

	const litDir = join(workerDir, "_libs", "@lit-labs");
	if (existsSync(litDir)) {
		for (const name of readdirSync(litDir)) {
			if (!name.startsWith("ssr")) continue;
			changed = prependImport(join(litDir, name), `../../${DOM_STUB_NAME}`) || changed;
		}
	}
	return changed;
}

/** Cloudflare Pages allows at most 100 `include` + `exclude` rules combined. */
export const CLOUDFLARE_PAGES_MAX_ROUTE_RULES = 100;

const CLOUDFLARE_STATIC_ASSET_EXCLUDES = [
	"/",
	"/assets/*",
	"/fonts/*",
	"/islands/*",
	"/pagefind/*",
	"/font-faces.css",
	"/syntax-highlighting.css",
	"/404.html",
	"/*.html",
	"/*.svg",
	"/*.ico",
	"/*.txt",
	"/*.xml",
	"/*.css",
	"/*.js",
	"/*.png",
	"/*.webmanifest",
];

/** Directories under `dist/` that are never prerendered page trees. */
const DIST_NON_PAGE_DIRS = new Set([
	"assets",
	"fonts",
	"islands",
	"pagefind",
	"_worker.js",
	"_routes",
]);

/**
 * Collects URL paths for each prerendered index.html (e.g. `/docs/foo`).
 * Used to derive wildcard `_routes.json` excludes without one rule per page.
 */
export function collectPrerenderedHtmlPaths(distDir: string): string[] {
	const paths: string[] = [];
	if (!existsSync(distDir)) return paths;

	const walk = (absDir: string) => {
		const indexPath = join(absDir, "index.html");
		if (existsSync(indexPath)) {
			const rel = relative(distDir, absDir).replaceAll("\\", "/");
			paths.push(rel === "" ? "/" : `/${rel}`);
		}
		for (const entry of readdirSync(absDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			if (DIST_NON_PAGE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
			walk(join(absDir, entry.name));
		}
	};

	walk(distDir);
	return paths;
}

/**
 * Collapses prerendered paths into wildcard excludes (`/docs/*` covers nested docs).
 * Single-segment pages (e.g. `/about`) stay as exact excludes.
 */
export function prerenderedPathWildcardExcludes(paths: readonly string[]): string[] {
	const wildcards = new Set<string>();
	const exact = new Set<string>();

	for (const path of paths) {
		if (path === "/") continue;
		const segments = path.split("/").filter(Boolean);
		if (segments.length === 0) continue;
		if (segments.length === 1) {
			exact.add(`/${segments[0]}`);
			continue;
		}
		wildcards.add(`/${segments[0]}/*`);
	}

	return [...wildcards, ...exact];
}

/**
 * Builds the exclude list for `_routes.json`, staying within Cloudflare's rule cap.
 * Falls back to static asset excludes only when wildcards would still exceed the limit.
 */
export function buildCloudflareRoutesExclude(distDir: string, includeRuleCount: number): string[] {
	const exclude = new Set<string>(CLOUDFLARE_STATIC_ASSET_EXCLUDES);
	for (const rule of prerenderedPathWildcardExcludes(collectPrerenderedHtmlPaths(distDir))) {
		exclude.add(rule);
	}

	if (includeRuleCount + exclude.size > CLOUDFLARE_PAGES_MAX_ROUTE_RULES) {
		console.warn(
			`[cloudflare] _routes.json would exceed ${CLOUDFLARE_PAGES_MAX_ROUTE_RULES} rules (${includeRuleCount + exclude.size}); using static excludes only (narrow include still limits Functions)`,
		);
		return [...CLOUDFLARE_STATIC_ASSET_EXCLUDES].sort();
	}

	return [...exclude].sort();
}

const MINIMAL_CLOUDFLARE_404_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 Not Found</title>
  <meta name="robots" content="noindex, nofollow">
</head>
<body>
  <h1>404</h1>
  <p>Page not found.</p>
</body>
</html>
`;

/**
 * Without `404.html`, Cloudflare Pages assumes an SPA and serves `index.html` (200) for unknown URLs.
 */
export function ensureCloudflarePages404Html(distDir: string): boolean {
	const root404 = join(distDir, "404.html");
	if (existsSync(root404)) return false;

	const fromPrerender = join(distDir, "404", "index.html");
	if (existsSync(fromPrerender)) {
		copyFileSync(fromPrerender, root404);
		console.log("[cloudflare] Wrote dist/404.html from prerendered /404 page");
		return true;
	}

	writeFileSync(root404, MINIMAL_CLOUDFLARE_404_HTML);
	console.log("[cloudflare] Wrote minimal dist/404.html (add /404 to prerender for a custom page)");
	return true;
}

/**
 * Prefer ASSETS for prerendered HTML: only send dynamic routes to the Function.
 * Nitro defaults to `include: ["/*"]`, which forces every page through SSR.
 */
export function patchCloudflareRoutesForStaticHtml(cwd: string): boolean {
	const routesPath = join(cwd, "dist", "_routes.json");
	if (!existsSync(routesPath)) return false;

	const distDir = join(cwd, "dist");
	const include = new Set<string>(["/api/*", "/_server-islands/*", "/_actions/*"]);

	const apiDir = join(distDir, "_worker.js", "_routes", "api");
	if (existsSync(apiDir)) {
		include.add("/api/*");
	}

	const next = {
		version: 1,
		include: [...include],
		exclude: buildCloudflareRoutesExclude(distDir, include.size),
	};
	writeFileSync(routesPath, `${JSON.stringify(next, null, 2)}\n`);
	return true;
}

/**
 * Apply Cloudflare worker fixes under `dist/_worker.js` (file or directory).
 * Returns false when no Cloudflare worker output is present.
 */
export function patchCloudflareWorkerOutput(
	cwd: string,
	wrangler: CloudflareWranglerPatch = {
		compatibilityDate: "2026-09-04",
		compatibilityFlags: ["nodejs_compat", "enable_nodejs_fs_module"],
	},
): boolean {
	const root = join(cwd, "dist", "_worker.js");
	if (!existsSync(root)) return false;

	const workerDir = statSync(root).isDirectory() ? root : null;
	if (!workerDir) return false;

	const requirePatched = patchCloudflareCreateRequire(workerDir);
	const wranglerPatched = patchCloudflareWranglerJson(workerDir, wrangler);
	const domPatched = injectCloudflareDomStub(workerDir);

	if (requirePatched > 0) {
		console.log(
			`[cloudflare] Patched createRequire(import.meta.url) in ${requirePatched} worker file(s)`,
		);
	}
	if (wranglerPatched) {
		console.log(
			`[cloudflare] Synced wrangler.json compatibility_date=${wrangler.compatibilityDate}`,
		);
	}
	if (domPatched) {
		console.log("[cloudflare] Injected _dom_stub.mjs before Lit / SSR imports");
	}
	return requirePatched > 0 || wranglerPatched || domPatched;
}

/** True when post-build prerender wrote a homepage shell under `dist/`. */
export function hasCloudflarePrerenderedHomepage(cwd: string): boolean {
	return existsSync(join(cwd, "dist", "index.html"));
}

/**
 * When prerender succeeded, prefer static HTML over the Pages Function.
 * Skipped when prerender failed so `/*` SSR still serves HTML routes.
 */
export function patchCloudflareRoutesAfterPrerender(cwd: string): boolean {
	if (!hasCloudflarePrerenderedHomepage(cwd)) {
		console.log(
			"[cloudflare] Skipping _routes.json static-first patch (no prerendered index.html)",
		);
		return false;
	}
	const distDir = join(cwd, "dist");
	ensureCloudflarePages404Html(distDir);

	if (patchCloudflareRoutesForStaticHtml(cwd)) {
		const pageCount = collectPrerenderedHtmlPaths(distDir).length;
		console.log(
			`[cloudflare] Limited _routes.json include to dynamic SSR paths (${pageCount} prerendered HTML path(s) excluded)`,
		);
		return true;
	}
	return false;
}
