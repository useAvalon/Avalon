/**
 * Preact Integration - Client Entrypoint
 *
 * This module provides client-side hydration functionality for Preact components.
 * It is dynamically imported by the main client hydration system.
 */

export type { PreactHydrationOptions } from "../types.ts";
export {
	cleanupHydration,
	getHydrationScript,
	hydrate,
	isHydrationReady,
	unmount,
} from "./hydration.ts";
