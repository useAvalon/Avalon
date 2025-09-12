import { defineConfig } from 'vite';
import { resolve } from '@std/path';
import deno from '@deno/vite-plugin';
import type { UserConfig } from 'vite';

// Auto-discover island entry points from user's project directories
async function discoverIslandEntries() {
	const entries: Record<string, string> = {};
	const cwd = Deno.cwd();

	// Check user's islands directory
	try {
		const islandsPath = resolve(cwd, 'islands');
		for await (const dirEntry of Deno.readDir(islandsPath)) {
			if (
				dirEntry.isFile &&
				(dirEntry.name.endsWith('.tsx') ||
					dirEntry.name.endsWith('.ts') ||
					dirEntry.name.endsWith('.jsx') ||
					dirEntry.name.endsWith('.vue'))
			) {
				const name = dirEntry.name.replace(/\.(tsx?|jsx?|vue)$/, '');
				entries[`islands/${name}`] = resolve(islandsPath, dirEntry.name);
			}
		}
	} catch (_error) {
		// Islands directory doesn't exist, that's fine
	}

	// Check user's components directory
	try {
		const componentsPath = resolve(cwd, 'components');
		for await (const dirEntry of Deno.readDir(componentsPath)) {
			if (
				dirEntry.isFile &&
				(dirEntry.name.endsWith('.tsx') ||
					dirEntry.name.endsWith('.ts') ||
					dirEntry.name.endsWith('.jsx') ||
					dirEntry.name.endsWith('.vue'))
			) {
				const name = dirEntry.name.replace(/\.(tsx?|jsx?|vue)$/, '');
				entries[`components/${name}`] = resolve(componentsPath, dirEntry.name);
			}
		}
	} catch (_error) {
		// Components directory doesn't exist, that's fine
	}

	return entries;
}

// Check for Vue files in common directories
async function checkForVueFiles(): Promise<boolean> {
	const cwd = Deno.cwd();
	const dirsToCheck = ['islands', 'components', 'src'];

	for (const dir of dirsToCheck) {
		try {
			const dirPath = resolve(cwd, dir);
			for await (const entry of Deno.readDir(dirPath)) {
				if (entry.isFile && entry.name.endsWith('.vue')) {
					return true;
				}
			}
		} catch {
			// Directory doesn't exist, continue
		}
	}
	return false;
}

// Check for Solid files in common directories
async function checkForSolidFiles(): Promise<boolean> {
	const cwd = Deno.cwd();
	const dirsToCheck = ['islands', 'components', 'src'];

	for (const dir of dirsToCheck) {
		try {
			const dirPath = resolve(cwd, dir);
			for await (const entry of Deno.readDir(dirPath)) {
				if (entry.isFile && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx'))) {
					// Check file content for Solid.js imports
					const content = await Deno.readTextFile(resolve(dirPath, entry.name));
					if (
						content.includes('solid-js') ||
						content.includes('from "solid-js"') ||
						content.includes("from 'solid-js'")
					) {
						return true;
					}
				}
			}
		} catch {
			// Directory doesn't exist, continue
		}
	}
	return false;
}

// Custom plugin to set JSX import source per file
function jsxImportSourcePlugin() {
	return {
		name: 'jsx-import-source',
		transform(code: string, id: string) {
			if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) return;

			// Skip if already has jsxImportSource comment
			if (code.includes('@jsxImportSource')) return;

			// Detect framework based on imports
			if (code.includes('solid-js') || code.includes('from "solid-js"') || code.includes("from 'solid-js'")) {
				// Solid.js file - let vite-plugin-solid handle it
				return;
			} else if (code.includes('preact') || code.includes('from "preact"') || code.includes("from 'preact'")) {
				// Preact file
				return `/** @jsxImportSource preact */\n${code}`;
			} else {
				// Default to Preact for other JSX files
				return `/** @jsxImportSource preact */\n${code}`;
			}
		},
	};
}

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	const islandEntries = await discoverIslandEntries();

	// Check if we have Vue files in the project
	const hasVueFiles =
		Object.keys(islandEntries).some(key => islandEntries[key].endsWith('.vue')) || (await checkForVueFiles());

	// Check if we have Solid files in the project
	const hasSolidFiles = await checkForSolidFiles();

	// Try to load Vue plugin if we have Vue files
	let vuePlugin = null;
	if (hasVueFiles) {
		try {
			// deno-lint-ignore no-external-import
			const { default: vue } = await import('@vitejs/plugin-vue');
			vuePlugin = vue();
			console.log('✅ Vue plugin loaded for .vue file support');
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn('⚠️ Vue files detected but @vitejs/plugin-vue not available:', errorMessage);
			console.warn('💡 Install with: deno add npm:@vitejs/plugin-vue');
		}
	}

	// Try to load Solid plugin if we have Solid files
	let solidPlugin = null;
	if (hasSolidFiles) {
		try {
			// deno-lint-ignore no-external-import
			const { default: solid } = await import('vite-plugin-solid');
			solidPlugin = solid();
			console.log('✅ Solid plugin loaded for Solid.js support');
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn('⚠️ Solid.js files detected but vite-plugin-solid not available:', errorMessage);
			console.warn('💡 Install with: deno add npm:vite-plugin-solid');
		}
	}

	return {
		root: '.',
		publicDir: 'public',

		// Plugin configuration
		plugins: [
			// Official Deno plugin for Vite
			deno(),
			// Custom JSX import source plugin
			jsxImportSourcePlugin(),
			// Vue plugin for .vue file support (if available)
			...(vuePlugin ? [vuePlugin] : []),
			// Solid plugin for Solid.js support (if available)
			...(solidPlugin ? [solidPlugin] : []),
		],

		// JSX configuration for different frameworks
		esbuild: {
			jsx: 'automatic',
			// Don't set global jsxImportSource - let plugins handle their own files
		},

		// Build configuration
		build: {
			outDir: 'dist',
			emptyOutDir: true,
			rollupOptions: {
				input: {
					// Island entries for client-side bundles
					...islandEntries,
					// Main client entry for shared utilities - use Avalon's client script
					client: resolve(new URL('../src/client/main.js', import.meta.url).pathname),
				},
				output: {
					// Clean naming for island bundles
					entryFileNames: (chunkInfo: { name?: string }) => {
						if (chunkInfo.name?.startsWith('islands/')) {
							return `islands/[name].[hash].js`;
						}
						return '[name].[hash].js';
					},
					chunkFileNames: 'chunks/[name].[hash].js',
					assetFileNames: 'assets/[name].[hash].[ext]',
				},
			},
			// Target modern browsers for islands
			target: 'es2020',
			minify: 'esbuild',
		},

		// Dev server configuration
		server: {
			port: 8002, // Vite dev server on different port
			strictPort: true,
			hmr: {
				port: 8003, // HMR WebSocket
			},
			cors: true,
		},

		// SSR configuration for framework support
		ssr: {
			target: 'webworker',
		},

		// Resolve configuration for Deno compatibility
		resolve: {
			alias: {
				'@/': resolve('src/'),
				'~/': resolve('./'),
			},
		},

		// Define globals for different environments
		define: {
			__DEV__: command === 'serve',
			__PROD__: command === 'build',
		},
	};
});
