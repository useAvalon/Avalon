import { defineConfig } from 'vite';
import { resolve } from '@std/path';
import { readdirSync } from 'node:fs';
import type { UserConfig } from 'vite';

// Auto-discover island entry points
function discoverIslandEntries() {
	const entries: Record<string, string> = {};

	try {
		const files = readdirSync('src/islands');
		for (const fileName of files) {
			if (
				fileName.endsWith('.tsx') ||
				fileName.endsWith('.jsx') ||
				fileName.endsWith('.vue') ||
				fileName.endsWith('.svelte')
			) {
				// Handle framework-specific naming conventions
				let name = fileName;
				if (fileName.endsWith('.solid.tsx') || fileName.endsWith('.solid.jsx')) {
					name = fileName.replace(/\.solid\.(tsx|jsx)$/, '');
				} else if (fileName.endsWith('.preact.tsx') || fileName.endsWith('.preact.jsx')) {
					name = fileName.replace(/\.preact\.(tsx|jsx)$/, '');
				} else {
					name = fileName.replace(/\.(tsx|jsx|vue|svelte)$/, '');
				}
				entries[`islands/${name}`] = resolve(`src/islands/${fileName}`);
			}
		}
	} catch (error) {
		console.warn('Islands directory not found or could not be read:', error);
	}

	return entries;
}

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	const islandEntries = discoverIslandEntries();
	const plugins = [];

	// MDX plugin - must come first to process .mdx files
	try {
		const { createMDXPlugin } = await import('../src/build/mdx-plugin.ts');
		const mdxPlugins = await createMDXPlugin({
			development: command === 'serve',
			jsxImportSource: 'preact',
		});
		console.log(`📦 Loaded ${mdxPlugins.length} MDX plugins`);
		plugins.push(...mdxPlugins);
	} catch (error) {
		console.error('❌ Could not load MDX plugin:', error);
	}

	// Deno plugin
	try {
		const { default: deno } = await import('@deno/vite-plugin');
		plugins.push(deno());
	} catch (error) {
		console.warn('Could not load @deno/vite-plugin:', error);
	}

	// Vue plugin
	try {
		const { default: vue } = await import('@vitejs/plugin-vue');
		plugins.push(
			vue({
				features: {
					prodHydrationMismatchDetails: command === 'serve',
				},
				template: {
					compilerOptions: {
						isCustomElement: tag => tag === 'is-land',
					},
				},
			})
		);
	} catch (error) {
		console.warn('Could not load Vue plugin:', error);
	}

	// Svelte plugin
	try {
		const { svelte } = await import('@sveltejs/vite-plugin-svelte');
		plugins.push(
			svelte({
				compilerOptions: {
					customElement: false,
					runes: true,
					hmr: false,
					dev: false,
					css: 'injected', // Inject CSS into component so we can extract it
				},
				hot: false,
				emitCss: false, // Don't emit separate CSS files
			})
		);
	} catch (error) {
		console.warn('Could not load Svelte plugin:', error);
	}

	// Preact plugin
	try {
		const { default: preact } = await import('@preact/preset-vite');
		plugins.push(
			preact({
				// Only process Preact components
				include: [/preact.*\.(tsx|jsx)$/],
			})
		);
	} catch (error) {
		console.warn('Could not load Preact plugin:', error);
	}

	// Solid plugin - only for Solid components
	try {
		const { default: solid } = await import('vite-plugin-solid');
		plugins.push(
			solid({
				ssr: true,
				hot: true,
				// Only process files that are explicitly Solid components
				include: [/\.(solid)\.(tsx|jsx)$/, /solid.*\.(tsx|jsx)$/],
				// Exclude Preact and other framework components
				exclude: [
					/PreactCounter\.(tsx|jsx)$/,
					/preact.*\.(tsx|jsx)$/,
					/VueCounter\.vue$/,
					/vue.*\.vue$/,
					/SvelteCounter\.svelte$/,
					/svelte.*\.svelte$/,
				],
			})
		);
	} catch (error) {
		console.warn('Could not load Solid plugin:', error);
	}

	return {
		root: '.',
		publicDir: 'public',
		plugins,

		optimizeDeps: {
			include: [
				'vue',
				'svelte',
				'svelte/internal',
				'svelte/store',
				'svelte/animate',
				'svelte/easing',
				'svelte/motion',
				'svelte/transition',
			],
			force: true,
		},

		esbuild: {
			jsx: 'automatic',
			jsxImportSource: 'preact', // Default to preact for JSX
		},

		build: {
			outDir: 'dist',
			emptyOutDir: true,
			rollupOptions: {
				input: {
					// Island entries for client-side bundles
					...islandEntries,
				},
				output: {
					entryFileNames: chunkInfo => {
						if (chunkInfo.name?.startsWith('islands/')) {
							return `islands/[name].[hash].js`;
						}
						return '[name].[hash].js';
					},
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
		},

		ssr: {
			target: 'webworker',
			noExternal: ['vue', '@vue/server-renderer', '@vue/shared', 'svelte', 'svelte/internal', 'svelte/store', 'svelte/server'],
		},

		resolve: {
			alias: {
				'@/': resolve('src/'),
				'$components/': resolve('src/components/'),
				'$layouts/': resolve('src/layouts/'),
				'$islands/': resolve('src/islands/'),
				'$pages/': resolve('src/pages/'),
				'$api/': resolve('src/api/'),
				// Resolve integration client files from parent directory
				'/@avalon/preact/client': resolve('../src/integrations/preact/client/hydration.ts'),
				'/@avalon/vue/client': resolve('../src/integrations/vue/client/hydration.ts'),
				'/@avalon/svelte/client': resolve('../src/integrations/svelte/client/hydration.ts'),
				'/@avalon/solid/client': resolve('../src/integrations/solid/client/hydration.ts'),
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
