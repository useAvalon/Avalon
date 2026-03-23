/**
 * Prerender implementation.
 *
 * Spawns the built Nitro server as a child process, fetches routes via HTTP,
 * extracts links, and writes static HTML files to the output directory.
 *
 * This approach avoids dependency issues (e.g. undici, platform-specific
 * modules) that occur when importing the server bundle directly.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { PrerenderConfig } from "./index.ts";

/** Extract <a href="..."> links from HTML, returning absolute paths */
function extractLinks(html: string): string[] {
	const links: string[] = [];
	const re = /<a\s[^>]*href=["']([^"'#?]+)/gi;
	let match: RegExpExecArray | null = re.exec(html);
	while (match !== null) {
		const href = match[1];
		if (href.startsWith("/") && !href.startsWith("//")) {
			if (
				href.startsWith("/assets/") ||
				href.startsWith("/islands/") ||
				href.startsWith("/chunks/") ||
				href.startsWith("/_") ||
				href.match(/\.\w{2,5}$/)
			) {
				continue;
			}
			links.push(href);
		}
		match = re.exec(html);
	}
	return [...new Set(links)];
}

/** Check if a route matches an ignore pattern */
function matchesIgnore(
	route: string,
	patterns: Array<string | RegExp | ((path: string) => undefined | null | boolean)>,
): boolean {
	for (const pattern of patterns) {
		if (typeof pattern === "string") {
			if (route === pattern) return true;
			if (pattern.endsWith("/**") && route.startsWith(pattern.slice(0, -2))) return true;
		} else if (pattern instanceof RegExp) {
			if (pattern.test(route)) return true;
		} else if (typeof pattern === "function") {
			if (pattern(route)) return true;
		}
	}
	return false;
}

/**
 * Wait for the server to be ready by polling the health endpoint.
 */
async function waitForServer(baseUrl: string, timeoutMs = 15_000): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(`${baseUrl}/`);
			if (res.ok || res.status < 500) return;
		} catch {
			// Server not ready yet
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`[prerender] Server did not become ready within ${timeoutMs}ms`);
}

/**
 * Prerender routes by spawning the built server and fetching each route via HTTP.
 */
export async function prerenderRoutes(config: PrerenderConfig): Promise<{
	prerenderedRoutes: string[];
	errors: Array<{ route: string; error: string }>;
}> {
	const {
		serverEntryPath,
		outputDir,
		routes: initialRoutes = ["/"],
		crawlLinks = false,
		ignore = [],
		concurrency = 4,
		failOnError = false,
		autoSubfolderIndex = true,
		retry = 3,
		retryDelay = 500,
		port = 13172,
	} = config;

	const absServerEntry = resolve(serverEntryPath);
	if (!existsSync(absServerEntry)) {
		throw new Error(`[prerender] Server entry not found: ${absServerEntry}`);
	}

	const absOutputDir = resolve(outputDir);
	const baseUrl = `http://localhost:${port}`;

	console.log(`[prerender] Spawning server from ${serverEntryPath} on port ${port}...`);

	// Spawn the Nitro server as a child process
	let serverProcess: ChildProcess | null = null;
	try {
		serverProcess = spawn("node", [absServerEntry], {
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

		// Log server output for debugging
		serverProcess.stdout?.on("data", (data: Buffer) => {
			const msg = data.toString().trim();
			if (msg) console.log(`[prerender:server] ${msg}`);
		});
		serverProcess.stderr?.on("data", (data: Buffer) => {
			const msg = data.toString().trim();
			if (msg) console.error(`[prerender:server:err] ${msg}`);
		});

		// Wait for server to be ready
		await waitForServer(baseUrl);
		console.log(`[prerender] Server ready at ${baseUrl}`);
	} catch (err: unknown) {
		serverProcess?.kill("SIGKILL");
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`[prerender] Failed to start server: ${message}`);
	}

	const prerendered: string[] = [];
	const errors: Array<{ route: string; error: string }> = [];
	const visited = new Set<string>();
	const queue: string[] = [...initialRoutes];

	console.log(`[prerender] Starting with ${queue.length} route(s), crawlLinks=${crawlLinks}`);

	async function fetchRoute(route: string): Promise<{ html: string; status: number } | null> {
		for (let attempt = 1; attempt <= retry; attempt++) {
			try {
				const response = await fetch(`${baseUrl}${route}`);
				const html = await response.text();
				return { html, status: response.status };
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				if (attempt < retry) {
					console.warn(`[prerender] Retry ${attempt}/${retry} for ${route}: ${message}`);
					await new Promise((r) => setTimeout(r, retryDelay));
				} else {
					console.error(`[prerender] All ${retry} attempts failed for ${route}: ${message}`);
					return null;
				}
			}
		}
		return null;
	}

	try {
		// Process queue with concurrency limit
		while (queue.length > 0) {
			const batch = queue.splice(0, concurrency);

			await Promise.all(
				batch.map(async (route) => {
					const normalizedRoute = route.endsWith("/") && route !== "/" ? route.slice(0, -1) : route;

					if (visited.has(normalizedRoute)) return;
					visited.add(normalizedRoute);

					if (matchesIgnore(normalizedRoute, ignore)) {
						console.log(`[prerender] ⏭  ${normalizedRoute} (ignored)`);
						return;
					}

					const result = await fetchRoute(normalizedRoute);

					if (!result) {
						const msg = `Failed to fetch ${normalizedRoute} after ${retry} attempts`;
						console.error(`[prerender] ❌ ${msg}`);
						errors.push({ route: normalizedRoute, error: msg });
						if (failOnError) throw new Error(msg);
						return;
					}

					if (result.status >= 400) {
						const msg = `${normalizedRoute} returned ${result.status}`;
						console.error(`[prerender] ❌ ${msg}`);
						errors.push({ route: normalizedRoute, error: msg });
						if (failOnError) throw new Error(msg);
						return;
					}

					// Determine output file path
					const fileName = autoSubfolderIndex
						? join(normalizedRoute, "index.html")
						: `${normalizedRoute}.html`;
					const outputPath = join(absOutputDir, fileName);

					mkdirSync(dirname(outputPath), { recursive: true });
					writeFileSync(outputPath, result.html);
					prerendered.push(normalizedRoute);
					console.log(`[prerender] ✅ ${normalizedRoute} → ${fileName}`);

					if (crawlLinks) {
						const links = extractLinks(result.html);
						for (const link of links) {
							const normalized = link.endsWith("/") && link !== "/" ? link.slice(0, -1) : link;
							if (!visited.has(normalized) && !matchesIgnore(normalized, ignore)) {
								queue.push(normalized);
							}
						}
					}
				}),
			);
		}
	} finally {
		// Always kill the server process
		if (serverProcess) {
			console.log("[prerender] Shutting down server...");
			serverProcess.kill("SIGKILL");
		}
	}

	console.log(
		`[prerender] Done: ${prerendered.length} page(s) prerendered` +
			(errors.length > 0 ? `, ${errors.length} error(s)` : ""),
	);

	return { prerenderedRoutes: prerendered, errors };
}
