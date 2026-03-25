/**
 * Nitro Integration Module for Avalon Vite Plugin
 *
 * Provides coordination between Avalon's Vite plugin and Nitro:
 * - API routes: Auto-discovered by Nitro from `api/` directory
 * - Page routes: Virtual module for SSR page component discovery
 * - Middleware: Auto-discovered by Nitro from `middleware/` directory
 */

import { existsSync } from "node:fs";
import { stat as fsStat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { H3Event } from "h3";
import { nitro as nitroVitePlugin } from "nitro/vite";
import type { Plugin, ViteDevServer } from "vite";
import { isRunnableDevEnvironment } from "vite";
import { getUniversalCSSForHead } from "../islands/universal-css-collector.ts";
import { getUniversalHeadForInjection } from "../islands/universal-head-collector.ts";
import {
	clearMiddlewareCache,
	discoverScopedMiddleware,
	executeScopedMiddleware,
} from "../middleware/index.ts";
import type { MiddlewareRoute } from "../middleware/types.ts";
import {
	type AvalonNitroConfig,
	createNitroConfig,
	type NitroConfigOutput,
} from "../nitro/config.ts";
import {
	createIslandManifestPlugin,
	createNitroBuildPlugin,
	createSourceMapConfig,
	createSourceMapPlugin,
} from "../nitro/index.ts";
import type { PageModule } from "../nitro/types.ts";
import { collectCssFromModuleGraph, injectSsrCss } from "../render/collect-css.ts";
import { generateErrorPage, generateFallback404 } from "../render/error-pages.ts";
import type { ResolvedAvalonConfig } from "./types.ts";

/**
 * Resolves the absolute path to a file inside @useavalon/avalon's source tree.
 * Handles both workspace (.ts source) and published (.js compiled) layouts.
 */
function resolveAvalonPackagePath(relativePath: string): string {
	const require = createRequire(import.meta.url);
	const modEntry = require.resolve("@useavalon/avalon");
	const pkgRoot = dirname(modEntry);
	const resolved = join(pkgRoot, relativePath);
	// Published package ships .js in dist/, workspace has .ts source
	if (relativePath.endsWith(".ts") && !existsSync(resolved)) {
		const jsPath = resolved.replace(/\.ts$/, ".js");
		if (existsSync(jsPath)) return jsPath;
	}
	return resolved;
}

/**
 * Resolves the absolute path to a file inside an @useavalon/<name> integration package.
 * Handles both workspace (.ts source) and published (.js compiled) layouts.
 */
function resolveIntegrationPackagePath(name: string, relativePath: string): string {
	const require = createRequire(join(process.cwd(), "package.json"));
	const modEntry = require.resolve(`@useavalon/${name}`);
	const pkgRoot = dirname(modEntry);
	const resolved = join(pkgRoot, relativePath);
	if (relativePath.endsWith(".ts") && !existsSync(resolved)) {
		const jsPath = resolved.replace(/\.ts$/, ".js");
		if (existsSync(jsPath)) return jsPath;
	}
	return resolved;
}

export const VIRTUAL_MODULE_IDS = {
	PAGE_ROUTES: "virtual:avalon/page-routes",
	PAGE_LOADER: "virtual:avalon/page-loader",
	ISLAND_MANIFEST: "virtual:avalon/island-manifest",
	RUNTIME_CONFIG: "virtual:avalon/runtime-config",
	CONFIG: "virtual:avalon/config",
	LAYOUTS: "virtual:avalon/layouts",
	ASSETS: "virtual:avalon/assets",
	RENDERER: "virtual:avalon/renderer",
	CLIENT_ENTRY: "virtual:avalon/client-entry",
	INTEGRATION_LOADER: "virtual:avalon/integration-loader",
} as const;

export const RESOLVED_VIRTUAL_IDS = {
	PAGE_ROUTES: "\0" + VIRTUAL_MODULE_IDS.PAGE_ROUTES,
	PAGE_LOADER: "\0" + VIRTUAL_MODULE_IDS.PAGE_LOADER,
	ISLAND_MANIFEST: "\0" + VIRTUAL_MODULE_IDS.ISLAND_MANIFEST,
	RUNTIME_CONFIG: "\0" + VIRTUAL_MODULE_IDS.RUNTIME_CONFIG,
	CONFIG: "\0" + VIRTUAL_MODULE_IDS.CONFIG,
	LAYOUTS: "\0" + VIRTUAL_MODULE_IDS.LAYOUTS,
	ASSETS: "\0" + VIRTUAL_MODULE_IDS.ASSETS,
	RENDERER: "\0" + VIRTUAL_MODULE_IDS.RENDERER,
	CLIENT_ENTRY: "\0" + VIRTUAL_MODULE_IDS.CLIENT_ENTRY,
	INTEGRATION_LOADER: "\0" + VIRTUAL_MODULE_IDS.INTEGRATION_LOADER,
} as const;

export interface NitroIntegrationResult {
	nitroOptions: NitroConfigOutput;
	plugins: Plugin[];
}

export interface NitroCoordinationPluginOptions {
	avalonConfig: ResolvedAvalonConfig;
	nitroConfig: AvalonNitroConfig;
	verbose?: boolean;
}

/**
 * Creates the Nitro integration for Avalon — configuration, virtual modules,
 * build plugins, and SSR coordination.
 *
 * Uses the Nitro v3 Vite plugin from `nitro/vite` for server route discovery,
 * SSR rendering pipeline, and Rolldown-optimized bundling.
 */
export function createNitroIntegration(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig = {},
): NitroIntegrationResult {
	const nitroOptions = createNitroConfig(nitroConfig, avalonConfig);

	// Nitro v3 Vite plugin — only pass keys that Nitro actually accepts.
	// Spreading the full nitroOptions leaks Avalon-specific keys (staticAssets,
	// publicAssets, etc.) which Nitro forwards to Rolldown, causing
	// "Invalid input options" warnings (e.g. "jsx" key errors).
	const nitroVitePluginOptions: Record<string, unknown> = {
		preset: nitroOptions.preset,
		serverDir: nitroConfig.serverDir ?? nitroOptions.serverDir ?? "./server",
		routeRules: nitroOptions.routeRules,
		runtimeConfig: nitroOptions.runtimeConfig,
		compatibilityDate: nitroOptions.compatibilityDate,
		// Tell Nitro to scan the project root so it discovers routes/ and middleware/
		// alongside the serverDir (./server) which contains the catch-all renderer.
		scanDirs: ["."],
		// Inline ESM-only packages that fail at runtime when Nitro leaves
		// them as external CJS require() calls. estree-walker v3 is the
		// primary offender — it only exports via ESM "import" condition.
		// Also inline @useavalon packages so their server renderers are
		// bundled directly (they ship .ts source, not CJS).
		noExternals: ["estree-walker", /^@useavalon\//, /^estree-util/],
	};

	// Only pass renderer when explicitly configured — passing `undefined`
	// can interfere with Nitro's internal SSR entry auto-detection.
	if (nitroConfig.renderer === false) {
		nitroVitePluginOptions.renderer = false;
	} else if (nitroOptions.renderer) {
		nitroVitePluginOptions.renderer = nitroOptions.renderer;
	}

	// Only include optional keys if they're defined
	if (nitroOptions.publicRuntimeConfig) {
		nitroVitePluginOptions.publicRuntimeConfig = nitroOptions.publicRuntimeConfig;
	}
	if (nitroOptions.publicAssets) {
		nitroVitePluginOptions.publicAssets = nitroOptions.publicAssets;
	}
	if (nitroOptions.compressPublicAssets) {
		nitroVitePluginOptions.compressPublicAssets = nitroOptions.compressPublicAssets;
	}
	if (nitroOptions.serverEntry) {
		nitroVitePluginOptions.serverEntry = nitroOptions.serverEntry;
	}

	// Ensure undici is always traced — Nitro's server bundle imports it
	// for its HTTP agent but doesn't always trace it automatically.
	// Without this, the built server fails with ERR_MODULE_NOT_FOUND
	// when spawned standalone (e.g. for prerendering).
	const userTraceDeps = nitroOptions.traceDeps ?? [];
	const traceDeps = [...new Set(["undici", ...userTraceDeps])];
	nitroVitePluginOptions.traceDeps = traceDeps;

	// Do NOT forward prerender config to Nitro — Nitro's built-in prerenderer
	// doesn't work correctly with custom SSR entries (returns 404 for all routes).
	// Avalon handles prerendering in a post-build step instead (see
	// packages/avalon/src/prerender/). The config is stored on nitroOptions
	// so the post-build step can read it, but we explicitly disable Nitro's
	// own prerender to prevent it from running and failing the build.
	if (nitroOptions.prerender) {
		// Store on nitroOptions for post-build, but tell Nitro not to prerender
		nitroVitePluginOptions.prerender = { routes: [], crawlLinks: false };
	}

	const nitroPlugin = nitroVitePlugin(nitroVitePluginOptions);

	const coordinationPlugin = createNitroCoordinationPlugin({
		avalonConfig,
		nitroConfig,
		verbose: avalonConfig.verbose,
	});

	const virtualModulesPlugin = createVirtualModulesPlugin({
		avalonConfig,
		nitroConfig,
		verbose: avalonConfig.verbose,
	});

	const buildPlugin = createNitroBuildPlugin(avalonConfig, nitroConfig);

	const manifestPlugin = createIslandManifestPlugin(avalonConfig, {
		verbose: avalonConfig.verbose,
		generatePreloadHints: true,
	});

	const sourceMapConfig = createSourceMapConfig(
		nitroConfig.preset ?? "node_server",
		avalonConfig.isDev,
	);
	const sourceMapPlugin = createSourceMapPlugin(sourceMapConfig);

	return {
		nitroOptions,
		plugins: [
			...(Array.isArray(nitroPlugin) ? nitroPlugin : [nitroPlugin]),
			coordinationPlugin,
			virtualModulesPlugin,
			buildPlugin,
			manifestPlugin,
			sourceMapPlugin,
		],
	};
}

/**
 * Coordination plugin: stores config/server refs, sets up SSR middleware and HMR,
 * and prewarms core infrastructure modules (fire-and-forget).
 */
export function createNitroCoordinationPlugin(options: NitroCoordinationPluginOptions): Plugin {
	const { avalonConfig, verbose } = options;

	return {
		name: "avalon:nitro-coordination",
		enforce: "pre",

		configResolved(_config) {
			globalThis.__avalonConfig = avalonConfig;
		},

		configureServer(server: ViteDevServer) {
			globalThis.__viteDevServer = server;

			// Scoped middleware — discovered once, cached until invalidated by HMR
			let scopedMiddlewareRoutes: MiddlewareRoute[] | null = null;

			async function getScopedMiddleware(): Promise<MiddlewareRoute[]> {
				if (!scopedMiddlewareRoutes) {
					const viteRoot = server.config.root || process.cwd();
					scopedMiddlewareRoutes = await discoverScopedMiddleware({
						baseDir: `${viteRoot}/src`,
						devMode: false,
					});
				}
				return scopedMiddlewareRoutes;
			}

			function clearScopedMiddlewareRoutes(): void {
				scopedMiddlewareRoutes = null;
			}

			setupHMRCoordination(server, avalonConfig, verbose, clearScopedMiddlewareRoutes);

			// Pre-discover middleware (non-blocking)
			getScopedMiddleware().catch((err) => {
				console.warn("[middleware] Failed to discover middleware:", err);
			});

			// When Nitro manages the SSR environment it replaces the default
			// RunnableDevEnvironment with a FetchableDevEnvironment. In that
			// case server.ssrLoadModule() will throw because it requires a
			// RunnableDevEnvironment. Detect this once at startup and skip
			// the avalon SSR middleware entirely — Nitro's own env-runner
			// pipeline handles SSR requests instead.
			const ssrEnv = server.environments?.ssr;
			const ssrIsRunnable = !!ssrEnv && isRunnableDevEnvironment(ssrEnv);

			if (ssrIsRunnable) {
				// Fire-and-forget: prewarm only core infrastructure modules.
				// Pages, islands, and per-route middleware are loaded on-demand.
				prewarmCoreModules(server, avalonConfig.integrations, verbose).catch((err) => {
					console.error("[prewarm] Core modules pre-warm failed:", err);
				});
			}

			// SSR middleware — runs before Vite's SPA fallback.
			// When Nitro owns the SSR environment (non-runnable), we skip
			// this middleware and let Nitro's handler serve the request.
			server.middlewares.use(async (req, res, next) => {
				if (!ssrIsRunnable) return next();

				const originalUrl = req.url || "/";
				let url = originalUrl;

				if (url.endsWith(".html")) url = url.slice(0, -5) || "/";
				if (url === "/index") url = "/";

				// Skip static files, HMR, and Vite internals
				if (
					url.startsWith("/@") ||
					url.startsWith("/__") ||
					url.startsWith("/node_modules/") ||
					url.startsWith("/src/client/") ||
					url.startsWith("/packages/") ||
					(url.includes(".") && !url.endsWith("/"))
				) {
					return next();
				}

				if (url.startsWith("/api/")) {
					return next();
				}

				try {
					const middlewareHandled = await handleScopedMiddleware(
						server,
						url,
						req,
						res,
						getScopedMiddleware,
						verbose,
					);
					if (middlewareHandled) return;

					// Try streaming SSR first (streams shell before page data resolves)
					const streamed = await handleStreamingSSRRequest(server, url, avalonConfig, res);
					if (streamed) return;

					// Fallback to buffered SSR for non-modular pages
					const html = await handleSSRRequest(server, url, avalonConfig);
					if (html) {
						res.statusCode = 200;
						res.setHeader("Content-Type", "text/html");
						res.end(html);
						return;
					}

					await handle404(server, url, res, avalonConfig);
				} catch (error) {
					console.error("[SSR Error]", error);
					res.statusCode = 500;
					res.setHeader("Content-Type", "text/html");
					res.end(generateErrorPage(error as Error));
				}
			});
		},

		buildStart() {
			// no-op in production — coordination happens via other plugins
		},
	};
}

// ─── Dev Server Middleware Helpers ───────────────────────────────────────────

import type { IncomingMessage, ServerResponse } from "node:http";

async function handleScopedMiddleware(
	server: ViteDevServer,
	url: string,
	req: IncomingMessage,
	res: ServerResponse,
	getScopedMiddleware: () => Promise<MiddlewareRoute[]>,
	verbose?: boolean,
): Promise<boolean> {
	const middlewareStart = performance.now();
	const middlewareRoutes = await getScopedMiddleware();
	if (middlewareRoutes.length === 0) return false;

	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(req.headers)) {
		if (typeof value === "string") headers[key] = value;
		else if (Array.isArray(value)) headers[key] = value.join(", ");
	}

	const fullUrl = `http://${req.headers.host || "localhost"}${url}`;
	const h3Event = {
		url: fullUrl,
		method: req.method || "GET",
		path: url,
		node: { req, res },
		req: new Request(fullUrl, {
			method: req.method || "GET",
			headers,
		}),
		context: {} as Record<string, unknown>,
	} as unknown as H3Event;

	const middlewareResponse = await executeScopedMiddleware(h3Event, middlewareRoutes, {
		devMode: false,
	});

	const middlewareTime = performance.now() - middlewareStart;
	if (middlewareTime > 100) {
		console.warn(`⚠️ Slow middleware: ${middlewareTime.toFixed(0)}ms for ${url}`);
	}

	if (middlewareResponse) {
		res.statusCode = middlewareResponse.status;
		middlewareResponse.headers.forEach((value, key) => {
			res.setHeader(key, value);
		});
		res.end(await middlewareResponse.text());
		return true;
	}
	return false;
}

async function handle404(
	server: ViteDevServer,
	url: string,
	res: ServerResponse,
	config: ResolvedAvalonConfig,
): Promise<void> {
	try {
		const { discoverErrorPages, getErrorPageModule, generateDefaultErrorPage } = await import(
			"../nitro/error-handler.ts"
		);
		const errorPages = await discoverErrorPages({
			isDev: config.isDev,
			pagesDir: config.pagesDir,
			loadPageModule: async (filePath: string): Promise<PageModule> => {
				return (await server.ssrLoadModule(filePath)) as PageModule;
			},
		});
		const errorPageModule = getErrorPageModule(404, errorPages);

		if (errorPageModule?.default && typeof errorPageModule.default === "function") {
			const { renderToHtml } = await import("../render/ssr.ts");
			const ErrorPageComponent = errorPageModule.default;
			const errorHtml = await renderToHtml(
				{
					component: () =>
						ErrorPageComponent({ statusCode: 404, message: `Page not found: ${url}`, url }),
				},
				{},
			);
			res.statusCode = 404;
			res.setHeader("Content-Type", "text/html");
			res.end(errorHtml);
			return;
		}

		const fallbackHtml = generateDefaultErrorPage(404, `Page not found: ${url}`, config.isDev);
		res.statusCode = 404;
		res.setHeader("Content-Type", "text/html");
		res.end(fallbackHtml);
	} catch {
		res.statusCode = 404;
		res.setHeader("Content-Type", "text/html");
		res.end(generateFallback404(url));
	}
}

/**
 * Prewarms core infrastructure modules (fire-and-forget).
 * Loads SSR infrastructure and framework renderers so the first page render
 * doesn't pay the full module-load cost. Island components are loaded on-demand
 * to avoid penalizing startup with unused modules.
 */
async function prewarmCoreModules(
	server: ViteDevServer,
	integrations: readonly string[],
	verbose?: boolean,
): Promise<void> {
	const prewarmStart = performance.now();

	const coreModules = [
		{ path: resolveAvalonPackagePath("src/render/ssr.ts"), assignTo: "ssr" as string | null },
		{
			path: resolveAvalonPackagePath("src/core/layout/enhanced-layout-resolver.ts"),
			assignTo: "layout" as string | null,
		},
		{ path: resolveAvalonPackagePath("src/middleware/index.ts"), assignTo: null as string | null },
		...integrations.map((name) => ({
			path: resolveIntegrationPackagePath(name, "server/renderer.ts"),
			assignTo: null as string | null,
		})),
	];

	const results = await Promise.allSettled(
		coreModules.map(async ({ path, assignTo }) => {
			const mod = await server.ssrLoadModule(path);
			if (assignTo === "ssr") cachedSSRModule = mod;
			if (assignTo === "layout") cachedLayoutModule = mod;
		}),
	);

	const succeeded = results.filter((r) => r.status === "fulfilled").length;
	const totalTime = performance.now() - prewarmStart;

	if (verbose && succeeded > 0) {
		console.log(
			`🔥 SSR ready in ${totalTime.toFixed(0)}ms (${succeeded}/${coreModules.length} core modules)`,
		);
	}
}

/**
 * Virtual modules plugin — page routes, island manifest, runtime config.
 */
export function createVirtualModulesPlugin(options: NitroCoordinationPluginOptions): Plugin {
	const { avalonConfig, nitroConfig, verbose } = options;

	return {
		name: "avalon:nitro-virtual-modules",
		enforce: "pre",

		resolveId(id: string) {
			if (id === VIRTUAL_MODULE_IDS.PAGE_ROUTES) return RESOLVED_VIRTUAL_IDS.PAGE_ROUTES;
			if (id === VIRTUAL_MODULE_IDS.PAGE_LOADER) return RESOLVED_VIRTUAL_IDS.PAGE_LOADER;
			if (id === VIRTUAL_MODULE_IDS.ISLAND_MANIFEST) return RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST;
			if (id === VIRTUAL_MODULE_IDS.RUNTIME_CONFIG) return RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG;
			if (id === VIRTUAL_MODULE_IDS.CONFIG) return RESOLVED_VIRTUAL_IDS.CONFIG;
			if (id === VIRTUAL_MODULE_IDS.LAYOUTS) return RESOLVED_VIRTUAL_IDS.LAYOUTS;
			if (id === VIRTUAL_MODULE_IDS.ASSETS) return RESOLVED_VIRTUAL_IDS.ASSETS;
			if (id === VIRTUAL_MODULE_IDS.RENDERER) return RESOLVED_VIRTUAL_IDS.RENDERER;
			if (id === VIRTUAL_MODULE_IDS.CLIENT_ENTRY) return RESOLVED_VIRTUAL_IDS.CLIENT_ENTRY;
			if (id === VIRTUAL_MODULE_IDS.INTEGRATION_LOADER)
				return RESOLVED_VIRTUAL_IDS.INTEGRATION_LOADER;
			return null;
		},

		async load(id: string) {
			if (id === RESOLVED_VIRTUAL_IDS.PAGE_ROUTES)
				return await generatePageRoutesModule(avalonConfig, verbose);
			if (id === RESOLVED_VIRTUAL_IDS.PAGE_LOADER)
				return await generatePageLoaderModule(avalonConfig, verbose);
			if (id === RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST) return generateIslandManifestModule();
			if (id === RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG)
				return generateRuntimeConfigModule(avalonConfig, nitroConfig);
			if (id === RESOLVED_VIRTUAL_IDS.CONFIG)
				return generateConfigModule(avalonConfig, nitroConfig);
			if (id === RESOLVED_VIRTUAL_IDS.LAYOUTS) return await generateLayoutsModule(avalonConfig);
			if (id === RESOLVED_VIRTUAL_IDS.ASSETS) return generateAssetsModule(nitroConfig);
			if (id === RESOLVED_VIRTUAL_IDS.RENDERER) return generateRendererModule(avalonConfig);
			if (id === RESOLVED_VIRTUAL_IDS.CLIENT_ENTRY)
				return await generateClientEntryModule(avalonConfig, nitroConfig);
			if (id === RESOLVED_VIRTUAL_IDS.INTEGRATION_LOADER)
				return generateIntegrationLoaderModule(avalonConfig);
			return null;
		},

		handleHotUpdate({ file, server }) {
			if (file.includes(avalonConfig.pagesDir)) {
				const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_IDS.PAGE_ROUTES);
				if (mod) server.moduleGraph.invalidateModule(mod);
			}
			// Invalidate layouts virtual module when layout files change
			if (file.includes("/layouts/") || file.includes("_layout")) {
				const layoutMod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_IDS.LAYOUTS);
				if (layoutMod) server.moduleGraph.invalidateModule(layoutMod);
				// Also invalidate client entry since layout CSS may have changed
				const clientEntryMod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_IDS.CLIENT_ENTRY);
				if (clientEntryMod) server.moduleGraph.invalidateModule(clientEntryMod);
			}
			// Invalidate virtual:avalon/config when config-related files change
			if (
				file.includes("vite.config") ||
				file.includes("avalon.config") ||
				file.includes("nitro.config")
			) {
				const configMod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_IDS.CONFIG);
				if (configMod) server.moduleGraph.invalidateModule(configMod);
			}
			return undefined;
		},
	};
}

