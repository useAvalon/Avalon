/**
 * Advanced Layout System - Complete Export Index
 *
 * This file provides a comprehensive export index for the entire layout system,
 * making it easy to import all layout-related functionality from a single location.
 */

// === Core Layout System ===

export type { EnhancedLayoutResolverOptions } from "./core/layout/enhanced-layout-resolver.ts";
// Enhanced Layout Resolver
export {
	createEnhancedLayoutResolver,
	EnhancedLayoutResolver,
	EnhancedLayoutResolverUtils,
} from "./core/layout/enhanced-layout-resolver.ts";
// Layout Composition Control
export { LayoutComposer } from "./core/layout/layout-composer.ts";
export type {
	LayoutDataLoadingOptions,
	LayoutDataLoadingResult,
} from "./core/layout/layout-data-loader.ts";
// Layout Data Loading
export {
	defaultLayoutDataLoader,
	getParentLayoutData,
	LayoutDataLoader,
	LayoutDataLoadingError,
	loadSingleLayoutData,
	mergeLayoutData,
} from "./core/layout/layout-data-loader.ts";
// Layout Discovery
export { LayoutDiscovery } from "./core/layout/layout-discovery.ts";
// Layout Matching and Conditional Rendering
export {
	BuiltInLayoutRules,
	LayoutMatcher as LayoutMatcherClass,
} from "./core/layout/layout-matcher.ts";
export type {
	LayoutConfig,
	LayoutDiscoveryOptions,
	LayoutRoute,
	LayoutRule,
	RouteInfo,
} from "./schemas/layout.ts";

// === Layout Utilities (Essential Only) ===
// Debug and performance utilities are available via lazy import from './core/layout/layout-utilities.ts'
// when needed in development mode

export type {
	CacheConfig,
	CacheEntry,
	CacheStats,
} from "./core/layout/layout-cache-manager.ts";
export { LayoutCacheManager } from "./core/layout/layout-cache-manager.ts";

// === Core Types and Schemas ===

export type {
	EnhancedLayoutContext,
	IslandStateClearer,
	IslandStateLoader,
	IslandStateSaver,
	LayoutCache,
	LayoutContext,
	LayoutData,
	LayoutErrorHandler,
	LayoutFallbackRenderer,
	LayoutHandler,
	LayoutLoader,
	LayoutMatcherFunction,
	LayoutProps,
	LayoutRetryFunction,
	ResolvedLayout,
	StreamingReadyCheck,
} from "./schemas/layout.ts";

// === Advanced Interface Types ===

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
} from "./types/layout.ts";

// === Validation Schemas ===

export {
	EnhancedLayoutContextSchema,
	ErrorRecoveryStrategySchema,
	IslandStateSchema,
	LayoutCacheSchema,
	LayoutConfigSchema,
	LayoutContextSchema,
	LayoutDataSchema,
	LayoutDiscoveryOptionsSchema,
	LayoutErrorBoundaryPropsSchema,
	LayoutErrorInfoSchema,
	LayoutHandlerSchema,
	LayoutPropsSchema,
	LayoutRouteSchema,
	LayoutRuleSchema,
	PersistentIslandContextSchema,
	PersistentIslandPropsSchema,
	ResolvedLayoutSchema,
	RouteInfoSchema,
	StreamingComponentSchema,
	StreamingLayoutPropsSchema,
} from "./schemas/layout.ts";

// === Convenience Re-exports ===

// Main layout system class for easy access
// Factory functions for custom setups
export {
	createEnhancedLayoutResolver as createLayoutSystem,
	EnhancedLayoutResolver as LayoutSystem,
} from "./core/layout/enhanced-layout-resolver.ts";

/**
 * Layout System Version Information
 */
export const LAYOUT_SYSTEM_VERSION = "1.0.0";

/**
 * Layout System Feature Flags
 */
export const LAYOUT_SYSTEM_FEATURES = {
	DISCOVERY: true,
	DATA_LOADING: true,
	CONDITIONAL_RENDERING: true,
	COMPOSITION_CONTROL: true,
	PERSISTENT_ISLANDS: true,
	ERROR_BOUNDARIES: true,
	STREAMING: true,
	CACHING: true,
	PERFORMANCE_MONITORING: true,
	DEBUG_UTILITIES: true,
} as const;

/**
 * Layout System Configuration Defaults
 */
export const LAYOUT_SYSTEM_DEFAULTS = {
	DISCOVERY: {
		baseDirectory: "src/pages",
		filePattern: "_layout.tsx",
		excludeDirectories: ["node_modules", ".git", "dist"],
		enableWatching: false,
		developmentMode: false,
	},
	CACHING: {
		enabled: true,
		ttl: 300000, // 5 minutes
		maxSize: 100,
		cleanupInterval: 60000, // 1 minute
	},
	STREAMING: {
		enabled: true,
		priority: "medium" as const,
		timeout: 5000,
	},
	ERROR_BOUNDARIES: {
		enabled: true,
		maxRetries: 3,
		fallbackStrategy: "component" as const,
	},
	PERFORMANCE: {
		monitoring: true,
		thresholds: {
			discoveryTime: 100,
			dataLoadingTime: 500,
			renderingTime: 200,
			totalTime: 1000,
		},
	},
} as const;
