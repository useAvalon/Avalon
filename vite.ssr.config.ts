import { defineConfig } from 'vite';
import { resolve } from '@std/path';
import deno from '@deno/vite-plugin';
import type { UserConfig } from 'vite';
import { detectUsedIntegrations, getRequiredIntegrations } from './src/build/integration-detection-plugin.ts';
import { integrationResolverPlugin, createIntegrationAliases } from './src/build/integration-resolver-plugin.ts';
import { integrationBundlerPlugin, getIntegrationSSRNoExternal } from './src/build/integration-bundler-plugin.ts';

/**
 * Vite configuration for SSR builds
 * This builds server-side integration code and island SSR bundles
 */
export default defineConfig(async (): Promise<UserConfig> => {
	// Detect which integrations are used
	const usedIntegrations = await detectUsedIntegrations();
	const requiredIntegrations = getRequiredIntegrations(usedIntegrations);
	
	console.log(`🔧 Configuring SSR build for integrations: ${requiredIntegrations.join(', ') || 'none'}`);

	// Discover island entries for SSR
	const islandEntries: Record<string, string> = {};
	const cwd = Deno.cwd();
	
	try {
		const islandsPath = resolve(cwd, 'islands');
		for await (const dirEntry of Deno.readDir(islandsPath)) {
			if (dirEntry.isFile) {
				const name = dirEntry.name;
				if (name.endsWith('.tsx') || name.endsWith('.jsx') || 
				    name.endsWith('.vue') || name.endsWith('.svelte')) {
					const baseName = name.replace(/\.(tsx|jsx|vue|svelte)$/, '');
					islandEntries[`islands/${baseName}`] = resolve(islandsPath, name);
				}
			}
		}
	} catch {
		// Islands directory doesn't exist
	}

	// Load framework plugins for SSR
	const frameworkPlugins = [];
	
	// Vue SSR plugin
	if (requiredIntegrations.includes('vue')) {
		try {
			// deno-lint-ignore no-external-import
			const { default: vue } = await import('@vitejs/plugin-vue');
			frameworkPlugins.push(vue({
				template: {
					compilerOptions: {
						isCustomElement: (tag: string) => tag === 'is-land',
					},
				},
			}));
		} catch {
			console.warn('⚠️ Vue plugin not available for SSR build');
		}
	}
	
	// Solid SSR plugin
	if (requiredIntegrations.includes('solid')) {
		try {
			// deno-lint-ignore no-external-import
			const { default: solid } = await import('vite-plugin-solid');
			frameworkPlugins.push(solid({ ssr: true }));
		} catch {
			console.warn('⚠️ Solid plugin not available for SSR build');
		}
	}
	
	// Svelte SSR plugin
	if (requiredIntegrations.includes('svelte')) {
		try {
			// deno-lint-ignore no-external-import
			const { svelte } = await import('@sveltejs/vite-plugin-svelte');
			frameworkPlugins.push(svelte({
				compilerOptions: {
					customElement: false,
					runes: true,
					css: 'injected',
				},
			}));
		} catch {
			console.warn('⚠️ Svelte plugin not available for SSR build');
		}
	}

	return {
		root: '.',
		publicDir: false, // No public dir for SSR build

		plugins: [
			// Integration plugins
			integrationResolverPlugin(),
			integrationBundlerPlugin({ integrations: requiredIntegrations, ssr: true }),
			// Deno plugin
			deno(),
			// Framework plugins
			...frameworkPlugins,
		],

		build: {
			outDir: 'dist/ssr',
			emptyOutDir: true,
			ssr: true,
			rollupOptions: {
				input: {
					// Island entries for SSR
					...islandEntries,
				},
				output: {
					entryFileNames: '[name].js',
					chunkFileNames: 'chunks/[name].[hash].js',
					format: 'es',
				},
			},
			target: 'es2020',
			minify: false, // Don't minify SSR code for better debugging
		},

		ssr: {
			target: 'webworker',
			noExternal: getIntegrationSSRNoExternal(requiredIntegrations),
		},

		resolve: {
			alias: {
				'@/': resolve('src/'),
				'~/': resolve('./'),
				// Integration package aliases
				...createIntegrationAliases(),
			},
		},

		define: {
			__DEV__: false,
			__PROD__: true,
			__VUE_OPTIONS_API__: true,
			__VUE_PROD_DEVTOOLS__: false,
			__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
		},
	};
});
