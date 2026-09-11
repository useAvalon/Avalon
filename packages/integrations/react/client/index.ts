/**
 * Client-side exports for React integration
 *
 * This module provides the client-side hydration functionality
 * for React islands in Avalon applications.
 */

export {
	cleanupHydration,
	getHydrationScript,
	hydrate,
	isHydrationReady,
	unmount,
} from "./hydration.ts";
