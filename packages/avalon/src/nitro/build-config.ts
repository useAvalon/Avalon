/**
 * Nitro Build Configuration Module for Avalon
 *
 * This module provides build configuration utilities for integrating Nitro
 * with Avalon's Vite-based build pipeline. It handles:
 * - Vite client build configuration
 * - Nitro server build configuration
 * - Preset-specific output configuration
 * - Source map generation
 *
 * @module nitro/build-config
 */

import type { Plugin, UserConfig, BuildOptions } from 'vite';
import type { ResolvedAvalonConfig } from '../vite-plugin/types.ts';
import type { AvalonNitroConfig } from './config.ts';
import { DEFAULT_NITRO_CONFIG, VALID_V3_PRESETS } from './config.ts';

/**
 * Build mode for the Avalon application
 */
export type BuildMode = 'client' | 'server' | 'both';

/**
 * Sourcemap option type
 */
export type SourcemapOption = boolean | 'inline' | 'hidden';

/**
 * Minify option type
 */
export type MinifyOption = boolean | 'oxc' | 'esbuild' | 'terser';

/**
 * Preset-specific build output configuration
 */
export interface PresetOutputConfig {
	/** Output directory for the preset */
	outputDir: string;
	/** Server entry file name */
	serverEntry: string;
	/** Whether the preset supports streaming */
	supportsStreaming: boolean;
	/** Whether the preset requires bundled dependencies */
	bundleDependencies: boolean;
	/** Additional files to include in output */
	additionalFiles?: string[];
	/** Environment-specific configuration */
	env?: Record<string, string>;
}

/**
 * Avalon build configuration options
 */
export interface AvalonBuildConfig {
	/** Build mode: client, server, or both */
	mode: BuildMode;
	/** Output directory for client assets */
	clientOutDir: string;
	/** Output directory for server bundle */
	serverOutDir: string;
	/** Enable source maps */
	sourcemap: SourcemapOption;
	/** Minify output */
	minify: MinifyOption;
	/** Target environment */
	target: string | string[];
	/** Enable SSR build */
	ssr: boolean;
	/** Nitro preset for deployment */
	preset: string;
	/** Enable verbose logging */
	verbose: boolean;
	/** Nitro v3: Compatibility date for preset features (YYYY-MM-DD) */
	compatibilityDate?: string;
	/** Nitro v3: Dependencies to trace instead of bundle */
	traceDeps?: string[];
	/** Nitro v3: Rolldown-specific configuration */
	rolldownConfig?: Record<string, unknown>;
	/** Nitro v3: Custom server entry point */
	serverEntry?: string;
}

/**
 * Default build configuration values
 */
export const DEFAULT_BUILD_CONFIG: AvalonBuildConfig = {
	mode: 'both',
	clientOutDir: 'dist/client',
	serverOutDir: 'dist/server',
	sourcemap: true,
	minify: 'oxc',
	target: 'es2020',
	ssr: true,
	preset: 'node_server',
	verbose: false,
};

/**
 * Preset-specific output configurations
 */
