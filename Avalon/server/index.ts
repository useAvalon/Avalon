/**
 * Avalon Demo - Server Entry Point
 *
 * This file serves as the entry point for the Nitro server.
 * It exports the renderer and any server-side utilities needed
 * for the Avalon demo application.
 *
 * Requirements: 1.1 - Nitro Server Integration
 */

// Re-export the renderer as the default handler
export { default } from "./renderer.ts";

// Export renderer options for customization
export { avalonConfig, rendererOptions } from "./renderer.ts";

/**
 * Server-side utilities and helpers
 * These can be imported by API routes and middleware
 */

/**
 * Gets the current runtime configuration
 * In production, this would use Nitro's useRuntimeConfig()
 */
export function getRuntimeConfig() {
  // In development, return the static config
  // In production, this would be populated by Nitro
  return {
    avalon: {
      streaming: true,
      pagesDir: "src/pages",
      apiDir: "src/api",
      islandsDir: "src/islands",
    },
    appName: "Avalon Demo",
    appVersion: "1.0.0",
  };
}

/**
 * Checks if the server is running in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env?.DEV ?? true;
}

/**
 * Checks if the server is running in production mode
 */
export function isProduction(): boolean {
  return import.meta.env?.PROD ?? false;
}
