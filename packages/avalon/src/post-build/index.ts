/**
 * Avalon Post-Build Script
 *
 * Handles all post-build tasks for production deployments:
 *
 * 1. Cleanup: Removes stale Vite template index.html files
 * 2. CSS Patching: Copies SSR CSS to client assets, patches SSR bundle
 * 3. Island Redirects: Generates _redirects for clean island paths (Netlify)
 * 4. Adapter Copying: Copies framework adapters to dist/
 * 5. Netlify Function Copying: Copies server function to all Netlify paths
 * 6. Prerendering: Boots built server, fetches routes, writes static HTML
 * 7. HTML Optimization: Inlines small CSS, defers non-critical stylesheets,
 *    adds font preload hints
 *
 * Usage:
 *   import { runPostBuild } from '@useavalon/avalon/post-build';
 *   await runPostBuild();
 */

import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
	patchCloudflareRoutesAfterPrerender,
	patchCloudflareWorkerOutput,
} from "./cloudflare-worker-patch.ts";
import { copySSRCSSToClient } from "./copy-ssr-css.ts";
import { collectFiles, isFile } from "./fs-utils.ts";
import { optimizePrerenderedHtml } from "./html-optimize.ts";
import { injectIslandDepsPreloads } from "./inject-island-preloads.ts";
import { ensureIsolatedIslands } from "./isolated-islands-step.ts";
import { patchSSRBundleCSS } from "./patch-ssr-bundle-css.ts";
import { type PrerenderConfig, prerenderIfConfigured } from "./prerender.ts";

export { patchCloudflareRoutesAfterPrerender } from "./cloudflare-worker-patch.ts";
export { patchSSRBundleCSS } from "./patch-ssr-bundle-css.ts";
export { isNetlifyHandler, type PrerenderConfig } from "./prerender.ts";

export interface PostBuildOptions {
	/** Project root directory (default: process.cwd()) */
	cwd?: string;
	/** Prerender configuration (default: { routes: ['/'], crawlLinks: true }) */
	prerender?: PrerenderConfig | false;
	/** Port for prerender server (default: 13172) */
	prerenderPort?: number;
	/**
	 * Keep the shared `entry-client` script (and its modulepreload) in
	 * prerendered HTML. Required when `clientRouter` is enabled so client
	 * navigation can rescan islands after a swap.
	 */
	clientRouter?: boolean;
}

// ─── Cloudflare paths ────────────────────────────────────────────────

/**
 * SSR asset manifest (client CSS/JS) lives in `_ssr/ssr.mjs` for Cloudflare Pages
 * directory workers — not in `index.js` (the fetch entry).
 */
function resolveCloudflareSsrBundle(cwd: string): string | null {
	const ssr = join(cwd, "dist", "_worker.js", "_ssr", "ssr.mjs");
	return isFile(ssr) ? ssr : null;
}

// ─── Cleanup ─────────────────────────────────────────────────────────

function isViteGeneratedHtml(filePath: string): boolean {
	if (!existsSync(filePath)) return false;
	const content = readFileSync(filePath, "utf-8");
	return content.length < 500 && !content.includes("data-framework") && !content.includes("avalon");
}

function cleanupStaleHtml(cwd: string): void {
	for (const htmlPath of [
		"dist/index.html",
		".netlify/functions-internal/server/public/index.html",
		".output/public/index.html",
	]) {
		const full = join(cwd, htmlPath);
		if (isViteGeneratedHtml(full)) {
			unlinkSync(full);
			console.log(`[cleanup] Removed stale Vite template ${htmlPath}`);
		} else if (existsSync(full)) {
			console.log(`[cleanup] Kept ${htmlPath} (not a Vite template)`);
		}
	}
}

// ─── Island sync / redirects ─────────────────────────────────────────

function syncIsolatedIslands(cwd: string, distDir: string): void {
	const islandsDir = join(distDir, "islands");
	if (!existsSync(islandsDir)) return;

	const outputDirs = [
		join(cwd, ".output", "public"),
		join(cwd, ".netlify", "functions-internal", "server", "public"),
	];

	for (const outputDir of outputDirs) {
		if (!existsSync(outputDir)) continue;
		const destIslands = join(outputDir, "islands");
		cpSync(islandsDir, destIslands, { recursive: true, force: true });
	}
	console.log("[islands] Synced isolated islands to output directories");
}

