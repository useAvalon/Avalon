import { defineConfig, createLogger } from 'vite';
import { resolve } from 'node:path';
import type { UserConfig, Plugin } from 'vite';
import { avalon } from '../packages/avalon/src/vite-plugin/plugin.ts';
import { agentOptimization } from '../packages/agent-optimization/mod.ts';
import tailwindcss from '@tailwindcss/vite';

// ── Suppress noisy third-party warnings that we can't fix upstream ──

// 1. Vite logger: catches warnings routed through Vite's own logger
const logger = createLogger();
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
	if (msg.includes('optimizeDeps.rollupOptions') || msg.includes('optimizeDeps.esbuildOptions')) return;
	if (msg.includes('`esbuild` option was specified by')) return;
	if (msg.includes('recommend switching to `@vitejs/plugin-react-oxc`')) return;
	if (msg.includes('dynamic import cannot be analyzed by Vite')) return;
	originalWarn(msg, options);
};

// 2. Console intercept: catches warnings written directly by third-party plugins
//    (e.g. vite-plugin-svelte, Vite deprecation notices) that bypass the custom logger
const _origConsoleWarn = console.warn;
const _origConsoleLog = console.log;
const _suppressPatterns = [
	'optimizeDeps.rollupOptions',
	'optimizeDeps.esbuildOptions',
	'`esbuild` option was specified by',
	'vite-plugin-svelte',
	'no Svelte config found',
	'Invalid input options',
	'may not be able to be serialized',
	'validate output options',
];
const _shouldSuppress = (args: unknown[]) =>
	args.some(a => typeof a === 'string' && _suppressPatterns.some(p => a.includes(p)));
console.warn = (...args: unknown[]) => { if (!_shouldSuppress(args)) _origConsoleWarn(...args); };
console.log = (...args: unknown[]) => { if (!_shouldSuppress(args)) _origConsoleLog(...args); };