// ─── HMR Coordination ───────────────────────────────────────────────────────

function setupHMRCoordination(
	server: ViteDevServer,
	_config: ResolvedAvalonConfig,
	_verbose?: boolean,
	clearScopedMiddlewareRoutes?: () => void,
): void {
	server.watcher.on("change", (file) => {
		if (file.includes("_middleware")) {
			clearMiddlewareCache();
			clearScopedMiddlewareRoutes?.();
		}
		if (file.includes("/render/") || file.includes("/layout/") || file.includes("/islands/")) {
			cachedSSRModule = null;
			cachedLayoutModule = null;
		}

		if (file.includes("/layouts/") || file.includes("_layout")) {
			const resolver = globalThis.__avalonLayoutResolver as { clearCache?: () => void } | undefined;
			resolver?.clearCache?.();
		}
	});

	server.watcher.on("add", (file) => {
		if (file.includes("_middleware")) {
			clearMiddlewareCache();
			clearScopedMiddlewareRoutes?.();
		}
	});

	server.watcher.on("unlink", (file) => {
		if (file.includes("_middleware")) {
			clearMiddlewareCache();
			clearScopedMiddlewareRoutes?.();
		}
	});
}

// ─── Virtual Module Generators ───────────────────────────────────────────────

async function generatePageRoutesModule(
	config: ResolvedAvalonConfig,
	_verbose?: boolean,
): Promise<string> {
	try {
		const { getAllPageDirs } = await import("./module-discovery.ts");
		const { discoverPageRoutesFromMultipleDirs } = await import("../nitro/route-discovery.ts");

		// Get all page directories (traditional + modular)
		const pageDirs = await getAllPageDirs(config.pagesDir, config.modules, process.cwd());

		const routes = await discoverPageRoutesFromMultipleDirs(pageDirs, {
			developmentMode: config.isDev,
		});

		const routesJson = JSON.stringify(routes, null, 2);
		return `export const pageRoutes = ${routesJson};\nexport default pageRoutes;\n`;
	} catch {
		return `export const pageRoutes = [];\nexport default pageRoutes;\n`;
	}
}

