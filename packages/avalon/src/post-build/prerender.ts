import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { normalizePresetName } from "../nitro/config.ts";
import { extractLinks } from "./extract-links.ts";
import { fetchHandlerWrapperSource, projectHasLitDomShim } from "./fetch-handler-wrapper.ts";
import { isFile } from "./fs-utils.ts";

export interface PrerenderConfig {
	routes?: string[];
	crawlLinks?: boolean;
	ignore?: string[];
	failOnError?: boolean;
	concurrency?: number;
	autoSubfolderIndex?: boolean;
	retry?: number;
	retryDelay?: number;
}

/** True when the built server lives under Netlify's functions tree. */
export function isNetlifyHandler(serverEntryPath: string): boolean {
	return serverEntryPath.split(/[/\\]/).includes(".netlify");
}

/** Nitro's preset name from `.output/nitro.json`, in underscore form. */
export function readNitroOutputPreset(cwd: string): string | null {
	const path = join(cwd, ".output", "nitro.json");
	if (!isFile(path)) return null;
	try {
		const { preset } = JSON.parse(readFileSync(path, "utf-8")) as { preset?: unknown };
		return typeof preset === "string" ? normalizePresetName(preset) : null;
	} catch {
		return null;
	}
}

/**
 * Fetch-handler entry of a Cloudflare build, or null for other presets.
 *
 * - `cloudflare_pages`: `dist/_worker.js` (file or directory).
 * - `cloudflare_module` / `cloudflare_durable`: `.output/server/index.mjs`,
 *   identified by the preset Nitro wrote to `.output/nitro.json`.
 *
 * Both export a Workers `fetch` handler instead of starting a listener, so
 * prerender must run them behind the Node HTTP wrapper.
 */
export function resolveCloudflareWorker(cwd: string): string | null {
	const root = join(cwd, "dist", "_worker.js");
	if (isFile(root)) return root;
	if (existsSync(root)) {
		for (const name of ["index.js", "index.mjs"]) {
			const nested = join(root, name);
			if (isFile(nested)) return nested;
		}
	}

	const preset = readNitroOutputPreset(cwd);
	if (preset?.startsWith("cloudflare") && preset !== "cloudflare_pages") {
		const moduleEntry = join(cwd, ".output", "server", "index.mjs");
		if (isFile(moduleEntry)) return moduleEntry;
	}
	return null;
}

function writeFetchHandlerWrapper(modulePath: string, port: number, cwd: string): string {
	const wrapperPath = join(dirname(modulePath), "_prerender-server.mjs");
	const importSpec = `./${basename(modulePath)}`;
	writeFileSync(
		wrapperPath,
		fetchHandlerWrapperSource(importSpec, port, {
			litDomShim: projectHasLitDomShim(cwd),
		}),
	);
	return wrapperPath;
}

/** Deletes the generated wrapper so it does not ship with the server output. */
function removeWrapper(actualEntry: string, serverEntry: string): void {
	if (actualEntry === serverEntry || !existsSync(actualEntry)) return;
	unlinkSync(actualEntry);
	console.log("[prerender] Cleaned up wrapper script");
}

function patchServerHtmlAssetEntries(cwd: string, serverEntry: string): void {
	const filesToPatch = [serverEntry, join(dirname(serverEntry), "main.mjs")].filter((f) =>
		isFile(f),
	);
	const htmlKeyRe = /"\/[^"]*\.html":\{[^}]+\},?/g;
	for (const filePath of filesToPatch) {
		let serverCode = readFileSync(filePath, "utf-8");
		const before = serverCode.length;
		serverCode = serverCode.replaceAll(htmlKeyRe, "");
		if (before !== serverCode.length) {
			writeFileSync(filePath, serverCode);
			console.log(`[prerender] Patched ${relative(cwd, filePath)}: removed HTML asset entries`);
		}
	}
}

function normalizeRoute(route: string): string {
	return route.endsWith("/") && route !== "/" ? route.slice(0, -1) : route;
}

function matchesIgnore(route: string, ignore: string[]): boolean {
	for (const pattern of ignore) {
		if (route === pattern) return true;
		if (pattern.endsWith("/**") && route.startsWith(pattern.slice(0, -2))) return true;
	}
	return false;
}

function finalizePrerenderHtml(html: string, clientRouter: boolean): string {
	let final = html.replace(
		"<!DOCTYPE html>",
		"<!DOCTYPE html>\n<!-- SSG: prerendered at build time -->",
	);
	final = final.replaceAll(/<link rel="stylesheet" href="\/assets\/[^"]*\.css">\n?/g, (match) => {
		if (match.includes("_isolated-island-entry")) return "";
		return match;
	});
	if (!clientRouter) {
		final = final.replaceAll(
			/<script type="module" src="\/assets\/entry-client[^"]*\.js"><\/script>\n?/g,
			"",
		);
	}
	const hasGlobalCss =
		/\/assets\/(?:ssr-)?index-[^"]+\.css/.test(final) ||
		/<style data-inlined-from="\/assets\/(?:ssr-)?index-/.test(final);
	if (hasGlobalCss) {
		final = final.replaceAll(
			/<link rel="stylesheet" href="\/assets\/entry-client[^"]*\.css">\n?/g,
			"",
		);
	}
	if (!clientRouter) {
		final = final.replaceAll(
			/<link rel="modulepreload" href="\/assets\/entry-client[^"]*\.js">\n?/g,
			"",
		);
	}
	return final;
}

