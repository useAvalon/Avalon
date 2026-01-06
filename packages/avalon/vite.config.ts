import { defineConfig } from 'vite';
import { resolve } from '@std/path';
import deno from '@deno/vite-plugin';
import type { UserConfig } from 'vite';
import { createMDXPlugin } from './src/build/mdx-plugin.ts';
import { integrationDetectionPlugin, detectUsedIntegrations, getRequiredIntegrations } from './src/build/integration-detection-plugin.ts';
import { integrationResolverPlugin, createIntegrationAliases } from './src/build/integration-resolver-plugin.ts';
import { integrationBundlerPlugin, getIntegrationOptimizeDeps } from './src/build/integration-bundler-plugin.ts';
import { discoverAllIslands, getQualifiedIslandName } from './src/islands/discovery/index.ts';

const SUPPORTED_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.vue', '.svelte', '.mdx', '.md'] as const;
const FRAMEWORK_DETECTION_DIRS = ['islands', 'components', 'src'] as const;
const SVELTE_DETECTION_DIRS = ['islands', 'components', 'src', 'examples'] as const;

type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

function isSupportedFile(filename: string): boolean {
	return SUPPORTED_EXTENSIONS.some(ext => filename.endsWith(ext));
}

/**
 * Discover all island entries using the nested islands discovery service.
 * Scans all islands directories (including nested ones like /src/modules/[module]/islands/)
 * and generates build entries with qualified names for collision handling.
 * 
 * @returns Record of entry names to file paths for Vite build input
 */
async function discoverIslandEntries(): Promise<Record<string, string>> {
	const cwd = Deno.cwd();
	const allEntries: Record<string, string> = {};

	try {
		// Use the discovery service to find all islands across all directories
		const islands = await discoverAllIslands(cwd);

		for (const island of islands) {
			// Generate entry name based on qualified name
			// For default /src/islands/: "islands/Counter"
			// For nested /src/modules/auth/islands/: "islands/modules/auth/Counter"
			const qualifiedName = getQualifiedIslandName(island);
			const entryName = island.namespace === '' 
				? `islands/${island.name}`
				: `islands/${qualifiedName}`;
			
			allEntries[entryName] = island.filePath;
		}

		// Log discovered islands for debugging
		const islandCount = Object.keys(allEntries).length;
		if (islandCount > 0) {
			console.log(`🏝️  Discovered ${islandCount} island(s) across all directories`);
		}
	} catch (error) {
		console.warn('⚠️  Failed to discover islands:', error);
	}

	return allEntries;
}

async function hasFilesWithExtension(
	extension: SupportedExtension,
	dirs: readonly string[] = FRAMEWORK_DETECTION_DIRS
): Promise<boolean> {
	const cwd = Deno.cwd();

	for (const dir of dirs) {
		try {
			const dirPath = resolve(cwd, dir);
			for await (const entry of Deno.readDir(dirPath)) {
				if (entry.isFile && entry.name.endsWith(extension)) {
					return true;
				}
			}
		} catch {
			// Directory doesn't exist, continue
		}
	}
	return false;
}