/**
 * Generates a virtual module that imports all page components and provides
 * a loadPage(pathname) function for production SSR.
 *
 * In development, pages are loaded via Vite's ssrLoadModule. In production,
 * all page modules must be statically imported into the server bundle so
 * they're available at runtime. This module bridges that gap.
 */
async function generatePageLoaderModule(
	config: ResolvedAvalonConfig,
	_verbose?: boolean,
): Promise<string> {
	try {
		const { getAllPageDirs } = await import("./module-discovery.ts");
		const { discoverPageRoutesFromMultipleDirs } = await import("../nitro/route-discovery.ts");
		const { relative } = await import("node:path");

		const cwd = process.cwd();
		const pageDirs = await getAllPageDirs(config.pagesDir, config.modules, cwd);
		const routes = await discoverPageRoutesFromMultipleDirs(pageDirs, {
			developmentMode: config.isDev,
		});

		// Generate import statements for each page
		const imports: string[] = [];
		const routeEntries: string[] = [];

		for (let i = 0; i < routes.length; i++) {
			const route = routes[i];
			const varName = `page_${i}`;
			// Make the absolute filePath relative to the project root, then
			// prefix with '/' so Vite resolves it from the project root.
			const relPath = relative(cwd, route.filePath).replaceAll("\\", "/");
			const importPath = relPath.startsWith("/") ? relPath : "/" + relPath;
			imports.push(`import * as ${varName} from '${importPath}';`);
			routeEntries.push(
				`  { pattern: ${JSON.stringify(route.pattern)}, params: ${JSON.stringify(route.params)}, module: ${varName} }`,
			);
		}

		return [
			...imports,
			"",
			`const routes = [`,
			routeEntries.join(",\n"),
			`];`,
			"",
			`/**`,
			` * Match a pathname against discovered routes and return the page module.`,
			` * Uses the same pattern matching as Avalon's route discovery.`,
			` */`,
			`export function loadPage(pathname) {`,
			`  const cleanPath = pathname.split('?')[0];`,
			`  for (const route of routes) {`,
			`    if (matchRoute(cleanPath, route.pattern, route.params)) {`,
			`      return route.module;`,
			`    }`,
			`  }`,
			`  return null;`,
			`}`,
			"",
			`function matchRoute(pathname, pattern, paramNames) {`,
			`  // Exact match`,
			`  if (pattern === pathname) return true;`,
			`  // Normalize trailing slashes`,
			`  const normPath = pathname === '/' ? '/' : pathname.replace(/\\/$/, '');`,
			`  const normPattern = pattern === '/' ? '/' : pattern.replace(/\\/$/, '');`,
			`  if (normPath === normPattern) return true;`,
			`  // Dynamic segments: /users/:id matches /users/123`,
			`  if (paramNames.length > 0) {`,
			`    const patternParts = normPattern.split('/');`,
			`    const pathParts = normPath.split('/');`,
			`    if (patternParts.length !== pathParts.length) return false;`,
			`    return patternParts.every((part, i) => part.startsWith(':') || part === pathParts[i]);`,
			`  }`,
			`  return false;`,
			`}`,
			"",
			`export default { loadPage, routes };`,
			"",
		].join("\n");
	} catch (err) {
		console.error("[page-loader] Failed to generate page loader:", err);
		return `export function loadPage() { return null; }\nexport default { loadPage, routes: [] };\n`;
	}
}

function generateIslandManifestModule(): string {
	return `export const islandManifest = { islands: {}, clientEntry: "", css: [] };\nexport default islandManifest;\n`;
}

function generateRuntimeConfigModule(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig,
): string {
	const runtimeConfig = {
		avalon: {
			streaming: nitroConfig.streaming ?? true,
			pagesDir: avalonConfig.pagesDir,
			layoutsDir: avalonConfig.layoutsDir,
			isDev: avalonConfig.isDev,
		},
		...nitroConfig.runtimeConfig,
	};
	return `export const runtimeConfig = ${JSON.stringify(runtimeConfig, null, 2)};\nexport function useRuntimeConfig() { return runtimeConfig; }\nexport default runtimeConfig;\n`;
}

