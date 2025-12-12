/**
 * Svelte Integration Package
 * 
 * Provides server-side rendering and client-side hydration for Svelte 5 components.
 * This integration follows the Avalon integration architecture, allowing Svelte
 * to be used alongside other frameworks in the same application.
 * 
 * @module @avalon/integration-svelte
 */

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
