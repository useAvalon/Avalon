/**
 * Svelte Integration - Client Entrypoint
 * 
 * Main entrypoint for client-side Svelte integration code.
 * This module is imported by the browser to handle hydration.
 */

export { hydrate, mount, getHydrationScript } from "./hydration.ts";
export type * from "../types.ts";