export function generateConfigModule(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig,
): string {
	const config = {
		streaming: nitroConfig.streaming ?? true,
		pagesDir: avalonConfig.pagesDir,
		layoutsDir: avalonConfig.layoutsDir,
		isDev: avalonConfig.isDev,
		...nitroConfig.runtimeConfig,
	};
	return `const config = ${JSON.stringify(config, null, 2)};\nexport function useAvalonConfig() { return config; }\nexport default config;\n`;
}

// ─── Layout & Asset Virtual Module Generators ────────────────────────────────

/**
 * Generates a virtual module that statically imports all discovered layout
 * components and exports a `wrapWithLayouts(pageHtml, pageModule, context)`
 * function. This eliminates the need for consumers to manually import layouts
 * and build a layout map in their renderer.
 *
 * The generated module:
 * 1. Discovers all layout directories (shared + modular)
 * 2. Generates static imports for each _layout.tsx
 * 3. Builds a prefix→Layout map (like the manual moduleLayouts array)
 * 4. Exports wrapWithLayouts that composes page HTML with the right layouts
 */
async function generateLayoutsModule(avalonConfig: ResolvedAvalonConfig): Promise<string> {
	const { getAllLayoutDirs } = await import("./module-discovery.ts");
	const { relative, resolve } = await import("node:path");
	const { stat: fsStat } = await import("node:fs/promises");

	const cwd = process.cwd();
	const layoutDirs = await getAllLayoutDirs(avalonConfig.layoutsDir, avalonConfig.modules, cwd);

	// Discover actual _layout.tsx files
	const layouts: Array<{ prefix: string; importPath: string; varName: string; isShared: boolean }> =
		[];
	let idx = 0;
	const sharedLayoutsPath = resolve(cwd, avalonConfig.layoutsDir);

	for (const { dir, prefix } of layoutDirs) {
		const layoutFile = join(dir, "_layout.tsx");
		try {
			const s = await fsStat(layoutFile);
			if (!s.isFile()) continue;
		} catch {
			continue;
		}
		const relPath = relative(cwd, layoutFile).replaceAll("\\", "/");
		const importPath = relPath.startsWith("/") ? relPath : "/" + relPath;
		// A layout is "shared" (root) only if it lives in the shared layoutsDir,
		// not in a module directory. The home module has prefix '/' but provides
		// its own module-specific layout, not the root layout.
		const isShared = dir.startsWith(sharedLayoutsPath);
		// Shared layout that lives in layoutsDir is the root layout
		const isRootLayout = isShared && !avalonConfig.modules;
		const varName = isRootLayout ? "RootLayout" : `Layout_${idx}`;
		layouts.push({ prefix, importPath, varName, isShared });
		idx++;
	}

	// Separate shared (root) layouts from module layouts
	const sharedLayouts = layouts.filter((l) => l.isShared);
	const moduleLayouts = layouts.filter((l) => !l.isShared);

	// Generate imports
	const imports = layouts.map((l) => `import ${l.varName} from '${l.importPath}';`);

	// Generate the module layout entries array
	// Module layouts are sorted by prefix length (longest first for matching)
	// The home module (prefix '/') is special — it only matches exact '/'
	const entries = moduleLayouts
		.sort((a, b) => b.prefix.length - a.prefix.length)
		.map((l) => {
			// Home module: skipRoot=true (it IS the root-level layout)
			const skipRoot = l.prefix === "/";
			return `  { prefix: ${JSON.stringify(l.prefix)}, Layout: ${l.varName}, skipRoot: ${skipRoot} }`;
		});

	// The root/shared layout (outermost wrapper)
	const rootLayoutVar = sharedLayouts.length > 0 ? sharedLayouts[0].varName : "null";

	const code = [
		`// Auto-generated by Avalon — do not edit`,
		`import { h } from 'preact';`,
		`import preactRenderToString from 'preact-render-to-string';`,
		`import { getUniversalCSSForHead } from '@useavalon/avalon/islands/universal-css-collector';`,
		`import { getUniversalHeadForInjection } from '@useavalon/avalon/islands/universal-head-collector';`,
		...imports,
		``,
		`const RootLayoutComponent = ${rootLayoutVar};`,
		``,
		`const moduleLayouts = [`,
		entries.join(",\n"),
		`];`,
		``,
		`function getLayoutsForPath(pathname) {`,
		`  for (const entry of moduleLayouts) {`,
		`    if (entry.prefix === '/' ? pathname === '/' : pathname.startsWith(entry.prefix)) {`,
		`      return entry;`,
		`    }`,
		`  }`,
		`  return null;`,
		`}`,
		``,
		`function injectUniversalAssets(html) {`,
		`  const universalCSS = getUniversalCSSForHead(true);`,
		`  if (universalCSS && html.includes('</head>')) {`,
		`    html = html.replace('</head>', universalCSS + '\\n</head>');`,
		`  }`,
		`  const universalHead = getUniversalHeadForInjection(true);`,
		`  if (universalHead && html.includes('</head>')) {`,
		`    html = html.replace('</head>', universalHead + '\\n</head>');`,
		`  }`,
		`  return html;`,
		`}`,
		``,
		`export async function wrapWithLayouts(pageHtml, pageModule, context, injectAssets) {`,
		`  const pathname = context.url.pathname;`,
		`  const frontmatter = {`,
		`    ...(pageModule.frontmatter || {}),`,
		`    ...(pageModule.metadata || {}),`,
		`    currentPath: pathname,`,
		`  };`,
		`  const pageLayoutConfig = pageModule.layoutConfig;`,
		`  const skipAll = pageLayoutConfig?.skipLayouts?.includes('_layout');`,
		``,
		`  const layoutEntry = getLayoutsForPath(pathname);`,
		`  const routeInfo = { path: pathname, params: context.params, query: context.url.searchParams };`,
		`  let html;`,
		``,
		`  if (!layoutEntry || skipAll) {`,
		`    if (RootLayoutComponent && !skipAll) {`,
		`      const rootProps = {`,
		`        children: h('div', { id: 'app', dangerouslySetInnerHTML: { __html: pageHtml } }),`,
		`        frontmatter,`,
		`        data: {},`,
		`        route: routeInfo,`,
		`      };`,
		`      const rootResult = RootLayoutComponent(rootProps);`,
		`      const resolvedRoot = rootResult instanceof Promise ? await rootResult : rootResult;`,
		`      html = '<!DOCTYPE html>\\n' + preactRenderToString(resolvedRoot);`,
		`    } else {`,
		`      const title = String(frontmatter.title || 'Avalon');`,
		`      html = [`,
		`        '<!DOCTYPE html>',`,
		`        '<html lang="en">',`,
		`        '<head>',`,
		`        '<meta charset="utf-8">',`,
		`        '<meta name="viewport" content="width=device-width, initial-scale=1">',`,
		`        '<title>' + title + '</title>',`,
		`        '</head>',`,
		`        '<body>',`,
		`        '<div id="app">' + pageHtml + '</div>',`,
		`        '</body>',`,
		`        '</html>',`,
		`      ].join('\\n');`,
		`    }`,
		`  } else {`,
		`    const layoutProps = {`,
		`      children: h('div', { dangerouslySetInnerHTML: { __html: pageHtml } }),`,
		`      frontmatter,`,
		`      data: {},`,
		`      route: routeInfo,`,
		`    };`,
		`    const layoutResult = layoutEntry.Layout(layoutProps);`,
		`    const resolvedLayout = layoutResult instanceof Promise ? await layoutResult : layoutResult;`,
		`    let wrappedHtml = preactRenderToString(resolvedLayout);`,
		``,
		`    if (!layoutEntry.skipRoot && RootLayoutComponent) {`,
		`      const rootProps = {`,
		`        children: h('div', { dangerouslySetInnerHTML: { __html: wrappedHtml } }),`,
		`        frontmatter,`,
		`        data: {},`,
		`        route: routeInfo,`,
		`      };`,
		`      const rootResult = RootLayoutComponent(rootProps);`,
		`      const resolvedRoot = rootResult instanceof Promise ? await rootResult : rootResult;`,
		`      wrappedHtml = preactRenderToString(resolvedRoot);`,
		`    }`,
		``,
		`    html = '<!DOCTYPE html>\\n' + wrappedHtml;`,
		`  }`,
		``,
		`  if (injectAssets) {`,
		`    html = injectAssets(html);`,
		`  }`,
		`  return injectUniversalAssets(html);`,
		`}`,
		``,
		`export default { wrapWithLayouts };`,
		``,
	].join("\n");

	return code;
}

/**
 * Generates a virtual module that provides asset injection helpers.
 * Imports client assets via the ?assets=client virtual import and exports
 * an `injectAssets(html)` function that adds CSS links, JS preloads, and
 * the entry script to the HTML.
 *
 * The ?assets=client suffix is resolved by Nitro's Vite assets plugin
 * which reads the client build manifest and provides CSS/JS metadata.
 */
