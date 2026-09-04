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
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fetchHandlerWrapperSource } from "./fetch-handler-wrapper.ts";

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

function isFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

/** Cloudflare Pages emits `_worker.js` as a file or as a directory with `index.js`. */
function resolveCloudflareWorker(cwd: string): string | null {
	const root = join(cwd, "dist", "_worker.js");
	if (isFile(root)) return root;
	if (!existsSync(root)) return null;
	for (const name of ["index.js", "index.mjs"]) {
		const nested = join(root, name);
		if (isFile(nested)) return nested;
	}
	return null;
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

// ─── CSS Patching ────────────────────────────────────────────────────

function minifyCSS(css: string): string {
	return css
		.replaceAll(/\/\*[\s\S]*?\*\//g, "")
		.replaceAll(/\s+/g, " ")
		.replaceAll(/\s*([{}:;,])\s*/g, "$1")
		.trim();
}

function patchSSRBundleCSS(ssrBundlePath: string, distDir: string, cwd: string): void {
	if (!isFile(ssrBundlePath)) return;

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

// ─── Copy SSR CSS to Client ──────────────────────────────────────────

function copySSRCSSToClient(cwd: string, distDir: string): void {
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

// ─── Island Isolation ────────────────────────────────────────────────

async function ensureIsolatedIslands(cwd: string, distDir: string): Promise<void> {
	const islandsDir = join(distDir, "islands");
	if (!existsSync(islandsDir)) {
		console.log("[islands] No islands directory found, skipping isolation");
		return;
	}

	const islandFiles = collectFiles(islandsDir, (n) => n.endsWith(".js") && !n.endsWith(".js.map"));
	const needsRebuild = islandFiles.some((f) => {
		const code = readFileSync(f, "utf-8");
		return code.includes('from"../') || code.includes("from'../");
	});

	if (!needsRebuild) {
		console.log("[islands] All islands are self-contained");
		return;
	}

	try {
		const { buildIsolatedIslands } = await import("./isolated-island-builder.ts");
		const islands = new Map<string, { filePath: string; bundleKey: string; framework: string }>();

		for (const islandFile of islandFiles) {
			const relPath = relative(distDir, islandFile).replaceAll("\\", "/");
			const bundleKey = relPath.replace(/^islands\//, "").replace(/\.js$/, "");
			const code = readFileSync(islandFile, "utf-8");

			let framework = "preact";
			// Detect framework from the bundle key filename convention (Counter.solid, Counter.vue, etc.)
			if (bundleKey.includes(".solid")) framework = "solid";
			else if (bundleKey.includes(".vue") || bundleKey.endsWith(".vue")) framework = "vue";
			else if (bundleKey.includes(".svelte") || bundleKey.endsWith(".svelte")) framework = "svelte";
			else if (bundleKey.includes(".lit")) framework = "lit";
			else if (bundleKey.includes(".qwik")) framework = "qwik";
			else if (bundleKey.includes(".react")) framework = "react";
			else if (bundleKey.includes(".preact")) framework = "preact";

			const srcMatch = /from["']((?:\/|\.\/)[^"']+\.(tsx|ts|jsx|js|vue|svelte))["']/i.exec(code);
			let srcPath: string;
			if (srcMatch && !srcMatch[1].includes("/assets/") && !srcMatch[1].startsWith("../")) {
				srcPath = srcMatch[1];
			} else {
				// Infer source path from the bundle key.
				// The bundle key is like "app/modules/demo/components/Counter.lit"
				// Try common extensions in order of likelihood.
				const basePath = bundleKey;
				const candidates = [
					`${basePath}.tsx`,
					`${basePath}.ts`,
					`${basePath}.jsx`,
					`${basePath}.js`,
					`${basePath}`, // .vue and .svelte have no extra extension
				];
				const found = candidates.find((c) => existsSync(join(cwd, c)));
				srcPath = found ?? `${basePath}.tsx`;
			}

			// The extracted path may have a dev-mode prefix (src/islands/) that
			// doesn't exist on disk. Strip it and resolve to the actual source file.
			if (srcPath.startsWith("src/islands/")) {
				srcPath = srcPath.slice("src/islands/".length);
			}
			// Ensure the path is absolute from the project root
			if (!srcPath.startsWith("/")) {
				srcPath = `/${srcPath}`;
			}

			islands.set(bundleKey, { filePath: srcPath, bundleKey, framework });
		}

		await buildIsolatedIslands(cwd, distDir, islands, [], {});
	} catch (_err) {
		console.warn("[islands] Isolated rebuild failed, falling back to inline-islands");
		try {
			const { inlineIslandChunks } = await import("./inline-islands.ts");
			await inlineIslandChunks(distDir, { verbose: true });
		} catch (inlineErr) {
			console.error("[islands] Inline fallback also failed:", inlineErr);
		}
	}
}

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

// ─── Island Redirects ────────────────────────────────────────────────

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

function isNetlifyHandler(serverEntryPath: string): boolean {
	if (!existsSync(serverEntryPath)) return false;
	const code = readFileSync(serverEntryPath, "utf-8");
	return code.includes("netlify") || code.includes("lambda");
}

function writeFetchHandlerWrapper(modulePath: string, port: number): string {
	const wrapperPath = join(dirname(modulePath), "_prerender-server.mjs");
	const importSpec = `./${basename(modulePath)}`;
	writeFileSync(wrapperPath, fetchHandlerWrapperSource(importSpec, port));
	return wrapperPath;
}

// ─── Prerendering ────────────────────────────────────────────────────

function extractLinks(html: string): string[] {
	const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
	const links: string[] = [];
	let match: RegExpExecArray | null;
	for (match = linkRegex.exec(html); match !== null; match = linkRegex.exec(html)) {
		let href = match[1];
		// Strip URL fragments and query strings — they're not separate routes
		const hashIdx = href.indexOf("#");
		if (hashIdx !== -1) href = href.substring(0, hashIdx);
		const queryIdx = href.indexOf("?");
		if (queryIdx !== -1) href = href.substring(0, queryIdx);
		if (href && href.startsWith("/") && !href.startsWith("//") && !href.includes(".")) {
			links.push(href);
		}
	}
	return links;
}

async function prerenderIfConfigured(
	cwd: string,
	distDir: string,
	config: PrerenderConfig,
	port: number,
): Promise<void> {
	const cloudflareWorker = resolveCloudflareWorker(cwd);
	const serverEntries = [
		join(cwd, ".netlify", "functions-internal", "server", "server.mjs"),
		join(cwd, ".netlify", "v1", "functions", "server", "server.mjs"),
		join(cwd, ".output", "server", "index.mjs"),
		...(cloudflareWorker ? [cloudflareWorker] : []),
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
	const isCloudflareWorker = cloudflareWorker !== null && serverEntry === cloudflareWorker;
	let actualEntry = serverEntry;

	if (netlifyMode) {
		const mainMjsPath = join(dirname(serverEntry), "main.mjs");
		if (!existsSync(mainMjsPath)) {
			console.error("[prerender] Netlify handler detected but main.mjs not found");
			return;
		}
		actualEntry = writeFetchHandlerWrapper(mainMjsPath, port);
		console.log("[prerender] Netlify handler detected — using wrapper");
	} else if (isCloudflareWorker) {
		actualEntry = writeFetchHandlerWrapper(serverEntry, port);
		console.log("[prerender] Cloudflare worker detected — using wrapper");
	}

	// Patch HTML asset entries out of server manifests so SSR runs fresh
	{
		const filesToPatch = [serverEntry, join(dirname(serverEntry), "main.mjs")].filter((f) =>
			isFile(f),
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
					const cleaned = stamped.replaceAll(
						/<link rel="stylesheet" href="\/assets\/[^"]*\.css">\n?/g,
						(match) => {
							if (match.includes("_isolated-island-entry")) return "";
							return match;
						},
					);
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

	if (netlifyMode || isCloudflareWorker) {
		const wrapperPath = join(dirname(serverEntry), "_prerender-server.mjs");
		if (existsSync(wrapperPath)) {
			unlinkSync(wrapperPath);
			console.log("[prerender] Cleaned up wrapper script");
		}
	}

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

// ─── Modulepreload Injection ─────────────────────────────────────────

function injectIslandDepsPreloads(cwd: string, distDir: string): void {
	let depsManifest: Record<string, string[]> = {};
	const depsPath = join(distDir, "island-deps.json");
	if (existsSync(depsPath)) {
		try {
			depsManifest = JSON.parse(readFileSync(depsPath, "utf-8"));
		} catch {
			/* ignore */
		}
	}

	const outputDir = join(cwd, ".output", "public");
	if (Object.keys(depsManifest).length === 0 && existsSync(outputDir)) {
		const islandFiles = collectFiles(
			join(outputDir, "islands"),
			(n) => n.endsWith(".js") && !n.endsWith(".js.map"),
		);
		for (const islandFile of islandFiles) {
			const relPath = `/${islandFile.substring(outputDir.length + 1).replaceAll("\\", "/")}`;
			const code = readFileSync(islandFile, "utf-8");
			const importRegex = /\bfrom\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;
			const deps: string[] = [];
			let m: RegExpExecArray | null;
			for (m = importRegex.exec(code); m !== null; m = importRegex.exec(code)) {
				const importPath = m[1] || m[2];
				if (importPath && (importPath.includes("/assets/") || importPath.startsWith("."))) {
					const resolved = importPath.startsWith(".")
						? `/${join(dirname(relPath.slice(1)), importPath)
								.replaceAll("\\", "/")
								.replace(/^\/+/, "")}`
						: importPath;
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

// ─── HTML Optimization ───────────────────────────────────────────────

/**
 * Known non-critical local stylesheet patterns that can be safely deferred.
 */
const DEFERABLE_LOCAL_PATTERNS = [/syntax-highlight/i, /hljs/i, /prism/i, /highlight\.js/i];

/**
 * Maximum CSS size (in bytes) to inline into HTML.
 * 14 KiB fits within the typical TCP initial congestion window (~14 KB).
 */
const CSS_INLINE_THRESHOLD = 14_336;

/**
 * Optimize prerendered HTML files for progressive rendering.
 *
 * 1. Inlines small global CSS (≤14 KiB) to eliminate render-blocking requests,
 *    or adds a preload hint for larger CSS
 * 2. Defers non-critical stylesheets (external + known local patterns)
 * 3. Adds preload hints for Google Fonts CSS
 */
function optimizePrerenderedHtml(cwd: string, distDir: string): void {
	const htmlDirs = [join(cwd, ".output", "public"), distDir];
	const cssCache = buildCSSCache(htmlDirs);

	let patchedCount = 0;

	for (const htmlDir of htmlDirs) {
		if (!existsSync(htmlDir)) continue;
		const htmlFiles = collectFiles(htmlDir, (n) => n === "index.html");

		for (const htmlFile of htmlFiles) {
			let html = readFileSync(htmlFile, "utf-8");
			const original = html;

			html = inlineOrPreloadGlobalCSS(html, cssCache);
			html = hoistBodyStylesToHead(html);
			html = deferNonCriticalStylesheetsStatic(html);
			html = addFontPreloadHintsStatic(html);

			if (html !== original) {
				writeFileSync(htmlFile, html);
				patchedCount++;
			}
		}
	}

	if (patchedCount > 0) {
		console.log(
			`[post-build] Optimized ${patchedCount} HTML file(s) — deferred non-critical CSS, added font preload hints`,
		);
	}
}

/**
 * Hoist inline <style> tags from <body> into <head>.
 *
 * Component-scoped CSS (from Solid, Preact, etc.) is often rendered as
 * inline <style> tags scattered throughout the body. The browser
 * recalculates styles each time it encounters one, causing incremental
 * repaints that inflate Speed Index. Moving all styles into <head>
 * ensures the browser has complete styling before painting the body.
 * Duplicate style blocks are deduplicated by content.
 */
function hoistBodyStylesToHead(html: string): string {
	if (!html.includes("</head>") || !html.includes("<body")) return html;

	const headEnd = html.indexOf("</head>");
	const bodyStart = html.indexOf("<body");
	if (headEnd === -1 || bodyStart === -1 || bodyStart < headEnd) return html;

	const bodyContent = html.substring(bodyStart);

	// Parse through the body tracking <template> depth.
	// Only hoist <style> tags at depth 0 (not inside shadow DOM templates).
	const seen = new Set<string>();
	const hoisted: string[] = [];
	let result = "";
	let templateDepth = 0;
	let i = 0;

	while (i < bodyContent.length) {
		if (bodyContent[i] === "<") {
			// Check for <template or </template>
			if (bodyContent.startsWith("<template", i)) {
				templateDepth++;
				const end = bodyContent.indexOf(">", i);
				if (end === -1) break;
				result += bodyContent.substring(i, end + 1);
				i = end + 1;
				continue;
			}
			if (bodyContent.startsWith("</template>", i)) {
				templateDepth = Math.max(0, templateDepth - 1);
				result += "</template>";
				i += 11;
				continue;
			}
			// Check for <style> at document level (not inside template)
			if (templateDepth === 0 && bodyContent.startsWith("<style", i)) {
				const closeIdx = bodyContent.indexOf("</style>", i);
				if (closeIdx === -1) break;
				const fullTag = bodyContent.substring(i, closeIdx + 8);
				const cssMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(fullTag);
				if (cssMatch) {
					const normalized = cssMatch[1].replaceAll(/\s+/g, " ").trim();
					if (normalized && !seen.has(normalized)) {
						seen.add(normalized);
						hoisted.push(`<style>${normalized}</style>`);
					}
				}
				// Skip this style tag in the body output
				i = closeIdx + 8;
				continue;
			}
		}
		result += bodyContent[i];
		i++;
	}

	if (hoisted.length === 0) return html;

	const headPart = html.substring(0, headEnd);
	return `${headPart}\n${hoisted.join("\n")}\n</head>${result}`;
}

/** Scan public asset directories and cache CSS file contents by href. */
function buildCSSCache(htmlDirs: string[]): Map<string, string> {
	const cache = new Map<string, string>();
	for (const htmlDir of htmlDirs) {
		const assetsDir = join(htmlDir, "assets");
		if (!existsSync(assetsDir)) continue;
		for (const file of readdirSync(assetsDir)) {
			if (file.endsWith(".css")) {
				cache.set(`/assets/${file}`, readFileSync(join(assetsDir, file), "utf-8"));
			}
		}
	}
	return cache;
}

/**
 * Inline global CSS directly into HTML if small enough,
 * otherwise add a preload hint for early discovery.
 */
function inlineOrPreloadGlobalCSS(html: string, cssCache: Map<string, string>): string {
	const globalCssRegex =
		/<link\s+rel="stylesheet"\s+href="(\/assets\/(?:ssr-)?index-[^"]+\.css)">/i;
	const match = globalCssRegex.exec(html);
	if (!match) return html;

	const href = match[1];
	const cssContent = cssCache.get(href);
	if (!cssContent) return html;

	if (Buffer.byteLength(cssContent, "utf-8") <= CSS_INLINE_THRESHOLD) {
		const inlineStyle = `<style data-inlined-from="${href}">${cssContent}</style>`;
		return html.replace(match[0], inlineStyle);
	}

	const preloadHint = `<link rel="preload" href="${href}" as="style">`;
	if (html.includes("</title>") && !html.includes(`preload" href="${href}"`)) {
		html = html.replace("</title>", `</title>\n${preloadHint}`);
	}
	return html;
}

/** Defer external stylesheets and known non-critical local stylesheets. */
function deferNonCriticalStylesheetsStatic(html: string): string {
	const linkRegex = /<link\s+([^>]*rel=["']stylesheet["'][^>]*)>/gi;

	return html.replaceAll(linkRegex, (fullMatch, attrs: string) => {
		if (/\bmedia\s*=/i.test(attrs)) return fullMatch;
		if (/data-critical/i.test(attrs)) return fullMatch;

		const hrefResult = /href=["']([^"']+)["']/i.exec(attrs);
		if (!hrefResult) return fullMatch;

		const href = hrefResult[1];
		const isExternal = href.startsWith("https://") || href.startsWith("http://");
		const isDeferableLocal = !isExternal && DEFERABLE_LOCAL_PATTERNS.some((re) => re.test(href));

		if (!isExternal && !isDeferableLocal) return fullMatch;

		return `<link ${attrs} media="print" onload="this.media='all'">\n<noscript><link ${attrs}></noscript>`;
	});
}

/** Add preload hints for Google Fonts CSS URLs. */
function addFontPreloadHintsStatic(html: string): string {
	const fontUrlRegex = /href=["'](https:\/\/fonts\.googleapis\.com\/css2[^"']+)["']/gi;
	const fontUrls = new Set<string>();

	let match: RegExpExecArray | null;
	for (match = fontUrlRegex.exec(html); match !== null; match = fontUrlRegex.exec(html)) {
		fontUrls.add(match[1]);
	}

	if (fontUrls.size === 0) return html;

	const preloadHints: string[] = [];
	for (const url of fontUrls) {
		const escapedUrl = url.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
		const existingPreload = new RegExp(
			String.raw`<link\s+[^>]*rel=["']preload["'][^>]*href=["']${escapedUrl}["'][^>]*>`,
			"i",
		);
		if (existingPreload.test(html)) continue;
		preloadHints.push(`<link rel="preload" href="${url}" as="style">`);
	}

	if (preloadHints.length === 0) return html;

	const preloadBlock = preloadHints.join("\n");
	if (html.includes("</title>")) {
		return html.replace("</title>", `</title>\n${preloadBlock}`);
	}

	return html;
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

/**
 * Register prerendered HTML files (and their compressed variants) in
 * Nitro's static asset manifest inside server/index.mjs.
 *
 * Nitro's asset manifest is baked at build time — before prerendering.
 * Prerendered HTML files written to .output/public/ are invisible to
 * the static asset handler, so requests fall through to the SSR
 * catch-all which serves uncompressed HTML.
 *
 * This patches the manifest to include prerendered HTML + .br/.gz
 * variants, enabling Nitro's static handler to serve them with
 * content-encoding negotiation (brotli/gzip).
 */
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

/** Build manifest entry strings for all prerendered HTML files. */
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

/** Patch a single Nitro server entry with new manifest entries and route rules. */
function patchServerManifest(
	serverEntry: string,
	newEntries: string[],
	publicDir: string,
): boolean {
	if (!existsSync(serverEntry)) return false;

	let code = readFileSync(serverEntry, "utf-8");

	// 1. Add HTML files to the static asset manifest
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

	// 2. Add cache-control route rules for prerendered routes so HTML
	// gets max-age=0 instead of inheriting immutable from asset rules.
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

/** Find prerendered routes by scanning for index.html files in the public dir. */
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

// ─── Main Entry Point ────────────────────────────────────────────────

export async function runPostBuild(options: PostBuildOptions = {}): Promise<void> {
	const cwd = options.cwd ?? process.cwd();
	const distDir = join(cwd, "dist");
	const prerenderPort = options.prerenderPort ?? 13172;

	// 1. Cleanup stale HTML
	cleanupStaleHtml(cwd);

	// 2. Copy SSR CSS to client assets
	copySSRCSSToClient(cwd, distDir);

	// 3. Patch SSR bundle CSS array
	for (const ssrPath of [
		join(cwd, ".netlify", "functions-internal", "server", "_ssr", "ssr.mjs"),
		join(cwd, ".netlify", "v1", "functions", "server", "_ssr", "ssr.mjs"),
		join(cwd, ".output", "server", "_ssr", "ssr.mjs"),
		resolveCloudflareWorker(cwd),
	]) {
		if (!ssrPath) continue;
		if (isFile(ssrPath)) {
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

	// 9. Prerender (if not disabled)
	if (options.prerender !== false) {
		await prerenderIfConfigured(cwd, distDir, options.prerender ?? {}, prerenderPort);
	}

	// 10. Inject modulepreload hints for island dependencies
	injectIslandDepsPreloads(cwd, distDir);

	// 11. Optimize prerendered HTML — inline CSS, defer non-critical, font preloads
	optimizePrerenderedHtml(cwd, distDir);

	// 12. Re-compress public assets (brotli + gzip)
	await recompressPublicAssets(cwd);

	// 13. Register prerendered HTML in Nitro's static asset manifest
	// so the static handler serves them with brotli/gzip compression.
	patchNitroAssetManifest(cwd);

	console.log("[post-build] ✅ Complete");
}
