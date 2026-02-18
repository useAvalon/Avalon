import { mergeOptions } from '../functions/merge.ts';
import { loadIslandManifest } from '../build/island-manifest.ts';
import type { IslandManifest as _IslandManifest } from '../build/island-manifest.ts';
import type { z } from 'zod';

import {
	validateServerConfig,
	safeValidateServerConfig,
	type ServerConfig,
	type Routes,
	type RouteConfig,
} from '../schemas/index.ts';

// Import utilities from separate modules
import { DEFAULT_SERVER_PORT } from './constants.ts';
import { setupViteServer } from './vite-server.ts';
import { setupApiRoutes } from './api-setup.ts';
import { createAllRoutes } from './routes/index.ts';
import { withErrorHandler } from './server-error-handler.ts';

// Import new middleware system (Nitro-aligned)
import { discoverScopedMiddleware, executeScopedMiddleware, clearMiddlewareCache } from '../middleware/index.ts';
import type { MiddlewareRoute } from '../middleware/types.ts';

// Import layout system
import { EnhancedLayoutResolver, EnhancedLayoutResolverUtils } from '../core/layout/enhanced-layout-resolver.ts';
import type { LayoutContext } from '../types/layout.ts';

// Import dev logger
import { DevLogger } from '../utils/dev-logger.ts';

// Import integration preloading for island rendering optimization
import { preloadIntegrations, type PreloadIntegrationsOptions } from '../islands/integration-loader.ts';

// Import error handler for custom error pages
import {
	discoverErrorPages,
	getErrorPageModule,
	generateDefaultErrorPage,
	type ErrorHandlerOptions,
} from '../nitro/error-handler.ts';

// Type alias for Bun server - using the Server type from Bun's global namespace
type BunServer = ReturnType<typeof Bun.serve>;

/**
 * Creates a server with validated configuration
 * @param config - Server configuration object
 * @returns Bun server instance
 * @throws {ValidationError} When configuration is invalid
 */
