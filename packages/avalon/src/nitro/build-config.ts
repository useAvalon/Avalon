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

import type { Plugin, UserConfig, BuildOptions } from "vite";
import type { ResolvedAvalonConfig } from "../vite-plugin/types.ts";
import type { AvalonNitroConfig } from "./config.ts";
import { DEFAULT_NITRO_CONFIG, VALID_V3_PRESETS } from "./config.ts";

/**
 * Build mode for the Avalon application
 */
export type BuildMode = "client" | "server" | "both";

/**
 * Sourcemap option type
 */
export type SourcemapOption = boolean | "inline" | "hidden";

/**
 * Minify option type
 */
export type MinifyOption = boolean | "esbuild" | "terser";

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
  mode: "both",
  clientOutDir: "dist/client",
  serverOutDir: "dist/server",
  sourcemap: true,
  minify: "esbuild",
  target: "es2020",
  ssr: true,
  preset: "node_server",
  verbose: false,
};

/**
 * Preset-specific output configurations
 */
export const PRESET_OUTPUT_CONFIGS: Record<string, PresetOutputConfig> = {
  "node_server": {
    outputDir: ".output",
    serverEntry: "server/index.mjs",
    supportsStreaming: true,
    bundleDependencies: false,
  },
  "node_middleware": {
    outputDir: ".output",
    serverEntry: "server/index.mjs",
    supportsStreaming: true,
    bundleDependencies: false,
  },
  "vercel": {
    outputDir: ".vercel/output",
    serverEntry: "functions/render.func/index.mjs",
    supportsStreaming: true,
    bundleDependencies: true,
    additionalFiles: ["config.json"],
  },
  "cloudflare_module": {
    outputDir: "dist",
    serverEntry: "server/index.mjs",
    supportsStreaming: false,
    bundleDependencies: true,
  },
  "cloudflare_pages": {
    outputDir: "dist",
    serverEntry: "_worker.js",
    supportsStreaming: false,
    bundleDependencies: true,
    additionalFiles: ["_routes.json"],
  },
  "deno_deploy": {
    outputDir: ".output",
    serverEntry: "server/index.ts",
    supportsStreaming: true,
    bundleDependencies: false,
  },
  "deno_server": {
    outputDir: ".output",
    serverEntry: "server/index.ts",
    supportsStreaming: true,
    bundleDependencies: false,
  },
  "netlify_functions": {
    outputDir: ".netlify",
    serverEntry: "functions-internal/render.mjs",
    supportsStreaming: true,
    bundleDependencies: true,
  },
  "netlify_edge": {
    outputDir: ".netlify/edge-functions",
    serverEntry: "render.js",
    supportsStreaming: true,
    bundleDependencies: true,
  },
  "aws_lambda": {
    outputDir: ".output",
    serverEntry: "server/index.mjs",
    supportsStreaming: false,
    bundleDependencies: true,
  },
  "azure_swa": {
    outputDir: ".output",
    serverEntry: "server/index.mjs",
    supportsStreaming: false,
    bundleDependencies: true,
  },
  "firebase_functions": {
    outputDir: ".output",
    serverEntry: "server/index.mjs",
    supportsStreaming: true,
    bundleDependencies: true,
  },
  "render_com": {
    outputDir: ".output",
    serverEntry: "server/index.mjs",
    supportsStreaming: true,
    bundleDependencies: false,
  },
  "static": {
    outputDir: "dist",
    serverEntry: "",
    supportsStreaming: false,
    bundleDependencies: false,
  },
  "browser": {
    outputDir: "dist",
    serverEntry: "",
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
  buildConfig: Partial<AvalonBuildConfig> = {}
): BuildOptions {
  const config = { ...DEFAULT_BUILD_CONFIG, ...buildConfig };

  return {
    outDir: config.clientOutDir,
    emptyOutDir: true,
    sourcemap: config.sourcemap,
    minify: config.minify,
    target: config.target,
    rollupOptions: {
      output: {
        // Use content hashes for cache busting
        entryFileNames: "[name].[hash].js",
        chunkFileNames: "chunks/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
        // Optimize chunk splitting
        manualChunks: createManualChunks(),
      },
    },
    // Report compressed size for production builds
    reportCompressedSize: !avalonConfig.isDev,
    // CSS code splitting
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
  buildConfig: Partial<AvalonBuildConfig> = {}
): BuildOptions {
  const config = { ...DEFAULT_BUILD_CONFIG, ...buildConfig };
  const preset = nitroConfig.preset ?? DEFAULT_NITRO_CONFIG.preset;
  const presetConfig = PRESET_OUTPUT_CONFIGS[preset] ?? PRESET_OUTPUT_CONFIGS["node_server"];

  return {
    outDir: config.serverOutDir,
    emptyOutDir: true,
    sourcemap: config.sourcemap,
    minify: config.minify,
    target: config.target,
    ssr: true,
    rollupOptions: {
      input: {
        // Server entry point
        index: "./server/index.ts",
      },
      output: {
        format: "esm",
        entryFileNames: "[name].mjs",
        chunkFileNames: "chunks/[name].[hash].mjs",
        // Preserve module structure for better debugging
        preserveModules: !presetConfig.bundleDependencies,
      },
      // External dependencies based on preset
      external: presetConfig.bundleDependencies
        ? []
        : getServerExternals(preset),
    },
  };
}

/**
 * Creates manual chunk configuration for optimal code splitting
 *
 * @returns Manual chunks configuration function
 */
function createManualChunks(): (id: string) => string | undefined {
  return (id: string) => {
    // Vendor chunks for framework dependencies
    if (id.includes("node_modules")) {
      // React ecosystem
      if (id.includes("react") || id.includes("react-dom")) {
        return "vendor-react";
      }
      // Vue ecosystem
      if (id.includes("vue") || id.includes("@vue")) {
        return "vendor-vue";
      }
      // Svelte ecosystem
      if (id.includes("svelte")) {
        return "vendor-svelte";
      }
      // Preact ecosystem
      if (id.includes("preact")) {
        return "vendor-preact";
      }
      // Solid ecosystem
      if (id.includes("solid-js")) {
        return "vendor-solid";
      }
      // Lit ecosystem
      if (id.includes("lit") || id.includes("@lit")) {
        return "vendor-lit";
      }
      // Other vendor code
      return "vendor";
    }
    // Island components
    if (id.includes("/islands/")) {
      return "islands";
    }
    return undefined;
  };
}

/**
 * Gets external dependencies for server build based on preset
 *
 * @param preset - Nitro preset name
 * @returns Array of external dependency patterns
 */
function getServerExternals(preset: string): (string | RegExp)[] {
  const baseExternals: (string | RegExp)[] = [
    // Node.js built-ins
    /^node:/,
    // Deno built-ins
    /^deno:/,
  ];

  // Preset-specific externals
  switch (preset) {
    case "deno_deploy":
    case "deno_server":
      // Deno handles its own dependencies
      return [...baseExternals];

    case "node_server":
      // Node.js can load from node_modules
      return [
        ...baseExternals,
        /^[a-z@]/i, // All npm packages
      ];

    default:
      // Edge/serverless presets bundle everything
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
  return PRESET_OUTPUT_CONFIGS[preset] ?? PRESET_OUTPUT_CONFIGS["node_server"];
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
  buildConfig: Partial<AvalonBuildConfig> = {}
): Partial<UserConfig> {
  const preset = nitroConfig.preset ?? DEFAULT_NITRO_CONFIG.preset;
  const presetConfig = getPresetOutputConfig(preset);

  return {
    build: {
      // Use client build config as base
      ...createClientBuildConfig(avalonConfig, buildConfig),
      // Override output directory based on preset
      outDir: presetConfig.outputDir,
    },
    // Define build-time constants
    define: {
      __DEV__: false,
      __PROD__: true,
      "process.env.NODE_ENV": JSON.stringify("production"),
      // Preset-specific defines
      ...createPresetDefines(preset, presetConfig),
    },
  };
}

/**
 * Creates preset-specific define constants
 *
 * @param preset - Nitro preset name
 * @param presetConfig - Preset output configuration
 * @returns Define constants object
 */
function createPresetDefines(
  preset: string,
  presetConfig: PresetOutputConfig
): Record<string, string> {
  const defines: Record<string, string> = {
    __NITRO_PRESET__: JSON.stringify(preset),
    __SUPPORTS_STREAMING__: JSON.stringify(presetConfig.supportsStreaming),
  };

  // Add preset-specific environment variables
  if (presetConfig.env) {
    for (const [key, value] of Object.entries(presetConfig.env)) {
      defines[`process.env.${key}`] = JSON.stringify(value);
    }
  }

  return defines;
}

/**
 * Creates a Vite plugin for Nitro build integration
 *
 * @param avalonConfig - Resolved Avalon configuration
 * @param nitroConfig - Nitro configuration
 * @returns Vite plugin for build integration
 */
export function createNitroBuildPlugin(
  avalonConfig: ResolvedAvalonConfig,
  nitroConfig: AvalonNitroConfig
): Plugin {
  const preset = nitroConfig.preset ?? DEFAULT_NITRO_CONFIG.preset;
  const presetConfig = getPresetOutputConfig(preset);

  return {
    name: "avalon:nitro-build",
    enforce: "post",

    config(_config: UserConfig, { command }: { command: string }) {
      // Only apply during build
      if (command !== "build") {
        return;
      }

      // Merge build configuration
      return createCombinedBuildConfig(avalonConfig, nitroConfig, {
        sourcemap: true,
        verbose: avalonConfig.verbose,
      });
    },

    buildStart() {
      if (avalonConfig.verbose) {
        console.log("🚀 Avalon Nitro build starting...");
        console.log(`   Preset: ${preset}`);
        console.log(`   Output: ${presetConfig.outputDir}`);
        console.log(`   Streaming: ${presetConfig.supportsStreaming}`);
      }
    },

    writeBundle() {
      if (avalonConfig.verbose) {
        console.log("✅ Avalon client build complete");
      }
    },

    closeBundle() {
      if (avalonConfig.verbose) {
        console.log("📦 Avalon build finished");
        console.log(`   Output directory: ${presetConfig.outputDir}`);
      }
    },
  };
}

/**
 * Validates build configuration
 *
 * @param config - Build configuration to validate
 * @returns Validation result with any errors
 */
export function validateBuildConfig(
  config: Partial<AvalonBuildConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate preset
  if (config.preset) {
    if (!VALID_V3_PRESETS.includes(config.preset)) {
      errors.push(
        `Unknown preset: ${config.preset}. Valid presets: ${VALID_V3_PRESETS.join(", ")}`
      );
    }
  }

  // Validate mode
  if (config.mode && !["client", "server", "both"].includes(config.mode)) {
    errors.push(`Invalid build mode: ${config.mode}. Must be 'client', 'server', or 'both'`);
  }

  // Validate sourcemap
  if (
    config.sourcemap !== undefined &&
    typeof config.sourcemap !== "boolean" &&
    !["inline", "hidden"].includes(config.sourcemap as string)
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
 *
 * @param preset - Nitro preset name
 * @param isDev - Whether in development mode
 * @returns Source map configuration
 */
export function createSourceMapConfig(
  preset: string,
  isDev: boolean
): SourceMapConfig {
  // Development always uses full source maps
  if (isDev) {
    return {
      enabled: true,
      type: true,
      includeContent: true,
    };
  }

  // Edge/serverless presets may have size constraints
  if (
    preset.includes("edge") ||
    preset.includes("cloudflare") ||
    preset.includes("lambda")
  ) {
    return {
      enabled: true,
      type: "hidden", // Generate but don't reference in output
      includeContent: false, // Reduce size
    };
  }

  // Standard presets use full source maps
  return {
    enabled: true,
    type: true,
    includeContent: true,
  };
}

/**
 * Gets the Vite sourcemap option from SourceMapConfig
 *
 * @param config - Source map configuration
 * @returns Vite sourcemap option value
 */
export function getViteSourceMapOption(
  config: SourceMapConfig
): SourcemapOption {
  if (!config.enabled) {
    return false;
  }
  return config.type;
}

/**
 * Creates a Vite plugin for source map handling
 *
 * @param config - Source map configuration
 * @returns Vite plugin for source map handling
 */
export function createSourceMapPlugin(config: SourceMapConfig): Plugin {
  return {
    name: "avalon:sourcemap",
    enforce: "post",

    config(_viteConfig: UserConfig, { command }: { command: string }) {
      // Only apply during build
      if (command !== "build") {
        return;
      }

      return {
        build: {
          sourcemap: getViteSourceMapOption(config),
        },
        // Rollup-specific source map options
        ...(config.sourceRoot && {
          rollupOptions: {
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

      // Count source map files
      const sourceMapCount = Object.keys(bundle).filter(
        (key) => key.endsWith(".map")
      ).length;

      if (sourceMapCount > 0 && globalThis.__avalonConfig?.verbose) {
        console.log(`📍 Generated ${sourceMapCount} source map(s)`);
      }
    },
  };
}