function generateAssetsModule(nitroConfig: AvalonNitroConfig): string {
	// Resolve the client entry path. The ?assets=client suffix is handled
	// by Nitro's Vite assets plugin which reads the client build manifest.
	// We use an absolute path from the project root so it resolves correctly
	// even when imported from a virtual module.
	const clientEntry = nitroConfig.clientEntry ?? "app/entry-client";
	const importPath = clientEntry.startsWith("/") ? clientEntry : "/" + clientEntry;
	return [
		`// Auto-generated by Avalon — do not edit`,
		`// @ts-ignore — virtual import resolved by Nitro's Vite assets plugin at build time`,
		`import clientAssets from '${importPath}?assets=client';`,
		``,
		`function buildAssetTags() {`,
		`  const cssLinks = (clientAssets?.css ?? [])`,
		`    .map(attr => '<link rel="stylesheet" href="' + attr.href + '">')`,
		`    .join('\\n');`,
		`  const jsPreloads = (clientAssets?.js ?? [])`,
		`    .map(attr => '<link rel="modulepreload" href="' + attr.href + '">')`,
		`    .join('\\n');`,
		`  const entryScript = clientAssets?.entry`,
		`    ? '<script type="module" src="' + clientAssets.entry + '"></script>'`,
		`    : '';`,
		`  return { cssLinks, jsPreloads, entryScript };`,
		`}`,
		``,
		`export function injectAssets(html) {`,
		`  const { cssLinks, jsPreloads, entryScript } = buildAssetTags();`,
		`  if (html.includes('</head>')) {`,
		`    html = html.replace('</head>', cssLinks + '\\n' + jsPreloads + '\\n</head>');`,
		`  }`,
		`  if (html.includes('</body>')) {`,
		`    html = html.replace('</body>', entryScript + '\\n</body>');`,
		`  }`,
		`  return html;`,
		`}`,
		``,
		`export { clientAssets };`,
		`export default { injectAssets, clientAssets };`,
		``,
	].join("\n");
}

/**
 * Generates the `virtual:avalon/renderer` module.
 *
 * Wires together:
 * - virtual:avalon/config (runtime config)
 * - virtual:avalon/page-loader (page module resolution)
 * - virtual:avalon/layouts (layout wrapping)
 * - virtual:avalon/assets (client asset injection)
 * - createNitroRenderer (SSR request handler)
 * - registerBuiltinDirectives (custom hydration directives)
 *
 * Consumer usage: `export { default } from 'virtual:avalon/renderer';`
 */
function generateRendererModule(avalonConfig: ResolvedAvalonConfig): string {
	// Statically import and pre-register integrations so the SSR bundle
	// can render islands without relying on dynamic imports (which fail
	// in the bundled Nitro environment).
	const integrations: string[] = Array.isArray(avalonConfig.integrations)
		? avalonConfig.integrations
		: [];

	const integrationImports: string[] = [];
	const registrationLines: string[] = [];

	for (const fw of integrations) {
		const varName = `${fw}Integration`;
		// Each integration's mod.ts exports a named <fw>Integration object
		integrationImports.push(`import { ${varName} } from '@useavalon/${fw}';`);
		registrationLines.push(`registry.register(${varName});`);
	}

	return [
		`// Auto-generated by Avalon — do not edit`,
		`import { createNitroRenderer } from '@useavalon/avalon/nitro/renderer';`,
		`import { registerBuiltinDirectives } from '@useavalon/avalon';`,
		`import { registry } from '@useavalon/avalon/islands/integration-registry';`,
		`import avalonConfig from 'virtual:avalon/config';`,
		`import { loadPage } from 'virtual:avalon/page-loader';`,
		`import { wrapWithLayouts } from 'virtual:avalon/layouts';`,
		`import { injectAssets } from 'virtual:avalon/assets';`,
		...integrationImports,
		``,
		`// Pre-register framework integrations for SSR`,
		...registrationLines,
		``,
		`// Register built-in custom hydration directives (on:delay, on:scroll, etc.)`,
		`registerBuiltinDirectives();`,
		``,
		`export default createNitroRenderer({`,
		`  avalonConfig,`,
		`  isDev: avalonConfig.isDev,`,
		`  resolvePageRoute: async (pathname) => {`,
		`    const mod = loadPage(pathname);`,
		`    if (!mod || !('default' in mod)) return null;`,
		`    return { filePath: '[virtual:' + pathname + ']', pattern: pathname, params: {} };`,
		`  },`,
		`  loadPageModule: async (filePath) => {`,
		`    const match = filePath.match(/^\\[virtual:(.+)\\]$/);`,
		`    const pathname = match ? match[1] : filePath;`,
		`    const mod = loadPage(pathname);`,
		`    if (mod) return mod;`,
		`    return { default: () => null, metadata: { title: 'Avalon' } };`,
		`  },`,
		`  wrapWithLayouts: (pageHtml, pageModule, context) =>`,
		`    wrapWithLayouts(pageHtml, pageModule, context, injectAssets),`,
		`});`,
		``,
	].join("\n");
}

// ─── Public Accessors ────────────────────────────────────────────────────────

/**
 * Generate the virtual:avalon/client-entry module.
 *
 * Auto-discovers CSS files in layout directories and includes the
 * hydration runtime + any global CSS specified in config. This means
 * consumers don't need to manually maintain a client entry file.
 */
async function generateClientEntryModule(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig,
): Promise<string> {
	const { getAllLayoutDirs } = await import("./module-discovery.ts");
	const { readdir } = await import("node:fs/promises");
	const { relative, join: pathJoin } = await import("node:path");

	const cwd = process.cwd();

	// Discover all CSS files in layout directories
	const layoutDirs = await getAllLayoutDirs(avalonConfig.layoutsDir, avalonConfig.modules, cwd);

	const cssImports: string[] = [];

	for (const { dir } of layoutDirs) {
		try {
			const entries = await readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isFile()) continue;
				if (!entry.name.endsWith(".css")) continue;
				const absPath = pathJoin(dir, entry.name);
				const relPath = relative(cwd, absPath).replaceAll("\\", "/");
				const importPath = relPath.startsWith("/") ? relPath : "/" + relPath;
				cssImports.push(importPath);
			}
		} catch {
			// Directory doesn't exist or can't be read — skip
		}
	}

	// Build the module source
	const lines: string[] = [
		`// Auto-generated by Avalon — do not edit`,
		`// Island hydration runtime`,
		`import '@useavalon/avalon/client/main';`,
		``,
	];

	// Global CSS from config
	const globalCSS = nitroConfig.globalCSS ?? [];
	for (const cssPath of globalCSS) {
		const importPath = cssPath.startsWith("/") ? cssPath : "/" + cssPath;
		lines.push(`// Global CSS`);
		lines.push(`import '${importPath}';`);
	}

	if (globalCSS.length > 0) lines.push(``);

	// Layout CSS (auto-discovered)
	if (cssImports.length > 0) {
		lines.push(`// Layout CSS (auto-discovered)`);
		for (const imp of cssImports) {
			lines.push(`import '${imp}';`);
		}
	}

	lines.push(``);
	return lines.join("\n");
}

/**
 * Generate the integration loader virtual module.
 *
 * Only includes dynamic import() calls for frameworks that are actually
 * configured in the avalon() config. This prevents Vite from trying to
 * resolve @useavalon/vue/client, @useavalon/svelte/client, etc. when
 * only preact is configured.
 */
function generateIntegrationLoaderModule(avalonConfig: ResolvedAvalonConfig): string {
	const integrations = avalonConfig.integrations ?? [];
	const frameworkNames = integrations.map((i: string | { name: string }) =>
		typeof i === "string" ? i : i.name,
	);

	const frameworkImports: Record<string, string> = {
		preact: "@useavalon/preact/client",
		react: "@useavalon/preact/client",
		vue: "@useavalon/vue/client",
		svelte: "@useavalon/svelte/client",
		solid: "@useavalon/solid/client",
		lit: "@useavalon/lit/client",
		qwik: "@useavalon/qwik/client",
	};

	const hmrImports: Record<string, string> = {
		preact: "@useavalon/preact/client/hmr",
		react: "@useavalon/react/client/hmr",
		vue: "@useavalon/vue/client/hmr",
		svelte: "@useavalon/svelte/client/hmr",
		solid: "@useavalon/solid/client/hmr",
		lit: "@useavalon/lit/client/hmr",
		qwik: "@useavalon/qwik/client/hmr",
	};

	const hasLit = frameworkNames.includes("lit");

	const lines: string[] = [
		`// Auto-generated by Avalon — only includes configured integrations`,
		``,
		`// --- loadIntegrationModule ---`,
		`export async function loadIntegrationModule(framework) {`,
		`  switch (framework) {`,
	];

	for (const fw of frameworkNames) {
		const importPath = frameworkImports[fw];
		if (!importPath) continue;
		if (fw === "react") {
			lines.push(`    case "react":`);
		} else if (fw === "preact") {
			lines.push(`    case "preact":`);
			lines.push(`      return import("${importPath}");`);
		} else {
			lines.push(`    case "${fw}":`);
			lines.push(`      return import("${importPath}");`);
		}
	}

	if (frameworkNames.includes("react") && !frameworkNames.includes("preact")) {
		lines.push(`      return import("${frameworkImports.react}");`);
	}

	lines.push(`    default:`);
	lines.push(`      throw new Error(\`Unknown or unconfigured framework: \${framework}\`);`);
	lines.push(`  }`);
	lines.push(`}`);
	lines.push(``);

	// --- preLitHydration: only emitted if Lit is configured ---
	lines.push(`// --- Lit hydration pre-load (only if Lit is configured) ---`);
	if (hasLit) {
		lines.push(`export async function preLitHydration() {`);
		lines.push(`  await import("@useavalon/lit/client");`);
		lines.push(`}`);
	} else {
		lines.push(`export async function preLitHydration() {}`);
	}
	lines.push(``);

	// --- loadHMRAdapter: only emitted for configured frameworks ---
	lines.push(`// --- HMR adapter loader ---`);
	lines.push(`export async function loadHMRAdapter(framework) {`);
	lines.push(`  switch (framework) {`);

	for (const fw of frameworkNames) {
		const hmrPath = hmrImports[fw];
		if (!hmrPath) continue;
		lines.push(`    case "${fw}":`);
		lines.push(`      return import("${hmrPath}").then(m => m.${fw}Adapter);`);
	}

	lines.push(`    default: return null;`);
	lines.push(`  }`);
	lines.push(`}`);

	return lines.join("\n");
}

export function getViteDevServer(): ViteDevServer | undefined {
	return globalThis.__viteDevServer;
}

