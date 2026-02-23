// === Core Avalon + Vite Architecture ===

// Vite Plugin - unified configuration API
export {
	avalon,
	getResolvedConfig,
	getIslandsDir,
	getPagesDir,
	getApiDir,
	getNitroConfig,
	isNitroEnabled,
} from './src/vite-plugin/plugin.ts';
export type {
	AvalonPluginConfig,
	IntegrationName,
	ResolvedAvalonConfig,
	MDXConfig,
	ResolvedMDXConfig,
	AvalonNitroConfig,
	CacheOptions,
	RouteRule,
	NitroConfigOutput,
	AvalonRuntimeConfig,
} from './src/vite-plugin/types.ts';

// Nitro Integration - virtual modules and coordination
export {
	createNitroIntegration,
	createNitroCoordinationPlugin,
	createVirtualModulesPlugin,
	getViteDevServer,
	getAvalonConfig,
	isDevelopmentMode,
	VIRTUAL_MODULE_IDS,
	RESOLVED_VIRTUAL_IDS,
} from './src/vite-plugin/nitro-integration.ts';
export type { NitroIntegrationResult, NitroCoordinationPluginOptions } from './src/vite-plugin/nitro-integration.ts';

// Main exports
export { renderToHtml } from './src/render/ssr.ts';

// Universal Island component (single function auto-detects framework)
export { default as Island, renderIsland, type IslandProps } from './src/islands/island.tsx';

// Island utilities
export {
	addSvelteSSRCSS,
	getSvelteSSRCSS,
	getSvelteSSRCSSForHead,
	getSvelteSSRCSSStats,
	getSvelteComponentCSS,
	clearSvelteComponentCSS,
	generateComponentScopeId,
} from './src/islands/css-utils.ts';
export { detectFramework, detectFrameworkFromSrc, resolveIslandPath } from './src/islands/framework-detection.ts';
export { analyzeComponentFile, renderComponentSSROnly } from './src/islands/component-analysis.ts';
export type { Framework, RenderParams, SvelteSSRCSSEntry } from './src/islands/types.ts';

// Island render cache utilities
export {
	clearCache,
	clearIslandCache,
	invalidateCacheForPath,
	invalidateCacheForFile,
	getCacheStats,
	logCacheStats,
	configureCache,
	getCacheConfig,
} from './src/islands/render-cache.ts';
export type { CacheConfig as IslandCacheConfig, CacheStats as IslandCacheStats } from './src/islands/render-cache.ts';

// Island Discovery System
export {
	// Scanner functions
	discoverIslandDirectories,
	discoverIslandsInDirectory,
	discoverAllIslands,
	isIslandsDirectory,
	getDefaultIslandsPath,
	hasDefaultIslandsDirectory,
	getQualifiedIslandName,
	parseQualifiedIslandName,
	// Registry
	IslandRegistry,
	createIslandRegistry,
	// Resolver
	IslandResolver,
	createIslandResolver,
	// Validator
	IslandValidator,
	createIslandValidator,
	validateAllIslands,
	formatValidationError,
	formatValidationWarning,
	formatCircularDependency,
	formatValidationResult,
	// Watcher
	IslandWatcher,
	createIslandWatcher,
	// Type utilities
	ISLAND_FILE_EXTENSIONS,
	DEFAULT_DISCOVERY_CONFIG,
	isSupportedIslandExtension,
} from './src/islands/discovery/index.ts';

// Island Discovery Types
export type {
	IslandDirectory,
	DiscoveredIsland,
	IslandCollision,
	IslandChangeEvent,
	IslandFileExtension,
	IslandDiscoveryConfig,
	ResolutionResult,
	ImportPathOptions,
	ValidationResult,
	ValidationError,
	ValidationWarning,
	CircularDependency,
	IslandChangeCallback,
	IslandWatcherOptions,
} from './src/islands/discovery/index.ts';

