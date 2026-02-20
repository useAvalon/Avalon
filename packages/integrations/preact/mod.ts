/**
 * @avalon/preact
 * 
 * Preact integration for Avalon framework
 * Provides server-side rendering and client-side hydration for Preact components
 */

import type { Plugin } from "vite";
import type { Integration, IntegrationConfig } from "../core/types.ts";
import { render } from "./server/renderer.ts";
import { getHydrationScript } from "./client/hydration.ts";

/**
 * Preact integration configuration
 */
const config: IntegrationConfig = {
  name: "preact",
  fileExtensions: [".tsx", ".jsx"],
  jsxImportSources: ["preact"],
  detectionPatterns: {
    imports: [
      /^preact$/,
      /^preact\//,
      /from\s+['"]preact['"]/,
      /from\s+['"]preact\/[^'"]+['"]/,
    ],
    content: [
      /\buseState\b/,
      /\buseEffect\b/,
      /\buseRef\b/,
      /\buseMemo\b/,
      /\buseCallback\b/,
      /\buseContext\b/,
      /\buseReducer\b/,
      /\bh\(/,
      /\bFragment\b/,
    ],
  },
};

/**
 * Preact integration object
 * Implements the Integration interface
 */
export const preactIntegration: Integration = {
  name: "preact",
  version: "0.1.0",
  
  render,
  
  getHydrationScript,
  
  config(): IntegrationConfig {
    return config;
  },

  /**
   * Provides the @preact/preset-vite Vite plugin with include/exclude patterns.
   * Excludes .solid.tsx files to avoid conflicts with Solid integration.
   */
  async vitePlugin(): Promise<Plugin | Plugin[]> {
    const { default: preact } = await import("@preact/preset-vite");
    return preact({
      // Exclude Solid files from Preact processing
      include: [/\.(tsx|jsx)$/],
      exclude: [
        /node_modules/,
        /\.solid\.(tsx|jsx)$/,
      ],
    });
  },
};

// Re-export public API
export { render, renderWithErrorBoundary } from "./server/renderer.ts";
export { hydrate, getHydrationScript } from "./client/hydration.ts";
export { loadComponent, isPreactComponent, normalizeProps } from "./server/utils.ts";

// Re-export types
export type * from "./types.ts";
export type { Integration, IntegrationConfig, RenderParams, RenderResult } from "../core/types.ts";