async function fetchRouteWithRetry(
	baseUrl: string,
	route: string,
	retry: number,
	retryDelay: number,
): Promise<{ html: string; status: number } | null> {
	for (let attempt = 1; attempt <= retry; attempt++) {
		try {
			const res = await fetch(`${baseUrl}${route}`);
			return { html: await res.text(), status: res.status };
		} catch {
			if (attempt < retry) await new Promise((r) => setTimeout(r, retryDelay));
		}
	}
	return null;
}

/** Exit status of the prerender server process; both null while it runs. */
export interface ServerExitStatus {
	exitCode: number | null;
	signalCode: string | null;
}

/**
 * Polls the server until it answers or `timeoutMs` passes. Throws as soon as
 * the server process exits, so a server that cannot start (wrong entry, crash
 * at import) fails right away instead of after the full timeout.
 */
export async function waitForServer(
	baseUrl: string,
	timeoutMs: number,
	server: ServerExitStatus = { exitCode: null, signalCode: null },
): Promise<void> {
	const startWait = Date.now();
	while (Date.now() - startWait < timeoutMs) {
		if (server.exitCode !== null || server.signalCode !== null) {
			const status =
				server.signalCode === null ? `code ${server.exitCode}` : `signal ${server.signalCode}`;
			throw new Error(`Server process exited with ${status} before it was ready`);
		}
		try {
			const res = await fetch(`${baseUrl}/`);
			if (res.ok || res.status < 500) return;
		} catch {
			// Server not ready yet.
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`Server did not become ready within ${Math.round(timeoutMs / 1000)}s`);
}

function copyPrerenderedToAltDirs(
	cwd: string,
	distDir: string,
	outputDir: string,
	prerendered: string[],
): void {
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
			if (!existsSync(srcPath)) continue;
			mkdirSync(dirname(destPath), { recursive: true });
			copyFileSync(srcPath, destPath);
		}
	}
	if (altOutputDirs.length > 0) {
		console.log(
			`[prerender] Copied prerendered HTML to ${altOutputDirs.length} additional output dir(s)`,
		);
	}
}

export async function prerenderIfConfigured(
	cwd: string,
	distDir: string,
	config: PrerenderConfig,
	port: number,
	clientRouter = false,
): Promise<void> {
	const cloudflareWorker = resolveCloudflareWorker(cwd);
	const serverEntries = [
		...(cloudflareWorker ? [cloudflareWorker] : []),
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
	const isCloudflareWorker = cloudflareWorker !== null && serverEntry === cloudflareWorker;
	let actualEntry = serverEntry;

	if (isCloudflareWorker) {
		actualEntry = writeFetchHandlerWrapper(serverEntry, port, cwd);
		console.log(
			`[prerender] Cloudflare worker detected (${relative(cwd, serverEntry)}) — using wrapper`,
		);
	} else if (isNetlifyHandler(serverEntry)) {
		const mainMjsPath = join(dirname(serverEntry), "main.mjs");
		if (!existsSync(mainMjsPath)) {
			console.error("[prerender] Netlify handler detected but main.mjs not found");
			return;
		}
		actualEntry = writeFetchHandlerWrapper(mainMjsPath, port, cwd);
		console.log("[prerender] Netlify handler detected — using wrapper");
	}

	patchServerHtmlAssetEntries(cwd, serverEntry);
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
		await waitForServer(baseUrl, 15_000, serverProcess);
		console.log(`[prerender] Server ready at ${baseUrl}`);
	} catch (err) {
		serverProcess?.kill("SIGKILL");
		removeWrapper(actualEntry, serverEntry);
		console.error("[prerender] Failed to start server:", (err as Error).message);
		return;
	}

	const visited = new Set<string>();
	const queue = [...prerenderConfig.routes];
	const prerendered: string[] = [];
	const errors: Array<{ route: string; error: string }> = [];

	try {
		while (queue.length > 0) {
			const batch = queue.splice(0, prerenderConfig.concurrency);
			await Promise.all(
				batch.map(async (route) => {
					const normalized = normalizeRoute(route);
					if (visited.has(normalized)) return;
					visited.add(normalized);
					if (matchesIgnore(normalized, prerenderConfig.ignore)) return;

					const result = await fetchRouteWithRetry(
						baseUrl,
						normalized,
						prerenderConfig.retry,
						prerenderConfig.retryDelay,
					);
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
					writeFileSync(outputPath, finalizePrerenderHtml(result.html, clientRouter));
					prerendered.push(normalized);
					console.log(`[prerender] ✅ ${normalized} → ${fileName}`);

					if (!prerenderConfig.crawlLinks) return;
					for (const link of extractLinks(result.html)) {
						const norm = normalizeRoute(link);
						if (!visited.has(norm) && !matchesIgnore(norm, prerenderConfig.ignore)) {
							queue.push(norm);
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

	removeWrapper(actualEntry, serverEntry);

	if (prerendered.length > 0) {
		copyPrerenderedToAltDirs(cwd, distDir, outputDir, prerendered);
	}
}