async function hasSolidFiles(): Promise<boolean> {
	const cwd = Deno.cwd();

	for (const dir of FRAMEWORK_DETECTION_DIRS) {
		try {
			const dirPath = resolve(cwd, dir);
			for await (const entry of Deno.readDir(dirPath)) {
				if (entry.isFile && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx'))) {
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

async function detectFrameworks(islandEntries: Record<string, string>) {
	// Check if any island entries have Vue or Svelte extensions
	const hasVueInEntries = Object.values(islandEntries).some(path => path.endsWith('.vue'));
	const hasSvelteInEntries = Object.values(islandEntries).some(path => path.endsWith('.svelte'));

	return {
		vue: hasVueInEntries || (await hasFilesWithExtension('.vue')),
		solid: await hasSolidFiles(),
		svelte: hasSvelteInEntries || (await hasFilesWithExtension('.svelte', SVELTE_DETECTION_DIRS)),
	};
}

function createJsxImportSourcePlugin() {
	return {
		name: 'jsx-import-source',
		transform(code: string, id: string) {
			if (!id.endsWith('.tsx') && !id.endsWith('.jsx')) return;
			if (code.includes('@jsxImportSource')) return;

			// Solid.js files are handled by vite-plugin-solid
			if (code.includes('solid-js') || code.includes('from "solid-js"') || code.includes("from 'solid-js'")) {
				return;
			}

			// Default to Preact for JSX files
			return `/** @jsxImportSource preact */\n${code}`;
		},
	};
}

interface PluginConfig {
	name: string;
	packageName: string;
	config: () => unknown;
	successMessage: string;
	errorMessage: string;
	installHint: string;
}

async function loadFrameworkPlugin(pluginConfig: PluginConfig) {
	try {
		// deno-lint-ignore no-external-import
		const module = await import(pluginConfig.packageName);
		const plugin = pluginConfig.name === 'svelte' ? module.svelte : module.default;
		console.log(`✅ ${pluginConfig.successMessage}`);
		return plugin(pluginConfig.config());
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.warn(`⚠️ ${pluginConfig.errorMessage}:`, errorMessage);
		console.warn(`💡 ${pluginConfig.installHint}`);
		return null;
	}
}

async function loadFrameworkPlugins(frameworks: { vue: boolean; solid: boolean; svelte: boolean }) {
	const plugins = [];

	if (frameworks.vue) {
		const vuePlugin = await loadFrameworkPlugin({
			name: 'vue',
			packageName: '@vitejs/plugin-vue',
			config: () => ({
				template: {
					compilerOptions: {
						isCustomElement: (tag: string) => tag === 'is-land',
						style: 'scoped',
					},
				},
			}),
			successMessage: 'Vue plugin loaded for .vue file support',
			errorMessage: 'Vue files detected but @vitejs/plugin-vue not available',
			installHint: 'Install with: deno add npm:@vitejs/plugin-vue',
		});
		if (vuePlugin) plugins.push(vuePlugin);
	}

	if (frameworks.solid) {
		const solidPlugin = await loadFrameworkPlugin({
			name: 'solid',
			packageName: 'vite-plugin-solid',
			config: () => ({ ssr: true, hot: true }),
			successMessage: 'Solid plugin loaded for Solid.js support with SSR',
			errorMessage: 'Solid.js files detected but vite-plugin-solid not available',
			installHint: 'Install with: deno add npm:vite-plugin-solid',
		});
		if (solidPlugin) plugins.push(solidPlugin);
	}

	if (frameworks.svelte) {
		const sveltePlugin = await loadFrameworkPlugin({
			name: 'svelte',
			packageName: '@sveltejs/vite-plugin-svelte',
			config: () => ({
				compilerOptions: {
					customElement: false,
					runes: true,
					css: 'injected',
					dev: false, // Explicitly disable dev mode to prevent SSR issues
				},
				hot: true, // Enable hot reload at plugin level
			}),
			successMessage: 'Svelte plugin loaded for .svelte file support with SSR',
			errorMessage: 'Svelte files detected but @sveltejs/vite-plugin-svelte not available',
			installHint: 'Install with: deno add npm:@sveltejs/vite-plugin-svelte',
		});
		if (sveltePlugin) plugins.push(sveltePlugin);
	}

	return plugins;
}

export default defineConfig(async ({ command }): Promise<UserConfig> => {
	const islandEntries = await discoverIslandEntries();
	const frameworks = await detectFrameworks(islandEntries);
	const frameworkPlugins = await loadFrameworkPlugins(frameworks);
	const mdxPlugins = await createMDXPlugin({ development: command === 'serve' });

	const isDev = command === 'serve';
	
	// Detect which integrations are used for tree-shaking
	const usedIntegrations = await detectUsedIntegrations();
	const requiredIntegrations = getRequiredIntegrations(usedIntegrations);
	
	console.log(`🔧 Configuring build for integrations: ${requiredIntegrations.join(', ') || 'none'}`);

	return {
		root: '.',
		publicDir: 'public',
		// Ensure proper base URL for dependency resolution
		base: '/',

		optimizeDeps: {
			include: [
				// Only include dependencies for used integrations
				...getIntegrationOptimizeDeps(requiredIntegrations),
			],
			exclude: ['@mdx-js/react', '@mdx-js/rollup', '@mdx-js/mdx'],
			// Force re-optimization in development for consistency
			force: isDev,
		},

		plugins: [
			// Integration plugins (must come first)
			integrationDetectionPlugin(),
			integrationResolverPlugin(),
			integrationBundlerPlugin({ integrations: requiredIntegrations, ssr: false }),
			// MDX plugins
			...mdxPlugins.map(plugin => ({ ...plugin, enforce: 'pre' })),
			// Deno plugin
			deno(),
			// JSX import source plugin
			createJsxImportSourcePlugin(),
			// Framework-specific plugins
			...frameworkPlugins,
		],

		esbuild: {
			jsx: 'automatic',
		},

		build: {
			outDir: 'dist',
			emptyOutDir: true,
			// Note: Svelte compilation outputs to 'dist' directory, not 'public/dist-svelte-compiled'
			rollupOptions: {
				input: {
					...islandEntries,
					client: resolve('./src/client/main.js'),
				},
				output: {
					entryFileNames: (chunkInfo: { name?: string }) => {
						return chunkInfo.name?.startsWith('islands/') ? `islands/[name].[hash].js` : '[name].[hash].js';
					},
					chunkFileNames: 'chunks/[name].[hash].js',
					assetFileNames: 'assets/[name].[hash].[ext]',
				},
			},
			target: 'es2020',
			minify: 'esbuild',
		},

		server: {
			port: 8012, // Use dedicated Vite dev server port
			strictPort: true,
			hmr: { port: 8013 }, // Use dedicated HMR port
			cors: {
				origin: true,
				credentials: true,
				methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
				allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
			},
		},

		ssr: {
			target: 'webworker',
			noExternal: ['vue', '@vue/server-renderer', '@vue/shared', 'svelte', 'svelte/internal', 'svelte/store', 'svelte/server'],
		},

		resolve: {
			alias: {
				'@/': resolve('./src/'),
				'~/': resolve('../../'),
				// Integration package aliases
				...createIntegrationAliases(),
			},
		},

		define: {
			__DEV__: isDev,
			__PROD__: !isDev,
			__VUE_OPTIONS_API__: true,
			__VUE_PROD_DEVTOOLS__: false,
			__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: isDev,
		},
	};
});