export function getAvalonConfig(): ResolvedAvalonConfig | undefined {
	return globalThis.__avalonConfig;
}

export function isDevelopmentMode(): boolean {
	return globalThis.__avalonConfig?.isDev ?? true;
}

// ─── SSR Request Handling ────────────────────────────────────────────────────

const STREAM_MARKER = "<!--AVALON_STREAM_BOUNDARY-->";

let cachedSSRModule: unknown = null;

let cachedLayoutModule: unknown = null;

/**
 * Streaming SSR handler — flushes the layout shell to the browser before
 * the page component's async data fetching resolves.
 *
 * Flow:
 * 1. Load page module + layout modules, collect CSS
 * 2. Render shell layout with a marker placeholder as children
 * 3. Split HTML on the marker → shellBefore / shellAfter
 * 4. res.write(shellBefore) — browser starts parsing <html><head>... immediately
 * 5. Render page content (awaits data fetches)
 * 6. Render wrapper layouts around page content
 * 7. res.write(wrappedContent + shellAfter)
 * 8. res.end()
 *
 * Falls back to null (caller uses buffered path) when:
 * - No modular layouts configured
 * - Page not found
 * - No shell layout detected
 * - Page provides its own complete HTML document
 */
async function handleStreamingSSRRequest(
	server: ViteDevServer,
	url: string,
	config: ResolvedAvalonConfig,
	res: ServerResponse,
): Promise<boolean> {
	// Streaming only works with modular layouts (need shell + wrapper separation)
	if (!config.modules) return false;

	const pathname = url.split("?")[0];
	const pageFile = await findPageFile(pathname, config, server);
	if (!pageFile) return false;

	try {
		const pageModule = await server.ssrLoadModule(pageFile);
		const PageComponent = pageModule.default;
		if (!PageComponent) return false;

		// Check if page wants to skip layouts entirely (provides own HTML)
		const layoutConfig = pageModule.layoutConfig as { skipLayouts?: string[] } | undefined;

		// Collect CSS
		const cssContents = await collectCssFromModuleGraph(server, pageFile);
		const layoutFiles = await discoverLayoutFiles(pathname, server);

		const layoutModules: Array<{ file: string; module: Record<string, unknown> }> = [];
		for (const layoutFile of layoutFiles) {
			const layoutModule = await server.ssrLoadModule(layoutFile);
			layoutModules.push({ file: layoutFile, module: layoutModule });
		}
		for (const layoutFile of layoutFiles) {
			const layoutCss = await collectCssFromModuleGraph(server, layoutFile);
			cssContents.push(...layoutCss);
		}

		if (layoutModules.length === 0) return false;

		const { render: preactRender } = await server.ssrLoadModule("preact-render-to-string");
		const { h } = await server.ssrLoadModule("preact");

		const skipLayouts = layoutConfig?.skipLayouts || [];
		const activeLayouts = layoutModules.filter(({ file }) => {
			const layoutName =
				file
					.split("/")
					.pop()
					?.replace(/\.[^.]+$/, "") || "";
			return !skipLayouts.includes(layoutName);
		});

		const frontmatter = pageModule.frontmatter as Record<string, unknown> | undefined;
		const metadata = pageModule.metadata as Record<string, unknown> | undefined;
		const mergedFrontmatter = { ...frontmatter, ...metadata, currentPath: pathname };
		const layoutProps = {
			children: null as unknown,
			frontmatter: mergedFrontmatter,
			params: {},
			url: pathname,
		};

		// Categorize layouts into shell vs wrapper
		const shellLayouts: Array<{ module: Record<string, unknown> }> = [];
		const wrapperLayouts: Array<{ module: Record<string, unknown> }> = [];

		for (const layout of activeLayouts) {
			const LayoutComponent = layout.module.default;
			if (!LayoutComponent || typeof LayoutComponent !== "function") continue;
			try {
				const testProps = { ...layoutProps, children: h("div", null, "test") };
				const testResult = (LayoutComponent as (props: unknown) => unknown)(testProps);
				const resolvedTest = testResult instanceof Promise ? await testResult : testResult;
				const testHtml = preactRender(resolvedTest);
				if (testHtml.trim().startsWith("<html") || testHtml.includes("<!DOCTYPE")) {
					shellLayouts.push(layout);
				} else {
					wrapperLayouts.push(layout);
				}
			} catch {
				wrapperLayouts.push(layout);
			}
		}

		// Need a shell layout to stream
		if (shellLayouts.length === 0) return false;

		// Render shell layout with stream marker as children
		const { module: shellModule } = shellLayouts[shellLayouts.length - 1];
		const ShellComponent = shellModule.default;
		if (!ShellComponent || typeof ShellComponent !== "function") return false;

		let shellHtml: string;
		try {
			const shellProps = {
				...layoutProps,
				children: h("div", { dangerouslySetInnerHTML: { __html: STREAM_MARKER } }),
			};
			const shellResult = (ShellComponent as (props: unknown) => unknown)(shellProps);
			const resolvedShell = shellResult instanceof Promise ? await shellResult : shellResult;
			shellHtml = preactRender(resolvedShell);
		} catch {
			return false;
		}

		// Split on marker
		const markerIndex = shellHtml.indexOf(STREAM_MARKER);
		if (markerIndex === -1) return false;

		const shellBefore = shellHtml.slice(0, markerIndex);
		const shellAfter = shellHtml.slice(markerIndex + STREAM_MARKER.length);

		// Inject CSS into the shell's <head>
		let shellBeforeWithCss = shellBefore;
		if (cssContents.length > 0) {
			const cssTag = `<style data-avalon-ssr-css>${cssContents.join("\n")}</style>`;
			if (shellBefore.includes("</head>")) {
				shellBeforeWithCss = shellBefore.replace("</head>", `${cssTag}\n</head>`);
			} else {
				shellBeforeWithCss = shellBefore + cssTag;
			}
		}

		// Ensure DOCTYPE
		if (!shellBeforeWithCss.trim().toLowerCase().startsWith("<!doctype")) {
			shellBeforeWithCss = "<!DOCTYPE html>\n" + shellBeforeWithCss;
		}

		// Inject universal CSS and head content
		const universalCSS = getUniversalCSSForHead(true);
		if (universalCSS && shellBeforeWithCss.includes("</head>")) {
			shellBeforeWithCss = shellBeforeWithCss.replace("</head>", `${universalCSS}\n</head>`);
		}
		const universalHead = getUniversalHeadForInjection(true);
		if (universalHead && shellBeforeWithCss.includes("</head>")) {
			shellBeforeWithCss = shellBeforeWithCss.replace("</head>", `${universalHead}\n</head>`);
		}

		// ── FLUSH SHELL ──
		res.statusCode = 200;
		res.setHeader("Content-Type", "text/html; charset=utf-8");
		res.setHeader("Transfer-Encoding", "chunked");
		res.setHeader("X-Avalon-Streaming", "1");
		res.flushHeaders();
		res.write(shellBeforeWithCss);

		// ── RENDER PAGE CONTENT (this is where data fetching happens) ──
		let pageContent: string;
		try {
			const pageResult =
				typeof PageComponent === "function" ? (PageComponent as () => unknown)() : PageComponent;
			const resolvedPage = pageResult instanceof Promise ? await pageResult : pageResult;
			pageContent = preactRender(resolvedPage);
		} catch (error) {
			console.error("[SSR Streaming] Error rendering page component:", error);
			pageContent = `<div>Error rendering page</div>`;
		}

		// Check if page returned a complete HTML doc (shouldn't happen with layouts, but safety check)
		const isCompleteDoc =
			pageContent.trim().startsWith("<!DOCTYPE html>") || pageContent.trim().startsWith("<html");
		if (isCompleteDoc) {
			// Can't stream this — just send it and close
			res.end(pageContent);
			return true;
		}

		// Apply wrapper layouts around page content
		let content = pageContent;
		for (const { module: layoutModule } of wrapperLayouts) {
			const LayoutComponent = layoutModule.default;
			if (!LayoutComponent || typeof LayoutComponent !== "function") continue;
			try {
				const props = {
					...layoutProps,
					children: h("div", { dangerouslySetInnerHTML: { __html: content } }),
				};
				const layoutResult = (LayoutComponent as (props: unknown) => unknown)(props);
				const resolvedLayout = layoutResult instanceof Promise ? await layoutResult : layoutResult;
				content = preactRender(resolvedLayout);
			} catch (error) {
				console.error("[SSR Streaming] Error rendering wrapper layout:", error);
			}
		}

		// ── FLUSH PAGE CONTENT + SHELL TAIL ──
		// Inject client scripts before closing </body>
		let tail = content + shellAfter;
		if (!tail.includes("/src/client/main.js") && !tail.includes("/@vite/client")) {
			const bodyCloseIndex = tail.lastIndexOf("</body>");
			if (bodyCloseIndex !== -1) {
				tail =
					tail.slice(0, bodyCloseIndex) +
					'\n<script type="module" src="/@vite/client"></script>\n' +
					'<script type="module" src="/src/client/main.js"></script>\n' +
					tail.slice(bodyCloseIndex);
			}
		}

		res.end(tail);
		return true;
	} catch (error) {
		// If we already started writing, we can't change status code
		if (res.headersSent) {
			res.end(`<div>Streaming SSR error: ${(error as Error).message}</div></body></html>`);
			return true;
		}
		return false;
	}
}

