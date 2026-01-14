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

// Import middleware system
import { MiddlewareDiscovery } from '../core/middleware/middleware-discovery.ts';
import { MiddlewareExecutor } from '../core/middleware/middleware-executor.ts';
import { MiddlewareContextManager } from '../core/middleware/middleware-context.ts';
import type { MiddlewareContext } from '../schemas/middleware.ts';

// Import layout system
import { EnhancedLayoutResolver, EnhancedLayoutResolverUtils } from '../core/layout/enhanced-layout-resolver.ts';
import type { LayoutContext } from '../types/layout.ts';

// Import file-system routing
import { FileSystemRouter } from '../core/routing/file-system-router.ts';
import type { FileSystemRouterConfig } from '../schemas/routing.ts';

// Import dev logger
import { DevLogger } from '../utils/dev-logger.ts';

/**
 * Creates a server with validated configuration
 * @param config - Server configuration object
 * @returns Deno server instance
 * @throws {ValidationError} When configuration is invalid
 */
export async function createServer(config: ServerConfig): Promise<Deno.HttpServer> {
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
	const isDev = Deno.env.get('DENO_ENV') !== 'production';

	// Initialize dev logger
	const devLogger = isDev ? new DevLogger() : null;
	
	if (devLogger) {
		devLogger.addTask('vite', 'Starting Vite dev server');
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

	// Setup API routes
	if (devLogger) devLogger.startTask('api');
	const apiRoutes = await setupApiRoutes(isDev);
	if (devLogger) await devLogger.completeTask('api');

	// Initialize middleware system
	if (devLogger) devLogger.startTask('middleware');
	const middlewareDiscovery = new MiddlewareDiscovery({
		baseDirectory: 'src',
		filePattern: '_middleware.ts',
		excludeDirectories: ['node_modules', '.git', 'dist', 'build'],
		enableWatching: isDev,
		developmentMode: isDev,
	});

	const middlewareExecutor = new MiddlewareExecutor({
		developmentMode: isDev,
		enableLogging: false, // Disable logging to keep output clean
		maxExecutionTime: 30000,
	});
	if (devLogger) await devLogger.completeTask('middleware');

	// Initialize layout system - derive base directory from pages directory
	if (devLogger) devLogger.startTask('layouts');
	const pagesDirectory = fileSystemRouting?.discovery?.pagesDirectory || 'src/pages';
	const layoutBaseDirectory = pagesDirectory.replace('/pages', '');

	if (isDev) {
		console.log(`🎨 Layout resolver base directory: ${layoutBaseDirectory}`);
		console.log(`📁 Pages directory: ${pagesDirectory}`);
		console.log(`📋 Layouts directory: ${fileSystemRouting?.discovery?.layoutsDirectory || 'not configured'}`);

		// Check what the final discovery directory will be
		const finalLayoutsDir = fileSystemRouting?.discovery?.layoutsDirectory || `${layoutBaseDirectory}/layouts`;
		console.log(`🔍 Final layouts discovery directory: ${finalLayoutsDir}`);

		// Check if the directory exists
		try {
			const stat = await Deno.stat(finalLayoutsDir);
			console.log(`✅ Layouts directory exists: ${stat.isDirectory ? 'directory' : 'file'}`);
		} catch (error) {
			console.log(`❌ Layouts directory does not exist: ${finalLayoutsDir}`);
			console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	const layoutResolver = new EnhancedLayoutResolver({
		...(isDev
			? EnhancedLayoutResolverUtils.createDevelopmentConfig(layoutBaseDirectory)
			: EnhancedLayoutResolverUtils.createProductionConfig(layoutBaseDirectory)),
		// Override discovery options directly (not nested in discovery object)
		baseDirectory: 'src/layouts', // Explicitly set to src/layouts for Avalon demo
		filePattern: '_layout.tsx',
		excludeDirectories: ['node_modules', '.git', 'dist', 'build'],
		enableWatching: isDev,
		developmentMode: isDev,
	});

	// Initialize file-system routing if enabled
	let fileSystemRouter: FileSystemRouter | undefined;
	if (fileSystemRouting?.enabled !== false) {
		try {
			const fileSystemConfig: Partial<FileSystemRouterConfig> = {
				enabled: true,
				fallbackToManual: true,
				enableCaching: !isDev, // Disable caching in development for hot reload
				...fileSystemRouting,
				discovery: {
					pagesDirectory: 'src/pages',
					apiDirectory: 'src/api',
					extensions: ['.tsx', '.ts', '.jsx', '.js', '.md', '.mdx'],
					excludeDirectories: ['node_modules', '.git', 'dist', 'build'],
					enableWatching: isDev,
					developmentMode: isDev,
					quietMode: isDev && !!devLogger, // Enable quiet mode when using dev logger
					...fileSystemRouting?.discovery,
				},
			};

			fileSystemRouter = new FileSystemRouter(fileSystemConfig);
		} catch (error) {
			console.error('Failed to initialize file-system routing:', error);
			if (fileSystemRouting?.fallbackToManual !== false) {
				console.warn('Falling back to manual routes only');
			} else {
				throw error;
			}
		}
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
		fileSystemRouter, // Pass file-system router if enabled
		quietMode: isDev && !!devLogger, // Enable quiet mode when using dev logger
		streamingEnabled: streaming?.enabled ?? true, // Pass streaming configuration
	});

	async function requestHandler(req: Request): Promise<Response> {
		const url = new URL(req.url);

		// Filter out noisy system requests from logging
		const isSystemRequest =
			url.pathname.startsWith('/.well-known') || url.pathname.startsWith('/.') || url.pathname.includes('/favicon.ico');

		if (!isSystemRequest && !devLogger) {
			console.log(`🔍 Request: ${req.method} ${url.pathname}`);
		}

		// Wrap the handler with error catching in development
		const wrappedHandler = withErrorHandler(async (req: Request) => {
			// Build and execute middleware chain
			const middlewareChain = await middlewareDiscovery.buildMiddlewareChain(url);

			if (middlewareChain.length > 0) {
				if (!isSystemRequest && isDev && !devLogger) {
					console.log(`🔗 Executing ${middlewareChain.length} middleware`);
				}

				// Create middleware context
				const middlewareContext = MiddlewareContextManager.createContext(req);

				// Execute middleware chain
				const middlewareResult = await middlewareExecutor.execute(middlewareChain, middlewareContext);

				// If middleware returned a response, use it (early termination)
				if (middlewareResult.response) {
					if (!isSystemRequest && isDev) {
						console.log(`⚡ Middleware returned response (early termination)`);
					}
					return middlewareResult.response;
				}

				// Continue with route matching, passing middleware context and layout resolver to route handlers
				return await handleRouteMatching(req, url, isSystemRequest, middlewareResult.context, layoutResolver);
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
		middlewareContext?: MiddlewareContext,
		layoutResolver?: EnhancedLayoutResolver
	): Promise<Response> {
		// Try to match each route pattern
		for (const route of serverRoutes) {
			if (route.pattern.test(url)) {
				if (!isSystemRequest && !devLogger) {
					console.log(`✅ Route matched: ${route.pattern.pathname}`);
				}

				// Create layout context for layout rendering
				let layoutContext: LayoutContext | undefined;
				if (layoutResolver) {
					if (middlewareContext) {
						// Create layout context from middleware context if available
						layoutContext = MiddlewareContextManager.createLayoutContext(middlewareContext);
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

				// Pass middleware context and layout context to route handler if available
				const response = await route.handler(req, middlewareContext, layoutContext);
				return response instanceof Response ? response : new Response(response);
			}
		}

		if (!isSystemRequest) {
			console.log(`❌ No route matched: ${url.pathname}`);
		}
		// Default handler for unmatched routes
		return new Response('Not Found', { status: 404 });
	}

	const server = Deno.serve(
		{
			port,
			onListen: ({ port: serverPort }) => {
				if (devLogger) {
					devLogger.finish(
						`http://localhost:${serverPort}`,
						viteDevServer ? 'http://localhost:8010' : undefined,
						viteDevServer ? 'ws://localhost:8011' : undefined
					);
				} else {
					console.log(`🚀 Server running on http://localhost:${serverPort}`);
					if (isDev && viteDevServer) {
						console.log(`⚡ Vite dev server: http://localhost:8010`);
						console.log(`🔥 HMR WebSocket: ws://localhost:8011`);
					}
				}
			},
		},
		requestHandler
	);

	// Add cleanup on process exit with duplicate prevention
	let isShuttingDown = false;

	const cleanup = () => {
		// Prevent multiple executions
		if (isShuttingDown) {
			return;
		}
		isShuttingDown = true;

		// Just exit immediately - no need for graceful shutdown messages
		Deno.exit(0);
	};

	// Single signal handler
	const handleSignal = () => {
		if (isShuttingDown) return;
		cleanup(); // Don't await - let it run with its own timeout
	};

	// Register signal handlers only once
	Deno.addSignalListener('SIGINT', handleSignal);
	Deno.addSignalListener('SIGTERM', handleSignal);
	Deno.addSignalListener('SIGQUIT', handleSignal);

	// Manual exit handler for development (tip is shown in dev logger)

	return server;
}

/**
 * Creates a server with graceful error handling for invalid configuration
 * @param config - Server configuration object (potentially invalid)
 * @returns Server instance or throws with helpful error message
 */
export async function createServerSafe(config: unknown): Promise<Deno.HttpServer> {
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
// Use: deno run --allow-read --allow-write --allow-run scripts/compress-media.ts

export type { Routes, ServerConfig, RouteConfig };