export default defineConfig(async ({ command }): Promise<UserConfig> => {

	// Create the Avalon plugin with unified configuration
	// The avalon() function now returns all necessary plugins including:
	// - MDX plugins
	// - Core Avalon plugin
	// - Deferred integration loader (loads framework plugins lazily)
	// - Nitro integration plugins (when nitro config is provided)
	//
	// PERFORMANCE: Integration Vite plugins are loaded LAZILY by default.
	// Only integrations that are actually used in your islands directory
	// will have their Vite plugins loaded, significantly improving cold start time.
	const avalonPlugins = await avalon({
		// Directory configuration
		islandsDir: 'src/islands',
		pagesDir: 'src/pages',
		apiDir: 'src/api',

		// Framework integrations to activate (for SSR and hydration)
		// NOTE: With lazyIntegrations enabled (default), only integrations
		// that are actually used in your islands will have their Vite plugins loaded.
		// This means you can list all 6 frameworks here without performance penalty.
		integrations: ['react', 'preact', 'vue', 'svelte', 'solid', 'lit'],

		// Enable lazy loading of integration Vite plugins (default: true)
		// When true, only loads Vite plugins for frameworks actually used in your project.
		// Set to false to load all configured integrations at startup.
		lazyIntegrations: true,

		// MDX configuration
		mdx: {
			jsxImportSource: 'preact',
			syntaxHighlighting: true,
		},

		// Nitro server runtime configuration
		// Enables universal deployment through Nitro presets
		nitro: {
			// Deployment preset - can be changed for different platforms:
			// 'node_server' (default), 'vercel', 'cloudflare_module', 'deno_deploy', 'netlify_functions', etc.
			preset: 'node_server',

			// Enable streaming SSR for better TTFB
			streaming: true,

			// Route rules for caching, redirects, and headers
			// These rules configure Nitro's static asset handling with appropriate cache headers
			routeRules: {
				// API routes with CORS enabled
				'/api/**': {
					cors: true,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
					},
				},
				// Static assets with long cache (immutable, hashed filenames)
				'/assets/**': {
					headers: {
						'Cache-Control': 'public, max-age=31536000, immutable',
					},
				},
				// Islands with long cache (hashed filenames)
				'/islands/**': {
					headers: {
						'Cache-Control': 'public, max-age=31536000, immutable',
					},
				},
				// Chunks with long cache (hashed filenames)
				'/chunks/**': {
					headers: {
						'Cache-Control': 'public, max-age=31536000, immutable',
					},
				},
				// Font files with long cache
				'/**/*.woff': {
					headers: {
						'Cache-Control': 'public, max-age=31536000, immutable',
					},
				},
				'/**/*.woff2': {
					headers: {
						'Cache-Control': 'public, max-age=31536000, immutable',
					},
				},
				// Favicon with medium cache (1 day)
				'/favicon.ico': {
					headers: {
						'Cache-Control': 'public, max-age=86400',
					},
				},
				// CSS files from public directory (may be mutable)
				'/syntax-highlighting.css': {
					headers: {
						'Cache-Control': 'public, max-age=0, must-revalidate',
					},
				},
			},

			// Runtime configuration accessible via useRuntimeConfig()
			runtimeConfig: {
				// App-specific runtime config
				appName: 'Avalon Demo',
				appVersion: '1.0.0',
			},

			// Static asset serving configuration
			staticAssets: {
				publicDir: 'public',
				buildDir: 'dist',
				compression: true,
			},
		},

		// Auto-discover integrations from component file extensions
		autoDiscoverIntegrations: true,

		// Validate integrations on startup
		validateIntegrations: true,

		// Show warnings for integration issues
		showWarnings: true,

		// Enable verbose logging (set to true for detailed startup diagnostics)
		verbose: false,
	});

	// Auto-discover island entry points for build
	const islandEntries: Record<string, string> = {};
	try {
		const { readdirSync } = await import('node:fs');
		const files = readdirSync('src/islands');
		for (const fileName of files) {
			if (/\.(tsx|jsx|ts|js|vue|svelte)$/.test(fileName)) {
				const name = fileName
					.replace(/\.solid\.(tsx|jsx)$/, '')
					.replace(/\.preact\.(tsx|jsx)$/, '')
					.replace(/\.(tsx|jsx|ts|js|vue|svelte)$/, '');
				islandEntries[`islands/${name}`] = resolve(`src/islands/${fileName}`);
			}
		}
	} catch (_error) {
		// Islands directory not found - this is fine, it may not exist yet
	}

	return {
		root: '.',
		publicDir: 'public',
		customLogger: logger,

		// Agent optimization must come before Avalon so its middleware can
		// intercept res.end() calls made by Avalon's SSR handler.
		plugins: [
			tailwindcss() as unknown as Plugin,
			...agentOptimization({
				sitemap: {
					siteUrl: 'http://localhost:8012',
					changefreq: 'daily',
					exclude: ['/admin/**', '/login'],
				},
				markdown: true,
				structuredData: true,
			}),
			...avalonPlugins,
		],

		optimizeDeps: {
			include: [
				'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client',
				'vue', 'svelte', 'svelte/internal', 'svelte/store', 'svelte/animate', 'svelte/easing', 'svelte/motion', 'svelte/transition',
				'lit', '@lit-labs/ssr-client', '@lit-labs/ssr-client/lit-element-hydrate-support.js',
				'preact', 'preact/hooks', 'preact/jsx-runtime',
			],
		},

		build: {
			outDir: 'dist',
			emptyOutDir: true,
			rolldownOptions: {
				input: islandEntries,
				output: {
					entryFileNames: chunkInfo => chunkInfo.name?.startsWith('islands/') ? 'islands/[name].[hash].js' : '[name].[hash].js',
					chunkFileNames: 'chunks/[name].[hash].js',
					assetFileNames: 'assets/[name].[hash].[ext]',
				},
			},
			target: 'es2020',
			minify: 'oxc',
		},

		server: {
			port: 8012,
			strictPort: false,
			hmr: { port: 8013 },
			cors: false,
			warmup: { clientFiles: Object.values(islandEntries) },
			fs: {
				// TODO: Remove this when Avalon is published to npm/jsr
				// This is only needed during development because the framework packages
				// are in a parent directory. Once published, users will import from
				// the published package and won't need this workaround.
				allow: ['..'],
			},
		},

		ssr: {
			// webworker target: Vite bundles all deps by default (handles CJS→ESM).
			target: 'webworker',
			noExternal: [
				'vue', '@vue/server-renderer', '@vue/shared',
				'svelte', 'svelte/internal', 'svelte/store', 'svelte/server',
				'react', 'react-dom', 'react-dom/client', 'react-dom/server',
			],
		},

		resolve: {
			alias: {
				'@/': resolve('src/'),
				'$components/': resolve('src/components/'),
				'$layouts/': resolve('src/layouts/'),
				'$islands/': resolve('src/islands/'),
				'$pages/': resolve('src/pages/'),
				'$api/': resolve('src/api/'),
				'/src/client/main.js': resolve('../packages/avalon/src/client/main.js'),
				'/@avalon/preact/client': resolve('../packages/integrations/preact/client/index.ts'),
				'/@avalon/react/client': resolve('../packages/integrations/react/client/index.ts'),
				'/@avalon/vue/client': resolve('../packages/integrations/vue/client/index.ts'),
				'/@avalon/svelte/client': resolve('../packages/integrations/svelte/client/index.ts'),
				'/@avalon/solid/client': resolve('../packages/integrations/solid/client/index.ts'),
				'/@avalon/lit/client': resolve('../packages/integrations/lit/client/index.ts'),
			},
		},

		define: {
			__DEV__: command === 'serve',
			__PROD__: command === 'build',
			__VUE_OPTIONS_API__: true,
			__VUE_PROD_DEVTOOLS__: command === 'serve',
			global: 'globalThis',
			'process.env.NODE_ENV': JSON.stringify(command === 'serve' ? 'development' : 'production'),
		},
	};
});
