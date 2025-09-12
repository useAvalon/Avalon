import { join } from '@std/path';
import { renderToHtml } from './ssr.ts';
import { mergeOptions } from '../functions/merge.ts';
import { discoverApiRoutes, handleApiRequest } from '../functions/api.ts';
import { loadIslandManifest } from '../build/island-manifest.ts';
import type { IslandManifest as _IslandManifest } from '../build/island-manifest.ts';
import type { z } from 'zod';
import type { ViteDevServer } from 'vite';
import {
	validateServerConfig,
	safeValidateServerConfig,
	type ServerConfig,
	type Routes,
	type RouteConfig,
} from '../schemas/index.ts';

const STATIC_FILES_DIR = join(Deno.cwd(), 'public');

// Proxy requests to Vite dev server
async function proxyToVite(req: Request, viteUrl: string): Promise<Response> {
	try {
		const url = new URL(req.url);
		const viteRequestUrl = `${viteUrl}${url.pathname}${url.search}`;

		const response = await fetch(viteRequestUrl, {
			method: req.method,
			headers: req.headers,
			body: req.body,
		});

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	} catch (error) {
		console.error('Vite proxy error:', error);
		return new Response('Vite proxy failed', { status: 502 });
	}
}

const MIME_TYPES: Record<string, string> = {
	// JavaScript/TypeScript
	'.js': 'application/javascript',
	'.ts': 'application/typescript',
	'.tsx': 'application/typescript',
	'.vue': 'text/x-vue',
	'.jsx': 'application/javascript',
	'.mjs': 'application/javascript',

	// Stylesheets
	'.css': 'text/css',
	'.scss': 'text/css',
	'.sass': 'text/css',

	// HTML/XML
	'.html': 'text/html',
	'.htm': 'text/html',
	'.xml': 'application/xml',

	// Data formats
	'.json': 'application/json',
	'.csv': 'text/csv',
	'.txt': 'text/plain',

	// Images
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.bmp': 'image/bmp',
	'.tiff': 'image/tiff',
	'.avif': 'image/avif',

	// Fonts
	'.otf': 'font/otf',
	'.ttf': 'font/ttf',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.eot': 'application/vnd.ms-fontobject',

	// Audio/Video
	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',

	// Documents
	'.pdf': 'application/pdf',
	'.zip': 'application/zip',
	'.tar': 'application/x-tar',
	'.gz': 'application/gzip',

	// Manifest files
	'.webmanifest': 'application/manifest+json',
	'.manifest': 'text/cache-manifest',
} as const;

