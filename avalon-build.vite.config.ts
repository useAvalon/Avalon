import { defineConfig } from 'vite';
import { resolve } from '@std/path';
import type { UserConfig } from 'vite';

/**
 * Vite config for building Avalon's own client scripts
 * This pre-bundles the main client hydration script
 */
export default defineConfig((): UserConfig => {
	return {
		root: '.',

		plugins: [],

		// Build Avalon's client scripts
		build: {
			outDir: 'dist-avalon',
			emptyOutDir: true,
			lib: {
				entry: {
					'main': resolve('./src/client/main.js'),
				},
				formats: ['es'],
			},
			rollupOptions: {
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
