/**
 * Advanced Layout System - Complete Export Index
 *
 * This file provides a comprehensive export index for the entire layout system,
 * making it easy to import all layout-related functionality from a single location.
 */

// === Core Layout System ===

// Layout Discovery
export { LayoutDiscovery } from './core/layout/layout-discovery.ts';
export type { LayoutDiscoveryOptions, LayoutRoute } from './schemas/layout.ts';

// Layout Data Loading
export {
	LayoutDataLoader,
	LayoutDataLoadingError,
	loadSingleLayoutData,
	mergeLayoutData,
	getParentLayoutData,
	defaultLayoutDataLoader,
} from './core/layout/layout-data-loader.ts';
export type { LayoutDataLoadingResult, LayoutDataLoadingOptions } from './core/layout/layout-data-loader.ts';

// Layout Matching and Conditional Rendering
export { LayoutMatcher as LayoutMatcherClass, BuiltInLayoutRules } from './core/layout/layout-matcher.ts';
export type { LayoutRule, RouteInfo } from './schemas/layout.ts';

// Layout Composition Control
export { LayoutComposer } from './core/layout/layout-composer.ts';
export type { LayoutConfig } from './schemas/layout.ts';

// Enhanced Layout Resolver
export {
	EnhancedLayoutResolver,
	defaultEnhancedLayoutResolver,
	createEnhancedLayoutResolver,
	EnhancedLayoutResolverUtils,
} from './core/layout/enhanced-layout-resolver.ts';
export type { EnhancedLayoutResolverOptions } from './core/layout/enhanced-layout-resolver.ts';

// === Persistent Islands System ===

export { IslandPersistence, defaultIslandPersistence } from './core/islands/island-persistence.ts';
export { IslandStateSerializer } from './core/islands/island-state-serializer.ts';
export {
	createPersistentIslandContext,
	usePersistentIslandContext,
	PersistentIslandProvider,
} from './core/islands/persistent-island-context.ts';
export { PersistentIsland } from './components/PersistentIsland.tsx';
export type { IslandState, PersistentIslandProps, PersistentIslandContext } from './schemas/layout.ts';

// === Error Boundary System ===

export { LayoutErrorBoundary } from './components/LayoutErrorBoundary.tsx';
export { LayoutDataErrorBoundary } from './components/LayoutDataErrorBoundary.tsx';
export { IslandErrorBoundary, withIslandErrorBoundary } from './components/IslandErrorBoundary.tsx';
export { LayoutErrorRecovery } from './core/layout/layout-error-recovery.ts';
export {
	LayoutErrorLogger,
	LayoutErrorDebugger,
	layoutErrorLogger,
	layoutErrorDebugger,
} from './core/layout/layout-error-logger.ts';
export {
	LayoutErrorBoundaryManager,
	layoutErrorBoundaryManager,
	ErrorBoundaryUtils,
} from './core/layout/layout-error-boundary-manager.ts';
export type { LayoutErrorInfo, LayoutErrorBoundaryProps, ErrorRecoveryStrategy } from './schemas/layout.ts';

// === Streaming System ===

export {
	LayoutStreaming,
	layoutStreaming,
	createStreamingComponent,
	StreamingUtils,
	StreamingPriority,
	DEFAULT_STREAMING_CONFIG,
} from './core/layout/layout-streaming.ts';
export { StreamingLayout, StreamingSuspense, withStreaming, useStreamingState } from './components/StreamingLayout.tsx';
export {
	StreamingPriorityLoader,
	streamingPriorityLoader,
	PriorityLoadingUtils,
	LoadingPriority,
	DEFAULT_LOAD_CONFIG,
} from './core/layout/streaming-priority-loader.ts';
export type { StreamingLayoutProps, StreamingComponent } from './schemas/layout.ts';

// === Layout Utilities and Helpers ===

export {
	LayoutCacheManager,
	LayoutDebugUtils,
	LayoutPerformanceMonitor,
	LayoutConfigValidator,
	LayoutErrorReporter,
	defaultLayoutUtilities,
	withLayoutUtilities,
	validateLayoutConfiguration,
	getLayoutSystemHealthReport,
} from './core/layout/layout-utilities.ts';
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
} from './core/layout/layout-utilities.ts';

// === Core Types and Schemas ===

export type {
	LayoutContext,
	LayoutData,
	LayoutHandler,
	LayoutProps,
	LayoutLoader,
	ResolvedLayout,
	LayoutCache,
	EnhancedLayoutContext,
	LayoutMatcherFunction,
	LayoutErrorHandler,
	LayoutRetryFunction,
	LayoutFallbackRenderer,
	IslandStateSaver,
	IslandStateLoader,
	IslandStateClearer,
	StreamingReadyCheck,
} from './schemas/layout.ts';

// === Advanced Interface Types ===

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
} from './types/layout.ts';

// === Validation Schemas ===

export {
	LayoutContextSchema,
	LayoutDataSchema,
	LayoutRouteSchema,
	LayoutHandlerSchema,
	LayoutPropsSchema,
	LayoutDiscoveryOptionsSchema,
	RouteInfoSchema,
	LayoutRuleSchema,
	LayoutConfigSchema,
	IslandStateSchema,
	PersistentIslandPropsSchema,
	PersistentIslandContextSchema,
	LayoutErrorInfoSchema,
	LayoutErrorBoundaryPropsSchema,
	ErrorRecoveryStrategySchema,
	StreamingLayoutPropsSchema,
	StreamingComponentSchema,
	ResolvedLayoutSchema,
	LayoutCacheSchema,
	EnhancedLayoutContextSchema,
} from './schemas/layout.ts';

// === Convenience Re-exports ===

// Main layout system class for easy access
export { EnhancedLayoutResolver as LayoutSystem } from './core/layout/enhanced-layout-resolver.ts';

// Default instances for quick setup
export { defaultEnhancedLayoutResolver as defaultLayoutSystem } from './core/layout/enhanced-layout-resolver.ts';
export { defaultIslandPersistence as defaultPersistence } from './core/islands/island-persistence.ts';
export { defaultLayoutUtilities as defaultUtilities } from './core/layout/layout-utilities.ts';

// Factory functions for custom setups
export { createEnhancedLayoutResolver as createLayoutSystem } from './core/layout/enhanced-layout-resolver.ts';

/**
 * Layout System Version Information
 */
export const LAYOUT_SYSTEM_VERSION = '1.0.0';

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
		baseDirectory: 'src/pages',
		filePattern: '_layout.tsx',
		excludeDirectories: ['node_modules', '.git', 'dist'],
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
		priority: 'medium' as const,
		timeout: 5000,
	},
	ERROR_BOUNDARIES: {
		enabled: true,
		maxRetries: 3,
		fallbackStrategy: 'component' as const,
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