async function serveStaticFile(path: string, rootDir: string, originalUrl?: string): Promise<Response> {
	try {
		// Security: Prevent directory traversal attacks
		if (path.includes('..') || path.includes('\\') || path.startsWith('/')) {
			console.warn(`🚨 Security: Blocked potentially malicious path: ${path}`);
			return new Response('Forbidden', { status: 403 });
		}

		// Security: Normalize and resolve the path
		const normalizedPath = path.replace(/\/+/g, '/').replace(/^\//, '');
		const filePath = join(rootDir, normalizedPath);
		const extension = path.substring(path.lastIndexOf('.'));

		// Define binary file extensions that should be read as raw bytes
		const binaryExtensions = [
			'.woff',
			'.woff2',
			'.otf',
			'.ttf',
			'.eot', // Fonts
			'.png',
			'.jpg',
			'.jpeg',
			'.gif',
			'.webp',
			'.svg',
			'.ico',
			'.bmp',
			'.tiff',
			'.avif', // Images
			'.mp3',
			'.mp4',
			'.webm',
			'.ogg',
			'.wav',
			'.avi',
			'.mov', // Media
			'.pdf',
			'.zip',
			'.tar',
			'.gz',
			'.7z',
			'.rar', // Archives/Documents
		];

		// Define font file extensions
		const fontExtensions = ['.woff', '.woff2', '.otf', '.ttf', '.eot'];

		// Check if this is a binary file
		const isBinaryFile = binaryExtensions.includes(extension.toLowerCase());
		const isFontFile = fontExtensions.includes(extension.toLowerCase());

		if (isBinaryFile) {
			// For binary files, read raw bytes
			const fileBytes = await Deno.readFile(filePath);
			const headers: Record<string, string> = {
				'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
			};

			// Font-specific optimizations
			if (isFontFile) {
				// Fonts rarely change, cache for 1 year
				headers['Cache-Control'] = 'public, max-age=31536000, immutable';
				// Add CORS headers for font files to prevent cross-origin issues
				headers['Access-Control-Allow-Origin'] = '*';
				headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
				headers['Access-Control-Allow-Headers'] = 'Content-Type';
				// Add font-display hint for better font loading
				const preloadUrl = originalUrl || '/' + normalizedPath;
				headers['Link'] =
					'<' +
					preloadUrl +
					'>; rel=preload; as=font; type=' +
					(MIME_TYPES[extension] || 'application/octet-stream') +
					'; crossorigin';
			} else {
				// Other binary files get standard caching
				headers['Cache-Control'] = 'public, max-age=3600';
			}

			return new Response(fileBytes, { headers });
		} else {
			// For text files, read as text (Vite handles all processing)
			const fileContent = await Deno.readTextFile(filePath);

			return new Response(fileContent, {
				headers: {
					'Content-Type': MIME_TYPES[extension] || 'text/plain',
					'Cache-Control': 'no-cache', // Let Vite handle caching in dev
				},
			});
		}
	} catch (error: unknown) {
		console.error(`Error serving file ${path}:`, error);
		return new Response('File not found', { status: 404 });
	}
}

/**
 * Creates a server with validated configuration
 * @param config - Server configuration object
 * @returns Deno server instance
 * @throws {ValidationError} When configuration is invalid
 */
export async function createServer(config: ServerConfig): Promise<Deno.HttpServer> {
	// Validate the entire server configuration
	const validatedConfig = validateServerConfig(config);

	const { routes, port = 8000, defaultOptions = {} } = validatedConfig;

	// Merge options with validation (no more importMap with Vite)
	const mergedDefaultOptions = mergeOptions({}, defaultOptions, {});

	// Get API routes (development vs production)
	const isDev = Deno.env.get('DENO_ENV') !== 'production';

	// Load island manifest for production
	const islandManifest: _IslandManifest | null = isDev ? null : await loadIslandManifest();

	// Vite dev server (always in development for efficient compilation and HMR)
	let viteDevServer: ViteDevServer | null = null;
	let viteServerUrl = '';
	if (isDev) {
		try {
			// Import Vite dynamically to avoid production dependencies
			const { createServer } = await import('vite');
			viteDevServer = await createServer({
				configFile: 'vite.config.ts',
				server: {
					middlewareMode: false, // Run as standalone server
					port: 8002,
					strictPort: true,
					cors: true,
					hmr: { port: 8003 },
				},
				root: Deno.cwd(),
			});
			await viteDevServer.listen();
			viteServerUrl = 'http://localhost:8002';

			// Make Vite server available globally for SSR
			globalThis.__viteDevServer = viteDevServer;

			console.log('✅ Vite dev server started on http://localhost:8002');
			console.log('🔥 HMR WebSocket: ws://localhost:8003');
		} catch (error) {
			console.error('❌ Failed to start Vite dev server. This is required for development:', error);
			console.log('💡 Make sure you have vite.config.ts and @deno/vite-plugin installed');
			throw error;
		}
	}

	let apiRoutes;
	if (isDev) {
		// Development: Auto-discover routes
		apiRoutes = await discoverApiRoutes();
		console.log(`Discovered ${apiRoutes.length} API routes`);
		for (const route of apiRoutes) {
			console.log(`  ${route.pattern.pathname} -> src/api/${route.filePath}`);
		}
	} else {
		// Production: Use pre-generated routes
		try {
			const routesModule = await import(join(Deno.cwd(), 'src/routes.ts'));
			apiRoutes = routesModule.routes;
			console.log(`Loaded ${apiRoutes.length} static API routes`);
		} catch (_error) {
			console.warn('No static routes found. Run: deno task build-routes');
			console.warn('Falling back to auto-discovery...');
			apiRoutes = await discoverApiRoutes();
		}
	}

	const serverRoutes = [
		{
			pattern: new URLPattern({ pathname: '/api/*' }),
			handler: async (req: Request) => {
				return await handleApiRequest(req, apiRoutes);
			},
		},

		// Client script serving (always available) - served from Avalon's location
		{
			pattern: new URLPattern({ pathname: '/src/client/main.js' }),
			handler: async () => {
				try {
					// Serve from Avalon's client script, not user's repo
					const clientScriptPath = new URL('../client/main.js', import.meta.url);
					const clientScript = await Deno.readTextFile(clientScriptPath);
					return new Response(clientScript, {
						headers: {
							'Content-Type': 'application/javascript; charset=utf-8',
							'Cache-Control': 'no-cache',
						},
					});
				} catch (error) {
					console.error('Failed to serve Avalon client script:', error);
					return new Response('Client script not found', { status: 404 });
				}
			},
		},

		// Vite dev server middleware (development only)
		...(isDev && viteServerUrl
			? [
					{
						pattern: new URLPattern({ pathname: '/@vite/*' }),
						handler: (req: Request) => proxyToVite(req, viteServerUrl),
					},
					{
						pattern: new URLPattern({ pathname: '/@fs/*' }),
						handler: (req: Request) => proxyToVite(req, viteServerUrl),
					},
					{
						pattern: new URLPattern({ pathname: '/@id/*' }),
						handler: (req: Request) => proxyToVite(req, viteServerUrl),
					},
					{
						pattern: new URLPattern({ pathname: '/node_modules/*' }),
						handler: (req: Request) => proxyToVite(req, viteServerUrl),
					},
					{
						pattern: new URLPattern({ pathname: '/@solid-refresh' }),
						handler: (req: Request) => proxyToVite(req, viteServerUrl),
					},
					{
						pattern: new URLPattern({ pathname: '/src/*' }),
						handler: (req: Request) => proxyToVite(req, viteServerUrl),
					},
					{
						pattern: new URLPattern({ pathname: '/islands/*' }),
						handler: (req: Request) => {
							console.log(`🏝️ Proxying island request: ${req.url}`);
							return proxyToVite(req, viteServerUrl);
						},
					},
					{
						pattern: new URLPattern({ pathname: '/components/*' }),
						handler: (req: Request) => proxyToVite(req, viteServerUrl),
					},
			  ]
			: [
					{
						pattern: new URLPattern({ pathname: '/src/*' }),
						handler: async (req: Request) => {
							const url = new URL(req.url);
							const path = url.pathname.replace(/^\/src\//, '');
							// Special case: serve Avalon's client script
							if (path === 'client/main.js') {
								try {
									const clientScriptPath = new URL('../client/main.js', import.meta.url);
									const clientScript = await Deno.readTextFile(clientScriptPath);
									return new Response(clientScript, {
										headers: {
											'Content-Type': 'application/javascript; charset=utf-8',
											'Cache-Control': 'no-cache',
										},
									});
								} catch (error) {
									console.error('Failed to serve Avalon client script:', error);
								}
							}
							// Otherwise serve from user's repo
							return await serveStaticFile(path, join(Deno.cwd(), 'src'));
						},
					},
			  ]),

		// Serve built island bundles (production)
		{
			pattern: new URLPattern({ pathname: '/dist/islands/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/dist\//, '');
				return await serveStaticFile(path, join(Deno.cwd(), 'dist'));
			},
		},
		// CSS files
		{
			pattern: new URLPattern({ pathname: '/css/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/css\//, 'css/');
				return await serveStaticFile(path, STATIC_FILES_DIR);
			},
		},
		// JavaScript files
		{
			pattern: new URLPattern({ pathname: '/js/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/js\//, 'js/');
				return await serveStaticFile(path, STATIC_FILES_DIR);
			},
		},
		// Image files
		{
			pattern: new URLPattern({ pathname: '/images/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/images\//, 'images/');
				return await serveStaticFile(path, STATIC_FILES_DIR);
			},
		},
		// Font files
		{
			pattern: new URLPattern({ pathname: '/fonts/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/fonts\//, 'fonts/');
				console.log(`Font request: ${url.pathname} -> serving from: ${path}`);
				return await serveStaticFile(path, STATIC_FILES_DIR, url.pathname);
			},
		},
		// Assets folder (for videos, other media, etc.)
		{
			pattern: new URLPattern({ pathname: '/assets/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/assets\//, 'assets/');
				console.log(`Assets request: ${url.pathname} -> serving from: ${path}`);
				return await serveStaticFile(path, STATIC_FILES_DIR);
			},
		},

		...Object.entries(routes).map(([path, routeConfig]) => ({
			pattern: new URLPattern({ pathname: path }),
			handler: async () => {
				try {
					// Pass Vite HMR port and island manifest to SSR
					const viteHmrPort = isDev ? 8003 : undefined;
					// Create extended options with island manifest
					const extendedOptions = {
						...mergedDefaultOptions,
						...(islandManifest && { islandManifest }),
					};
					const htmlContent = await renderToHtml(routeConfig as RouteConfig, extendedOptions, viteHmrPort);
					return new Response(htmlContent, {
						headers: {
							'Content-Type': 'text/html; charset=utf-8',
							'Cache-Control': 'no-cache',
						},
					});
				} catch (error: unknown) {
					console.error('Error handling route:', error);
					return new Response('Internal Server Error', { status: 500 });
				}
			},
		})),

		// General static files (for files directly in public/) - MUST be last as fallback
		{
			pattern: new URLPattern({ pathname: '/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.substring(1); // Remove leading slash

				// Security: Block potentially malicious requests
				if (
					path.includes('..') ||
					path.includes('\\') ||
					path.startsWith('.well-known') ||
					path.startsWith('.') ||
					path.includes('/.') ||
					path.includes('node_modules') ||
					path.includes('package.json') ||
					path.includes('deno.json') ||
					path.includes('.env')
				) {
					return new Response('Not Found', { status: 404 });
				}

				// Only serve files with common static file extensions
				const staticFileExtensions = [
					'.ttf',
					'.woff',
					'.woff2',
					'.otf',
					'.eot', // Fonts
					'.png',
					'.jpg',
					'.jpeg',
					'.gif',
					'.webp',
					'.svg',
					'.ico', // Images
					'.css',
					'.js',
					'.json',
					'.txt',
					'.xml', // Text files
					'.pdf',
					'.zip',
					'.mp3',
					'.mp4',
					'.webm', // Documents & media
				];

				const hasStaticExtension = staticFileExtensions.some(ext => path.toLowerCase().endsWith(ext));

				if (hasStaticExtension) {
					console.log(`Static file request: ${url.pathname} -> serving from: ${path}`);
					return await serveStaticFile(path, STATIC_FILES_DIR);
				}

				// Not a static file, return 404
				return new Response('Not Found', { status: 404 });
			},
		},
	];

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
