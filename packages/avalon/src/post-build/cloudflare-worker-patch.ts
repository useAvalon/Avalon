/**
 * Cloudflare Pages worker post-build patches.
 *
 * 1. Rolldown emits `createRequire(import.meta.url)` — undefined on workerd.
 * 2. Lit SSR reads `document` at module eval; the inlined DOM stub runs too late
 *    because ESM static imports of `@lit-labs/ssr` evaluate first.
 * 3. Nitro's `_routes.json` includes `/*`, so prerendered HTML hits the Function
 *    instead of ASSETS — amplify any SSR boot failure into a site-wide 500.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ssrDomShimModuleSource } from "../vite-plugin/ssr-dom-shim-module.ts";

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
	writeFileSync(stubPath, `${ssrDomShimModuleSource().trim()}\n`);

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

/**
 * Prefer ASSETS for prerendered HTML: only send dynamic routes to the Function.
 * Nitro defaults to `include: ["/*"]`, which forces every page through SSR.
 */
export function patchCloudflareRoutesForStaticHtml(cwd: string): boolean {
	const routesPath = join(cwd, "dist", "_routes.json");
	if (!existsSync(routesPath)) return false;

	const include = new Set<string>([
		"/api/*",
		"/_server-islands/*",
		"/_actions/*",
		"/demo/data-fetching",
		"/demo/data-fetching/",
	]);

	const apiDir = join(cwd, "dist", "_worker.js", "_routes", "api");
	if (existsSync(apiDir)) {
		include.add("/api/*");
	}

	const next = {
		version: 1,
		include: [...include],
		// Wrangler requires both keys. Exclude static trees so they never hit the Function.
		exclude: [
			"/",
			"/assets/*",
			"/islands/*",
			"/pagefind/*",
			"/*.html",
			"/*.svg",
			"/*.ico",
			"/*.txt",
			"/*.xml",
			"/*.css",
			"/*.js",
		],
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
	const routesPatched = patchCloudflareRoutesForStaticHtml(cwd);

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
	if (routesPatched) {
		console.log("[cloudflare] Limited _routes.json include to dynamic SSR paths");
	}
	return requirePatched > 0 || wranglerPatched || domPatched || routesPatched;
}
