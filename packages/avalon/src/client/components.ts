/**
 * Client-safe component exports for use in island components.
 *
 * Import from '@avalon/avalon/client' instead of '@avalon/avalon' when
 * you need framework components inside islands. The main entry point
 * re-exports server-only code (nitro, h3, vite plugins) that can't
 * be bundled for the browser.
 */

// Persistent islands
export { PersistentIsland } from '../components/PersistentIsland.tsx';
export {
	usePersistentIslandContext,
	PersistentIslandProvider,
	createPersistentIslandContext,
} from '../core/islands/persistent-island-context.tsx';
export { usePersistentState } from '../core/islands/use-persistent-state.ts';
export { IslandPersistence, defaultIslandPersistence } from '../core/islands/island-persistence.ts';
export { IslandStateSerializer } from '../core/islands/island-state-serializer.ts';

// Error boundaries
export { IslandErrorBoundary, withIslandErrorBoundary } from '../components/IslandErrorBoundary.tsx';
export { LayoutErrorBoundary } from '../components/LayoutErrorBoundary.tsx';
export { LayoutDataErrorBoundary } from '../components/LayoutDataErrorBoundary.tsx';
export { StreamingErrorBoundary, withStreamingErrorBoundary } from '../components/StreamingErrorBoundary.tsx';

// Streaming
export { StreamingLayout, StreamingSuspense, withStreaming, useStreamingState } from '../components/StreamingLayout.tsx';

// Image optimization
export { Image } from '../components/Image.tsx';
export type { ImageProps } from '../components/Image.tsx';

// Types
export type { IslandState } from '../schemas/layout.ts';
