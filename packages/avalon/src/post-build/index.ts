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
 *
 * Usage:
 *   import { runPostBuild } from '@useavalon/avalon/post-build';
 *   await runPostBuild();
 *
 * With custom prerender config:
 *   await runPostBuild({
 *     prerender: { routes: ['/'], crawlLinks: true, ignore: ['/admin'] },
 *   });
 */

import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

export interface PrerenderConfig {
	/** Routes to prerender (default: ['/']) */
	routes?: string[];
	/** Crawl links found in prerendered pages (default: true) */
	crawlLinks?: boolean;
	/** Routes to ignore (default: []) */
	ignore?: string[];
	/** Fail build on prerender errors (default: false) */
	failOnError?: boolean;
	/** Max concurrent fetches (default: 4) */
	concurrency?: number;
	/** Create index.html in subdirectories (default: true) */
	autoSubfolderIndex?: boolean;
	/** Number of retry attempts (default: 3) */
	retry?: number;
	/** Delay between retries in ms (default: 500) */
	retryDelay?: number;
}

export interface PostBuildOptions {
	/** Project root directory (default: process.cwd()) */
	cwd?: string;
	/** Prerender configuration (default: { routes: ['/'], crawlLinks: true }) */
	prerender?: PrerenderConfig | false;
	/** Port for prerender server (default: 13172) */
	prerenderPort?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function collectFiles(
	dir: string,
	predicate: (name: string) => boolean,
	result: string[] = [],
): string[] {
	if (!existsSync(dir)) return result;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			collectFiles(full, predicate, result);
		} else if (predicate(entry.name)) {
			result.push(full);
		}
	}
	return result;
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
			console.log(`[cleanup] Preserved prerendered ${htmlPath}`);
		}
	}
}

// ─── CSS Patching ────────────────────────────────────────────────────

function patchSSRBundleCSS(ssrBundlePath: string, distDir: string, cwd: string): void {
	if (!existsSync(ssrBundlePath)) return;

	const assetsDir = join(distDir, "assets");
	const assetsDirs = [
		assetsDir,
		join(cwd, ".netlify", "functions-internal", "server", "public", "assets"),
		join(cwd, ".output", "public", "assets"),
	];
	const foundAssetsDir = assetsDirs.find((d) => existsSync(d));
	if (!foundAssetsDir) return;

	const allCssPaths = collectFiles(foundAssetsDir, (n) => n.endsWith(".css"))
		.filter((f) => {
			const name = (f.split("/").pop() || "").toLowerCase();
			if (name.includes("_isolated-island-entry")) return false;
			if (name.startsWith("entry-client")) return true;
			if (name.startsWith("index-")) return true;
			return false;
		})
		.map((f) => {
			const rel = f.substring(foundAssetsDir.length).replaceAll("\\", "/");
			return `/assets${rel}`;
		});

	// Include ssr-index only when no index-*.css exists (they have the same content)
	if (!allCssPaths.some((p) => /\/index-[^/]+\.css$/.test(p))) {
		const ssrPaths = collectFiles(foundAssetsDir, (n) => n.endsWith(".css"))
			.filter((f) => (f.split("/").pop() || "").toLowerCase().startsWith("ssr-index"))
			.map((f) => `/assets${f.substring(foundAssetsDir.length).replaceAll("\\", "/")}`);
		allCssPaths.push(...ssrPaths);
	}
	console.log(`[patch] Found ${allCssPaths.length} CSS files in ${foundAssetsDir}`);

	let code = readFileSync(ssrBundlePath, "utf-8");

	const patterns = [
		{ re: /css:\[(\{href:`[^`]+`\}(?:,\{href:`[^`]+`\})*)\]/, hrefRe: /href:`([^`]+)`/g, q: "`" },
		{ re: /css:\[(\{href:"[^"]+"\}(?:,\{href:"[^"]+"\})*)\]/, hrefRe: /href:"([^"]+)"/g, q: '"' },
	];

	for (const { re, hrefRe, q } of patterns) {
		const match = re.exec(code);
		if (!match) continue;

		const existingSet = new Set([...match[1].matchAll(hrefRe)].map((m) => m[1]));
		const newPaths = allCssPaths.filter((p) => !existingSet.has(p));
		if (newPaths.length === 0) {
			console.log("[patch] All CSS already included");
			return;
		}

		const newEntries = newPaths.map((p) => `{href:${q}${p}${q}}`).join(",");
		code = code.replace(match[0], `css:[${match[1]},${newEntries}]`);
		writeFileSync(ssrBundlePath, code);
		console.log(`[patch] ✅ Added ${newPaths.length} CSS files to SSR bundle`);
		return;
	}

	console.warn("[patch] Could not find CSS array in SSR bundle");
}

