/**
 * @avalon/integration-lit
 * 
 * Lit integration for Avalon framework
 * Provides server-side rendering and client-side hydration for Lit web components
 */

// Import DOM shim FIRST - must be before any Lit imports anywhere
import "./server/dom-shim.ts";

import type { Plugin } from "vite";
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
 * Virtual module ID for the Lit SSR DOM shim
 */
const LIT_SSR_SHIM_ID = "virtual:avalon-lit-ssr-shim";
const RESOLVED_LIT_SSR_SHIM_ID = "\0" + LIT_SSR_SHIM_ID;

/**
 * Creates a Vite plugin that ensures the Lit DOM shim is loaded before any Lit code.
 * This plugin must be placed first in the plugin array to ensure proper initialization.
 */
function createLitSSRShimPlugin(): Plugin {
  return {
    name: "avalon:lit-ssr-shim",
    // Enforce "pre" to ensure this runs before other plugins
    enforce: "pre",

    resolveId(id: string) {
      if (id === LIT_SSR_SHIM_ID) {
        return RESOLVED_LIT_SSR_SHIM_ID;
      }
      return null;
    },

    load(id: string) {
      if (id === RESOLVED_LIT_SSR_SHIM_ID) {
        // Return code that imports the DOM shim
        return `
          // Lit SSR DOM Shim - ensures DOM APIs are available before Lit loads
          import "@lit-labs/ssr-dom-shim";
          export const LIT_SSR_SHIM_LOADED = true;
        `;
      }
      return null;
    },

    // Transform Lit files to ensure DOM shim is imported first
    transform(code: string, id: string) {
      // Only process .lit.ts or .lit.js files, or files that import from 'lit'
      const isLitFile = /\.lit\.(ts|js)$/.test(id);
      const importsLit = /from\s+['"]lit['"]/.test(code) || /from\s+['"]lit\//.test(code);

      if ((isLitFile || importsLit) && !id.includes("node_modules")) {
        // Prepend the shim import to ensure DOM APIs are available
        return {
          code: `import "${LIT_SSR_SHIM_ID}";\n${code}`,
          map: null,
        };
      }

      return null;
    },
  };
}

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

  /**
   * Provides the Lit SSR shim plugin for DOM shim support.
   * This plugin MUST be placed first in the plugin array (handled by Avalon's plugin ordering).
   */
  async vitePlugin(): Promise<Plugin | Plugin[]> {
    return createLitSSRShimPlugin();
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
