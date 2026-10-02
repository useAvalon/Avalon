/**
 * Svelte Integration - Client Entrypoint
 *
 * Main entrypoint for client-side Svelte integration code.
 * This module is imported by the browser to handle hydration.
 */

export type * from "../types.ts";
export { hydrate, mount, unmount } from "./hydration.ts";