function generateIslandRedirects(distDir: string): void {
	const islandsDir = join(distDir, "islands");
	if (!existsSync(islandsDir)) return;

	const islandFiles = collectFiles(islandsDir, (n) => n.endsWith(".js") && !n.endsWith(".js.map"));
	if (islandFiles.length === 0) return;

	const redirects: string[] = [];
	for (const file of islandFiles) {
		const relPath = file.substring(distDir.length).replaceAll("\\", "/");
		redirects.push(`${relPath}  ${relPath}  200`);
	}

	const redirectsPath = join(distDir, "_redirects");
	const existing = existsSync(redirectsPath) ? readFileSync(redirectsPath, "utf-8") : "";
	const newContent = existing ? `${existing}\n${redirects.join("\n")}` : redirects.join("\n");
	writeFileSync(redirectsPath, newContent);
	console.log(`[redirects] Generated ${redirects.length} island redirect(s)`);
}

// ─── Adapter Copying ─────────────────────────────────────────────────

function copyAdapters(cwd: string, distDir: string): void {
	const adaptersDir = join(cwd, "node_modules", "@useavalon");
	if (!existsSync(adaptersDir)) return;

	const outputDirs = [
		join(distDir, "adapters"),
		join(cwd, ".output", "public", "adapters"),
		join(cwd, ".netlify", "functions-internal", "server", "public", "adapters"),
	];

	for (const outputDir of outputDirs) {
		if (!existsSync(dirname(outputDir))) continue;
		const clientDirs = readdirSync(adaptersDir)
			.map((name) => join(adaptersDir, name, "client"))
			.filter((d) => existsSync(d));

		for (const clientDir of clientDirs) {
			const name = clientDir.split("/").at(-2) || "";
			const dest = join(outputDir, name);
			mkdirSync(dest, { recursive: true });
			cpSync(clientDir, dest, { recursive: true, force: true });
		}
	}
	console.log("[adapters] Copied framework adapters to output directories");
}

// ─── Netlify Function Copying ────────────────────────────────────────

function copyToNetlifyPaths(cwd: string): void {
	const srcDir = join(cwd, ".netlify", "functions-internal");
	const destDir = join(cwd, ".netlify", "v1", "functions");
	if (!existsSync(srcDir)) return;
	mkdirSync(destDir, { recursive: true });
	cpSync(srcDir, destDir, { recursive: true, force: true });
	console.log("[netlify] Copied server function to v1 API paths");
}

// ─── Compress Public Assets ──────────────────────────────────────────

async function recompressPublicAssets(cwd: string): Promise<void> {
	const { promisify } = await import("node:util");
	const zlib = await import("node:zlib");
	const brotli = promisify(zlib.brotliCompress);
	const gzip = promisify(zlib.gzip);

	const publicDirs = [
		join(cwd, ".output", "public"),
		join(cwd, ".netlify", "functions-internal", "server", "public"),
	];

	const compressible = (name: string) =>
		name.endsWith(".js") ||
		name.endsWith(".css") ||
		name.endsWith(".html") ||
		name.endsWith(".svg") ||
		name.endsWith(".txt") ||
		name.endsWith(".xml") ||
		name.endsWith(".json");

	let count = 0;
	for (const pubDir of publicDirs) {
		if (!existsSync(pubDir)) continue;
		const files = collectFiles(pubDir, (n) => compressible(n) && !n.endsWith(".map"));
		for (const file of files) {
			const content = readFileSync(file);
			if (content.length < 256) continue;

			try {
				const [br, gz] = await Promise.all([
					brotli(content, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
					gzip(content, { level: 9 }),
				]);
				writeFileSync(`${file}.br`, br);
				writeFileSync(`${file}.gz`, gz);
				count++;
			} catch {
				// compression failed for this file, skip
			}
		}
	}

	if (count > 0) {
		console.log(`[compress] ✅ Compressed ${count} public asset(s) (brotli + gzip)`);
	}
}

// ─── Nitro Asset Manifest Patching ───────────────────────────────────

function buildManifestEntries(publicDir: string): string[] {
	const htmlFiles = collectFiles(
		publicDir,
		(n) =>
			n === "index.html" ||
			n === "index.html.br" ||
			n === "index.html.gz" ||
			n === "index.html.zst",
	);

	const entries: string[] = [];
	const mtime = new Date().toISOString();

	for (const file of htmlFiles) {
		const relPath = `/${file.substring(publicDir.length + 1).replaceAll("\\", "/")}`;
		const size = readFileSync(file).length;
		const etag = `"${size.toString(16)}-prerender"`;

		let encoding = "";
		if (relPath.endsWith(".br")) encoding = "br";
		else if (relPath.endsWith(".gz")) encoding = "gzip";
		else if (relPath.endsWith(".zst")) encoding = "zstd";

		let entry = `"${relPath}":{type:\`text/html; charset=utf-8\``;
		if (encoding) entry += `,encoding:\`${encoding}\``;
		entry += `,etag:\`${etag}\`,mtime:\`${mtime}\`,size:${size},path:\`../public${relPath}\`}`;
		entries.push(entry);
	}

	return entries;
}

function findPrerenderedRoutes(publicDir: string): string[] {
	const routes: string[] = [];
	if (!existsSync(publicDir)) return routes;
	for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
		if (!entry.isDirectory() && entry.name === "index.html") {
			routes.push("/");
		} else if (entry.isDirectory() && existsSync(join(publicDir, entry.name, "index.html"))) {
			routes.push(`/${entry.name}`);
		}
	}
	return routes;
}

