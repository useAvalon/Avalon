import { defineConfig, type UserConfig } from 'vite';
import { resolve } from 'node:path';
import { avalon } from '../packages/avalon/src/vite-plugin/plugin.ts';
import { agentOptimization } from '../packages/agent-optimization/mod.ts';

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	const avalonPlugins = await avalon({
		// Modular architecture - pages/layouts discovered within each module
		modules: 'app/modules',
		
		// Shared layouts directory (root layout lives here)
		layoutsDir: 'app/shared/layouts',

		integrations: ['react', 'preact', 'vue', 'svelte', 'qwik', 'solid', 'lit'],
		lazyIntegrations: true,

		mdx: {
			jsxImportSource: 'preact',
			syntaxHighlighting: true,
		},

		nitro: {
			preset: 'node_server',
			streaming: true,
			compatibilityDate: '2025-06-01',
			routeRules: {
				'/assets/**': {
					headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
				},
				'/chunks/**': {
					headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
				},
				'/favicon.ico': {
					headers: { 'Cache-Control': 'public, max-age=86400' },
				},
			},
			runtimeConfig: {
				appName: 'Avalon Demo',
				appVersion: '1.0.0',
			},
			staticAssets: {
				publicDir: 'public',
				buildDir: 'dist',
				compression: true,
			},
		},

		autoDiscoverIntegrations: true,
		verbose: false,
		showWarnings: false,
	});

	return {
		root: '.',
		publicDir: 'public',

		plugins: [
			agentOptimization({
				sitemap: {
					siteUrl: 'http://localhost:8012',
					changefreq: 'daily',
					exclude: ['/admin/**', '/login'],
				},
				markdown: true,
				structuredData: true,
				llms: {
					siteUrl: 'http://localhost:8012',
					siteName: 'Avalon',
					siteDescription: 'A multi-framework islands architecture for building fast, modern websites.',
					sections: {
						'Pages': ['/'],
						'Docs': ['/docs'],
						'Blog': ['/blog'],
					},
					exclude: ['/admin/**'],
					full: true,
				},
			}),
			avalonPlugins,
		].flat(),

		optimizeDeps: {
			include: [
				'react',
				'react/jsx-runtime',
				'react/jsx-dev-runtime',
				'react-dom',
				'react-dom/client',
				'vue',
				'svelte',
				'svelte/internal',
				'svelte/store',
				'lit',
				'@lit-labs/ssr-client',
				'@lit-labs/ssr-client/lit-element-hydrate-support.js',
				'preact',
				'preact/hooks',
				'preact/jsx-runtime',
				'@builder.io/qwik',
			],
		},

		build: {
			outDir: 'dist',
			emptyOutDir: true,
			target: 'es2020',
			minify: 'oxc',
		},

		server: {
			port: 8012,
			strictPort: false,
			hmr: { port: 8013 },
			fs: {
				// Needed during monorepo development — framework packages are in parent dir.
				// Remove when importing from published packages.
				allow: ['..'],
			},
		},

		ssr: {
			target: 'webworker',
			resolve: {
				// 'node' condition ensures solid-js/web resolves to server.js (SSR build)
				// instead of dev.js (client DOM build). Vue's CJS issue from its "node"
				// condition is handled by the resolve.alias for vue below.
				conditions: ['node'],
			},
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
				'@builder.io/qwik',
				'@builder.io/qwik/server',
			],
			// solid-js and solid-js/web are intentionally NOT in noExternal.
			// They must load as native ESM so the renderer and component share
			// the same module instance (and thus the same sharedConfig).
			// The resolveId hook in avalon:solid-oxc-exclude already ensures
			// they resolve to server.js in SSR and dev.js on the client.
		},

		resolve: {
			alias: [
				{ find: '@shared', replacement: resolve('app/shared') },
				{ find: '@modules', replacement: resolve('app/modules') },
				{ find: '@/', replacement: resolve('app') + '/' },
				{ find: '/src/client/main.js', replacement: resolve('../packages/avalon/src/client/main.js') },
				{ find: '/@avalon/preact/client', replacement: resolve('../packages/integrations/preact/client/index.ts') },
				{ find: '/@avalon/react/client', replacement: resolve('../packages/integrations/react/client/index.ts') },
				{ find: '/@avalon/vue/client', replacement: resolve('../packages/integrations/vue/client/index.ts') },
				{ find: '/@avalon/svelte/client', replacement: resolve('../packages/integrations/svelte/client/index.ts') },
				{ find: '/@avalon/solid/client', replacement: resolve('../packages/integrations/solid/client/index.ts') },
				{ find: '/@avalon/lit/client', replacement: resolve('../packages/integrations/lit/client/index.ts') },
				{ find: '/@avalon/qwik/client', replacement: resolve('../packages/integrations/qwik/client/index.ts') },
				// Vue's index.mjs re-exports from index.js (CJS with module.exports)
				// which breaks under ssr.target: 'webworker' + conditions: ['node'].
				// All @vue/* packages have a "node" export condition pointing to CJS.
				// Alias them to their ESM bundler builds directly.
				{ find: /^vue$/, replacement: 'vue/dist/vue.esm-bundler.js' },
				{ find: /^@vue\/shared$/, replacement: '@vue/shared/dist/shared.esm-bundler.js' },
				{ find: /^@vue\/runtime-core$/, replacement: '@vue/runtime-core/dist/runtime-core.esm-bundler.js' },
				{ find: /^@vue\/runtime-dom$/, replacement: '@vue/runtime-dom/dist/runtime-dom.esm-bundler.js' },
				{ find: /^@vue\/reactivity$/, replacement: '@vue/reactivity/dist/reactivity.esm-bundler.js' },
				{ find: /^@vue\/server-renderer$/, replacement: '@vue/server-renderer/dist/server-renderer.esm-bundler.js' },
			],
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