/**
 * Simple CSS minification — removes comments, extra whitespace, and newlines.
 * Good enough for production; avoids adding a heavy dependency.
 */
function minifyCSS(css: string): string {
	return css
		.replaceAll(/\/\*[\s\S]*?\*\//g, "")
		.replaceAll(/\s+/g, " ")
		.replaceAll(/\s*([{}:;,>~+])\s*/g, "$1")
		.replaceAll(/;}/g, "}")
		.trim();
}

function copySSRCSSToClient(cwd: string, distDir: string): void {
	// Skip if the client build already emitted entry-client CSS (which contains
	// the same global + layout styles). The ssr-index copy is only needed when
	// the client build does not produce its own CSS bundle.
	const clientAssets = join(distDir, "assets");
	if (existsSync(clientAssets)) {
		const hasClientCSS = readdirSync(clientAssets).some(
			(f) => f.startsWith("entry-client") && f.endsWith(".css"),
		);
		if (hasClientCSS) {
			console.log("[ssr-css] Skipped — client build already includes entry-client CSS");
			return;
		}
	}

	const ssrAssetsDirs = [join(cwd, "node_modules", ".nitro", "vite", "services", "ssr", "assets")];

	for (const ssrAssetsDir of ssrAssetsDirs) {
		if (!existsSync(ssrAssetsDir)) continue;
		const cssFiles = readdirSync(ssrAssetsDir).filter((f) => f.endsWith(".css"));
		if (cssFiles.length === 0) continue;

		const destDirs = [
			join(distDir, "assets"),
			join(cwd, ".output", "public", "assets"),
			join(cwd, ".netlify", "functions-internal", "server", "public", "assets"),
		];
		for (const destDir of destDirs) {
			mkdirSync(destDir, { recursive: true });
			for (const file of cssFiles) {
				// Minify CSS before copying — SSR build output is unminified
				let css = readFileSync(join(ssrAssetsDir, file), "utf-8");
				css = minifyCSS(css);
				writeFileSync(join(destDir, `ssr-${file}`), css);
			}
		}
		const sampleFile = cssFiles[0];
		const destName = `ssr-${sampleFile}`;
		const destPath = join(destDirs.find((d) => existsSync(d)) || destDirs[0], destName);
		const size = existsSync(destPath) ? readFileSync(destPath).length : 0;
		console.log(`[ssr-css] Copied SSR CSS → /assets/${destName} (${size} bytes, minified)`);

		// Patch asset manifests (skip silently for Netlify which has no per-file manifest)
		const nitroIndexPaths = [
			join(cwd, ".output", "server", "index.mjs"),
			join(cwd, ".netlify", "functions-internal", "server", "main.mjs"),
		];
		for (const indexPath of nitroIndexPaths) {
			if (!existsSync(indexPath)) continue;
			let code = readFileSync(indexPath, "utf-8");
			const assetKey = `/assets/${destName}`;
			if (code.includes(assetKey)) continue;
			const existingCssRe = /"\/assets\/[^"]+\.css":\{type:`text\/css[^}]+\}/;
			const match = existingCssRe.exec(code);
			if (match) {
				const mtime = new Date().toISOString();
				const etag = `"${size.toString(16)}-ssr"`;
				const newEntry = `,"${assetKey}":{type:\`text/css; charset=utf-8\`,etag:\`${etag}\`,mtime:\`${mtime}\`,size:${size},path:\`../public/assets/${destName}\`}`;
				code = code.replace(match[0], match[0] + newEntry);
				writeFileSync(indexPath, code);
				console.log(`[ssr-css] ✅ Patched asset manifest in ${indexPath}`);
			}
		}
		return;
	}
	console.log("[ssr-css] No SSR CSS files found");
}

// ─── Ensure Isolated Islands ─────────────────────────────────────────

/**
 * Rebuild any island files in dist/ that are still code-split (contain
 * relative imports to shared chunks). The isolated builder normally runs
 * in Vite's closeBundle hook, but the build process may terminate before
 * all frameworks finish compiling. This function acts as a safety net.
 */