export const PRESET_OUTPUT_CONFIGS: Record<string, PresetOutputConfig> = {
	node_server: {
		outputDir: '.output',
		serverEntry: 'server/index.mjs',
		supportsStreaming: true,
		bundleDependencies: false,
	},
	node_middleware: {
		outputDir: '.output',
		serverEntry: 'server/index.mjs',
		supportsStreaming: true,
		bundleDependencies: false,
	},
	vercel: {
		outputDir: '.vercel/output',
		serverEntry: 'functions/render.func/index.mjs',
		supportsStreaming: true,
		bundleDependencies: true,
		additionalFiles: ['config.json'],
	},
	cloudflare_module: {
		outputDir: 'dist',
		serverEntry: 'server/index.mjs',
		supportsStreaming: false,
		bundleDependencies: true,
	},
	cloudflare_pages: {
		outputDir: 'dist',
		serverEntry: '_worker.js',
		supportsStreaming: false,
		bundleDependencies: true,
		additionalFiles: ['_routes.json'],
	},
	deno_deploy: {
		outputDir: '.output',
		serverEntry: 'server/index.ts',
		supportsStreaming: true,
		bundleDependencies: false,
	},
	deno_server: {
		outputDir: '.output',
		serverEntry: 'server/index.ts',
		supportsStreaming: true,
		bundleDependencies: false,
	},
	netlify_functions: {
		outputDir: '.netlify',
		serverEntry: 'functions-internal/render.mjs',
		supportsStreaming: true,
		bundleDependencies: true,
	},
	netlify: {
		outputDir: '.netlify',
		serverEntry: 'functions-internal/server/index.mjs',
		supportsStreaming: true,
		bundleDependencies: true,
	},
	netlify_edge: {
		outputDir: '.netlify/edge-functions',
		serverEntry: 'render.js',
		supportsStreaming: true,
		bundleDependencies: true,
	},
	aws_lambda: {
		outputDir: '.output',
		serverEntry: 'server/index.mjs',
		supportsStreaming: false,
		bundleDependencies: true,
	},
	azure_swa: {
		outputDir: '.output',
		serverEntry: 'server/index.mjs',
		supportsStreaming: false,
		bundleDependencies: true,
	},
	firebase_functions: {
		outputDir: '.output',
		serverEntry: 'server/index.mjs',
		supportsStreaming: true,
		bundleDependencies: true,
	},
	render_com: {
		outputDir: '.output',
		serverEntry: 'server/index.mjs',
		supportsStreaming: true,
		bundleDependencies: false,
	},
	static: {
		outputDir: 'dist',
		serverEntry: '',
		supportsStreaming: false,
		bundleDependencies: false,
	},
	browser: {
		outputDir: 'dist',
		serverEntry: '',
		supportsStreaming: false,
		bundleDependencies: true,
	},
};

/**
 * Creates the Vite client build configuration
 *
 * @param avalonConfig - Resolved Avalon configuration
 * @param buildConfig - Build configuration options
 * @returns Vite build options for client build
 */
