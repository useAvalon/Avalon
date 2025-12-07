/**
 * Preact Integration - Client Entrypoint
 * 
 * This module provides client-side hydration functionality for Preact components.
 * It is dynamically imported by the main client hydration system.
 */

export { hydrate, getHydrationScript, isHydrationReady, cleanupHydration } from "./hydration.ts";
export type { PreactHydrationOptions } from "../types.ts";
