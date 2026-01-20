import { defineConfig } from 'vite';
import { resolve } from '@std/path';
import type { UserConfig, Plugin } from 'vite';
import { avalon } from '../packages/avalon/src/vite-plugin/plugin.ts';

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	// Create the Avalon plugin with unified configuration
	const avalonPlugins = await avalon({
		// Directory configuration
		islandsDir: 'src/islands',
		pagesDir: 'src/pages',
		apiDir: 'src/api',

		// Framework integrations to activate (for SSR and hydration)
		integrations: ['react', 'preact', 'vue', 'svelte', 'solid', 'lit'],

		// MDX configuration
		mdx: {
			jsxImportSource: 'preact',
			syntaxHighlighting: true,
		},

		// Auto-discover integrations from component file extensions
		autoDiscoverIntegrations: true,

		// Validate integrations on startup
		validateIntegrations: true,

		// Show warnings for integration issues
		showWarnings: true,

		// Enable verbose logging in development
		verbose: command === 'serve',
	});

	// Framework-specific Vite plugins for compilation
	// These are required for transforming framework-specific syntax
	const frameworkPlugins: Plugin[] = [];

	// Lit SSR DOM shim - must come first to install globals before Lit loads
	try {
		const { litSSRShimPlugin } = await import('../packages/avalon/src/build/lit-ssr-shim-plugin.ts');
		frameworkPlugins.push(litSSRShimPlugin());
	} catch (error) {
		console.warn('Could not load Lit SSR shim plugin:', error);
	}

	// Deno plugin for Deno compatibility
	try {
		const { default: deno } = await import('@deno/vite-plugin');
		const denoPlugins = deno();
		frameworkPlugins.push(...(Array.isArray(denoPlugins) ? denoPlugins : [denoPlugins]));
	} catch (error) {
		console.warn('Could not load @deno/vite-plugin:', error);
	}

	// Vue plugin for .vue file compilation
	try {
		const { default: vue } = await import('@vitejs/plugin-vue');
		const vuePlugins = vue({
			template: {
				compilerOptions: {
					isCustomElement: tag => tag === 'is-land',
				},
			},
		});
		frameworkPlugins.push(...(Array.isArray(vuePlugins) ? vuePlugins : [vuePlugins]));
	} catch (error) {
		console.warn('Could not load Vue plugin:', error);
	}

	// Svelte plugin for .svelte file compilation
	try {
		const { svelte } = await import('@sveltejs/vite-plugin-svelte');
		const sveltePlugins = svelte({
			compilerOptions: {
				customElement: false,
				runes: true,
				dev: false,
				hmr: false,
				css: 'injected',
			},
			emitCss: false,
		});
		frameworkPlugins.push(...(Array.isArray(sveltePlugins) ? sveltePlugins : [sveltePlugins]));
	} catch (error) {
		console.warn('Could not load Svelte plugin:', error);
	}

	// React plugin for React components (files that import from 'react')
	try {
		const { default: react } = await import('@vitejs/plugin-react');
		const reactPlugins = react();
		const reactPluginArray = Array.isArray(reactPlugins) ? reactPlugins : [reactPlugins];
		
		// Wrap the main React plugin to only process files that import from 'react'
		const mainReactPlugin = reactPluginArray.find(p => p.name === 'vite:react-babel');
		if (mainReactPlugin?.transform) {
			const originalTransform = mainReactPlugin.transform;
			const wrappedReactPlugin: Plugin = {
				...mainReactPlugin,
				name: 'avalon:react-wrapper',
				async transform(code: string, id: string, options?: { ssr?: boolean }) {
					if (!/\.(tsx|jsx)$/.test(id) || id.includes('node_modules') || /\.solid\.(tsx|jsx)$/.test(id)) {
						return null;
					}
					const hasReactImport = /from\s+['"]react['"]/.test(code) || /from\s+['"]react\//.test(code);
					const hasPreactImport = /from\s+['"]preact['"]/.test(code);
					if (hasReactImport && !hasPreactImport && typeof originalTransform === 'function') {
						return await originalTransform.call(this, code, id, options);
					}
					return null;
				},
			};
			for (const plugin of reactPluginArray) {
				frameworkPlugins.push(plugin.name === 'vite:react-babel' ? wrappedReactPlugin : plugin);
			}
		} else {
			frameworkPlugins.push(...reactPluginArray);
		}
	} catch (error) {
		console.warn('Could not load React plugin:', error);
	}

	// Preact plugin for Preact components (default for .tsx/.jsx files)
	try {
		const { default: preact } = await import('@preact/preset-vite');
		const preactPlugins = preact({
			include: /\.(tsx|jsx)$/,
			exclude: /\.solid\.(tsx|jsx)$/,
		});
		frameworkPlugins.push(...(Array.isArray(preactPlugins) ? preactPlugins : [preactPlugins]));
	} catch (error) {
		console.warn('Could not load Preact plugin:', error);
	}

	// Solid plugin for .solid.tsx/.solid.jsx files
	try {
		const { default: solid } = await import('vite-plugin-solid');
		const solidPlugins = solid({
			ssr: true,
			hot: true,
			include: [/\.solid\.(tsx|jsx)$/],
		});
		frameworkPlugins.push(...(Array.isArray(solidPlugins) ? solidPlugins : [solidPlugins]));
	} catch (error) {
		console.warn('Could not load Solid plugin:', error);
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
		
		// Lit SSR shim must come first, then Avalon plugins (includes MDX), then framework plugins
		plugins: [frameworkPlugins[0], ...avalonPlugins, ...frameworkPlugins.slice(1)],

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
