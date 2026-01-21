/**
 * Svelte Integration Package
 * 
 * Provides server-side rendering and client-side hydration for Svelte 5 components.
 * This integration follows the Avalon integration architecture, allowing Svelte
 * to be used alongside other frameworks in the same application.
 * 
 * @module @avalon/integration-svelte
 */

import type { Plugin } from "vite";
import type { Integration, IntegrationConfig } from "../shared/types.ts";
import { render } from "./server/renderer.ts";
import { getHydrationScript } from "./client/hydration.ts";

/**
 * Svelte integration configuration
 */
const config: IntegrationConfig = {
  name: "svelte",
  fileExtensions: [".svelte"],
  detectionPatterns: {
    imports: [
      /^svelte$/,
      /^svelte\//,
    ],
    content: [
      /<script[^>]*>/,
      /<style[^>]*>/,
      /\$:/,  // Svelte reactive statements
      /\$\{/,  // Svelte template expressions
    ],
  },
};

/**
 * Svelte integration object
 * 
 * Implements the Integration interface for Svelte 5 components.
 */
export const svelteIntegration: Integration = {
  name: "svelte",
  version: "0.1.0",
  
  render,
  getHydrationScript,
  
  config(): IntegrationConfig {
    return config;
  },

  /**
   * Provides the @sveltejs/vite-plugin-svelte Vite plugin with SSR-appropriate configuration.
   * Configures runes mode, CSS injection, and HMR settings for optimal Avalon integration.
   */
  async vitePlugin(): Promise<Plugin | Plugin[]> {
    const { svelte } = await import("@sveltejs/vite-plugin-svelte");
    return svelte({
      compilerOptions: {
        // Don't use custom elements mode - we want standard Svelte components
        customElement: false,
        // Enable Svelte 5 runes mode
        runes: true,
        // Disable dev mode for SSR (avoids dev-only warnings)
        dev: false,
        // Disable HMR in compiler (handled by Avalon's HMR coordinator)
        hmr: false,
        // Inject CSS into the component (collected during SSR)
        css: "injected",
      },
      // Don't emit separate CSS files - CSS is collected during SSR
      emitCss: false,
    });
  },
};

// Re-export public API
export { render } from "./server/renderer.ts";
export { hydrate, mount, getHydrationScript } from "./client/hydration.ts";
export {
  extractCss,
  combineCss,
  generateScopeId,
  scopeCss,
  minifyCss,
  processCssForProduction,
} from "./server/css-collector.ts";

// Re-export types
export type * from "./types.ts";

// Default export
export default svelteIntegration;
