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

/**
 * Creates a server with validated configuration
 * @param config - Server configuration object
 * @returns Deno server instance
 * @throws {ValidationError} When configuration is invalid
 */
export async function createServer(config: ServerConfig): Promise<Deno.HttpServer> {
	// Validate the entire server configuration
	const validatedConfig = validateServerConfig(config);

	const { routes, port = DEFAULT_SERVER_PORT, defaultOptions = {} } = validatedConfig;

	// Merge options with validation (no more importMap with Vite)
	const mergedDefaultOptions = mergeOptions({}, defaultOptions, {});

	// Get API routes (development vs production)
	const isDev = Deno.env.get('DENO_ENV') !== 'production';

	// Load island manifest for production
	const islandManifest: _IslandManifest | null = isDev ? null : await loadIslandManifest();

	// Setup Vite dev server
	const { viteDevServer, viteServerUrl } = await setupViteServer(isDev);

	// Setup API routes
	const apiRoutes = await setupApiRoutes(isDev);

	// Create all server routes using the modular route system
	const serverRoutes = createAllRoutes({
		isDev,
		viteServerUrl,
		apiRoutes,
		routes,
		mergedDefaultOptions,
		islandManifest,
	});

	function requestHandler(req: Request): Response | Promise<Response> {
		const url = new URL(req.url);

		// Filter out noisy system requests from logging
		const isSystemRequest =
			url.pathname.startsWith('/.well-known') || url.pathname.startsWith('/.') || url.pathname.includes('/favicon.ico');

		if (!isSystemRequest) {
			console.log(`🔍 Request: ${req.method} ${url.pathname}`);
		}

		// Try to match each route pattern
		for (const route of serverRoutes) {
			if (route.pattern.test(url)) {
				if (!isSystemRequest) {
					console.log(`✅ Route matched: ${route.pattern.pathname}`);
				}
				return route.handler(req);
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
				console.log(`🚀 Server running on http://localhost:${serverPort}`);
				if (isDev && viteDevServer) {
					console.log(`⚡ Vite dev server: http://localhost:8002`);
					console.log(`🔥 HMR WebSocket: ws://localhost:8003`);
				}
			},
		},
		requestHandler
	);

	// Add cleanup on process exit with duplicate prevention
	let isShuttingDown = false;

	const cleanup = async () => {
		// Prevent multiple executions
		if (isShuttingDown) {
			return;
		}
		isShuttingDown = true;

		console.log('\n🛑 Shutting down server gracefully...');

		try {
			// Stop Vite dev server
			if (viteDevServer) {
				console.log('🔄 Stopping Vite dev server...');
				await viteDevServer.close();
			}

			// Shutdown main server
			console.log('🌐 Shutting down main server...');
			try {
				await server.shutdown();
			} catch (shutdownError) {
				console.log('⚠️ Server shutdown error (continuing):', shutdownError);
			}

			console.log('✅ Server shutdown complete');
			Deno.exit(0);
		} catch (error) {
			console.error('❌ Error during shutdown:', error);
			Deno.exit(1);
		}
	};

	// Force exit after timeout if graceful shutdown fails
	const forceExit = () => {
		if (isShuttingDown) return;
		console.log('⚠️ Force exit after timeout');
		Deno.exit(1);
	};

	// Single signal handler with timeout
	const handleSignal = async () => {
		if (isShuttingDown) return;

		// Set a timeout to force exit if graceful shutdown takes too long
		const timeout = setTimeout(forceExit, 3000); // 3 seconds

		try {
			await cleanup();
			clearTimeout(timeout);
		} catch (error) {
			clearTimeout(timeout);
			throw error;
		}
	};

	// Register signal handlers only once
	Deno.addSignalListener('SIGINT', handleSignal);
	Deno.addSignalListener('SIGTERM', handleSignal);
	Deno.addSignalListener('SIGQUIT', handleSignal);

	// Manual exit handler for development
	if (isDev) {
		console.log('\n💡 Tip: Press Ctrl+C to stop the server gracefully');
		console.log('   Server will shut down in 3 seconds or force exit');
	}

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
