/**
 * Nitro Integration Module for Avalon Vite Plugin
 *
 * Provides coordination between Avalon's Vite plugin and Nitro:
 * - API routes: Auto-discovered by Nitro from `api/` directory
 * - Page routes: Virtual module for SSR page component discovery
 * - Middleware: Auto-discovered by Nitro from `middleware/` directory
 */

import type { Plugin, ViteDevServer } from 'vite';
import { nitro as nitroVitePlugin } from 'nitro/vite';
import { stat as fsStat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { ResolvedAvalonConfig } from './types.ts';
import { createNitroConfig, type AvalonNitroConfig, type NitroConfigOutput } from '../nitro/config.ts';
import type { PageModule } from '../nitro/types.ts';
import {
	createNitroBuildPlugin,
	createIslandManifestPlugin,
	createSourceMapPlugin,
	createSourceMapConfig,
} from '../nitro/index.ts';
import { discoverScopedMiddleware, executeScopedMiddleware, clearMiddlewareCache } from '../middleware/index.ts';
import type { MiddlewareRoute } from '../middleware/types.ts';
import type { H3Event } from 'h3';
import { generateErrorPage, generateFallback404 } from '../render/error-pages.ts';
import { collectCssFromModuleGraph, injectSsrCss } from '../render/collect-css.ts';
import { getUniversalCSSForHead } from '../islands/universal-css-collector.ts';
import { getUniversalHeadForInjection } from '../islands/universal-head-collector.ts';

/**
 * Resolves the absolute path to a file inside @useavalon/avalon's source tree.
 * Handles both workspace (.ts source) and published (.js compiled) layouts.
 */
function resolveAvalonPackagePath(relativePath: string): string {
	const require = createRequire(import.meta.url);
	const modEntry = require.resolve('@useavalon/avalon');
	const pkgRoot = dirname(modEntry);
	const resolved = join(pkgRoot, relativePath);
	// Published package ships .js in dist/, workspace has .ts source
	if (relativePath.endsWith('.ts') && !existsSync(resolved)) {
		const jsPath = resolved.replace(/\.ts$/, '.js');
		if (existsSync(jsPath)) return jsPath;
	}
	return resolved;
}

/**
 * Resolves the absolute path to a file inside an @useavalon/<name> integration package.
 * Handles both workspace (.ts source) and published (.js compiled) layouts.
 */
function resolveIntegrationPackagePath(name: string, relativePath: string): string {
	const require = createRequire(join(process.cwd(), 'package.json'));
	const modEntry = require.resolve(`@useavalon/${name}`);
	const pkgRoot = dirname(modEntry);
	const resolved = join(pkgRoot, relativePath);
	if (relativePath.endsWith('.ts') && !existsSync(resolved)) {
		const jsPath = resolved.replace(/\.ts$/, '.js');
		if (existsSync(jsPath)) return jsPath;
	}
	return resolved;
}

export const VIRTUAL_MODULE_IDS = {
	PAGE_ROUTES: 'virtual:avalon/page-routes',
	PAGE_LOADER: 'virtual:avalon/page-loader',
	ISLAND_MANIFEST: 'virtual:avalon/island-manifest',
	RUNTIME_CONFIG: 'virtual:avalon/runtime-config',
	CONFIG: 'virtual:avalon/config',
} as const;

export const RESOLVED_VIRTUAL_IDS = {
	PAGE_ROUTES: '\0' + VIRTUAL_MODULE_IDS.PAGE_ROUTES,
	PAGE_LOADER: '\0' + VIRTUAL_MODULE_IDS.PAGE_LOADER,
	ISLAND_MANIFEST: '\0' + VIRTUAL_MODULE_IDS.ISLAND_MANIFEST,
	RUNTIME_CONFIG: '\0' + VIRTUAL_MODULE_IDS.RUNTIME_CONFIG,
	CONFIG: '\0' + VIRTUAL_MODULE_IDS.CONFIG,
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
		serverDir: nitroConfig.serverDir ?? nitroOptions.serverDir ?? './server',
		routeRules: nitroOptions.routeRules,
		runtimeConfig: nitroOptions.runtimeConfig,
		renderer: nitroConfig.renderer === false ? false : nitroOptions.renderer,
		compatibilityDate: nitroOptions.compatibilityDate,
		// Tell Nitro to scan the project root so it discovers routes/ and middleware/
		// alongside the serverDir (./server) which contains the catch-all renderer.
		scanDirs: ['.'],
	};

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

	const sourceMapConfig = createSourceMapConfig(nitroConfig.preset ?? 'node_server', avalonConfig.isDev);
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
		name: 'avalon:nitro-coordination',
		enforce: 'pre',

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
			getScopedMiddleware().catch(err => {
				console.warn('[middleware] Failed to discover middleware:', err);
			});

			// Fire-and-forget: prewarm only core infrastructure modules.
			// Pages, islands, and per-route middleware are loaded on-demand.
			prewarmCoreModules(server, avalonConfig.integrations, verbose).catch(err => {
				console.error('[prewarm] Core modules pre-warm failed:', err);
			});

			// SSR middleware — runs before Vite's SPA fallback
			server.middlewares.use(async (req, res, next) => {
				const originalUrl = req.url || '/';
				let url = originalUrl;

				if (url.endsWith('.html')) url = url.slice(0, -5) || '/';
				if (url === '/index') url = '/';

				// Skip static files, HMR, and Vite internals
				if (
					url.startsWith('/@') ||
					url.startsWith('/__') ||
					url.startsWith('/node_modules/') ||
					url.startsWith('/src/client/') ||
					url.startsWith('/packages/') ||
					(url.includes('.') && !url.endsWith('/'))
				) {
					return next();
				}

				if (url.startsWith('/api/')) {
					return next();
				}

				try {
					const middlewareHandled = await handleScopedMiddleware(server, url, req, res, getScopedMiddleware, verbose);
					if (middlewareHandled) return;

					// Try streaming SSR first (streams shell before page data resolves)
					const streamed = await handleStreamingSSRRequest(server, url, avalonConfig, res);
					if (streamed) return;

					// Fallback to buffered SSR for non-modular pages
					const html = await handleSSRRequest(server, url, avalonConfig);
					if (html) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'text/html');
						res.end(html);
						return;
					}

					await handle404(server, url, res, avalonConfig);
				} catch (error) {
					console.error('[SSR Error]', error);
					res.statusCode = 500;
					res.setHeader('Content-Type', 'text/html');
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

import type { ServerResponse, IncomingMessage } from 'node:http';

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
		if (typeof value === 'string') headers[key] = value;
		else if (Array.isArray(value)) headers[key] = value.join(', ');
	}

	const fullUrl = `http://${req.headers.host || 'localhost'}${url}`;
	const h3Event = {
		url: fullUrl,
		method: req.method || 'GET',
		path: url,
		node: { req, res },
		req: new Request(fullUrl, {
			method: req.method || 'GET',
			headers,
		}),
		context: {} as Record<string, unknown>,
	} as unknown as H3Event;

	const middlewareResponse = await executeScopedMiddleware(h3Event, middlewareRoutes, { devMode: false });

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
		const { discoverErrorPages, getErrorPageModule, generateDefaultErrorPage } =
			await import('../nitro/error-handler.ts');
		const errorPages = await discoverErrorPages({
			isDev: config.isDev,
			pagesDir: config.pagesDir,
			loadPageModule: async (filePath: string): Promise<PageModule> => {
				return (await server.ssrLoadModule(filePath)) as PageModule;
			},
		});
		const errorPageModule = getErrorPageModule(404, errorPages);

		if (errorPageModule?.default && typeof errorPageModule.default === 'function') {
			const { renderToHtml } = await import('../render/ssr.ts');
			const ErrorPageComponent = errorPageModule.default;
			const errorHtml = await renderToHtml(
				{ component: () => ErrorPageComponent({ statusCode: 404, message: `Page not found: ${url}`, url }) },
				{},
			);
			res.statusCode = 404;
			res.setHeader('Content-Type', 'text/html');
			res.end(errorHtml);
			return;
		}

		const fallbackHtml = generateDefaultErrorPage(404, `Page not found: ${url}`, config.isDev);
		res.statusCode = 404;
		res.setHeader('Content-Type', 'text/html');
		res.end(fallbackHtml);
	} catch {
		res.statusCode = 404;
		res.setHeader('Content-Type', 'text/html');
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
		{ path: resolveAvalonPackagePath('src/render/ssr.ts'), assignTo: 'ssr' as string | null },
		{
			path: resolveAvalonPackagePath('src/core/layout/enhanced-layout-resolver.ts'),
			assignTo: 'layout' as string | null,
		},
		{ path: resolveAvalonPackagePath('src/middleware/index.ts'), assignTo: null as string | null },
		...integrations.map(name => ({
			path: resolveIntegrationPackagePath(name, 'server/renderer.ts'),
			assignTo: null as string | null,
		})),
	];

	const results = await Promise.allSettled(
		coreModules.map(async ({ path, assignTo }) => {
			const mod = await server.ssrLoadModule(path);
			if (assignTo === 'ssr') cachedSSRModule = mod;
			if (assignTo === 'layout') cachedLayoutModule = mod;
		}),
	);

	const succeeded = results.filter(r => r.status === 'fulfilled').length;
	const totalTime = performance.now() - prewarmStart;

	if (verbose && succeeded > 0) {
		console.log(`🔥 SSR ready in ${totalTime.toFixed(0)}ms (${succeeded}/${coreModules.length} core modules)`);
	}
}

