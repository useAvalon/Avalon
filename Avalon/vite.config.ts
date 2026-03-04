import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import type { UserConfig, Plugin } from 'vite';
import { avalon } from '../packages/avalon/src/vite-plugin/plugin.ts';
import { agentOptimization } from '../packages/agent-optimization/mod.ts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	const avalonPlugins = await avalon({
		islandsDir: 'src/islands',
		pagesDir: 'src/pages',

		integrations: ['react', 'preact', 'vue', 'svelte', 'solid', 'lit'],
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
				'/api/**': {
					cors: true,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
						'Cache-Control': 'no-store, no-cache, must-revalidate',
					},
				},
				'/assets/**': {
					headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
				},
				'/islands/**': {
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
	});

	return {
		root: '.',
		publicDir: 'public',

		plugins: [
			tailwindcss() as unknown as Plugin,
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
						'Demos': ['/frameworks', '/islands', '/api-demo', '/lit-demo', '/react-demo', '/multi-framework'],
						'Blog': ['/blog'],
					},
					exclude: ['/admin/**'],
					full: true,
				},
			}),
			avalonPlugins,
		],

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
			],
		},

		resolve: {
			alias: {
				'@/': resolve('src/'),
				'$components/': resolve('src/components/'),
				'$layouts/': resolve('src/layouts/'),
				'$islands/': resolve('src/islands/'),
				'$pages/': resolve('src/pages/'),
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