export async function createServer(config: ServerConfig): Promise<BunServer> {
	// Validate the entire server configuration
	const validatedConfig = validateServerConfig(config);

	const {
		routes,
		port = DEFAULT_SERVER_PORT,
		defaultOptions = {},
		renderOptions = {},
		fileSystemRouting,
		streaming = { enabled: true, onShellReadyTimeout: 5000, onAllReadyTimeout: 30000 },
	} = validatedConfig;

	// Merge options with validation (no more importMap with Vite)
	const mergedDefaultOptions = mergeOptions({}, defaultOptions, {});

	// Get API routes (development vs production)
	const isDev = process.env.NODE_ENV !== 'production';

	// Initialize dev logger
	const devLogger = isDev ? new DevLogger() : null;
	
	if (devLogger) {
		devLogger.addTask('vite', 'Starting Vite dev server');
		devLogger.addTask('prewarm', 'Pre-warming island components');
		devLogger.addTask('integrations', 'Preloading framework integrations');
		devLogger.addTask('api', 'Discovering API routes');
		devLogger.addTask('middleware', 'Loading middleware');
		devLogger.addTask('layouts', 'Initializing layout system');
		devLogger.addTask('routes', 'Setting up file-system routing');
		devLogger.startSpinner();
	}

	// Load island manifest for production
	const islandManifest: _IslandManifest | null = isDev ? null : await loadIslandManifest();

	// Setup Vite dev server
	if (devLogger) devLogger.startTask('vite');
	const { viteDevServer, viteServerUrl } = await setupViteServer(isDev);
	if (devLogger) await devLogger.completeTask('vite');

	// Note: Component pre-warming is handled by Vite's built-in server.warmup feature
	// configured in vite.config.ts. This is more efficient than custom pre-warming
	// as Vite optimizes the warmup process internally.

	// Preload framework integrations for faster island rendering
	// Using lazy mode: integrations are loaded on-demand when first island uses them
	// This reduces cold start time significantly for pages with few/no islands
	// The integration cache ensures subsequent requests are fast
	if (devLogger) devLogger.startTask('integrations');
	
	// In development, we use lazy loading to speed up cold starts
	// Integrations will be loaded on-demand when islands are rendered
	// The loadIntegration() function in integration-loader.ts handles caching
	const preloadOptions: PreloadIntegrationsOptions = {
		lazy: true,  // Enable on-demand loading
		// No detectedFrameworks means we skip preloading entirely
		// Integrations will be loaded when first island requests them
	};
	await preloadIntegrations(preloadOptions);
	if (devLogger) await devLogger.completeTask('integrations');

	// Setup API routes
	if (devLogger) devLogger.startTask('api');
	const apiRoutes = await setupApiRoutes(isDev);
	if (devLogger) await devLogger.completeTask('api');

	// Initialize middleware system (Nitro-aligned)
	if (devLogger) devLogger.startTask('middleware');
	
	// Discover scoped middleware at startup
	let scopedMiddlewareRoutes: MiddlewareRoute[] | null = null;
	
	async function getScopedMiddleware(): Promise<MiddlewareRoute[]> {
		if (!scopedMiddlewareRoutes) {
			scopedMiddlewareRoutes = await discoverScopedMiddleware({
				baseDir: 'src',
				devMode: isDev,
			});
		}
		return scopedMiddlewareRoutes;
	}
	
	// Pre-discover middleware routes
	await getScopedMiddleware();
	if (devLogger) await devLogger.completeTask('middleware');

	// Initialize error page discovery for custom 404/500 pages
	const errorHandlerOptions: ErrorHandlerOptions = {
		isDev,
		pagesDir: pagesDirectory,
		// Use Vite's ssrLoadModule to load error page components in development
		loadPageModule: viteDevServer
			? async (filePath: string) => {
					// ssrLoadModule throws if the file doesn't exist
					const module = await viteDevServer.ssrLoadModule(filePath);
					return module;
				}
			: undefined,
	};
	
	// Pre-discover error pages at startup
	await discoverErrorPages(errorHandlerOptions);

	// Initialize layout system - derive base directory from pages directory
	if (devLogger) devLogger.startTask('layouts');
	const pagesDirectory = fileSystemRouting?.discovery?.pagesDirectory || 'src/pages';
	const layoutBaseDirectory = pagesDirectory.replace('/pages', '');

	const layoutResolver = new EnhancedLayoutResolver({
		// Don't use createDevelopmentConfig - it enables expensive features like bundleOptimization
		// Instead, create a minimal config optimized for fast development
		baseDirectory: 'src/layouts',
		filePattern: '_layout.tsx',
		excludeDirectories: ['node_modules', '.git', 'dist', 'build'],
		enableWatching: isDev,
		developmentMode: false, // Disable verbose logging for performance
		enableCaching: true,
		cacheTTL: 60 * 1000, // 1 minute cache
		maxCacheSize: 100,
		enableStreaming: true,
		enableErrorBoundaries: true,
		enableMetrics: false, // Disable metrics for performance
		enableDebugInfo: false, // Disable debug info for performance
		// CRITICAL: Do NOT include bundleOptimization - it runs on every request and is very slow
	});

	// NOTE: File-system routing is now handled by Nitro's native routing system.
	// The fileSystemRouting config option is kept for backward compatibility but is deprecated.
	if (fileSystemRouting?.enabled !== false && isDev && !devLogger) {
		console.warn('[server] fileSystemRouting config is deprecated. File-system routing is now handled by Nitro.');
	}
	
	if (devLogger) await devLogger.completeTask('layouts');
	if (devLogger) await devLogger.completeTask('routes');

	// Create all server routes using the modular route system
	const serverRoutes = await createAllRoutes({
		isDev,
		viteServerUrl,
		apiRoutes,
		routes,
		mergedDefaultOptions,
		islandManifest,
		renderOptions,
		layoutResolver, // Pass layout resolver to route creation
		quietMode: isDev && !!devLogger, // Enable quiet mode when using dev logger
		streamingEnabled: streaming?.enabled ?? true, // Pass streaming configuration
	});

	async function requestHandler(req: Request): Promise<Response> {
		const url = new URL(req.url);

		// Filter out noisy system requests from logging
		const isSystemRequest =
			url.pathname.startsWith('/.well-known') || url.pathname.startsWith('/.') || url.pathname.includes('/favicon.ico');

		// Wrap the handler with error catching in development
		const wrappedHandler = withErrorHandler(async (req: Request) => {
			// Get scoped middleware routes
			const middlewareRoutes = await getScopedMiddleware();
			
			if (middlewareRoutes.length > 0) {
				// Create a minimal H3Event-compatible object for middleware execution
				const h3Event = {
					method: req.method,
					path: url.pathname,
					node: {
						req: {
							url: url.pathname + url.search,
							headers: Object.fromEntries(req.headers.entries()),
						},
						res: {},
					},
					context: {} as Record<string, unknown>,
				};

				// Execute scoped middleware
				const middlewareResponse = await executeScopedMiddleware(
					h3Event as import('../middleware/types.ts').MiddlewareRoute extends { pattern: URLPattern } ? Parameters<typeof executeScopedMiddleware>[0] : never,
					middlewareRoutes,
					{ devMode: isDev }
				);

				// If middleware returned a response, use it (early termination)
				if (middlewareResponse) {
					return middlewareResponse;
				}

				// Continue with route matching, passing middleware context to route handlers
				// Convert H3 event context to layout context format
				const layoutContext: LayoutContext = {
					params: {},
					query: url.searchParams,
					state: new Map(Object.entries(h3Event.context)),
					request: req,
				};
				
				return await handleRouteMatching(req, url, isSystemRequest, layoutContext, layoutResolver);
			} else {
				// No middleware, proceed with normal route matching
				return await handleRouteMatching(req, url, isSystemRequest, undefined, layoutResolver);
			}
		}, isDev);

		return await wrappedHandler(req);
	}

	async function handleRouteMatching(
		req: Request,
		url: URL,
		isSystemRequest: boolean,
		passedLayoutContext?: LayoutContext,
		layoutResolver?: EnhancedLayoutResolver
	): Promise<Response> {
		// Try to match each route pattern
		for (const route of serverRoutes) {
			if (route.pattern.test(url)) {

				// Use passed layout context or create a basic one
				let layoutContext: LayoutContext | undefined;
				if (layoutResolver) {
					if (passedLayoutContext) {
						// Use the layout context passed from middleware
						layoutContext = passedLayoutContext;
					} else {
						// Create basic layout context for requests without middleware
						layoutContext = {
							params: {},
							query: url.searchParams,
							state: new Map(),
							request: req,
						};
					}
				}

				// Pass layout context to route handler
				const response = await route.handler(req, undefined, layoutContext);
				return response instanceof Response ? response : new Response(response);
			}
		}

		if (!isSystemRequest) {
			// No route matched — will serve 404
		}
		
		// Return custom 404 error page
		const errorPages = await discoverErrorPages(errorHandlerOptions);
		const errorPageModule = getErrorPageModule(404, errorPages);
		
		if (errorPageModule && errorPageModule.default && typeof errorPageModule.default === 'function') {
			// Custom 404 page exists - try to render it using SSR
			try {
				// Import renderToHtml for SSR rendering
				const { renderToHtml } = await import('./ssr.ts');
				
				// Get the error page component
				const ErrorPageComponent = errorPageModule.default;
				
				// Create a route config for the error page
				// The component needs to be a function that returns JSX
				const errorRouteConfig = {
					component: () => ErrorPageComponent({ 
						statusCode: 404, 
						message: `Page not found: ${url.pathname}`,
						url: url.pathname,
					}),
					path: url.pathname,
				};
				
				// Render the error page
				const html = await renderToHtml(errorRouteConfig, {
					url: url.pathname,
					params: {},
					query: Object.fromEntries(url.searchParams),
				});
				
				return new Response(html, {
					status: 404,
					headers: { 'Content-Type': 'text/html; charset=utf-8' },
				});
			} catch (renderError) {
				console.error('[Error Page Render Error]', renderError);
				// Fall through to default error page
			}
		}
		
		// Fallback to default 404 page
		const html = generateDefaultErrorPage(
			404,
			`Page not found: ${url.pathname}`,
			isDev
		);
		return new Response(html, {
			status: 404,
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	}

	const server = Bun.serve({
		port,
		fetch: requestHandler,
	});

	// Log server startup
	if (devLogger) {
		devLogger.finish(
			`http://localhost:${server.port}`,
			viteDevServer ? 'http://localhost:8010' : undefined,
			viteDevServer ? 'ws://localhost:8011' : undefined
		);
	} else {
		console.log(`🚀 Server running on http://localhost:${server.port}`);
		if (isDev && viteDevServer) {
			console.log(`⚡ Vite dev server: http://localhost:8010`);
			console.log(`🔥 HMR WebSocket: ws://localhost:8011`);
		}
	}

	// Add cleanup on process exit with duplicate prevention
	let isShuttingDown = false;

	const cleanup = () => {
		// Prevent multiple executions
		if (isShuttingDown) {
			return;
		}
		isShuttingDown = true;

		// Just exit immediately - no need for graceful shutdown messages
		process.exit(0);
	};

	// Single signal handler
	const handleSignal = () => {
		if (isShuttingDown) return;
		cleanup(); // Don't await - let it run with its own timeout
	};

	// Register signal handlers only once using Node.js process.on()
	process.on('SIGINT', handleSignal);
	process.on('SIGTERM', handleSignal);
	process.on('SIGQUIT', handleSignal);

	// Manual exit handler for development (tip is shown in dev logger)

	return server;
}

/**
 * Creates a server with graceful error handling for invalid configuration
 * @param config - Server configuration object (potentially invalid)
 * @returns Server instance or throws with helpful error message
 */
export async function createServerSafe(config: unknown): Promise<BunServer> {
	const result = safeValidateServerConfig(config);

	if (!result.success) {
		const formattedErrors = result.error.format();
		const errorMessage = `Invalid server configuration:\n${JSON.stringify(formattedErrors, null, 2)}`;
		console.error(errorMessage);
		throw new Error(`Server configuration validation failed. ${result.error.message}`);
	}

	return await createServer(result.data);
}

/**
 * Validates server configuration and returns detailed validation results
 * @param config - Configuration to validate
 * @returns Validation result with detailed error information
 */
export function validateServerConfiguration(config: unknown): z.SafeParseReturnType<unknown, ServerConfig> {
	return safeValidateServerConfig(config);
}

// Media compression functionality moved to scripts/compress-media.ts
// Use: bun run scripts/compress-media.ts

export type { Routes, ServerConfig, RouteConfig };