/**
 * Virtual modules plugin — page routes, island manifest, runtime config.
 */
export function createVirtualModulesPlugin(options: NitroCoordinationPluginOptions): Plugin {
	const { avalonConfig, nitroConfig, verbose } = options;

	return {
		name: 'avalon:nitro-virtual-modules',
		enforce: 'pre',

		resolveId(id: string) {
			if (id === VIRTUAL_MODULE_IDS.PAGE_ROUTES) return RESOLVED_VIRTUAL_IDS.PAGE_ROUTES;
			if (id === VIRTUAL_MODULE_IDS.PAGE_LOADER) return RESOLVED_VIRTUAL_IDS.PAGE_LOADER;
			if (id === VIRTUAL_MODULE_IDS.ISLAND_MANIFEST) return RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST;
			if (id === VIRTUAL_MODULE_IDS.RUNTIME_CONFIG) return RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG;
			if (id === VIRTUAL_MODULE_IDS.CONFIG) return RESOLVED_VIRTUAL_IDS.CONFIG;
			return null;
		},

		async load(id: string) {
			if (id === RESOLVED_VIRTUAL_IDS.PAGE_ROUTES) return await generatePageRoutesModule(avalonConfig, verbose);
			if (id === RESOLVED_VIRTUAL_IDS.PAGE_LOADER) return await generatePageLoaderModule(avalonConfig, verbose);
			if (id === RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST) return generateIslandManifestModule();
			if (id === RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG) return generateRuntimeConfigModule(avalonConfig, nitroConfig);
			if (id === RESOLVED_VIRTUAL_IDS.CONFIG) return generateConfigModule(avalonConfig, nitroConfig);
			return null;
		},

		handleHotUpdate({ file, server }) {
			if (file.includes(avalonConfig.pagesDir)) {
				const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_IDS.PAGE_ROUTES);
				if (mod) server.moduleGraph.invalidateModule(mod);
			}
			// Invalidate virtual:avalon/config when config-related files change
			if (file.includes('vite.config') || file.includes('avalon.config') || file.includes('nitro.config')) {
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
	server.watcher.on('change', file => {
		if (file.includes('_middleware')) {
			clearMiddlewareCache();
			clearScopedMiddlewareRoutes?.();
		}
		if (file.includes('/render/') || file.includes('/layout/') || file.includes('/islands/')) {
			cachedSSRModule = null;
			cachedLayoutModule = null;
		}

		if (file.includes('/layouts/') || file.includes('_layout')) {
			const resolver = globalThis.__avalonLayoutResolver as { clearCache?: () => void } | undefined;
			resolver?.clearCache?.();
		}
	});

	server.watcher.on('add', file => {
		if (file.includes('_middleware')) {
			clearMiddlewareCache();
			clearScopedMiddlewareRoutes?.();
		}
	});

	server.watcher.on('unlink', file => {
		if (file.includes('_middleware')) {
			clearMiddlewareCache();
			clearScopedMiddlewareRoutes?.();
		}
	});
}

// ─── Virtual Module Generators ───────────────────────────────────────────────

async function generatePageRoutesModule(config: ResolvedAvalonConfig, _verbose?: boolean): Promise<string> {
	try {
		const { getAllPageDirs } = await import('./module-discovery.ts');
		const { discoverPageRoutesFromMultipleDirs } = await import('../nitro/route-discovery.ts');

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
async function generatePageLoaderModule(config: ResolvedAvalonConfig, _verbose?: boolean): Promise<string> {
	try {
		const { getAllPageDirs } = await import('./module-discovery.ts');
		const { discoverPageRoutesFromMultipleDirs, matchRoutePattern } = await import('../nitro/route-discovery.ts');

		const pageDirs = await getAllPageDirs(config.pagesDir, config.modules, process.cwd());
		const routes = await discoverPageRoutesFromMultipleDirs(pageDirs, {
			developmentMode: config.isDev,
		});

		// Generate import statements for each page
		const imports: string[] = [];
		const routeEntries: string[] = [];

		for (let i = 0; i < routes.length; i++) {
			const route = routes[i];
			const varName = `page_${i}`;
			// Use the file path relative to the project root for the import
			imports.push(`import * as ${varName} from '/${route.filePath}';`);
			routeEntries.push(
				`  { pattern: ${JSON.stringify(route.pattern)}, params: ${JSON.stringify(route.params)}, module: ${varName} }`,
			);
		}

		return [
			...imports,
			'',
			`const routes = [`,
			routeEntries.join(',\n'),
			`];`,
			'',
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
			'',
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
			'',
			`export default { loadPage, routes };`,
			'',
		].join('\n');
	} catch (err) {
		console.error('[page-loader] Failed to generate page loader:', err);
		return `export function loadPage() { return null; }\nexport default { loadPage, routes: [] };\n`;
	}
}

function generateIslandManifestModule(): string {
	return `export const islandManifest = { islands: {}, clientEntry: "", css: [] };\nexport default islandManifest;\n`;
}

function generateRuntimeConfigModule(avalonConfig: ResolvedAvalonConfig, nitroConfig: AvalonNitroConfig): string {
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

export function generateConfigModule(avalonConfig: ResolvedAvalonConfig, nitroConfig: AvalonNitroConfig): string {
	const config = {
		streaming: nitroConfig.streaming ?? true,
		pagesDir: avalonConfig.pagesDir,
		layoutsDir: avalonConfig.layoutsDir,
		isDev: avalonConfig.isDev,
		...nitroConfig.runtimeConfig,
	};
	return `const config = ${JSON.stringify(config, null, 2)};\nexport function useAvalonConfig() { return config; }\nexport default config;\n`;
}

// ─── Public Accessors ────────────────────────────────────────────────────────

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

const STREAM_MARKER = '<!--AVALON_STREAM_BOUNDARY-->';

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

	const pathname = url.split('?')[0];
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

		const { render: preactRender } = await server.ssrLoadModule('preact-render-to-string');
		const { h } = await server.ssrLoadModule('preact');

		const skipLayouts = layoutConfig?.skipLayouts || [];
		const activeLayouts = layoutModules.filter(({ file }) => {
			const layoutName =
				file
					.split('/')
					.pop()
					?.replace(/\.[^.]+$/, '') || '';
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
			if (!LayoutComponent || typeof LayoutComponent !== 'function') continue;
			try {
				const testProps = { ...layoutProps, children: h('div', null, 'test') };
				const testResult = (LayoutComponent as (props: unknown) => unknown)(testProps);
				const resolvedTest = testResult instanceof Promise ? await testResult : testResult;
				const testHtml = preactRender(resolvedTest);
				if (testHtml.trim().startsWith('<html') || testHtml.includes('<!DOCTYPE')) {
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
		if (!ShellComponent || typeof ShellComponent !== 'function') return false;

		let shellHtml: string;
		try {
			const shellProps = {
				...layoutProps,
				children: h('div', { dangerouslySetInnerHTML: { __html: STREAM_MARKER } }),
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

		let shellBefore = shellHtml.slice(0, markerIndex);
		const shellAfter = shellHtml.slice(markerIndex + STREAM_MARKER.length);

		// Inject CSS into the shell's <head>
		let shellBeforeWithCss = shellBefore;
		if (cssContents.length > 0) {
			const cssTag = `<style data-avalon-ssr-css>${cssContents.join('\n')}</style>`;
			if (shellBefore.includes('</head>')) {
				shellBeforeWithCss = shellBefore.replace('</head>', `${cssTag}\n</head>`);
			} else {
				shellBeforeWithCss = shellBefore + cssTag;
			}
		}

		// Ensure DOCTYPE
		if (!shellBeforeWithCss.trim().toLowerCase().startsWith('<!doctype')) {
			shellBeforeWithCss = '<!DOCTYPE html>\n' + shellBeforeWithCss;
		}

		// Inject universal CSS and head content
		const universalCSS = getUniversalCSSForHead(true);
		if (universalCSS && shellBeforeWithCss.includes('</head>')) {
			shellBeforeWithCss = shellBeforeWithCss.replace('</head>', `${universalCSS}\n</head>`);
		}
		const universalHead = getUniversalHeadForInjection(true);
		if (universalHead && shellBeforeWithCss.includes('</head>')) {
			shellBeforeWithCss = shellBeforeWithCss.replace('</head>', `${universalHead}\n</head>`);
		}

		// ── FLUSH SHELL ──
		res.statusCode = 200;
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.setHeader('Transfer-Encoding', 'chunked');
		res.setHeader('X-Avalon-Streaming', '1');
		res.flushHeaders();
		res.write(shellBeforeWithCss);

		// ── RENDER PAGE CONTENT (this is where data fetching happens) ──
		let pageContent: string;
		try {
			const pageResult = typeof PageComponent === 'function' ? (PageComponent as () => unknown)() : PageComponent;
			const resolvedPage = pageResult instanceof Promise ? await pageResult : pageResult;
			pageContent = preactRender(resolvedPage);
		} catch (error) {
			console.error('[SSR Streaming] Error rendering page component:', error);
			pageContent = `<div>Error rendering page</div>`;
		}

		// Check if page returned a complete HTML doc (shouldn't happen with layouts, but safety check)
		const isCompleteDoc = pageContent.trim().startsWith('<!DOCTYPE html>') || pageContent.trim().startsWith('<html');
		if (isCompleteDoc) {
			// Can't stream this — just send it and close
			res.end(pageContent);
			return true;
		}

		// Apply wrapper layouts around page content
		let content = pageContent;
		for (const { module: layoutModule } of wrapperLayouts) {
			const LayoutComponent = layoutModule.default;
			if (!LayoutComponent || typeof LayoutComponent !== 'function') continue;
			try {
				const props = {
					...layoutProps,
					children: h('div', { dangerouslySetInnerHTML: { __html: content } }),
				};
				const layoutResult = (LayoutComponent as (props: unknown) => unknown)(props);
				const resolvedLayout = layoutResult instanceof Promise ? await layoutResult : layoutResult;
				content = preactRender(resolvedLayout);
			} catch (error) {
				console.error('[SSR Streaming] Error rendering wrapper layout:', error);
			}
		}

		// ── FLUSH PAGE CONTENT + SHELL TAIL ──
		// Inject client scripts before closing </body>
		let tail = content + shellAfter;
		if (!tail.includes('/src/client/main.js') && !tail.includes('/@vite/client')) {
			const bodyCloseIndex = tail.lastIndexOf('</body>');
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
	const pathname = url.split('?')[0];
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
			html = await renderPageWithManualLayouts(PageComponent, pageModule, layoutModules, pathname, config, server);
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
	const { render: preactRender } = await server.ssrLoadModule('preact-render-to-string');
	const { h } = await server.ssrLoadModule('preact');

	// Check if page wants to skip certain layouts
	const layoutConfig = pageModule.layoutConfig as { skipLayouts?: string[] } | undefined;
	const skipLayouts = layoutConfig?.skipLayouts || [];

	// Filter out skipped layouts
	const activeLayouts = layoutModules.filter(({ file }) => {
		const layoutName =
			file
				.split('/')
				.pop()
				?.replace(/\.[^.]+$/, '') || '';
		return !skipLayouts.includes(layoutName);
	});

	// Render page content first
	let pageContent: string;
	try {
		const pageResult = typeof PageComponent === 'function' ? (PageComponent as () => unknown)() : PageComponent;
		const resolvedPage = pageResult instanceof Promise ? await pageResult : pageResult;
		pageContent = preactRender(resolvedPage);
	} catch (error) {
		console.error('[SSR] Error rendering page component:', error);
		pageContent = `<div>Error rendering page</div>`;
	}

	// Check if page content is a complete HTML document
	const isCompleteDoc = pageContent.trim().startsWith('<!DOCTYPE html>') || pageContent.trim().startsWith('<html');

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
		if (!LayoutComponent || typeof LayoutComponent !== 'function') continue;

		try {
			// Render with placeholder to detect if it returns HTML shell
			const testProps = {
				...layoutProps,
				children: h('div', null, 'test'),
			};
			const testResult = (LayoutComponent as (props: unknown) => unknown)(testProps);
			const resolvedTest = testResult instanceof Promise ? await testResult : testResult;
			const testHtml = preactRender(resolvedTest);

			if (testHtml.trim().startsWith('<html') || testHtml.includes('<!DOCTYPE')) {
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
		if (!LayoutComponent || typeof LayoutComponent !== 'function') continue;

		try {
			const props = {
				...layoutProps,
				children: h('div', { dangerouslySetInnerHTML: { __html: content } }),
			};

			const layoutResult = (LayoutComponent as (props: unknown) => unknown)(props);
			const resolvedLayout = layoutResult instanceof Promise ? await layoutResult : layoutResult;
			content = preactRender(resolvedLayout);
		} catch (error) {
			console.error('[SSR] Error rendering wrapper layout:', error);
		}
	}

	// Apply shell layout last (the one that provides <html>)
	// If there are multiple shell layouts, prefer the module-specific one (last in array)
	// since layouts are discovered in order: shared -> module-specific
	if (shellLayouts.length > 0) {
		// Use the last shell layout (module-specific takes precedence over shared)
		const { module: shellModule } = shellLayouts[shellLayouts.length - 1];
		const ShellComponent = shellModule.default;

		if (ShellComponent && typeof ShellComponent === 'function') {
			try {
				const props = {
					...layoutProps,
					children: h('div', { dangerouslySetInnerHTML: { __html: content } }),
				};

				const shellResult = (ShellComponent as (props: unknown) => unknown)(props);
				const resolvedShell = shellResult instanceof Promise ? await shellResult : shellResult;
				content = preactRender(resolvedShell);
			} catch (error) {
				console.error('[SSR] Error rendering shell layout:', error);
			}
		}
	}

	// Check if final content is a complete HTML document
	const isFinalCompleteDoc = content.trim().startsWith('<!DOCTYPE html>') || content.trim().startsWith('<html');

	if (isFinalCompleteDoc) {
		return injectClientScript(content);
	}

	// Wrap in basic HTML structure (fallback if no shell layout)
	const fallbackMetadata = (pageModule.metadata || {}) as { title?: string; description?: string };
	const title = fallbackMetadata.title || 'Avalon App';
	const description = fallbackMetadata.description || '';

	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
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
	if (!result.trim().toLowerCase().startsWith('<!doctype')) {
		result = '<!DOCTYPE html>\n' + result;
	}

	// Inject universal CSS from island framework renderers (Svelte scoped, Vue scoped, Solid CSS, etc.)
	if (!result.includes('data-universal-ssr="true"')) {
		const universalCSS = getUniversalCSSForHead(true);
		if (universalCSS && result.includes('</head>')) {
			result = result.replace('</head>', `${universalCSS}\n</head>`);
		}
	}

	// Inject universal head content (hydration scripts from frameworks like Solid)
	const universalHead = getUniversalHeadForInjection(true);
	if (universalHead && result.includes('</head>')) {
		result = result.replace('</head>', `${universalHead}\n</head>`);
	}

	// Skip if scripts already present
	if (result.includes('/src/client/main.js') || result.includes('/@vite/client')) {
		return result;
	}

	// Inject before </body> or at the end
	const bodyCloseIndex = result.lastIndexOf('</body>');
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
	const layoutFileName = '_layout.tsx';
	const layoutFiles: string[] = [];

	// Build path hierarchy: "/" → [''], "/blog/post" → ['', '/blog', '/blog/post']
	const segments = pathname.split('/').filter(Boolean);
	const paths = [''];
	for (let i = 0; i < segments.length; i++) {
		paths.push('/' + segments.slice(0, i + 1).join('/'));
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
		const firstSegment = segments[0] || '';
		const rootModules = ['home', 'root', 'main', 'index'];

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
			pathSegment === ''
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
	if (normalizedPath.endsWith('/') && normalizedPath !== '/') {
		normalizedPath = normalizedPath.slice(0, -1);
	}
	if (normalizedPath === '/') {
		normalizedPath = '/index';
	}

	const extensions = ['.tsx', '.ts', '.jsx', '.js', '.mdx', '.md'];
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
		const segments = pathname.split('/').filter(Boolean);
		const firstSegment = segments[0] || '';
		const rootModules = ['home', 'root', 'main', 'index'];

		// Determine which module and what the relative path within that module is
		let moduleName: string;
		let moduleRelativePath: string;

		if (!firstSegment || rootModules.includes(firstSegment.toLowerCase())) {
			// Root route - check home module
			moduleName = 'home';
			moduleRelativePath = normalizedPath;
		} else {
			// Check if first segment matches a module
			moduleName = firstSegment;
			// Remove the module prefix from the path
			const remainingSegments = segments.slice(1);
			moduleRelativePath = remainingSegments.length > 0 ? '/' + remainingSegments.join('/') : '/index';
		}

		// Try to find the page in the module
		for (const ext of extensions) {
			const result = await tryFile(`${modulesDir}/${moduleName}/${pagesDirName}${moduleRelativePath}${ext}`);
			if (result) return result;
		}
		if (!moduleRelativePath.endsWith('/index')) {
			for (const ext of extensions) {
				const result = await tryFile(`${modulesDir}/${moduleName}/${pagesDirName}${moduleRelativePath}/index${ext}`);
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
	if (!normalizedPath.endsWith('/index')) {
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
			cachedSSRModule = await server.ssrLoadModule(resolveAvalonPackagePath('src/render/ssr.ts'));
		}
		// cachedSSRModule is the dynamically-loaded render/ssr.ts module;
		// expected exports: renderToHtml, renderToHtmlWithLayouts
		const ssrModule = cachedSSRModule as Record<string, unknown>;

		if (!cachedLayoutModule) {
			cachedLayoutModule = await server.ssrLoadModule(
				resolveAvalonPackagePath('src/core/layout/enhanced-layout-resolver.ts'),
			);
		}
		// cachedLayoutModule is the dynamically-loaded enhanced-layout-resolver.ts module;
		// expected exports: EnhancedLayoutResolver, EnhancedLayoutResolverUtils
		const layoutModule = cachedLayoutModule as Record<string, unknown>;

		const routeConfig = {
			component: () => (typeof PageComponent === 'function' ? (PageComponent as () => unknown)() : PageComponent),
			options: { title: metadata.title || 'Avalon App' },
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
					const layoutsDir = config.layoutsDir || 'src/layouts';

					globalThis.__avalonLayoutResolver = new EnhancedLayoutResolver({
						baseDirectory: `${viteRoot}/${layoutsDir}`,
						filePattern: '_layout.tsx',
						excludeDirectories: ['node_modules', '.git', 'dist', 'build'],
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
					request: { method: 'GET', url: fullUrl, headers: new Headers() },
				};

				return await (ssrModule.renderToHtmlWithLayouts as Function)(
					routeConfig,
					globalThis.__avalonLayoutResolver,
					layoutContext,
					pathname,
					{ title: metadata.title || 'Avalon App' },
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
				{ title: metadata.title || 'Avalon App' },
				undefined,
				{ suppressWarnings: true },
			);
		}
	} catch {
		// SSR module not available, fall back to basic rendering
	}

	// Fallback: basic HTML template
	const title = metadata.title || 'Avalon App';
	const description = metadata.description || '';
	let content = '';
	try {
		const preactRenderModule = await server.ssrLoadModule('preact-render-to-string');
		if (preactRenderModule.render && typeof PageComponent === 'function') {
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
    ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
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
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

// ─── Global Type Declarations ────────────────────────────────────────────────

declare global {
	// deno-lint-ignore no-var
	var __avalonLayoutResolver: unknown;
}