function patchServerManifest(
	serverEntry: string,
	newEntries: string[],
	publicDir: string,
): boolean {
	if (!existsSync(serverEntry)) return false;

	let code = readFileSync(serverEntry, "utf-8");

	const manifestPattern = /("\/favicon\.ico":\{[^}]+\})/;
	const match = manifestPattern.exec(code);
	if (!match) return false;

	const toAdd = newEntries.filter((entry) => {
		const keyMatch = /^"([^"]+)"/.exec(entry);
		return keyMatch && !code.includes(`"${keyMatch[1]}":{`);
	});

	if (toAdd.length > 0) {
		code = code.replace(match[0], `${match[0]},${toAdd.join(",")}`);
	}

	const routes = findPrerenderedRoutes(publicDir);
	const faviconTag = "u===`/favicon.ico`&&d.unshift({data:e})";
	for (const route of routes) {
		if (code.includes(`route:\`${route}\``)) continue;
		const rule = `[{name:\`headers\`,route:\`${route}\`,handler:x,options:{"Cache-Control":\`public, max-age=0, must-revalidate\`}}]`;
		code = code.replace(faviconTag, `${faviconTag};u===\`${route}\`&&d.unshift({data:${rule}})`);
	}

	writeFileSync(serverEntry, code);
	return toAdd.length > 0 || routes.length > 0;
}

function patchNitroAssetManifest(cwd: string): void {
	const serverEntries = [
		join(cwd, ".output", "server", "index.mjs"),
		join(cwd, ".netlify", "functions-internal", "server", "index.mjs"),
	];

	const publicDir = join(cwd, ".output", "public");
	if (!existsSync(publicDir)) return;

	const newEntries = buildManifestEntries(publicDir);
	if (newEntries.length === 0) return;

	let patchedCount = 0;
	for (const serverEntry of serverEntries) {
		if (patchServerManifest(serverEntry, newEntries, publicDir)) patchedCount++;
	}

	if (patchedCount > 0) {
		console.log(
			`[manifest] ✅ Registered ${newEntries.length} prerendered HTML file(s) in Nitro asset manifest`,
		);
	}
}

// ─── Main Entry Point ────────────────────────────────────────────────

export async function runPostBuild(options: PostBuildOptions = {}): Promise<void> {
	const cwd = options.cwd ?? process.cwd();
	const distDir = join(cwd, "dist");
	const prerenderPort = options.prerenderPort ?? 13172;

	cleanupStaleHtml(cwd);
	copySSRCSSToClient(cwd, distDir);

	for (const ssrPath of [
		join(cwd, ".netlify", "functions-internal", "server", "_ssr", "ssr.mjs"),
		join(cwd, ".netlify", "v1", "functions", "server", "_ssr", "ssr.mjs"),
		join(cwd, ".output", "server", "_ssr", "ssr.mjs"),
		resolveCloudflareSsrBundle(cwd),
	]) {
		if (!ssrPath) continue;
		if (isFile(ssrPath)) {
			console.log(`[patch] Patching ${ssrPath}`);
			patchSSRBundleCSS(ssrPath, distDir, cwd);
		}
	}

	await ensureIsolatedIslands(cwd, distDir);
	syncIsolatedIslands(cwd, distDir);
	generateIslandRedirects(distDir);
	copyAdapters(cwd, distDir);
	copyToNetlifyPaths(cwd);
	patchCloudflareWorkerOutput(cwd);

	if (options.prerender !== false && process.env.AVALON_SKIP_PRERENDER !== "1") {
		await prerenderIfConfigured(
			cwd,
			distDir,
			options.prerender ?? {},
			prerenderPort,
			options.clientRouter,
		);
	}

	patchCloudflareRoutesAfterPrerender(cwd);

	injectIslandDepsPreloads(cwd, distDir);
	optimizePrerenderedHtml(cwd, distDir);
	await recompressPublicAssets(cwd);
	patchNitroAssetManifest(cwd);

	console.log("[post-build] ✅ Complete");
}
