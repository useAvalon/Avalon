import { defineConfig } from 'vite';
import { resolve } from '@std/path';
import type { UserConfig, Plugin } from 'vite';
import { avalon } from '../packages/avalon/src/vite-plugin/plugin.ts';

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	const isDev = command === 'serve';

	// Create the Avalon plugin with unified configuration
	// The avalon() function now returns all necessary plugins including:
	// - Lit SSR shim plugin (first)
	// - MDX plugins
	// - Core Avalon plugin
	// - Nitro integration plugins (when nitro config is provided)
	// - Framework plugins (React, Vue, Svelte, Preact, Solid) from integrations
	const avalonPlugins = await avalon({
		// Directory configuration
		islandsDir: 'src/islands',
		pagesDir: 'src/pages',
		apiDir: 'src/api',

		// Framework integrations to activate (for SSR and hydration)
		// Each integration provides its own Vite plugin for compilation
		integrations: ['react', 'preact', 'vue', 'svelte', 'solid', 'lit'],

		// MDX configuration
		mdx: {
			jsxImportSource: 'preact',
			syntaxHighlighting: true,
		},

		// Nitro server runtime configuration
		// Enables universal deployment through Nitro presets
		nitro: {
			// Deployment preset - can be changed for different platforms:
			// 'node-server' (default), 'vercel', 'cloudflare', 'deno-deploy', 'netlify', etc.
			preset: 'node-server',

			// Enable streaming SSR for better TTFB
			streaming: true,

			// Route rules for caching, redirects, and headers
			routeRules: {
				// API routes with CORS enabled
				'/api/**': {
					cors: true,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
					},
				},
				// Static assets with long cache
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

		// Enable verbose logging in development
		verbose: isDev,
	});

	// Additional plugins that are not part of framework integrations
	const additionalPlugins: Plugin[] = [];

	// Deno plugin for Deno compatibility
	try {
		const { default: deno } = await import('@deno/vite-plugin');
		const denoPlugins = deno();
		additionalPlugins.push(...(Array.isArray(denoPlugins) ? denoPlugins : [denoPlugins]));
	} catch (error) {
		console.warn('Could not load @deno/vite-plugin:', error);
	}

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
		
		// Avalon plugins include everything needed:
		// Lit SSR shim → MDX → Core Avalon → Framework plugins
		// Additional plugins (like Deno) come after
		plugins: [...avalonPlugins, ...additionalPlugins],

		optimizeDeps: {
			include: [
				'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client',
				'vue', 'svelte', 'svelte/internal', 'svelte/store', 'svelte/animate', 'svelte/easing', 'svelte/motion', 'svelte/transition',
				'lit', '@lit-labs/ssr-client', '@lit-labs/ssr-client/lit-element-hydrate-support.js',
				'preact', 'preact/hooks', 'preact/jsx-runtime',
			],
			esbuildOptions: { target: 'es2020' },
		},

		esbuild: {
			jsx: 'automatic',
			jsxImportSource: 'preact',
			target: 'es2020',
			tsconfigRaw: {
				compilerOptions: {
					experimentalDecorators: true,
					useDefineForClassFields: false,
				},
			},
		},

		build: {
			outDir: 'dist',
			emptyOutDir: true,
			rollupOptions: {
				input: islandEntries,
				output: {
					entryFileNames: chunkInfo => chunkInfo.name?.startsWith('islands/') ? 'islands/[name].[hash].js' : '[name].[hash].js',
					chunkFileNames: 'chunks/[name].[hash].js',
					assetFileNames: 'assets/[name].[hash].[ext]',
				},
			},
			target: 'es2020',
			minify: 'esbuild',
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
			target: 'webworker',
			noExternal: [
				'vue', '@vue/server-renderer', '@vue/shared',
				'svelte', 'svelte/internal', 'svelte/store', 'svelte/server',
				'react', 'react-dom', 'react-dom/client', 'react-dom/server',
				'lit', '@lit-labs/ssr', '@lit/reactive-element', 'linkedom', 'htmlparser2',
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
