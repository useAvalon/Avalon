/**
 * Client-safe component exports.
 *
 * Image optimization, error boundaries, and persistent state for islands.
 */

export type { ImageProps } from "../components/Image.tsx";
// Image optimization
export { Image } from "../components/Image.tsx";
export type { IslandErrorBoundaryProps } from "../components/IslandErrorBoundary.tsx";
// Error boundaries
export {
	IslandErrorBoundary,
	withIslandErrorBoundary,
} from "../components/IslandErrorBoundary.tsx";
export type { LayoutErrorBoundaryProps } from "../components/LayoutErrorBoundary.tsx";
export { LayoutErrorBoundary } from "../components/LayoutErrorBoundary.tsx";

// Persistent state
export { usePersistentState } from "../persistence/use-persistent-state.ts";

// Custom hydration directives (client-side registration)
export { registerClientDirective } from "./custom-directives.js";
