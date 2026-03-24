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

	const allCssPaths = collectFiles(foundAssetsDir, (n) => n.endsWith(".css")).map((f) => {
		const rel = f.substring(foundAssetsDir.length).replaceAll("\\", "/");
		return `/assets${rel}`;
	});
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

function copySSRCSSToClient(cwd: string, distDir: string): void {
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
				copyFileSync(join(ssrAssetsDir, file), join(destDir, `ssr-${file}`));
			}
		}
		const sampleFile = cssFiles[0];
		const size = readFileSync(join(ssrAssetsDir, sampleFile)).length;
		const destName = `ssr-${sampleFile}`;
		console.log(`[ssr-css] Copied SSR CSS → /assets/${destName} (${size} bytes)`);

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
					writeFileSync(outputPath, stamped);
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

	// 3. Patch SSR bundles
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

	// 4. Island redirects + local copies
	generateIslandRedirects(distDir);

	// 5. Copy framework adapters
	copyAdapters(cwd, distDir);

	// 6. Copy to Netlify function paths
	copyToNetlifyPaths(cwd);

	// 7. Prerender (if not disabled)
	if (options.prerender !== false) {
		await prerenderIfConfigured(cwd, distDir, options.prerender ?? {}, prerenderPort);
	}

	console.log("[post-build] ✅ Complete");
}