// Integration system
export {
	loadIntegration,
	detectAndLoadIntegration,
	preloadIntegrations,
	detectFrameworksFromPageContent,
	DEFAULT_PRELOAD_FRAMEWORKS,
} from './src/islands/integration-loader.ts';
export type { PreloadIntegrationsOptions } from './src/islands/integration-loader.ts';
export { registry as integrationRegistry } from './src/core/integrations/registry.ts';
export type {
	Integration,
	RenderParams as IntegrationRenderParams,
	RenderResult,
	IntegrationConfig,
} from '@avalon/core';

// Build utilities
export { generateIslandManifest, loadIslandManifest, getIslandBundlePath } from './src/build/island-manifest.ts';
export type {
	IslandManifest,
	IslandEntry,
	ExtendedIslandManifest,
	ExtendedIslandEntry,
} from './src/build/island-manifest.ts';

// MDX island transform (auto-wraps island imports in MDX with Island() calls)
export { mdxIslandTransform } from './src/build/mdx-island-transform.ts';
export type { MDXIslandTransformOptions } from './src/build/mdx-island-transform.ts';

// Page island transform (auto-wraps island imports in TSX pages when using `island` prop)
export { pageIslandTransform } from './src/build/page-island-transform.ts';
export type { PageIslandTransformOptions } from './src/build/page-island-transform.ts';

// Island directive type for the `island` prop
export type { IslandDirective } from './src/types/island-prop.d.ts';
export { asIsland } from './src/types/as-island.ts';

// Island type generation
export { generateIslandTypes, watchAndGenerateTypes } from './src/build/island-types-generator.ts';
export type { IslandTypeGeneratorOptions, TypeGenerationResult } from './src/build/island-types-generator.ts';

// Build command (batteries included)
// Note: This is exported as a function that dynamically imports the build module
// to avoid top-level await issues when SSR loading modules that import from @avalon/avalon
export async function build(_options?: Record<string, unknown>) {
	const { build: buildFn } = await import('../../scripts/build.ts');
	return buildFn();
}

// API utilities
export * from './src/core/api/api.ts';
export { discoverApiRoutes, handleApiRequest } from './src/functions/api.ts';

// Middleware system (Nitro-aligned)
export {
	defineMiddleware,
	discoverScopedMiddleware,
	executeScopedMiddleware,
	clearMiddlewareCache,
	invalidateMiddleware,
	getMatchingMiddleware,
	clearDiscoveryCache,
	hasContextValue,
	getContextValue,
	setContextValue,
	getMiddlewareCacheSize,
	isLegacyMiddlewareResponse,
} from './src/middleware/index.ts';

export type {
	MiddlewareHandler,
	MiddlewareFileExport,
	MiddlewareRoute,
	MiddlewareDiscoveryOptions,
	MiddlewareExecutorOptions,
	LegacyMiddlewareResponse,
} from './src/middleware/types.ts';

// Layout system - comprehensive export (all layout functionality)
export * from './src/layout-system.ts';

// Core types
export type { RenderOptions, MetaTag, ScriptConfig } from './src/schemas/core.ts';
export type { ApiContext, ApiHandler, ApiRouteConfig, ApiRoute, ApiMethod } from './src/schemas/api.ts';
export type { MiddlewareContext } from './src/nitro/middleware-adapter.ts';

// Layout data loading types
export type { LayoutDataLoadingResult, LayoutDataLoadingOptions } from './src/core/layout/layout-data-loader.ts';

// Enhanced layout resolver types
export type { EnhancedLayoutResolverOptions } from './src/core/layout/enhanced-layout-resolver.ts';

// Layout cache types (essential only)
export type { CacheEntry, CacheStats, CacheConfig } from './src/core/layout/layout-cache-manager.ts';

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
} from './src/core/islands/persistent-island-context.tsx';
export { PersistentIsland } from './src/components/PersistentIsland.tsx';

// Error boundary system
export { LayoutErrorBoundary } from './src/components/LayoutErrorBoundary.tsx';
export { LayoutDataErrorBoundary } from './src/components/LayoutDataErrorBoundary.tsx';
export { IslandErrorBoundary, withIslandErrorBoundary } from './src/components/IslandErrorBoundary.tsx';
export { StreamingErrorBoundary, withStreamingErrorBoundary } from './src/components/StreamingErrorBoundary.tsx';

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
