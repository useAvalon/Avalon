/**
 * @avalon/integration-react
 * 
 * React integration for Avalon framework
 * Provides server-side rendering and client-side hydration for React components,
 * including React Server Components (RSC) support.
 */

import type { Integration, IntegrationConfig } from "../shared/types.ts";
import { render, renderWithErrorBoundary } from "./server/renderer.ts";
import { getHydrationScript } from "./client/hydration.ts";

/**
 * React integration configuration
 */
const config: IntegrationConfig = {
  name: "react",
  fileExtensions: [".jsx", ".tsx"],
  jsxImportSources: ["react"],
  detectionPatterns: {
    imports: [
      /^react$/,
      /^react\//,
      /from\s+['"]react['"]/,
      /from\s+['"]react\/[^'"]+['"]/,
    ],
    content: [
      /\buseState\b/,
      /\buseEffect\b/,
      /\buseContext\b/,
      /\buseReducer\b/,
      /\buseCallback\b/,
      /\buseMemo\b/,
      /\buseRef\b/,
      /\buseTransition\b/,
      /\buseDeferredValue\b/,
      /\buseId\b/,
      /\buseLayoutEffect\b/,
      /\buseImperativeHandle\b/,
      /\buseDebugValue\b/,
      /\buseSyncExternalStore\b/,
      /\buseInsertionEffect\b/,
      /["']use client["']/,
      /["']use server["']/,
    ],
  },
};

/**
 * React integration object
 * Implements the Integration interface
 */
export const reactIntegration: Integration = {
  name: "react",
  version: "0.1.0",
  
  render,
  
  getHydrationScript,
  
  config(): IntegrationConfig {
    return config;
  },
};

// Re-export public API

// Server-side exports
export { render } from "./server/renderer.ts";
export type { renderWithErrorBoundary } from "./server/renderer.ts";
export { renderServerComponent } from "./server/rsc-renderer.ts";
export { 
  loadComponent, 
  hasUseClientDirective,
  analyzeComponent,
  serializeProps
} from "./server/utils.ts";

// Client-side exports
export { 
  hydrate, 
  getHydrationScript, 
  isHydrationReady, 
  cleanupHydration 
} from "./client/hydration.ts";

// Re-export types
export type {
  ReactRenderParams,
  ReactRenderResult,
  ReactHydrationOptions,
  ComponentMetadata,
  RenderParams,
  RenderResult,
  HydrationData,
} from "./types.ts";
export type { Integration, IntegrationConfig } from "../shared/types.ts";

// Default export
export default reactIntegration;
