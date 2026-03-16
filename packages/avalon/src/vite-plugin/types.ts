/**
 * Vite Plugin Types for Avalon
 *
 * CONFIG PATH: Vite plugin runtime
 * These types define the inline configuration passed to `avalon()` in
 * `vite.config.ts`. The `resolveConfig()` function in `vite-plugin/config.ts`
 * merges user options against `DEFAULT_CONFIG` to produce a `ResolvedAvalonConfig`.
 *
 * This path uses `IntegrationName[]` (simple string array) for integrations.
 *
 * There is a separate CLI config path (`schemas/integration-config.ts` →
 * `config-loader.ts` → `startup.ts` → `cli.ts`) that reads `avalon.config.ts`
 * from disk and uses `IntegrationConfigEntry[]` (objects with name/enabled/options).
 * That path is NOT used during Vite plugin startup.
 */

import type { AvalonNitroConfig } from "../nitro/config.ts";

/**
 * Image optimization configuration
 */
export interface ImageConfig {
  /**
   * Enable image optimization via vite-imagetools
   * @default true
   */
  enabled?: boolean;

  /**
   * Default image format for optimized images
   * @default "webp"
   */
  defaultFormat?: "webp" | "avif" | "jpg" | "png";

  /**
   * Default image quality (1-100)
   * @default 80
   */
  quality?: number;

  /**
   * Breakpoint widths for srcset generation
   * @default [200, 400, 600, 800, 1200]
   */
  widths?: number[];

  /**
   * Whether to strip EXIF and other metadata from images
   * @default true
   */
  removeMetadata?: boolean;

  /**
   * File patterns to include for image processing
   * @default /^[^?]+\.(heif|avif|jpeg|jpg|png|tiff|webp|gif)(\?.*)?$/
   */
  include?: string | RegExp | (string | RegExp)[];

  /**
   * File patterns to exclude from image processing
   * @default "public/**\/*"
   */
  exclude?: string | RegExp | (string | RegExp)[];
}

/**
 * Resolved image optimization configuration
 */
export interface ResolvedImageConfig {
  enabled: boolean;
  defaultFormat: "webp" | "avif" | "jpg" | "png";
  quality: number;
  widths: number[];
  removeMetadata: boolean;
  include: string | RegExp | (string | RegExp)[];
  exclude: string | RegExp | (string | RegExp)[];
}

/**
 * Supported integration names
 * These correspond to the @avalon/* packages
 */
export type IntegrationName =
  | "react"
  | "preact"
  | "vue"
  | "svelte"
  | "solid"
  | "lit"
  | "qwik";

/**
 * MDX configuration options
 */
export interface MDXConfig {
  /**
   * JSX import source for MDX files
   * @default "preact"
   */
  jsxImportSource?: string;

  /**
   * Enable syntax highlighting for code blocks
   * @default true
   */
  syntaxHighlighting?: boolean;

  /**
   * Custom remark plugins
   */
  remarkPlugins?: unknown[];

  /**
   * Custom rehype plugins
   */
  rehypePlugins?: unknown[];
}

/**
 * Modular architecture configuration
 * Enables co-located pages/layouts within feature modules
 */
export interface ModulesConfig {
  /**
   * Directory containing feature modules
   * @example "app/modules"
   */
  dir: string;

  /**
   * Name of the pages directory within each module
   * @default "pages"
   */
  pagesDirName?: string;

  /**
   * Name of the layouts directory within each module
   * @default "layouts"
   */
  layoutsDirName?: string;
}

/**
 * Configuration options for the Avalon Vite plugin
 */
export interface AvalonPluginConfig {
  /**
   * Directory containing page components for file-system routing
   * @default "src/pages"
   */
  pagesDir?: string;

  /**
   * Directory containing layout components
   * @default "src/layouts"
   */
  layoutsDir?: string;

