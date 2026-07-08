// === Core Avalon + Vite Architecture ===

export type {
	Integration,
	IntegrationConfig,
	RenderParams as IntegrationRenderParams,
	RenderResult,
} from "@useavalon/core";
// Server Actions
export {
	ACTION_ERROR_STATUS,
	ActionError,
	type ActionErrorOptions,
	createActionClient,
	defineAction,
	isAction,
	isActionError,
} from "./src/actions/define.ts";
export type {
	AcceptMode,
	Action,
	ActionClient,
	ActionClientOptions,
	ActionConfig,
	ActionContext,
	ActionErrorCode,
	ActionNamespace,
	ActionResult,
	SerializedActionError,
} from "./src/actions/types.ts";
export type { ActionsTypeGenerationResult } from "./src/build/actions-types-generator.ts";
// Server action type generation
export {
	findActionsEntryInfo,
	generateActionTypes,
	getActionsWatchDir,
} from "./src/build/actions-types-generator.ts";
export type {
	ExtendedIslandEntry,
	ExtendedIslandManifest,
	IslandEntry,
	IslandManifest,
} from "./src/build/island-manifest.ts";
// Build utilities
export {
	generateIslandManifest,
	getIslandBundlePath,
	loadIslandManifest,
} from "./src/build/island-manifest.ts";
export type {
	IslandTypeGeneratorOptions,
	TypeGenerationResult,
} from "./src/build/island-types-generator.ts";
// Island type generation
export { generateIslandTypes, watchAndGenerateTypes } from "./src/build/island-types-generator.ts";
export type { MDXIslandTransformOptions } from "./src/build/mdx-island-transform.ts";
// MDX island transform (auto-wraps island imports in MDX with Island() calls)
export { mdxIslandTransform } from "./src/build/mdx-island-transform.ts";
export type { PageIslandTransformOptions } from "./src/build/page-island-transform.ts";
// Page island transform (auto-wraps island imports in TSX pages when using `island` prop)
export { pageIslandTransform } from "./src/build/page-island-transform.ts";
export { registry as integrationRegistry } from "./src/core/integrations/registry.ts";
export { registerBuiltinDirectives } from "./src/islands/builtin-directives.ts";
export { analyzeComponentFile, renderComponentSSROnly } from "./src/islands/component-analysis.ts";
// Island utilities
export {
	addSvelteSSRCSS,
	clearSvelteComponentCSS,
	generateComponentScopeId,
	getSvelteComponentCSS,
	getSvelteSSRCSS,
	getSvelteSSRCSSForHead,
	getSvelteSSRCSSStats,
} from "./src/islands/css-utils.ts";
// Island Discovery Types
export type {
	CircularDependency,
	DiscoveredIsland,
	ImportPathOptions,
	IslandChangeCallback,
	IslandChangeEvent,
	IslandCollision,
	IslandDirectory,
	IslandDiscoveryConfig,
	IslandFileExtension,
	IslandWatcherOptions,
	ResolutionResult,
	ValidationError,
	ValidationResult,
	ValidationWarning,
} from "./src/islands/discovery/index.ts";
// Island Discovery Utilities (optional - for advanced use cases)
// Note: Islands are detected by usage (island prop), not by directory.
// These utilities are provided for tooling that needs to scan component files.
export {
	createIslandRegistry,
	createIslandResolver,
	createIslandValidator,
	createIslandWatcher,
	DEFAULT_DISCOVERY_CONFIG,
	discoverAllIslands,
	// Scanner functions
	discoverIslandDirectories,
	discoverIslandsInDirectory,
	formatCircularDependency,
	formatValidationError,
	formatValidationResult,
	formatValidationWarning,
	getDefaultIslandsPath,
	getQualifiedIslandName,
	hasDefaultIslandsDirectory,
	// Type utilities
	ISLAND_FILE_EXTENSIONS,
	// Registry
	IslandRegistry,
	// Resolver
	IslandResolver,
	// Validator
	IslandValidator,
	// Watcher
	IslandWatcher,
	isIslandsDirectory,
	isSupportedIslandExtension,
	parseQualifiedIslandName,
	validateAllIslands,
} from "./src/islands/discovery/index.ts";
export {
	detectFramework,
	detectFrameworkFromSrc,
	resolveIslandPath,
} from "./src/islands/framework-detection.ts";
export type {
	HydrationDirectiveDefinition,
	HydrationDirectiveFn,
} from "./src/islands/hydration-directives.ts";
// Custom hydration directives
export {
	getDirective,
	getRegisteredDirectives,
	isCustomDirective,
	registerHydrationDirective,
	unregisterHydrationDirective,
} from "./src/islands/hydration-directives.ts";
export type { PreloadIntegrationsOptions } from "./src/islands/integration-loader.ts";
// Integration system
export {
	DEFAULT_PRELOAD_FRAMEWORKS,
	detectAndLoadIntegration,
	detectFrameworksFromPageContent,
	loadIntegration,
	preloadIntegrations,
} from "./src/islands/integration-loader.ts";
// Universal Island component (single function auto-detects framework)
export { default as Island, type IslandProps, renderIsland } from "./src/islands/island.tsx";
export type {
	CacheConfig as IslandCacheConfig,
	CacheStats as IslandCacheStats,
} from "./src/islands/render-cache.ts";
// Island render cache utilities
export {
	clearCache,
	clearIslandCache,
	configureCache,
	getCacheConfig,
	getCacheStats,
	invalidateCacheForFile,
	invalidateCacheForPath,
	logCacheStats,
} from "./src/islands/render-cache.ts";
export type { Framework, RenderParams, SvelteSSRCSSEntry } from "./src/islands/types.ts";
// Main exports
export { renderToHtml } from "./src/render/ssr.ts";
// Server island prop type
export type { ServerIslandProp } from "./src/server-islands/types.ts";
// Island directive type for the `island` prop
export type { IslandDirective } from "./src/types/island-prop.d.ts";
export type {
	NitroCoordinationPluginOptions,
	NitroIntegrationResult,
} from "./src/vite-plugin/nitro-integration.ts";
// Nitro Integration - virtual modules and coordination
export {
	createNitroCoordinationPlugin,
	createNitroIntegration,
	createVirtualModulesPlugin,
	getAvalonConfig,
	getViteDevServer,
	isDevelopmentMode,
	RESOLVED_VIRTUAL_IDS,
	VIRTUAL_MODULE_IDS,
} from "./src/vite-plugin/nitro-integration.ts";
// Vite Plugin - unified configuration API
export {
	avalon,
	getLayoutsDir,
	getNitroConfig,
	getPagesDir,
	getResolvedConfig,
	isNitroEnabled,
} from "./src/vite-plugin/plugin.ts";
export type {
	AvalonNitroConfig,
	AvalonPluginConfig,
	AvalonRuntimeConfig,
	CacheOptions,
	IntegrationName,
	MDXConfig,
	NitroConfigOutput,
	RenderEngine,
	ResolvedAvalonConfig,
	ResolvedMDXConfig,
	RouteRule,
} from "./src/vite-plugin/types.ts";

