/**
 * @avalon/lit
 * 
 * Lit integration for Avalon framework
 * Provides server-side rendering and client-side hydration for Lit web components
 */

// Import DOM shim FIRST - must be before any Lit imports anywhere
import "./server/dom-shim.ts";

import type { Plugin } from "vite";
import type { Integration, IntegrationConfig } from "../core/types.ts";
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
 * Creates a Vite plugin that fixes decorator order issues in Vite 8 / Oxc output.
 * 
 * The issue is that Oxc (Vite 8's transformer) sometimes outputs "export @decorator class" 
 * instead of the valid "@decorator export class" syntax.
 * 
 * This plugin uses multiple strategies:
 * 1. Pre-transform: Rewrite decorators BEFORE Oxc processes them
 * 2. Post-transform: Fix any remaining issues after Oxc
 */
function createLitDecoratorFixPlugin(): Plugin {
  return {
    name: "avalon:lit-decorator-fix",
    // Enforce "pre" to run BEFORE Oxc transformation
    enforce: "pre",

    // Pre-transform: Convert TypeScript decorators to a format Oxc handles correctly
    // This runs BEFORE Oxc, so we can rewrite the source to avoid the issue
    transform(code: string, id: string, _options?: { ssr?: boolean }) {
      // Only process Lit files
      const isLitFile = /\.lit\.(ts|js)$/.test(id);
      if (!isLitFile || id.includes("node_modules")) {
        return null;
      }

      // Check if this file uses @customElement decorator
      if (!code.includes("@customElement")) {
        return null;
      }

      // Strategy: Convert "@customElement(...) export class" to use a different pattern
      // that Oxc handles correctly. We'll use a manual customElements.define() call.
      
      // Extract the tag name from @customElement("tag-name")
      const customElementMatch = new RegExp(/@customElement\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/).exec(code);
      if (!customElementMatch) {
        return null;
      }
      
      const tagName = customElementMatch[1];
      
      // Remove the @customElement decorator and add manual registration at the end
      let modifiedCode = code.replaceAll(
        /@customElement\s*\(\s*["'`][^"'`]+["'`]\s*\)\s*\n?\s*(export\s+class\s+(\w+))/g,
        '$1'
      );
      
      // Extract the class name
      const classNameMatch = new RegExp(/@customElement\s*\(\s*["'`][^"'`]+["'`]\s*\)\s*\n?\s*export\s+class\s+(\w+)/).exec(code);
      if (classNameMatch) {
        const className = classNameMatch[1];
        
        // Add manual customElements.define() at the end of the file
        // This avoids the decorator syntax issue entirely
        modifiedCode += `\n\n// Auto-generated: Register custom element (decorator removed for Vite 8 compatibility)\nif (typeof customElements !== 'undefined' && !customElements.get("${tagName}")) {\n  customElements.define("${tagName}", ${className});\n}\n`;
        
        // Also add a static property for SSR to find the tag name
        modifiedCode = modifiedCode.replace(
          new RegExp(String.raw`(export\s+class\s+${className}\s+extends\s+\w+\s*\{)`),
          `$1\n  static elementName = "${tagName}";`
        );
        
        return {
          code: modifiedCode,
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
   * Also includes a decorator fix plugin for Vite 8 compatibility.
   */
  async vitePlugin(): Promise<Plugin | Plugin[]> {
    return [createLitSSRShimPlugin(), createLitDecoratorFixPlugin()];
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
export type { Integration, IntegrationConfig, RenderParams, RenderResult } from "../core/types.ts";