async function handleSSRRequest(
	server: ViteDevServer,
	url: string,
	config: ResolvedAvalonConfig,
): Promise<string | null> {
	const pathname = url.split("?")[0];
	const pageFile = await findPageFile(pathname, config, server);

	if (!pageFile) return null;

	try {
		const pageModule = await server.ssrLoadModule(pageFile);
		const PageComponent = pageModule.default;

		if (!PageComponent) {
			console.warn(`[SSR] Page ${pageFile} has no default export`);
			return null;
		}

		// Collect CSS from the module graph after loading the page module.
		// This captures CSS modules, plain CSS imports, and any transitive CSS deps.
		const cssContents = await collectCssFromModuleGraph(server, pageFile);

		// Pre-load layout files via ssrLoadModule so their CSS modules enter
		// Vite's module graph *before* we collect CSS from them.
		const layoutFiles = await discoverLayoutFiles(pathname, server);

		// Load all layout modules
		const layoutModules: Array<{ file: string; module: Record<string, unknown> }> = [];
		for (const layoutFile of layoutFiles) {
			const layoutModule = await server.ssrLoadModule(layoutFile);
			layoutModules.push({ file: layoutFile, module: layoutModule });
		}

		// Collect CSS from layout files and merge with page CSS
		for (const layoutFile of layoutFiles) {
			const layoutCss = await collectCssFromModuleGraph(server, layoutFile);
			cssContents.push(...layoutCss);
		}

		let html: string;

		// If we have modular layouts, use manual layout composition
		if (config.modules && layoutModules.length > 0) {
			html = await renderPageWithManualLayouts(
				PageComponent,
				pageModule,
				layoutModules,
				pathname,
				config,
				server,
			);
		} else {
			html = await renderPageToHtml(PageComponent, pageModule, pathname, config, server);
		}

		// Inject collected CSS into the HTML so styles are present on first paint
		if (cssContents.length > 0) {
			html = injectSsrCss(html, cssContents);
		}

		return html;
	} catch (error) {
		console.error(`[SSR] Error rendering ${pageFile}:`, error);
		throw error;
	}
}

/**
 * Render a page with manually composed layouts (for modular architecture)
 *
 * Layout composition order:
 * 1. Page content is rendered first
 * 2. Module-specific layouts (e.g., docs/_layout.tsx) wrap the page content
 * 3. Root/shell layout (shared/_layout.tsx) wraps everything last
 *
 * This ensures that layouts returning `<div>` wrappers are applied before
 * layouts returning complete `<html>` documents.
 */
