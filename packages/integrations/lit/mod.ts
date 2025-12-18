/**
 * @avalon/integration-lit
 * 
 * Lit integration for Avalon framework
 * Provides server-side rendering and client-side hydration for Lit web components
 */

import type { Integration, IntegrationConfig } from "../shared/types.ts";
import { render } from "./server/renderer.ts";
import { getHydrationScript } from "./client/hydration.ts";

/**
 * Lit integration configuration
 */
const config: IntegrationConfig = {
  name: "lit",
  fileExtensions: [".ts", ".js"],
  jsxImportSources: [],
  detectionPatterns: {
    imports: [
      /^lit$/,
      /^lit\//,
      /from\s+['"]lit['"]/,
      /from\s+['"]lit\/[^'"]+['"]/,
      /@lit-labs\/ssr/,
    ],
    content: [
      /\bLitElement\b/,
      /\bcustomElement\b/,
      /@customElement/,
      /@property/,
      /@state/,
      /\bhtml`/,
      /\bcss`/,
    ],
  },
};

/**
 * Lit integration object
 * Implements the Integration interface
 */
export const litIntegration: Integration = {
  name: "lit",
  version: "0.1.0",
  
  async render(params) {
    // Cast component to Lit element class
    const litParams = {
      ...params,
      component: params.component as typeof import("lit").LitElement | undefined,
    };
    return await render(litParams);
  },
  
  getHydrationScript,
  
  config(): IntegrationConfig {
    return config;
  },
};

// Default export
export default litIntegration;

// Re-export public API
export { render, renderWithErrorBoundary } from "./server/renderer.ts";
export { hydrate, getHydrationScript } from "./client/hydration.ts";
export { loadComponent, getTagName, serializeAttributes, collectStyles, extractTagNameFromSource } from "./server/utils.ts";

// Re-export types
export type * from "./types.ts";
export type { Integration, IntegrationConfig, RenderParams, RenderResult } from "../shared/types.ts";
