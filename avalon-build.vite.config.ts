import { defineConfig } from 'vite';
import { resolve } from '@std/path';
import type { UserConfig } from 'vite';

/**
 * Vite config for building Avalon's own client scripts
 * This pre-bundles scripts with dependencies resolved
 */
export default defineConfig(async (): Promise<UserConfig> => {
	// Load plugins for building client scripts
	const plugins = [];

	// Load Solid plugin for solid-hydration.js
	try {
		// deno-lint-ignore no-external-import
		const { default: solid } = await import('vite-plugin-solid');
		plugins.push(solid({ ssr: false })); // Client-only build
		console.log('✅ Solid plugin loaded for Avalon build');
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.warn('⚠️ Could not load vite-plugin-solid for Avalon build:', errorMessage);
	}

	// Note: Vue hydration is now handled by the unified main.js script

	return {
		root: '.',

		plugins,

		// Build Avalon's client scripts
		build: {
			outDir: 'dist-avalon',
			emptyOutDir: true,
			rollupOptions: {
				input: {
					'solid-hydration': resolve('./src/client/solid-hydration.js'),
				},
				output: {
					entryFileNames: '[name].js',
					chunkFileNames: '[name].[hash].js',
				},
				// Keep external dependencies minimal for better compatibility
				external: [],
			},
			target: 'es2020',
			minify: 'esbuild',
		},

		// Define globals
		define: {
			__DEV__: false,
			__PROD__: true,
		},
	};
});
