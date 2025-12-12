/**
 * @avalon/integration-preact
 * 
 * Preact integration for Avalon framework
 * Provides server-side rendering and client-side hydration for Preact components
 */

import type { Integration, IntegrationConfig } from "../shared/types.ts";
import { render, renderWithErrorBoundary } from "./server/renderer.ts";
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
};

// Re-export public API
export { render, renderWithErrorBoundary } from "./server/renderer.ts";
export { hydrate, getHydrationScript } from "./client/hydration.ts";
export { loadComponent, isPreactComponent, normalizeProps } from "./server/utils.ts";

// Re-export types
export type * from "./types.ts";
export type { Integration, IntegrationConfig, RenderParams, RenderResult } from "../shared/types.ts";
