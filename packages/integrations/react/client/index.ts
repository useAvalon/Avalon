/**
 * Client-side exports for React integration
 * 
 * This module provides the client-side hydration functionality
 * for React islands in Avalon applications.
 */

export { 
  hydrate, 
  getHydrationScript, 
  isHydrationReady, 
  cleanupHydration 
} from "./hydration.ts";
