// === Core Avalon + Vite Architecture ===

// Main exports
export { renderToHtml } from './src/render/ssr.ts';
export { createServer, createServerSafe } from './src/render/server.ts';

// Universal Island component (single function auto-detects framework)
export { default as Island, renderIsland, type IslandProps } from './src/islands/island.tsx';

// Island utilities
export { addSvelteSSRCSS, getSvelteSSRCSS, getSvelteSSRCSSForHead, getSvelteSSRCSSStats, getSvelteComponentCSS, clearSvelteComponentCSS, generateComponentScopeId } from './src/islands/css-utils.ts';
export { detectFramework, detectFrameworkFromSrc, resolveIslandPath } from './src/islands/framework-detection.ts';
export { analyzeComponentFile, renderComponentSSROnly } from './src/islands/component-analysis.ts';
export { renderPreactComponent } from './src/islands/renderers/preact-renderer.ts';
export { renderVueComponent } from './src/islands/renderers/vue-renderer.ts';
export { renderSolidComponent } from './src/islands/renderers/solid-renderer.ts';
export { renderSvelteComponent } from './src/islands/renderers/svelte-renderer.ts';
export type { Framework, RenderParams, SvelteSSRCSSEntry } from './src/islands/types.ts';

// Build utilities
export { generateIslandManifest, loadIslandManifest, getIslandBundlePath } from './src/build/island-manifest.ts';
export type { IslandManifest, IslandEntry } from './src/build/island-manifest.ts';

// Build command (batteries included)
export { build } from './build.ts';

// API utilities
export * from './src/core/api/api.ts';
export { discoverApiRoutes, handleApiRequest } from './src/functions/api.ts';

// Middleware system
export { MiddlewareDiscovery } from './src/core/middleware/middleware-discovery.ts';
export { MiddlewareExecutor } from './src/core/middleware/middleware-executor.ts';
export { DefaultMiddlewareErrorHandler as MiddlewareErrorHandler } from './src/core/middleware/middleware-error-handler.ts';
export { MiddlewareContextManager } from './src/core/middleware/middleware-context.ts';

// Layout system - comprehensive export (all layout functionality)
export * from './src/layout-system.ts';

// Core types
export type { RenderOptions, MetaTag, ScriptConfig } from './src/schemas/core.ts';
export type { Routes, ServerConfig, RouteConfig } from './src/schemas/server.ts';
export type { ApiContext, ApiHandler, ApiRouteConfig, ApiRoute, ApiMethod } from './src/schemas/api.ts';
export type {
	MiddlewareContext,
	MiddlewareResponse,
	MiddlewareHandler,
	MiddlewareRoute,
	MiddlewareChain,
} from './src/schemas/middleware.ts';

// Layout data loading types
export type { LayoutDataLoadingResult, LayoutDataLoadingOptions } from './src/core/layout/layout-data-loader.ts';

// Enhanced layout resolver types
export type { EnhancedLayoutResolverOptions } from './src/core/layout/enhanced-layout-resolver.ts';

// Layout utilities types
export type {
	LayoutUtilitiesConfig,
	LayoutUtilitiesSuite,
	CacheEntry,
	CacheStats,
	CacheConfig,
	DebugConfig,
	DebugLogEntry,
	PerformanceMetric,
	PerformanceSnapshot,
	PerformanceThresholds,
	PerformanceAlert,
	ValidationError,
	ValidationResult,
	ValidationWarning,
	ConfigValidationOptions,
} from './src/core/layout/layout-utilities.ts';

// Layout system types - comprehensive export
export type {
	// Core layout types
	LayoutContext,
	LayoutData,
	LayoutRoute,
	LayoutHandler,
	LayoutProps,
	LayoutDiscoveryOptions,
	RouteInfo,
	LayoutRule,
	LayoutConfig,
	LayoutLoader,
	ResolvedLayout,
	LayoutCache,
	EnhancedLayoutContext,

	// Persistent islands types
	IslandState,
	PersistentIslandProps,
	PersistentIslandContext,
	IslandStateSaver,
	IslandStateLoader,
	IslandStateClearer,

	// Error boundary types
	LayoutErrorInfo,
	LayoutErrorBoundaryProps,
	ErrorRecoveryStrategy,
	LayoutErrorHandler,
	LayoutRetryFunction,
	LayoutFallbackRenderer,

	// Streaming types
	StreamingLayoutProps,
	StreamingComponent,
	StreamingReadyCheck,

	// Function types
	LayoutMatcherFunction,
} from './src/schemas/layout.ts';

// Persistent islands system
export { IslandPersistence, defaultIslandPersistence } from './src/core/islands/island-persistence.ts';
export { IslandStateSerializer } from './src/core/islands/island-state-serializer.ts';
export {
	createPersistentIslandContext,
	usePersistentIslandContext,
	PersistentIslandProvider,
} from './src/core/islands/persistent-island-context.ts';
export { PersistentIsland } from './src/components/PersistentIsland.tsx';

// Error boundary system
export { LayoutErrorBoundary } from './src/components/LayoutErrorBoundary.tsx';
export { LayoutDataErrorBoundary } from './src/components/LayoutDataErrorBoundary.tsx';
export { IslandErrorBoundary, withIslandErrorBoundary } from './src/components/IslandErrorBoundary.tsx';
export { LayoutErrorRecovery } from './src/core/layout/layout-error-recovery.ts';
export {
	LayoutErrorLogger,
	LayoutErrorDebugger,
	layoutErrorLogger,
	layoutErrorDebugger,
} from './src/core/layout/layout-error-logger.ts';
export {
	LayoutErrorBoundaryManager,
	layoutErrorBoundaryManager,
	ErrorBoundaryUtils,
} from './src/core/layout/layout-error-boundary-manager.ts';

// Layout system interfaces
export type {
	ILayoutDiscovery,
	ILayoutMatcher,
	ILayoutComposer,
	IIslandPersistence,
	ILayoutErrorRecovery,
	ILayoutStreaming,
	IEnhancedLayoutResolver,
	ILayoutComponent,
	IPersistentIslandComponent,
	ILayoutErrorBoundaryComponent,
	IStreamingLayoutComponent,
	LayoutModule,
	PageModule,
	LayoutResolutionContext,
	LayoutPerformanceMetrics,
	LayoutDebugInfo,
	LayoutEventType,
	LayoutEventData,
	LayoutEventHandler,
	ILayoutEventEmitter,
} from './src/types/layout.ts';