export function createClientBuildConfig(
	avalonConfig: ResolvedAvalonConfig,
	buildConfig: Partial<AvalonBuildConfig> = {},
): BuildOptions {
	const config = { ...DEFAULT_BUILD_CONFIG, ...buildConfig };

	return {
		outDir: config.clientOutDir,
		emptyOutDir: true,
		sourcemap: config.sourcemap,
		minify: config.minify,
		target: config.target,
		rolldownOptions: {
			output: {
				entryFileNames: '[name].[hash].js',
				chunkFileNames: 'chunks/[name].[hash].js',
				assetFileNames: 'assets/[name].[hash].[ext]',
				codeSplitting: {
					groups: [
						{ name: 'vendor-react', test: /node_modules\/(react|react-dom)/ },
						{ name: 'vendor-vue', test: /node_modules\/(vue|@vue)/ },
						{ name: 'vendor-svelte', test: /node_modules\/svelte/ },
						{ name: 'vendor-preact', test: /node_modules\/preact/ },
						{ name: 'vendor-solid', test: /node_modules\/solid-js/ },
						{ name: 'vendor-lit', test: /node_modules\/(lit|@lit)/ },
						{ name: 'vendor', test: /node_modules/ },
						{ name: 'islands', test: /\/islands\// },
					],
				},
			},
		},
		reportCompressedSize: !avalonConfig.isDev,
		cssCodeSplit: true,
	};
}

/**
 * Creates the Vite server build configuration for Nitro
 *
 * @param avalonConfig - Resolved Avalon configuration
 * @param nitroConfig - Nitro configuration
 * @param buildConfig - Build configuration options
 * @returns Vite build options for server build
 */
export function createServerBuildConfig(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig,
	buildConfig: Partial<AvalonBuildConfig> = {},
): BuildOptions {
	const config = { ...DEFAULT_BUILD_CONFIG, ...buildConfig };
	const preset = nitroConfig.preset ?? DEFAULT_NITRO_CONFIG.preset;
	const presetConfig = PRESET_OUTPUT_CONFIGS[preset] ?? PRESET_OUTPUT_CONFIGS['node_server'];

	return {
		outDir: config.serverOutDir,
		emptyOutDir: true,
		sourcemap: config.sourcemap,
		minify: config.minify,
		target: config.target,
		ssr: true,
		rolldownOptions: {
			input: {
				index: './server/index.ts',
			},
			output: {
				format: 'esm',
				entryFileNames: '[name].mjs',
				chunkFileNames: 'chunks/[name].[hash].mjs',
				preserveModules: !presetConfig.bundleDependencies,
			},
			external: presetConfig.bundleDependencies ? [] : getServerExternals(preset),
		},
	};
}

/**
 * Gets external dependencies for server build based on preset
 *
 * @param preset - Nitro preset name
 * @returns Array of external dependency patterns
 */
function getServerExternals(preset: string): (string | RegExp)[] {
	const baseExternals: (string | RegExp)[] = [/^node:/, /^deno:/];

	switch (preset) {
		case 'deno_deploy':
		case 'deno_server':
			return [...baseExternals];

		case 'node_server':
			return [...baseExternals, /^[a-z@]/i];

		default:
			return baseExternals;
	}
}

/**
 * Gets the preset output configuration
 *
 * @param preset - Nitro preset name
 * @returns Preset output configuration
 */
export function getPresetOutputConfig(preset: string): PresetOutputConfig {
	return PRESET_OUTPUT_CONFIGS[preset] ?? PRESET_OUTPUT_CONFIGS['node_server'];
}

/**
 * Checks if a preset supports streaming SSR
 *
 * @param preset - Nitro preset name
 * @returns True if the preset supports streaming
 */
export function presetSupportsStreaming(preset: string): boolean {
	const config = getPresetOutputConfig(preset);
	return config.supportsStreaming;
}

/**
 * Creates the combined build configuration for both client and server
 *
 * @param avalonConfig - Resolved Avalon configuration
 * @param nitroConfig - Nitro configuration
 * @param buildConfig - Build configuration options
 * @returns Combined Vite user config
 */
export function createCombinedBuildConfig(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig,
	buildConfig: Partial<AvalonBuildConfig> = {},
): Partial<UserConfig> {
	const preset = nitroConfig.preset ?? DEFAULT_NITRO_CONFIG.preset;
	const presetConfig = getPresetOutputConfig(preset);

	return {
		build: {
			...createClientBuildConfig(avalonConfig, buildConfig),
			outDir: presetConfig.outputDir,
		},
		define: {
			__DEV__: false,
			__PROD__: true,
			'process.env.NODE_ENV': JSON.stringify('production'),
			...createPresetDefines(preset, presetConfig),
		},
	};
}

/**
 * Creates preset-specific define constants
 */
function createPresetDefines(preset: string, presetConfig: PresetOutputConfig): Record<string, string> {
	const defines: Record<string, string> = {
		__NITRO_PRESET__: JSON.stringify(preset),
		__SUPPORTS_STREAMING__: JSON.stringify(presetConfig.supportsStreaming),
	};

	if (presetConfig.env) {
		for (const [key, value] of Object.entries(presetConfig.env)) {
			defines[`process.env.${key}`] = JSON.stringify(value);
		}
	}

	return defines;
}

/**
 * Creates a Vite plugin for Nitro build integration
 */
export function createNitroBuildPlugin(avalonConfig: ResolvedAvalonConfig, nitroConfig: AvalonNitroConfig): Plugin {
	const preset = nitroConfig.preset ?? DEFAULT_NITRO_CONFIG.preset;
	const presetConfig = getPresetOutputConfig(preset);

	return {
		name: 'avalon:nitro-build',
		enforce: 'post',

		config(_config: UserConfig, { command }: { command: string }) {
			if (command !== 'build') {
				return;
			}

			// Only return define constants during build. Do NOT set build.outDir
			// because Nitro's Vite plugin manages output directories for each
			// environment (client, nitro, ssr) via its own config hooks.
			return {
				define: {
					__DEV__: false,
					__PROD__: true,
					'process.env.NODE_ENV': JSON.stringify('production'),
					...createPresetDefines(preset, presetConfig),
				},
			};
		},

		buildStart() {
			if (avalonConfig.verbose) {
				console.log('🚀 Avalon Nitro build starting...');
				console.log(`   Preset: ${preset}`);
				console.log(`   Output: ${presetConfig.outputDir}`);
				console.log(`   Streaming: ${presetConfig.supportsStreaming}`);
			}
		},

		writeBundle() {
			if (avalonConfig.verbose) {
				console.log('✅ Avalon client build complete');
			}
		},

		closeBundle() {
			if (avalonConfig.verbose) {
				console.log('📦 Avalon build finished');
				console.log(`   Output directory: ${presetConfig.outputDir}`);
			}
		},
	};
}

/**
 * Validates build configuration
 */
export function validateBuildConfig(config: Partial<AvalonBuildConfig>): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (config.preset) {
		if (!VALID_V3_PRESETS.includes(config.preset)) {
			errors.push(`Unknown preset: ${config.preset}. Valid presets: ${VALID_V3_PRESETS.join(', ')}`);
		}
	}

	if (config.mode && !['client', 'server', 'both'].includes(config.mode)) {
		errors.push(`Invalid build mode: ${config.mode}. Must be 'client', 'server', or 'both'`);
	}

	if (
		config.sourcemap !== undefined &&
		typeof config.sourcemap !== 'boolean' &&
		!['inline', 'hidden'].includes(config.sourcemap as string)
	) {
		errors.push(`Invalid sourcemap option: ${config.sourcemap}`);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Source map configuration options
 */
export interface SourceMapConfig {
	/** Enable source maps */
	enabled: boolean;
	/** Source map type: true for external, 'inline' for inline, 'hidden' for hidden */
	type: SourcemapOption;
	/** Include source content in source maps */
	includeContent: boolean;
	/** Source map URL prefix */
	sourceRoot?: string;
}

/**
 * Default source map configuration
 */
export const DEFAULT_SOURCEMAP_CONFIG: SourceMapConfig = {
	enabled: true,
	type: true,
	includeContent: true,
};

/**
 * Creates source map configuration based on environment and preset
 */
export function createSourceMapConfig(preset: string, isDev: boolean): SourceMapConfig {
	if (isDev) {
		return {
			enabled: true,
			type: true,
			includeContent: true,
		};
	}

	if (preset.includes('edge') || preset.includes('cloudflare') || preset.includes('lambda')) {
		return {
			enabled: true,
			type: 'hidden',
			includeContent: false,
		};
	}

	return {
		enabled: true,
		type: true,
		includeContent: true,
	};
}

/**
 * Gets the Vite sourcemap option from SourceMapConfig
 */
export function getViteSourceMapOption(config: SourceMapConfig): SourcemapOption {
	if (!config.enabled) {
		return false;
	}
	return config.type;
}

/**
 * Creates a Vite plugin for source map handling
 */
export function createSourceMapPlugin(config: SourceMapConfig): Plugin {
	return {
		name: 'avalon:sourcemap',
		enforce: 'post',

		config(_viteConfig: UserConfig, { command }: { command: string }) {
			if (command !== 'build') {
				return;
			}

			return {
				build: {
					sourcemap: getViteSourceMapOption(config),
				},
				...(config.sourceRoot && {
					rolldownOptions: {
						output: {
							sourcemapPathTransform: (relativeSourcePath: string) => {
								return `${config.sourceRoot}/${relativeSourcePath}`;
							},
						},
					},
				}),
			};
		},

		generateBundle(_options: unknown, bundle: Record<string, unknown>) {
			if (!config.enabled) {
				return;
			}

			const sourceMapCount = Object.keys(bundle).filter(key => key.endsWith('.map')).length;

			if (sourceMapCount > 0 && globalThis.__avalonConfig?.verbose) {
				console.log(`📍 Generated ${sourceMapCount} source map(s)`);
			}
		},
	};
}
