/**
 * Client-safe component exports for use in island components.
 *
 * Import from '@useavalon/avalon/client' instead of '@useavalon/avalon' when
 * you need framework components inside islands. The main entry point
 * re-exports server-only code (nitro, h3, vite plugins) that can't
 * be bundled for the browser.
 */
// Persistent islands

// Image optimization
export { Image } from "../components/Image.tsx";
// Error boundaries
export {
	IslandErrorBoundary,
	withIslandErrorBoundary,
} from "../components/IslandErrorBoundary.tsx";
export { LayoutDataErrorBoundary } from "../components/LayoutDataErrorBoundary.tsx";
export { LayoutErrorBoundary } from "../components/LayoutErrorBoundary.tsx";
export { PersistentIsland } from "../components/PersistentIsland.tsx";
export {
	StreamingErrorBoundary,
	withStreamingErrorBoundary,
} from "../components/StreamingErrorBoundary.tsx";
// Streaming
export {
	StreamingLayout,
	StreamingSuspense,
	useStreamingState,
	withStreaming,
} from "../components/StreamingLayout.tsx";
export { defaultIslandPersistence, IslandPersistence } from "../core/islands/island-persistence.js";
export { IslandStateSerializer } from "../core/islands/island-state-serializer.js";
export {
	createPersistentIslandContext,
	PersistentIslandProvider,
	usePersistentIslandContext,
} from "../core/islands/persistent-island-context.tsx";
export { usePersistentState } from "../core/islands/use-persistent-state.js";

// Custom hydration directives (client-side registration)
export { registerClientDirective } from "./custom-directives.js";