  /**
   * Modular architecture configuration
   * When set, discovers pages and layouts within feature modules
   * Can be a string (just the dir) or full config object
   * 
   * @example
   * ```ts
   * // Simple - uses default 'pages' and 'layouts' folder names
   * modules: 'app/modules'
   * 
   * // Full config - customize folder names
   * modules: {
   *   dir: 'app/modules',
   *   pagesDirName: 'views',
   *   layoutsDirName: 'layouts',
   * }
   * ```
   */
  modules?: string | ModulesConfig;

  /**
   * Framework integrations to activate
   * Simply list the framework names - the integration packages handle the rest
   * @example ["react", "svelte", "lit"]
   */
  integrations?: IntegrationName[];

  /**
   * MDX processing configuration
   */
  mdx?: MDXConfig;

  /**
   * Image optimization configuration
   * When enabled, Avalon auto-injects vite-imagetools with sensible defaults.
   * Set to `false` to disable, or pass an object to customize.
   * 
   * @default { enabled: true }
   * 
   * @example
   * ```ts
   * // Use defaults (webp, quality 80, standard breakpoints)
   * image: true
   * 
   * // Customize
   * image: {
   *   defaultFormat: 'avif',
   *   quality: 90,
   *   widths: [320, 640, 1024, 1920],
   * }
   * 
   * // Disable
   * image: false
   * ```
   */
  image?: boolean | ImageConfig;

  /**
   * Nitro server runtime configuration
   * When provided, enables Nitro integration for universal deployment
   * 
   * @example
   * ```ts
   * nitro: {
   *   preset: 'vercel',
   *   streaming: true,
   *   routeRules: {
   *     '/api/**': { cors: true },
   *     '/static/**': { cache: { maxAge: 86400 } },
   *   },
   * }
   * ```
   */
  nitro?: AvalonNitroConfig;

  /**
   * Enable verbose logging during development
   * @default false
   */
  verbose?: boolean;

  /**
   * Auto-discover integrations based on component file extensions
   * When true, Avalon will automatically activate integrations
   * based on the components you use, even if not listed in integrations
   * @default true
   */
  autoDiscoverIntegrations?: boolean;

  /**
   * Validate integrations on startup
   * When true, Avalon will check that all integrations
   * implement the required interface correctly
   * @default true
   */
  validateIntegrations?: boolean;

  /**
   * Show warnings for integration issues
   * When true, Avalon will log warnings for non-critical
   * integration problems
   * @default true
   */
  showWarnings?: boolean;

  /**
   * Enable lazy loading of integration Vite plugins
   * When true (default), Avalon will only load Vite plugins for integrations
   * that are actually used in your project, significantly improving cold start time.
   * 
   * The lazy loading works by:
   * 1. Scanning the islands directory to discover which frameworks are used
   * 2. Only loading Vite plugins for those frameworks at startup
   * 3. Loading additional plugins on-demand if new frameworks are encountered
   * 
   * Set to false to load all configured integrations at startup (slower but predictable).
   * @default true
   */
  lazyIntegrations?: boolean;
}

/**
 * Fully resolved MDX configuration with defaults applied
 */
export interface ResolvedMDXConfig {
  jsxImportSource: string;
  syntaxHighlighting: boolean;
  remarkPlugins: unknown[];
  rehypePlugins: unknown[];
}

/**
 * Resolved modular architecture configuration
 */
export interface ResolvedModulesConfig {
  dir: string;
  pagesDirName: string;
  layoutsDirName: string;
}

/**
 * Fully resolved configuration with defaults applied
 */
export interface ResolvedAvalonConfig {
  pagesDir: string;
  layoutsDir: string;
  modules: ResolvedModulesConfig | null;
  integrations: IntegrationName[];
  mdx: ResolvedMDXConfig;
  image: ResolvedImageConfig;
  verbose: boolean;
  autoDiscoverIntegrations: boolean;
  validateIntegrations: boolean;
  showWarnings: boolean;
  lazyIntegrations: boolean;
  isDev: boolean;
}

/**
 * Re-export Nitro configuration types for convenience
 */
export type { AvalonNitroConfig } from "../nitro/config.ts";
export type {
  CacheOptions,
  RouteRule,
  NitroConfigOutput,
  AvalonRuntimeConfig,
  StaticAssetsConfig,
} from "../nitro/config.ts";
