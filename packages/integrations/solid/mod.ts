/**
 * @avalon/integration-solid
 * 
 * Solid integration for Avalon framework
 * Provides server-side rendering and client-side hydration for Solid components
 */

import type { Integration, IntegrationConfig } from "../shared/types.ts";
import { render, renderWithErrorBoundary } from "./server/renderer.ts";
import { getHydrationScript } from "./client/hydration.ts";

/**
 * Solid integration configuration
 */
const config: IntegrationConfig = {
  name: "solid",
  fileExtensions: [".tsx", ".jsx", ".ts", ".js"],
  jsxImportSources: ["solid-js", "solid-js/h"],
  detectionPatterns: {
    imports: [
      /^solid-js$/,
      /^solid-js\//,
      /from\s+['"]solid-js['"]/,
      /from\s+['"]solid-js\/[^'"]+['"]/,
    ],
    content: [
      /\bcreateSignal\b/,
      /\bcreateEffect\b/,
      /\bcreateMemo\b/,
      /\bcreateResource\b/,
      /\bShow\b/,
      /\bFor\b/,
      /\bSwitch\b/,
      /\bMatch\b/,
      /\bSuspense\b/,
      /\bErrorBoundary\b/,
      /\.solid\./,
    ],
  },
};

/**
 * Solid integration object
 * Implements the Integration interface
 */
export const solidIntegration: Integration = {
  name: "solid",
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
export { 
  loadComponent, 
  isSolidComponent, 
  normalizeProps,
  resolveIslandPath 
} from "./server/utils.ts";

// Re-export types
export type * from "./types.ts";
export type { 
  Integration, 
  IntegrationConfig, 
  RenderParams, 
  RenderResult 
} from "../shared/types.ts";
