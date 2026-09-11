/**
 * Solid integration client entrypoint
 * Exports client-side hydration functionality
 */

export type { SolidHydrationOptions } from "../types.ts";
export { getHydrationScript, hydrate, unmount } from "./hydration.ts";
