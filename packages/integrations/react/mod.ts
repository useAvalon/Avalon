/**
 * @avalon/react
 * 
 * React integration for Avalon framework
 * Provides server-side rendering and client-side hydration for React components,
 * including React Server Components (RSC) support.
 */

import type { Plugin } from "vite";
import type { Integration, IntegrationConfig } from "../core/types.ts";
import { render } from "./server/renderer.ts";
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

  /**
   * Provides the @vitejs/plugin-react Vite plugin with wrapped transform for React-only files.
   * Excludes .solid.tsx files and files without React imports to avoid conflicts with other frameworks.
   */
  async vitePlugin(): Promise<Plugin | Plugin[]> {
    const { default: react } = await import("@vitejs/plugin-react");
    const plugins = react();
    const pluginArray = Array.isArray(plugins) ? plugins : [plugins];

    // Find the main React babel plugin and wrap its transform
    const mainPlugin = pluginArray.find((p) => p.name === "vite:react-babel");
    if (mainPlugin?.transform) {
      const originalTransform = mainPlugin.transform;
      const wrappedPlugin: Plugin = {
        ...mainPlugin,
        name: "avalon:react-wrapper",
        async transform(code: string, id: string, options?: { ssr?: boolean }) {
          // Skip non-JSX/TSX files
          if (!/\.(tsx|jsx)$/.test(id)) {
            return null;
          }
          // Skip node_modules
          if (id.includes("node_modules")) {
            return null;
          }
          // Skip Solid files (they use .solid.tsx/.solid.jsx convention)
          if (/\.solid\.(tsx|jsx)$/.test(id)) {
            return null;
          }

          // Check if file imports from React
          const hasReactImport =
            /from\s+['"]react['"]/.test(code) ||
            /from\s+['"]react\//.test(code);
          // Check if file imports from Preact (to avoid conflicts)
          const hasPreactImport = /from\s+['"]preact['"]/.test(code);

          // Only process files that import React and don't import Preact
          if (
            hasReactImport &&
            !hasPreactImport &&
            typeof originalTransform === "function"
          ) {
            
            return await (originalTransform as any).call(this, code, id, options);
          }

          return null;
        },
      };

      // Replace the original plugin with our wrapped version
      return pluginArray.map((p) =>
        p.name === "vite:react-babel" ? wrappedPlugin : p
      );
    }

    return pluginArray;
  },
};

// Re-export public API

// Server-side exports
export { render, renderWithErrorBoundary } from "./server/renderer.ts";
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
export type { Integration, IntegrationConfig } from "../core/types.ts";

// Default export
export default reactIntegration;