// Build command
// Note: The build function is only available in the monorepo development environment.
// End users should use the CLI or Vite build commands directly.
export async function build(_options?: Record<string, unknown>) {
	throw new Error(
		"avalon build() is not available in the published package. Use `vite build` or the Avalon CLI instead.",
	);
}

export type { IslandErrorBoundaryProps } from "./src/components/IslandErrorBoundary.tsx";
// Error boundaries
export {
	IslandErrorBoundary,
	withIslandErrorBoundary,
} from "./src/components/IslandErrorBoundary.tsx";
export type { LayoutErrorBoundaryProps as LayoutErrorBoundaryComponentProps } from "./src/components/LayoutErrorBoundary.tsx";
export { LayoutErrorBoundary } from "./src/components/LayoutErrorBoundary.tsx";
// Enhanced layout resolver types
export type { EnhancedLayoutResolverOptions } from "./src/core/layout/enhanced-layout-resolver.ts";
// Layout cache types (essential only)
export type {
	CacheConfig,
	CacheEntry,
	CacheStats,
} from "./src/core/layout/layout-cache-manager.ts";

// Layout data loading types
export type {
	LayoutDataLoadingOptions,
	LayoutDataLoadingResult,
} from "./src/core/layout/layout-data-loader.ts";
// Layout system types - comprehensive export
export type {
	LayoutCache,
	LayoutConfig,
	LayoutContext,
	LayoutData,
	LayoutDiscoveryOptions,
	LayoutErrorInfo,
	LayoutHandler,
	LayoutLoader,
	// Core layout types (from hand-written interfaces — proper types, no Zod inference)
	LayoutProps,
	LayoutRoute,
	LayoutRule,
	ResolvedLayout,
	RouteInfo,
} from "./src/core/layout/layout-types.ts";
// Layout system - comprehensive export (all layout functionality)
export * from "./src/layout-system.ts";
// Middleware system (Nitro-aligned)
// Note: defineMiddleware removed — use defineHandler from 'nitro/h3' directly.
// Scoped middleware discovery/execution is Avalon's value-add over Nitro.
export {
	clearDiscoveryCache,
	clearMiddlewareCache,
	discoverScopedMiddleware,
	executeScopedMiddleware,
	getContextValue,
	getMatchingMiddleware,
	getMiddlewareCacheSize,
	hasContextValue,
	invalidateMiddleware,
	setContextValue,
} from "./src/middleware/index.ts";
export type {
	MiddlewareDiscoveryOptions,
	MiddlewareExecutorOptions,
	MiddlewareFileExport,
	MiddlewareHandler,
	MiddlewareRoute,
} from "./src/middleware/types.ts";
// Cron config type re-export for convenience alongside AvalonNitroConfig
export type { ResolvedCronConfig } from "./src/nitro/cron.ts";
export type { MiddlewareContext } from "./src/nitro/middleware-adapter.ts";
// Persistent state
export { usePersistentState } from "./src/persistence/use-persistent-state.ts";
export type { ApiMethod, ApiRoute } from "./src/schemas/api.ts";
// Core types
export type { MetaTag, RenderOptions, ScriptConfig } from "./src/schemas/core.ts";
// Cron / scheduled task config schema + types
export {
	CRON_ALIASES,
	type CronConfig,
	CronConfigSchema,
	type CronJob,
	CronJobSchema,
	CronScheduleSchema,
	isValidCronExpression,
} from "./src/schemas/cron.ts";
export type {
	// Zod-inferred types for schemas that don't have hand-written equivalents
	EnhancedLayoutContext,
	ErrorRecoveryStrategy,
	// Persistent islands types
	IslandState,
	IslandStateClearer,
	IslandStateLoader,
	IslandStateSaver,
	// Error boundary types
	LayoutErrorBoundaryProps,
	LayoutErrorHandler,
	LayoutFallbackRenderer,
	// Function types
	LayoutMatcherFunction,
	LayoutRetryFunction,
	PersistentIslandContext,
	PersistentIslandProps,
	StreamingComponent,
	// Streaming types
	StreamingLayoutProps,
	StreamingReadyCheck,
} from "./src/schemas/layout.ts";
// Layout system interfaces
export type {
	IEnhancedLayoutResolver,
	IIslandPersistence,
	ILayoutComponent,
	ILayoutComposer,
	ILayoutDiscovery,
	ILayoutErrorBoundaryComponent,
	ILayoutErrorRecovery,
	ILayoutEventEmitter,
	ILayoutMatcher,
	ILayoutStreaming,
	IPersistentIslandComponent,
	IStreamingLayoutComponent,
	LayoutDebugInfo,
	LayoutEventData,
	LayoutEventHandler,
	LayoutEventType,
	LayoutModule,
	LayoutPerformanceMetrics,
	LayoutResolutionContext,
	PageModule,
} from "./src/types/layout.ts";
