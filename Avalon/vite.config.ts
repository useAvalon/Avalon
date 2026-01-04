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
				fileName.endsWith('.ts') ||
				fileName.endsWith('.js') ||
				fileName.endsWith('.vue') ||
				fileName.endsWith('.svelte')
			) {
				// Handle framework-specific naming conventions
				let name;
				if (fileName.endsWith('.solid.tsx') || fileName.endsWith('.solid.jsx')) {
					name = fileName.replace(/\.solid\.(tsx|jsx)$/, '');
				} else if (fileName.endsWith('.preact.tsx') || fileName.endsWith('.preact.jsx')) {
					name = fileName.replace(/\.preact\.(tsx|jsx)$/, '');
				} else {
					name = fileName.replace(/\.(tsx|jsx|ts|js|vue|svelte)$/, '');
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

	// Lit SSR DOM shim plugin - must come first to install globals before Lit loads
	try {
		const { litSSRShimPlugin } = await import('../packages/avalon/src/build/lit-ssr-shim-plugin.ts');
		plugins.push(litSSRShimPlugin());
		console.log('✅ Loaded Lit SSR DOM shim plugin');
	} catch (error) {
		console.warn('Could not load Lit SSR shim plugin:', error);
	}

	// MDX plugin - must come first to process .mdx files
	try {
		const { createMDXPlugin } = await import('../packages/avalon/src/build/mdx-plugin.ts');
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

	// Framework detection plugin - determines React vs Preact based on imports
	const frameworkDetectionPlugin = {
		name: 'avalon:framework-detection',
		enforce: 'pre' as const,
		async resolveId(id: string) {
			// Let other plugins handle the resolution
			return null;
		},
		async load(id: string) {
			// Only process TSX/JSX files
			if (!/\.(tsx|jsx)$/.test(id)) {
				return null;
			}

			// Skip node_modules
			if (id.includes('node_modules')) {
				return null;
			}

			try {
				const code = await Deno.readTextFile(id);
				
				// Check if file imports from React
				const hasReactImport = /from\s+['"]react['"]/.test(code) || 
				                      /from\s+['"]react\//.test(code);
				
				// Check if file imports from Preact
				const hasPreactImport = /from\s+['"]preact['"]/.test(code) || 
				                       /from\s+['"]preact\//.test(code);

				// Store the framework info for other plugins to use
				if (hasReactImport && !hasPreactImport) {
					// Mark as React file
					(this as any).meta = { ...(this as any).meta, framework: 'react' };
				} else {
					// Default to Preact
					(this as any).meta = { ...(this as any).meta, framework: 'preact' };
				}
			} catch (error) {
				// If we can't read the file, let other plugins handle it
			}

			return null; // Let other plugins process the file
		},
	};

	plugins.push(frameworkDetectionPlugin);

	// React plugin - processes files that import from 'react'
	try {
		const { default: react } = await import('@vitejs/plugin-react');
		const reactPlugin = react();
		
		// Wrap the plugin to add content-based filtering
		const wrappedReactPlugin = {
			...reactPlugin,
			name: 'avalon:react-wrapper',
			async transform(code: string, id: string) {
				// Only process TSX/JSX files
				if (!/\.(tsx|jsx)$/.test(id)) return null;
				if (id.includes('node_modules')) return null;
				
				// Skip Solid files
				if (/\.solid\.(tsx|jsx)$/.test(id)) return null;
				
				// Check if file imports from React
				const hasReactImport = /from\s+['"]react['"]/.test(code) || 
				                      /from\s+['"]react\//.test(code);
				const hasPreactImport = /from\s+['"]preact['"]/.test(code);
				
				// Only process if it's a React file
				if (hasReactImport && !hasPreactImport) {
					// Call the original React plugin's transform
					if (reactPlugin.transform && typeof reactPlugin.transform === 'function') {
						return await reactPlugin.transform.call(this, code, id);
					}
				}
				
				return null;
			},
		};
		
		plugins.push(wrappedReactPlugin);
		console.log('✅ Loaded React plugin with content-based detection');
	} catch (error) {
		console.warn('Could not load React plugin:', error);
	}

	// Preact plugin - processes files that don't import from 'react'
	try {
		const { default: preact } = await import('@preact/preset-vite');
		plugins.push(
			preact({
				// Process all TSX/JSX files - the React wrapper above will handle React files first
				include: /\.(tsx|jsx)$/,
				// Exclude Solid files
				exclude: /\.solid\.(tsx|jsx)$/,
			})
		);
		console.log('✅ Loaded Preact plugin');
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
				include: [/\.solid\.(tsx|jsx)$/],
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
				// React - include all subpaths to prevent on-demand optimization
				'react',
				'react/jsx-runtime',
				'react/jsx-dev-runtime',
				'react-dom',
				'react-dom/client',
				// Vue
				'vue',
				// Svelte
				'svelte',
				'svelte/internal',
				'svelte/store',
				'svelte/animate',
				'svelte/easing',
				'svelte/motion',
				'svelte/transition',
				// Lit
				'lit',
				'@lit-labs/ssr-client',
				'@lit-labs/ssr-client/lit-element-hydrate-support.js',
				// Preact
				'preact',
				'preact/hooks',
				'preact/jsx-runtime',
			],
			// Exclude problematic packages from optimization
			exclude: [],
			// Increase timeout for slow connections
			esbuildOptions: {
				target: 'es2020',
			},
		},

		esbuild: {
			jsx: 'automatic',
			jsxImportSource: 'preact', // Default to preact for JSX
			target: 'es2020',
			// Enable TypeScript decorator support for Lit components
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
			// Pre-transform all discovered islands on startup
			warmup: {
				clientFiles: Object.values(islandEntries),
			},
		},

		ssr: {
			target: 'webworker',
			noExternal: [
				'vue', 
				'@vue/server-renderer', 
				'@vue/shared', 
				'svelte', 
				'svelte/internal', 
				'svelte/store', 
				'svelte/server',
				'react',
				'react-dom',
				'react-dom/client',
				'react-dom/server',
				'lit',
				'@lit-labs/ssr',
				'@lit/reactive-element',
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
				// Resolve integration client files from new package location
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