async function ensureIsolatedIslands(cwd: string, distDir: string): Promise<void> {
	const islandsDir = join(distDir, "islands");
	if (!existsSync(islandsDir)) return;

	const islandFiles = collectFiles(islandsDir, (n) => n.endsWith(".js") && !n.endsWith(".js.map"));
	if (islandFiles.length === 0) return;

	// Check which islands are still code-split (have relative imports to shared chunks)
	const staleIslands: Array<{ filePath: string; bundleKey: string; framework: string }> = [];
	for (const file of islandFiles) {
		const content = readFileSync(file, "utf-8");
		// Code-split islands import from shared chunks via relative paths like from"../../assets/
		// Self-contained isolated builds have no such imports (everything is inlined).
		const hasSharedImports = /from\s*["']\.\.\//.test(content);
		if (!hasSharedImports) continue;

		// Determine framework from filename
		const relPath = file.substring(islandsDir.length + 1).replace(/\.js$/, "");
		let framework = "preact";
		if (file.includes(".solid.")) framework = "solid";
		else if (file.includes(".vue.")) framework = "vue";
		else if (file.endsWith(".vue.js")) framework = "vue";
		else if (file.includes(".svelte.")) framework = "svelte";
		else if (file.includes(".react.")) framework = "react";
		else if (file.includes(".lit.")) framework = "lit";
		else if (file.includes(".qwik.")) framework = "qwik";

		// Qwik and Lit are skipped by the isolated builder
		if (framework === "qwik" || framework === "lit") continue;

		// Resolve the original source file from the bundle key
		const srcFile = join(cwd, `${relPath}.tsx`);
		const srcFileTs = join(cwd, `${relPath}.ts`);
		const srcFileVue = join(cwd, `${relPath}`).replace(/\.vue$/, ".vue");
		const srcFileSvelte = join(cwd, `${relPath}`).replace(/\.svelte$/, ".svelte");

		let resolvedSrc: string | null = null;
		for (const candidate of [srcFile, srcFileTs, srcFileVue, srcFileSvelte]) {
			if (existsSync(candidate)) {
				resolvedSrc = candidate;
				break;
			}
		}

		if (!resolvedSrc) {
			console.warn(`[islands] ⚠ Cannot find source for stale island: ${relPath}`);
			continue;
		}

		staleIslands.push({ filePath: resolvedSrc, bundleKey: relPath, framework });
	}

	if (staleIslands.length === 0) return;

	console.log(`[islands] Found ${staleIslands.length} island(s) still code-split, rebuilding...`);

	try {
		const { buildIsolatedIslands } = await import("./isolated-island-builder.ts");

		const islandsMap = new Map<
			string,
			{ filePath: string; bundleKey: string; framework: string }
		>();
		for (const island of staleIslands) {
			islandsMap.set(island.filePath, island);
		}

		await buildIsolatedIslands(cwd, "dist", islandsMap, [], {});
	} catch (err) {
		console.error(
			`[islands] ❌ Failed to rebuild stale islands: ${err instanceof Error ? err.message : err}`,
		);
	}
}

// ─── Sync Isolated Islands ───────────────────────────────────────────

/**
 * Copy isolated island builds from dist/ to .output/public/ and .netlify/.
 *
 * Nitro copies dist/ before the isolated builder finishes, so the output
 * directories contain stale code-split versions. This overwrites them with
 * the self-contained isolated builds and removes stale compressed files.
 */
function syncIsolatedIslands(cwd: string, distDir: string): void {
	const srcIslands = join(distDir, "islands");
	if (!existsSync(srcIslands)) return;

	const destDirs = [
		join(cwd, ".output", "public"),
		join(cwd, ".netlify", "functions-internal", "server", "public"),
	];

	let copied = 0;
	const islandFiles = collectFiles(srcIslands, (n) => n.endsWith(".js") && !n.endsWith(".js.map"));

	for (const destPublic of destDirs) {
		if (!existsSync(destPublic)) continue;
		const destBase = join(destPublic, "islands");
		for (const srcFile of islandFiles) {
			const relPath = srcFile.substring(srcIslands.length);
			const destFile = join(destBase, relPath);
			mkdirSync(dirname(destFile), { recursive: true });
			copyFileSync(srcFile, destFile);
			copied++;
			for (const ext of [".br", ".gz", ".zst"]) {
				const compressed = destFile + ext;
				if (existsSync(compressed)) {
					unlinkSync(compressed);
				}
			}
		}
	}

	if (copied > 0) {
		console.log(`[islands] ✅ Synced ${copied} isolated island build(s) to output`);
	}
}

// ─── Island Redirects ────────────────────────────────────────────────

function generateIslandRedirects(distDir: string): void {
	// Islands may be output to dist/assets/islands/ (hashed) or dist/islands/ (clean)
	const candidates = [join(distDir, "assets", "islands"), join(distDir, "islands")];
	const islandsDir = candidates.find((d) => existsSync(d));
	if (!islandsDir) {
		// Islands are served directly — no redirects needed
		return;
	}

	const islandFiles = collectFiles(islandsDir, (n) => n.endsWith(".js") && !n.endsWith(".js.map"));
	if (islandFiles.length === 0) return;

	// Only generate redirects for hashed filenames (e.g., Counter-abc123.js)
	const hashedFiles = islandFiles.filter((f) => /-[A-Za-z0-9_-]{6,12}\.js$/.test(f));
	if (hashedFiles.length === 0) {
		console.log(
			`[redirects] ${islandFiles.length} island(s) found with clean paths — no redirects needed`,
		);
		return;
	}

	const redirectLines: string[] = [];

	for (const absPath of hashedFiles) {
		const servePath = `/${relative(distDir, absPath).replaceAll("\\", "/")}`;
		const cleanPath = servePath
			.replace("/assets/", "/")
			.replace(/-[A-Za-z0-9_-]{6,12}\.js$/, ".js");

		redirectLines.push(`${cleanPath}  ${servePath}  200`);

		// Copy to clean path for local vite preview
		const cleanAbsPath = join(distDir, cleanPath.slice(1));
		mkdirSync(dirname(cleanAbsPath), { recursive: true });
		copyFileSync(absPath, cleanAbsPath);
	}

	const redirectsPath = join(distDir, "_redirects");
	let existing = existsSync(redirectsPath) ? readFileSync(redirectsPath, "utf-8") : "";
	existing = existing
		.replaceAll(/# Island JS path rewrites[^\n]*\n(?:\/islands\/[^\n]*\n)*/g, "")
		.trim();
	const header = "# Island JS path rewrites (generated by Avalon post-build)\n";
	const content = existing
		? `${existing}\n\n${header}${redirectLines.join("\n")}\n`
		: `${header + redirectLines.join("\n")}\n`;
	writeFileSync(redirectsPath, content);
	console.log(`[redirects] ✅ Wrote ${redirectLines.length} island redirects + local copies`);
}

// ─── Adapters ────────────────────────────────────────────────────────

function copyAdapters(cwd: string, distDir: string): void {
	const sources = [join(cwd, ".output", "public", "_adapters"), join(distDir, "_adapters")];

	for (const srcDir of sources) {
		if (!existsSync(srcDir)) continue;
		const files = readdirSync(srcDir).filter((f) => f.endsWith(".js"));
		if (files.length === 0) continue;

		const destDir = join(distDir, "_adapters");
		mkdirSync(destDir, { recursive: true });

		for (const file of files) {
			const src = join(srcDir, file);
			const dest = join(destDir, file);
			if (src !== dest) copyFileSync(src, dest);
		}
		console.log(`[adapters] ✅ Copied ${files.length} framework adapters`);
		return;
	}

	console.log("[adapters] No _adapters/ directory found");
}

// ─── Netlify Function Copying ────────────────────────────────────────

function copyToNetlifyPaths(cwd: string): void {
	const legacyDir = join(cwd, ".netlify", "functions-internal", "server");
	if (!existsSync(legacyDir)) return;

	const targets = [join(cwd, ".netlify", "v1", "functions", "server")];

	for (const target of targets) {
		cpSync(legacyDir, target, { recursive: true, force: true });
		const rel = target.substring(cwd.length).replaceAll("\\", "/");
		console.log(`[netlify-fn] ✅ Copied server function to ${rel}/`);
	}
}

// ─── Prerender ───────────────────────────────────────────────────────

function isNetlifyHandler(serverEntryPath: string): boolean {
	const code = readFileSync(serverEntryPath, "utf-8");
	return code.includes('path: "/*"') || code.includes("path:`/*`");
}

function writeNetlifyWrapper(mainMjsPath: string, port: number, cwd: string): string {
	const wrapperPath = join(dirname(mainMjsPath), "_prerender-server.mjs");

	let polyfillImport = "";
	const polyfillPaths = [
		join(cwd, "node_modules", "urlpattern-polyfill", "index.js"),
		join(cwd, "node_modules", "urlpattern-polyfill", "dist", "urlpattern.js"),
	];
	const polyfillPath = polyfillPaths.find((p) => existsSync(p));
	if (polyfillPath) {
		polyfillImport = `import '${polyfillPath.replaceAll("\\", "/")}';`;
	}

	const wrapperCode = `
${polyfillImport}
import { createServer } from 'node:http';
import handler from './main.mjs';
const PORT = ${port};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:' + PORT);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const request = new Request(url.toString(), { method: req.method, headers });
    const response = await handler(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    const body = await response.text();
    res.end(body);
  } catch (err) {
    console.error('[prerender-wrapper] Error:', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('[prerender-wrapper] Listening on http://127.0.0.1:' + PORT);
});
`;
	writeFileSync(wrapperPath, wrapperCode);
	return wrapperPath;
}

function extractLinks(html: string): string[] {
	const links: string[] = [];
	const re = /<a\s[^>]*href=["']([^"'#?]+)/gi;
	let m: RegExpExecArray | null = null;
	for (m = re.exec(html); m !== null; m = re.exec(html)) {
		const href = m[1];
		if (
			href.startsWith("/") &&
			!href.startsWith("//") &&
			!href.startsWith("/assets/") &&
			!href.startsWith("/islands/") &&
			!href.startsWith("/chunks/") &&
			!href.startsWith("/_") &&
			!href.match(/\.\w{2,5}$/)
		) {
			links.push(href);
		}
	}
	return [...new Set(links)];
}

async function prerenderIfConfigured(
	cwd: string,
	distDir: string,
	config: PrerenderConfig,
	port: number,
): Promise<void> {
	// Netlify paths first — when NITRO_PRESET=netlify the fresh build
	// lands here, while .output/ may contain a stale previous build.
	const serverEntries = [
		join(cwd, ".netlify", "functions-internal", "server", "server.mjs"),
		join(cwd, ".netlify", "v1", "functions", "server", "server.mjs"),
		join(cwd, ".output", "server", "index.mjs"),
	];
	const serverEntry = serverEntries.find((p) => existsSync(p));
	if (!serverEntry) {
		console.log("[prerender] No server entry found, skipping prerender");
		return;
	}

	const outputDirs = [join(cwd, ".output", "public"), distDir];
	const outputDir = outputDirs.find((d) => existsSync(d));
	if (!outputDir) {
		console.log("[prerender] No output directory found, skipping prerender");
		return;
	}

	const prerenderConfig = {
		routes: config.routes ?? ["/"],
		crawlLinks: config.crawlLinks ?? true,
		ignore: config.ignore ?? [],
		failOnError: config.failOnError ?? false,
		concurrency: config.concurrency ?? 4,
		autoSubfolderIndex: config.autoSubfolderIndex ?? true,
		retry: config.retry ?? 3,
		retryDelay: config.retryDelay ?? 500,
	};

	const baseUrl = `http://localhost:${port}`;
	const netlifyMode = isNetlifyHandler(serverEntry);
	let actualEntry = serverEntry;

	if (netlifyMode) {
		const mainMjsPath = join(dirname(serverEntry), "main.mjs");
		if (!existsSync(mainMjsPath)) {
			console.error("[prerender] Netlify handler detected but main.mjs not found");
			return;
		}
		actualEntry = writeNetlifyWrapper(mainMjsPath, port, cwd);
		console.log(`[prerender] Netlify handler detected — using wrapper`);
	}

	// Patch HTML asset entries out of server manifests so SSR runs fresh
	{
		const filesToPatch = [serverEntry, join(dirname(serverEntry), "main.mjs")].filter((f) =>
			existsSync(f),
		);
		for (const filePath of filesToPatch) {
			let serverCode = readFileSync(filePath, "utf-8");
			const htmlKeyRe = /"\/[^"]*\.html":\{[^}]+\},?/g;
			const before = serverCode.length;
			serverCode = serverCode.replaceAll(htmlKeyRe, "");
			if (before !== serverCode.length) {
				writeFileSync(filePath, serverCode);
				console.log(`[prerender] Patched ${relative(cwd, filePath)}: removed HTML asset entries`);
			}
		}
	}

	console.log(`[prerender] Starting prerender with server: ${relative(cwd, actualEntry)}`);

	const { spawn: spawnProcess } = await import("node:child_process");
	let serverProcess: ReturnType<typeof spawnProcess> | undefined;
	try {
		serverProcess = spawnProcess("node", [actualEntry], {
			env: {
				...process.env,
				PORT: String(port),
				NITRO_PORT: String(port),
				HOST: "127.0.0.1",
				NITRO_HOST: "127.0.0.1",
				NODE_ENV: "production",
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		serverProcess.stdout?.on("data", (data: Buffer) => {
			const msg = data.toString().trim();
			if (msg) console.log(`[prerender:server] ${msg}`);
		});
		serverProcess.stderr?.on("data", (data: Buffer) => {
			const msg = data.toString().trim();
			if (msg) console.error(`[prerender:server:err] ${msg}`);
		});

		const startWait = Date.now();
		let ready = false;
		while (Date.now() - startWait < 15_000) {
			try {
				const res = await fetch(`${baseUrl}/`);
				if (res.ok || res.status < 500) {
					ready = true;
					break;
				}
			} catch {
				/* not ready */
			}
			await new Promise((r) => setTimeout(r, 200));
		}
		if (!ready) throw new Error("Server did not become ready within 15s");
		console.log(`[prerender] Server ready at ${baseUrl}`);
	} catch (err) {
		serverProcess?.kill("SIGKILL");
		console.error("[prerender] Failed to start server:", (err as Error).message);
		return;
	}

	const visited = new Set<string>();
	const queue = [...prerenderConfig.routes];
	const prerendered: string[] = [];
	const errors: Array<{ route: string; error: string }> = [];

	function matchesIgnore(route: string): boolean {
		for (const pattern of prerenderConfig.ignore) {
			if (typeof pattern === "string" && route === pattern) return true;
			if (
				typeof pattern === "string" &&
				pattern.endsWith("/**") &&
				route.startsWith(pattern.slice(0, -2))
			)
				return true;
		}
		return false;
	}

	try {
		while (queue.length > 0) {
			const batch = queue.splice(0, prerenderConfig.concurrency);
			await Promise.all(
				batch.map(async (route) => {
					const normalized = route.endsWith("/") && route !== "/" ? route.slice(0, -1) : route;
					if (visited.has(normalized)) return;
					visited.add(normalized);
					if (matchesIgnore(normalized)) return;

					let result: { html: string; status: number } | null = null;
					for (let attempt = 1; attempt <= prerenderConfig.retry; attempt++) {
						try {
							const res = await fetch(`${baseUrl}${normalized}`);
							result = { html: await res.text(), status: res.status };
							break;
						} catch {
							if (attempt < prerenderConfig.retry)
								await new Promise((r) => setTimeout(r, prerenderConfig.retryDelay));
						}
					}

					if (!result) {
						errors.push({
							route: normalized,
							error: `Failed after ${prerenderConfig.retry} attempts`,
						});
						return;
					}
					if (result.status >= 400) {
						errors.push({ route: normalized, error: `Returned ${result.status}` });
						return;
					}

					const fileName = prerenderConfig.autoSubfolderIndex
						? join(normalized, "index.html")
						: `${normalized}.html`;
					const outputPath = join(outputDir, fileName);
					mkdirSync(dirname(outputPath), { recursive: true });
					const stamped = result.html.replace(
						"<!DOCTYPE html>",
						"<!DOCTYPE html>\n<!-- SSG: prerendered at build time -->",
					);
					// Strip phantom _isolated-island-entry CSS from prerendered HTML.
					// Keep: entry-client CSS, ssr-index CSS, index CSS (contains all CSS module styles),
					// and any other non-phantom CSS.
					const cleaned = stamped.replaceAll(
						/<link rel="stylesheet" href="\/assets\/[^"]*\.css">\n?/g,
						(match) => {
							if (match.includes("_isolated-island-entry")) return "";
							return match;
						},
					);
					// Strip empty entry-client JS and its duplicate CSS.
					// Per-island hydration mode produces a 0-byte entry-client.js
					// and entry-client CSS that duplicates index CSS.
					let final = cleaned;
					final = final.replaceAll(
						/<script type="module" src="\/assets\/entry-client[^"]*\.js"><\/script>\n?/g,
						"",
					);
					final = final.replaceAll(
						/<link rel="stylesheet" href="\/assets\/entry-client[^"]*\.css">\n?/g,
						"",
					);
					final = final.replaceAll(
						/<link rel="modulepreload" href="\/assets\/entry-client[^"]*\.js">\n?/g,
						"",
					);
					writeFileSync(outputPath, final);
					prerendered.push(normalized);
					console.log(`[prerender] ✅ ${normalized} → ${fileName}`);

					if (prerenderConfig.crawlLinks) {
						for (const link of extractLinks(result.html)) {
							const norm = link.endsWith("/") && link !== "/" ? link.slice(0, -1) : link;
							if (!visited.has(norm) && !matchesIgnore(norm)) queue.push(norm);
						}
					}
				}),
			);
		}
	} finally {
		console.log("[prerender] Shutting down server...");
		serverProcess?.kill("SIGKILL");
	}

	console.log(
		`[prerender] Done: ${prerendered.length} page(s) prerendered` +
			(errors.length > 0 ? `, ${errors.length} error(s)` : ""),
	);

	// Clean up wrapper
	if (netlifyMode) {
		const wrapperPath = join(dirname(serverEntry), "_prerender-server.mjs");
		if (existsSync(wrapperPath)) {
			unlinkSync(wrapperPath);
			console.log("[prerender] Cleaned up wrapper script");
		}
	}

	// Copy prerendered files to all output locations
	if (prerendered.length > 0) {
		const altOutputDirs = [
			distDir,
			join(cwd, ".netlify", "functions-internal", "server", "public"),
			join(cwd, ".netlify", "v1", "functions", "server", "public"),
		].filter((d) => d !== outputDir && existsSync(dirname(d)));

		for (const altDir of altOutputDirs) {
			for (const route of prerendered) {
				const fileName = join(route, "index.html");
				const srcPath = join(outputDir, fileName);
				const destPath = join(altDir, fileName);
				if (existsSync(srcPath)) {
					mkdirSync(dirname(destPath), { recursive: true });
					copyFileSync(srcPath, destPath);
				}
			}
		}
		if (altOutputDirs.length > 0) {
			console.log(
				`[prerender] Copied prerendered HTML to ${altOutputDirs.length} additional output dir(s)`,
			);
		}
	}
}

// ─── Island Dependency Modulepreload ──────────────────────────────────

/**
 * Inject `<link rel="modulepreload">` hints for island dependency chunks
 * into prerendered HTML files. This eliminates the waterfall where the browser
 * loads an island JS file, discovers its imports, then fetches them.
 *
 * Two strategies:
 * 1. Reads island-deps.json (from isolated island builder) if available
 * 2. Falls back to scanning island JS files for static import statements
 */
function injectIslandDepsPreloads(cwd: string, distDir: string): void {
	// Strategy 1: Use island-deps.json from isolated builder
	let depsManifest: Record<string, string[]> = {};
	const depsPath = join(distDir, "island-deps.json");
	if (existsSync(depsPath)) {
		try {
			depsManifest = JSON.parse(readFileSync(depsPath, "utf-8"));
		} catch {
			/* ignore */
		}
	}

	// Strategy 2: Scan island JS files for static imports
	const outputDir = join(cwd, ".output", "public");
	if (Object.keys(depsManifest).length === 0 && existsSync(outputDir)) {
		const islandFiles = collectFiles(
			join(outputDir, "islands"),
			(n) => n.endsWith(".js") && !n.endsWith(".js.map"),
		);
		for (const islandFile of islandFiles) {
			const relPath = `/${islandFile.substring(outputDir.length + 1).replaceAll("\\", "/")}`;
			const code = readFileSync(islandFile, "utf-8");
			// Extract static import paths: import{...}from"path" or import "path"
			const importRegex = /\bfrom\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;
			const deps: string[] = [];
			let m: RegExpExecArray | null;
			for (m = importRegex.exec(code); m !== null; m = importRegex.exec(code)) {
				const importPath = m[1] || m[2];
				if (importPath && (importPath.includes("/assets/") || importPath.startsWith("."))) {
					// Resolve relative paths to absolute
					const resolved = importPath.startsWith(".")
						? `/${join(dirname(relPath.slice(1)), importPath)
								.replaceAll("\\", "/")
								.replace(/^\/+/, "")}`
						: importPath;
					// Normalize path (remove ../ segments)
					const parts = resolved.split("/").filter(Boolean);
					const normalized: string[] = [];
					for (const part of parts) {
						if (part === "..") normalized.pop();
						else if (part !== ".") normalized.push(part);
					}
					deps.push(`/${normalized.join("/")}`);
				}
			}
			if (deps.length > 0) {
				depsManifest[relPath] = deps;
			}
		}
	}

	if (Object.keys(depsManifest).length === 0) return;

	// Find all prerendered HTML files and inject modulepreload hints
	const htmlDirs = [join(cwd, ".output", "public"), distDir];

	let patchedCount = 0;
	for (const htmlDir of htmlDirs) {
		if (!existsSync(htmlDir)) continue;
		const htmlFiles = collectFiles(htmlDir, (n) => n === "index.html");
		for (const htmlFile of htmlFiles) {
			let html = readFileSync(htmlFile, "utf-8");
			const preloadHints = new Set<string>();

			for (const [islandPath, deps] of Object.entries(depsManifest)) {
				if (html.includes(islandPath)) {
					for (const dep of deps) {
						if (!html.includes(`href="${dep}"`)) {
							preloadHints.add(dep);
						}
					}
				}
			}

			if (preloadHints.size === 0) continue;

			const hints = Array.from(preloadHints)
				.map((href) => `<link rel="modulepreload" href="${href}">`)
				.join("\n");

			if (html.includes("</head>")) {
				html = html.replace("</head>", `${hints}\n</head>`);
				writeFileSync(htmlFile, html);
				patchedCount++;
			}
		}
	}

	if (patchedCount > 0) {
		console.log(
			`[modulepreload] ✅ Injected dependency preloads into ${patchedCount} HTML file(s)`,
		);
	}
}

// ─── Compress Public Assets ──────────────────────────────────────────

/**
 * Re-compress all JS, CSS, and HTML files in public output directories
 * using brotli, gzip, and zstd. Runs after all post-build modifications
 * so compressed versions stay in sync with the source files.
 */
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
			if (content.length < 256) continue; // skip tiny files

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

// ─── Main Entry Point ────────────────────────────────────────────────

/**
 * Run all post-build tasks.
 *
 * Usage in consumer's post-build.mjs:
 * ```js
 * import { runPostBuild } from '@useavalon/avalon/post-build';
 * await runPostBuild();
 * ```
 */
export async function runPostBuild(options: PostBuildOptions = {}): Promise<void> {
	const cwd = options.cwd ?? process.cwd();
	const distDir = join(cwd, "dist");
	const prerenderPort = options.prerenderPort ?? 13172;

	// 1. Cleanup stale HTML
	cleanupStaleHtml(cwd);

	// 2. Copy SSR CSS to client assets
	copySSRCSSToClient(cwd, distDir);

	// 3. Patch SSR bundle CSS array — adds global CSS (index-*.css, ssr-index-*.css)
	// to the client manifest in the SSR bundle. The client manifest only includes
	// entry-client CSS, but index-*.css (all CSS module styles) is needed globally.
	// Island-specific CSS (Counter-*, DocsSidebar-*, etc.) is excluded by the filter.
	for (const ssrPath of [
		join(cwd, ".netlify", "functions-internal", "server", "_ssr", "ssr.mjs"),
		join(cwd, ".netlify", "v1", "functions", "server", "_ssr", "ssr.mjs"),
		join(cwd, ".output", "server", "_ssr", "ssr.mjs"),
	]) {
		if (existsSync(ssrPath)) {
			console.log(`[patch] Patching ${ssrPath}`);
			patchSSRBundleCSS(ssrPath, distDir, cwd);
		}
	}

	// 4. Rebuild any islands that are still code-split
	await ensureIsolatedIslands(cwd, distDir);

	// 5. Sync isolated island builds to output directories
	syncIsolatedIslands(cwd, distDir);

	// 6. Island redirects + local copies
	generateIslandRedirects(distDir);

	// 7. Copy framework adapters
	copyAdapters(cwd, distDir);

	// 8. Copy to Netlify function paths
	copyToNetlifyPaths(cwd);

	// 7. Prerender (if not disabled)
	if (options.prerender !== false) {
		await prerenderIfConfigured(cwd, distDir, options.prerender ?? {}, prerenderPort);
	}

	// 9. Inject modulepreload hints for island dependencies into prerendered HTML
	injectIslandDepsPreloads(cwd, distDir);

	// 10. Re-compress public assets (brotli, gzip, zstd).
	// Nitro compresses during the build, but the post-build overwrites island
	// files and CSS after that. Re-compress to keep compressed versions in sync.
	await recompressPublicAssets(cwd);

	console.log("[post-build] ✅ Complete");
}
