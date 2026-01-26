/**
 * Vite Plugin Types for Avalon
 *
 * This module defines the configuration interfaces for the Avalon Vite plugin.
 * These types enable type-safe configuration of the plugin and its integrations.
 */

import type { AvalonNitroConfig } from "../nitro/config.ts";

/**
 * Supported integration names
 * These correspond to the @avalon/integration-* packages
 */
export type IntegrationName =
  | "react"
  | "preact"
  | "vue"
  | "svelte"
  | "solid"
  | "lit";

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
 * Configuration options for the Avalon Vite plugin
 */
export interface AvalonPluginConfig {
  /**
   * Directory containing island components
   * @default "src/islands"
   */
  islandsDir?: string;

  /**
   * Directory containing page components for file-system routing
   * @default "src/pages"
   */
  pagesDir?: string;

  /**
   * Directory containing API route handlers
   * @default "src/api"
   */
  apiDir?: string;

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
 * Fully resolved configuration with defaults applied
 */
export interface ResolvedAvalonConfig {
  islandsDir: string;
  pagesDir: string;
  apiDir: string;
  integrations: IntegrationName[];
  mdx: ResolvedMDXConfig;
  verbose: boolean;
  autoDiscoverIntegrations: boolean;
  validateIntegrations: boolean;
  showWarnings: boolean;
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