async function renderPageWithManualLayouts(
	PageComponent: unknown,
	pageModule: Record<string, unknown>,
	layoutModules: Array<{ file: string; module: Record<string, unknown> }>,
	pathname: string,
	config: ResolvedAvalonConfig,
	server: ViteDevServer,
): Promise<string> {
	const { render: preactRender } = await server.ssrLoadModule("preact-render-to-string");
	const { h } = await server.ssrLoadModule("preact");

	// Check if page wants to skip certain layouts
	const layoutConfig = pageModule.layoutConfig as { skipLayouts?: string[] } | undefined;
	const skipLayouts = layoutConfig?.skipLayouts || [];

	// Filter out skipped layouts
	const activeLayouts = layoutModules.filter(({ file }) => {
		const layoutName =
			file
				.split("/")
				.pop()
				?.replace(/\.[^.]+$/, "") || "";
		return !skipLayouts.includes(layoutName);
	});

	// Render page content first
	let pageContent: string;
	try {
		const pageResult =
			typeof PageComponent === "function" ? (PageComponent as () => unknown)() : PageComponent;
		const resolvedPage = pageResult instanceof Promise ? await pageResult : pageResult;
		pageContent = preactRender(resolvedPage);
	} catch (error) {
		console.error("[SSR] Error rendering page component:", error);
		pageContent = `<div>Error rendering page</div>`;
	}

	// Check if page content is a complete HTML document
	const isCompleteDoc =
		pageContent.trim().startsWith("<!DOCTYPE html>") || pageContent.trim().startsWith("<html");

	if (isCompleteDoc) {
		// Page provides its own HTML structure, inject client script and return
		return injectClientScript(pageContent);
	}

	// Separate layouts into shell (returns <html>) and wrapper (returns <div>) layouts
	// We need to render each layout to determine its type, then apply in correct order
	// Merge frontmatter and metadata - metadata takes precedence for page-specific values
	const frontmatter = pageModule.frontmatter as Record<string, unknown> | undefined;
	const metadata = pageModule.metadata as Record<string, unknown> | undefined;
	const mergedFrontmatter = { ...frontmatter, ...metadata, currentPath: pathname };

	const layoutProps = {
		children: null as unknown, // Will be set per-layout
		frontmatter: mergedFrontmatter,
		params: {},
		url: pathname,
	};

	// Categorize layouts by rendering them with placeholder content
	const shellLayouts: Array<{ module: Record<string, unknown> }> = [];
	const wrapperLayouts: Array<{ module: Record<string, unknown> }> = [];

	for (const layout of activeLayouts) {
		const LayoutComponent = layout.module.default;
		if (!LayoutComponent || typeof LayoutComponent !== "function") continue;

		try {
			// Render with placeholder to detect if it returns HTML shell
			const testProps = {
				...layoutProps,
				children: h("div", null, "test"),
			};
			const testResult = (LayoutComponent as (props: unknown) => unknown)(testProps);
			const resolvedTest = testResult instanceof Promise ? await testResult : testResult;
			const testHtml = preactRender(resolvedTest);

			if (testHtml.trim().startsWith("<html") || testHtml.includes("<!DOCTYPE")) {
				shellLayouts.push(layout);
			} else {
				wrapperLayouts.push(layout);
			}
		} catch {
			// If we can't determine, treat as wrapper
			wrapperLayouts.push(layout);
		}
	}

	// Apply wrapper layouts first (innermost to outermost)
	// These are module-specific layouts that return <div> wrappers
	let content = pageContent;

	for (const { module: layoutModule } of wrapperLayouts) {
		const LayoutComponent = layoutModule.default;
		if (!LayoutComponent || typeof LayoutComponent !== "function") continue;

		try {
			const props = {
				...layoutProps,
				children: h("div", { dangerouslySetInnerHTML: { __html: content } }),
			};

			const layoutResult = (LayoutComponent as (props: unknown) => unknown)(props);
			const resolvedLayout = layoutResult instanceof Promise ? await layoutResult : layoutResult;
			content = preactRender(resolvedLayout);
		} catch (error) {
			console.error("[SSR] Error rendering wrapper layout:", error);
		}
	}

	// Apply shell layout last (the one that provides <html>)
	// If there are multiple shell layouts, prefer the module-specific one (last in array)
	// since layouts are discovered in order: shared -> module-specific
	if (shellLayouts.length > 0) {
		// Use the last shell layout (module-specific takes precedence over shared)
		const { module: shellModule } = shellLayouts[shellLayouts.length - 1];
		const ShellComponent = shellModule.default;

		if (ShellComponent && typeof ShellComponent === "function") {
			try {
				const props = {
					...layoutProps,
					children: h("div", { dangerouslySetInnerHTML: { __html: content } }),
				};

				const shellResult = (ShellComponent as (props: unknown) => unknown)(props);
				const resolvedShell = shellResult instanceof Promise ? await shellResult : shellResult;
				content = preactRender(resolvedShell);
			} catch (error) {
				console.error("[SSR] Error rendering shell layout:", error);
			}
		}
	}

	// Check if final content is a complete HTML document
	const isFinalCompleteDoc =
		content.trim().startsWith("<!DOCTYPE html>") || content.trim().startsWith("<html");

	if (isFinalCompleteDoc) {
		return injectClientScript(content);
	}

	// Wrap in basic HTML structure (fallback if no shell layout)
	const fallbackMetadata = (pageModule.metadata || {}) as { title?: string; description?: string };
	const title = fallbackMetadata.title || "Avalon App";
	const description = fallbackMetadata.description || "";

	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
    <script type="module" src="/@vite/client"></script>
  </head>
  <body>
    ${content}
    <script type="module" src="/src/client/main.js"></script>
  </body>
</html>`;
}

/**
 * Inject client script into HTML if not already present.
 * Also ensures DOCTYPE is present for valid HTML5.
 */
function injectClientScript(html: string): string {
	let result = html;

	// Ensure DOCTYPE is present
	if (!result.trim().toLowerCase().startsWith("<!doctype")) {
		result = "<!DOCTYPE html>\n" + result;
	}

	// Inject universal CSS from island framework renderers (Svelte scoped, Vue scoped, Solid CSS, etc.)
	if (!result.includes('data-universal-ssr="true"')) {
		const universalCSS = getUniversalCSSForHead(true);
		if (universalCSS && result.includes("</head>")) {
			result = result.replace("</head>", `${universalCSS}\n</head>`);
		}
	}

	// Inject universal head content (hydration scripts from frameworks like Solid)
	const universalHead = getUniversalHeadForInjection(true);
	if (universalHead && result.includes("</head>")) {
		result = result.replace("</head>", `${universalHead}\n</head>`);
	}

	// Skip if scripts already present
	if (result.includes("/src/client/main.js") || result.includes("/@vite/client")) {
		return result;
	}

	// Inject before </body> or at the end
	const bodyCloseIndex = result.lastIndexOf("</body>");
	if (bodyCloseIndex !== -1) {
		return (
			result.slice(0, bodyCloseIndex) +
			'\n<script type="module" src="/@vite/client"></script>\n' +
			'<script type="module" src="/src/client/main.js"></script>\n' +
			result.slice(bodyCloseIndex)
		);
	}

	return (
		result +
		'\n<script type="module" src="/@vite/client"></script>\n<script type="module" src="/src/client/main.js"></script>'
	);
}

/**
 * Discover layout files that apply to a given route path.
 *
 * Supports both traditional layouts (src/layouts/) and modular layouts (app/modules/[module]/layouts/).
 * For route "/blog/post", checks shared layouts, module layouts, and traditional layouts.
 */
async function discoverLayoutFiles(pathname: string, server: ViteDevServer): Promise<string[]> {
	const viteRoot = server.config.root || process.cwd();
	const config = globalThis.__avalonConfig;
	const layoutFileName = "_layout.tsx";
	const layoutFiles: string[] = [];

	// Build path hierarchy: "/" → [''], "/blog/post" → ['', '/blog', '/blog/post']
	const segments = pathname.split("/").filter(Boolean);
	const paths = [""];
	for (let i = 0; i < segments.length; i++) {
		paths.push("/" + segments.slice(0, i + 1).join("/"));
	}

	// Helper to check and add layout file
	async function tryAddLayout(fullPath: string): Promise<void> {
		try {
			const stat = await fsStat(fullPath);
			if (stat.isFile()) {
				const relativePath = fullPath.slice(viteRoot.length);
				if (!layoutFiles.includes(relativePath)) {
					layoutFiles.push(relativePath);
				}
			}
		} catch {
			// Layout file doesn't exist — that's fine
		}
	}

	// 1. Check shared layouts directory (root layout)
	if (config?.layoutsDir) {
		const sharedLayoutsDir = `${viteRoot}/${config.layoutsDir}`;
		await tryAddLayout(`${sharedLayoutsDir}/${layoutFileName}`);
	}

	// 2. Check modular layouts (app/modules/*/layouts/)
	if (config?.modules) {
		const modulesDir = `${viteRoot}/${config.modules.dir}`;
		const layoutsDirName = config.modules.layoutsDirName;

		// Determine which module this route belongs to
		const firstSegment = segments[0] || "";
		const rootModules = ["home", "root", "main", "index"];

		// For root routes, check the home/root/main/index module
		if (!firstSegment || rootModules.includes(firstSegment.toLowerCase())) {
			for (const moduleName of rootModules) {
				await tryAddLayout(`${modulesDir}/${moduleName}/${layoutsDirName}/${layoutFileName}`);
			}
		} else {
			// For other routes, check the module matching the first segment
			await tryAddLayout(`${modulesDir}/${firstSegment}/${layoutsDirName}/${layoutFileName}`);
		}
	}

	// 3. Check traditional layouts directory (src/layouts/)
	const traditionalLayoutsDir = `${viteRoot}/src/layouts`;
	for (const pathSegment of paths) {
		const fullPath =
			pathSegment === ""
				? `${traditionalLayoutsDir}/${layoutFileName}`
				: `${traditionalLayoutsDir}${pathSegment}/${layoutFileName}`;
		await tryAddLayout(fullPath);
	}

	return layoutFiles;
}

async function findPageFile(
	pathname: string,
	config: ResolvedAvalonConfig,
	server: ViteDevServer,
): Promise<string | null> {
	let normalizedPath = pathname;
	if (normalizedPath.endsWith("/") && normalizedPath !== "/") {
		normalizedPath = normalizedPath.slice(0, -1);
	}
	if (normalizedPath === "/") {
		normalizedPath = "/index";
	}

	const extensions = [".tsx", ".ts", ".jsx", ".js", ".mdx", ".md"];
	const viteRoot = server.config.root || process.cwd();

	// Helper to check if a file exists
	async function tryFile(relativePath: string): Promise<string | null> {
		try {
			const fullPath = `${viteRoot}/${relativePath}`;
			const stat = await fsStat(fullPath);
			if (stat.isFile()) return `/${relativePath}`;
		} catch {
			// File doesn't exist
		}
		return null;
	}

	// 1. Check modular page directories first
	if (config.modules) {
		const modulesDir = config.modules.dir;
		const pagesDirName = config.modules.pagesDirName;
		const segments = pathname.split("/").filter(Boolean);
		const firstSegment = segments[0] || "";
		const rootModules = ["home", "root", "main", "index"];

		// Determine which module and what the relative path within that module is
		let moduleName: string;
		let moduleRelativePath: string;

		if (!firstSegment || rootModules.includes(firstSegment.toLowerCase())) {
			// Root route - check home module
			moduleName = "home";
			moduleRelativePath = normalizedPath;
		} else {
			// Check if first segment matches a module
			moduleName = firstSegment;
			// Remove the module prefix from the path
			const remainingSegments = segments.slice(1);
			moduleRelativePath =
				remainingSegments.length > 0 ? "/" + remainingSegments.join("/") : "/index";
		}

		// Try to find the page in the module
		for (const ext of extensions) {
			const result = await tryFile(
				`${modulesDir}/${moduleName}/${pagesDirName}${moduleRelativePath}${ext}`,
			);
			if (result) return result;
		}
		if (!moduleRelativePath.endsWith("/index")) {
			for (const ext of extensions) {
				const result = await tryFile(
					`${modulesDir}/${moduleName}/${pagesDirName}${moduleRelativePath}/index${ext}`,
				);
				if (result) return result;
			}
		}
	}

	// 2. Check traditional pages directory
	const pagesDir = config.pagesDir;
	for (const ext of extensions) {
		const result = await tryFile(`${pagesDir}${normalizedPath}${ext}`);
		if (result) return result;
	}
	if (!normalizedPath.endsWith("/index")) {
		for (const ext of extensions) {
			const result = await tryFile(`${pagesDir}${normalizedPath}/index${ext}`);
			if (result) return result;
		}
	}

	return null;
}

async function renderPageToHtml(
	PageComponent: unknown,
	pageModule: Record<string, unknown>,
	pathname: string,
	config: ResolvedAvalonConfig,
	server: ViteDevServer,
): Promise<string> {
	const metadata = (pageModule.metadata || {}) as { title?: string; description?: string };

	try {
		if (!cachedSSRModule) {
			cachedSSRModule = await server.ssrLoadModule(resolveAvalonPackagePath("src/render/ssr.ts"));
		}
		// cachedSSRModule is the dynamically-loaded render/ssr.ts module;
		// expected exports: renderToHtml, renderToHtmlWithLayouts
		const ssrModule = cachedSSRModule as Record<string, unknown>;

		if (!cachedLayoutModule) {
			cachedLayoutModule = await server.ssrLoadModule(
				resolveAvalonPackagePath("src/core/layout/enhanced-layout-resolver.ts"),
			);
		}
		// cachedLayoutModule is the dynamically-loaded enhanced-layout-resolver.ts module;
		// expected exports: EnhancedLayoutResolver, EnhancedLayoutResolverUtils
		const layoutModule = cachedLayoutModule as Record<string, unknown>;

		const routeConfig = {
			component: () =>
				typeof PageComponent === "function" ? (PageComponent as () => unknown)() : PageComponent,
			options: { title: metadata.title || "Avalon App" },
			frontmatter: pageModule.frontmatter as Record<string, unknown> | undefined,
		};

		// Try layout-aware rendering first
		if (
			ssrModule.renderToHtmlWithLayouts &&
			layoutModule.EnhancedLayoutResolver &&
			layoutModule.EnhancedLayoutResolverUtils
		) {
			try {
				const viteRoot = server.config.root || process.cwd();

				if (!globalThis.__avalonLayoutResolver) {
					const EnhancedLayoutResolver = layoutModule.EnhancedLayoutResolver as new (
						opts: Record<string, unknown>,
					) => unknown;

					// Use the shared layouts directory as the base
					// The resolver will also check modular layouts via the layout composer
					const layoutsDir = config.layoutsDir || "src/layouts";

					globalThis.__avalonLayoutResolver = new EnhancedLayoutResolver({
						baseDirectory: `${viteRoot}/${layoutsDir}`,
						filePattern: "_layout.tsx",
						excludeDirectories: ["node_modules", ".git", "dist", "build"],
						enableWatching: true,
						developmentMode: false,
						enableCaching: true,
						cacheTTL: 60 * 1000,
						maxCacheSize: 100,
						enableStreaming: true,
						enableErrorBoundaries: true,
						enableMetrics: false,
						enableDebugInfo: false,
						// Pass modules config for modular layout discovery
						modulesDir: config.modules ? `${viteRoot}/${config.modules.dir}` : undefined,
						modulesLayoutsDirName: config.modules?.layoutsDirName,
					});
				}

				const fullUrl = `http://localhost${pathname}`;
				const layoutContext = {
					params: {},
					query: {},
					url: fullUrl,
					request: { method: "GET", url: fullUrl, headers: new Headers() },
				};

				return await (ssrModule.renderToHtmlWithLayouts as Function)(
					routeConfig,
					globalThis.__avalonLayoutResolver,
					layoutContext,
					pathname,
					{ title: metadata.title || "Avalon App" },
					undefined,
					{ suppressWarnings: true },
				);
			} catch {
				// Layout rendering failed, fall back to basic rendering
			}
		}

		if (ssrModule.renderToHtml) {
			return await (ssrModule.renderToHtml as Function)(
				routeConfig,
				{ title: metadata.title || "Avalon App" },
				undefined,
				{ suppressWarnings: true },
			);
		}
	} catch {
		// SSR module not available, fall back to basic rendering
	}

	// Fallback: basic HTML template
	const title = metadata.title || "Avalon App";
	const description = metadata.description || "";
	let content = "";
	try {
		const preactRenderModule = await server.ssrLoadModule("preact-render-to-string");
		if (preactRenderModule.render && typeof PageComponent === "function") {
			content = preactRenderModule.render((PageComponent as () => unknown)());
		}
	} catch {
		content = `<p>Loading page: ${escapeHtml(pathname)}</p>`;
	}

	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
    <script type="module" src="/@vite/client"></script>
  </head>
  <body>
    <div id="app">${content}</div>
    <script type="module" src="/src/client/main.js"></script>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

// ─── Global Type Declarations ────────────────────────────────────────────────

declare global {
	// deno-lint-ignore no-var
	var __avalonLayoutResolver: unknown;
}
