import type { ComponentType, ComponentChildren } from 'preact';
import type { Component } from 'preact';
import type {
	LayoutContext,
	LayoutData,
	LayoutRoute,
	LayoutHandler,
	LayoutProps,
	LayoutDiscoveryOptions,
	RouteInfo,
	LayoutRule,
	LayoutConfig,
	IslandState,
	PersistentIslandProps,
	PersistentIslandContext,
	LayoutErrorInfo,
	LayoutErrorBoundaryProps,
	ErrorRecoveryStrategy,
	StreamingLayoutProps,
	StreamingComponent,
	ResolvedLayout,
	LayoutCache,
	EnhancedLayoutContext,
	LayoutLoader,
	LayoutMatcherFunction,
	LayoutErrorHandler,
	LayoutRetryFunction,
	LayoutFallbackRenderer,
	IslandStateSaver,
	IslandStateLoader,
	IslandStateClearer,
	StreamingReadyCheck,
} from '../schemas/layout.ts';

// Import concrete implementations
export { LayoutDiscovery } from '../core/layout/layout-discovery.ts';
export { LayoutDataLoader } from '../core/layout/layout-data-loader.ts';
export { LayoutMatcher as LayoutMatcherClass } from '../core/layout/layout-matcher.ts';
export { LayoutComposer } from '../core/layout/layout-composer.ts';

// Re-export all types from schemas for convenience
export type {
	LayoutContext,
	LayoutData,
	LayoutRoute,
	LayoutHandler,
	LayoutProps,
	LayoutDiscoveryOptions,
	RouteInfo,
	LayoutRule,
	LayoutConfig,
	IslandState,
	PersistentIslandProps,
	PersistentIslandContext,
	LayoutErrorInfo,
	LayoutErrorBoundaryProps,
	ErrorRecoveryStrategy,
	StreamingLayoutProps,
	StreamingComponent,
	ResolvedLayout,
	LayoutCache,
	EnhancedLayoutContext,
	LayoutLoader,
	LayoutMatcherFunction,
	LayoutErrorHandler,
	LayoutRetryFunction,
	LayoutFallbackRenderer,
	IslandStateSaver,
	IslandStateLoader,
	IslandStateClearer,
	StreamingReadyCheck,
};

// Export persistent islands functionality
export { IslandPersistence, defaultIslandPersistence } from '../core/islands/island-persistence.ts';
export { IslandStateSerializer } from '../core/islands/island-state-serializer.ts';
export {
	createPersistentIslandContext,
	usePersistentIslandContext,
	PersistentIslandProvider,
} from '../core/islands/persistent-island-context.ts';
export { PersistentIsland } from '../components/PersistentIsland.tsx';

// Export error boundary functionality
export { LayoutErrorBoundary } from '../components/LayoutErrorBoundary.tsx';
export { LayoutDataErrorBoundary } from '../components/LayoutDataErrorBoundary.tsx';
export { IslandErrorBoundary, withIslandErrorBoundary } from '../components/IslandErrorBoundary.tsx';
export { LayoutErrorRecovery } from '../core/layout/layout-error-recovery.ts';
export {
	LayoutErrorLogger,
	LayoutErrorDebugger,
	layoutErrorLogger,
	layoutErrorDebugger,
} from '../core/layout/layout-error-logger.ts';
export {
	LayoutErrorBoundaryManager,
	layoutErrorBoundaryManager,
	ErrorBoundaryUtils,
} from '../core/layout/layout-error-boundary-manager.ts';

// Export streaming functionality
export {
	LayoutStreaming,
	layoutStreaming,
	createStreamingComponent,
	StreamingUtils,
	StreamingPriority,
	DEFAULT_STREAMING_CONFIG,
} from '../core/layout/layout-streaming.ts';
export {
	StreamingLayout,
	StreamingSuspense,
	withStreaming,
	useStreamingState,
} from '../components/StreamingLayout.tsx';
export {
	StreamingPriorityLoader,
	streamingPriorityLoader,
	PriorityLoadingUtils,
	LoadingPriority,
	DEFAULT_LOAD_CONFIG,
} from '../core/layout/streaming-priority-loader.ts';

// Export enhanced layout resolver
export {
	EnhancedLayoutResolver,
	defaultEnhancedLayoutResolver,
	createEnhancedLayoutResolver,
	EnhancedLayoutResolverUtils,
	type EnhancedLayoutResolverOptions,
} from '../core/layout/enhanced-layout-resolver.ts';

// Export layout utilities and helpers
export {
	LayoutCacheManager,
	LayoutDebugUtils,
	LayoutPerformanceMonitor,
	LayoutConfigValidator,
	LayoutErrorReporter,
	createLayoutUtilities,
	defaultLayoutUtilities,
	withLayoutUtilities,
	validateLayoutConfiguration,
	getLayoutSystemHealthReport,
	type LayoutUtilitiesConfig,
	type LayoutUtilitiesSuite,
	type CacheEntry,
	type CacheStats,
	type CacheConfig,
	type DebugConfig,
	type DebugLogEntry,
	type PerformanceMetric,
	type PerformanceSnapshot,
	type PerformanceThresholds,
	type PerformanceAlert,
	type ValidationError,
	type ValidationResult,
	type ValidationWarning,
	type ConfigValidationOptions,
} from '../core/layout/layout-utilities.ts';

// === Enhanced Interface Definitions ===

/**
 * Layout Discovery Interface
 * Handles discovery and scanning of layout files in the file system
 */
export interface ILayoutDiscovery {
	/**
	 * Discover all layouts for a given route path
	 */
	discoverLayouts(routePath: string): Promise<LayoutRoute[]>;

	/**
	 * Build a complete layout chain for a URL
	 */
	buildLayoutChain(url: URL): Promise<LayoutHandler[]>;

	/**
	 * Enable or disable file watching for hot reloading
	 */
	setWatching(enabled: boolean): void;

	/**
	 * Get current discovery options
	 */
	getOptions(): LayoutDiscoveryOptions;
}

/**
 * Layout Matcher Interface
 * Handles conditional layout rendering based on rules
 */
export interface ILayoutMatcher {
	/**
	 * Add a new layout rule
	 */
	addRule(rule: LayoutRule): void;

	/**
	 * Remove a layout rule
	 */
	removeRule(rule: LayoutRule): void;

	/**
	 * Check if a layout should be applied
	 */
	shouldApplyLayout(layoutPath: string, route: RouteInfo): boolean;

	/**
	 * Get all active rules
	 */
	getRules(): LayoutRule[];

	/**
	 * Clear all rules
	 */
	clearRules(): void;
}

/**
 * Layout Composer Interface
 * Handles page-level layout composition control
 */
export interface ILayoutComposer {
	/**
	 * Resolve layouts for a route with page-level configuration
	 */
	resolveLayouts(routePath: string, pageModule: PageModule): Promise<LayoutHandler[]>;

	/**
	 * Apply layout configuration to a layout chain
	 */
	applyConfiguration(layouts: LayoutHandler[], config: LayoutConfig): Promise<LayoutHandler[]>;

	/**
	 * Validate layout configuration
	 */
	validateLayoutConfig(config: LayoutConfig): { valid: boolean; errors: string[] };

	/**
	 * Clear all caches
	 */
	clearCache(): void;

	/**
	 * Get composition statistics
	 */
	getCompositionStats(): {
		customLayoutCacheSize: number;
		discoveryStats: { layoutCount: number; routeCacheCount: number };
	};
}

/**
 * Island Persistence Interface
 * Handles state persistence for islands across navigation
 */
export interface IIslandPersistence {
	/**
	 * Save island state
	 */
	saveState(id: string, state: IslandState): void;

	/**
	 * Load island state
	 */
	loadState(id: string): IslandState | null;

	/**
	 * Clear island state
	 */
	clearState(id: string): void;

	/**
	 * Check if state exists for an island
	 */
	hasState(id: string): boolean;

	/**
	 * Get all stored island IDs
	 */
	getStoredIds(): string[];

	/**
	 * Clear all stored states
	 */
	clearAllStates(): void;
}

/**
 * Layout Error Recovery Interface
 * Handles error recovery strategies for layout failures
 */
export interface ILayoutErrorRecovery {
	/**
	 * Handle a layout error and return appropriate response
	 */
	handleLayoutError(error: Error, context: LayoutContext): Promise<Response>;

	/**
	 * Register a custom error recovery strategy
	 */
	registerStrategy(errorType: string, strategy: ErrorRecoveryStrategy): void;

	/**
	 * Get recovery strategy for an error
	 */
	getStrategy(error: Error): ErrorRecoveryStrategy | null;
}

/**
 * Layout Streaming Interface
 * Handles progressive rendering of layout components
 */
export interface ILayoutStreaming {
	/**
	 * Render layout with streaming support
	 */
	renderWithStreaming(layout: LayoutHandler, props: LayoutProps): Promise<ReadableStream>;

	/**
	 * Check if streaming is supported for current environment
	 */
	isStreamingSupported(): boolean;

	/**
	 * Create streaming response for multiple components
	 */
	createStreamingResponse(components: StreamingComponent[]): ReadableStream;

	/**
	 * Generate skeleton placeholder for a component
	 */
	generateSkeleton(component: StreamingComponent): string;
}

/**
 * Enhanced Layout Resolver Interface
 * Main orchestrator for the layout system
 */
export interface IEnhancedLayoutResolver {
	/**
	 * Resolve and render complete layout chain for a route
	 */
	resolveAndRender(routePath: string, pageModule: PageModule, context: LayoutContext): Promise<ResolvedLayout>;

	/**
	 * Get cached layout resolution if available
	 */
	getCachedResolution(routePath: string): ResolvedLayout | null;

	/**
	 * Clear layout cache
	 */
	clearCache(): void;

	/**
	 * Enable or disable caching
	 */
	setCaching(enabled: boolean): void;
}

// === Component Interface Definitions ===

/**
 * Layout Component Interface
 * Base interface for all layout components
 */
export interface ILayoutComponent {
	/**
	 * Layout component props
	 */
	props: LayoutProps;

	/**
	 * Optional layout loader function
	 */
	layoutLoader?: LayoutLoader;

	/**
	 * Optional layout configuration
	 */
	layoutConfig?: LayoutConfig;
}

/**
 * Persistent Island Component Interface
 * Interface for islands that maintain state across navigation
 */
export interface IPersistentIslandComponent {
	/**
	 * Persistent island props
	 */
	props: PersistentIslandProps;

	/**
	 * Save current state
	 */
	saveState(): void;

	/**
	 * Load saved state
	 */
	loadState(): void;

	/**
	 * Clear saved state
	 */
	clearState(): void;

	/**
	 * Check if state exists
	 */
	hasState(): boolean;
}

/**
 * Layout Error Boundary Component Interface
 * Interface for error boundary components in layouts
 */
export interface ILayoutErrorBoundaryComponent extends Component<LayoutErrorBoundaryProps> {
	/**
	 * Handle retry action
	 */
	handleRetry(): void;

	/**
	 * Get current error state
	 */
	getErrorState(): { hasError: boolean; error?: Error };

	/**
	 * Reset error state
	 */
	resetErrorState(): void;
}

/**
 * Streaming Layout Component Interface
 * Interface for components that support streaming
 */
export interface IStreamingLayoutComponent {
	/**
	 * Streaming layout props
	 */
	props: StreamingLayoutProps;

	/**
	 * Check if component is ready to render
	 */
	isReady(): Promise<boolean>;

	/**
	 * Render fallback component
	 */
	renderFallback(): ComponentChildren;

	/**
	 * Get streaming priority
	 */
	getPriority(): number;
}

// === Utility Type Definitions ===

/**
 * Layout Module Type
 * Represents a layout module with optional exports
 */
export interface LayoutModule {
	/**
	 * Default export - the layout component
	 */
	default: ComponentType<LayoutProps>;

	/**
	 * Optional layout loader function
	 */
	layoutLoader?: LayoutLoader;

	/**
	 * Optional layout configuration
	 */
	layoutConfig?: LayoutConfig;

	/**
	 * Optional error boundary component
	 */
	ErrorBoundary?: ComponentType<LayoutErrorBoundaryProps>;
}

/**
 * Page Module Type
 * Represents a page module with optional layout configuration
 */
export interface PageModule {
	/**
	 * Default export - the page component
	 */
	default: ComponentType<Record<string, unknown>>;

	/**
	 * Optional layout configuration for this page
	 */
	layoutConfig?: LayoutConfig;

	/**
	 * Optional frontmatter data from MDX files
	 */
	frontmatter?: Record<string, unknown>;

	/**
	 * Optional page-specific data loader
	 */
	loader?: (ctx: LayoutContext) => Promise<Record<string, unknown>>;
}

/**
 * Layout Resolution Context
 * Context information during layout resolution
 */
export interface LayoutResolutionContext {
	/**
	 * Current route being resolved
	 */
	route: RouteInfo;

	/**
	 * Page module being rendered
	 */
	pageModule: PageModule;

	/**
	 * Layout context
	 */
	layoutContext: LayoutContext;

	/**
	 * Whether caching is enabled
	 */
	cachingEnabled: boolean;

	/**
	 * Whether streaming is enabled
	 */
	streamingEnabled: boolean;

	/**
	 * Development mode flag
	 */
	developmentMode: boolean;
}

/**
 * Layout Performance Metrics
 * Metrics collected during layout resolution and rendering
 */
export interface LayoutPerformanceMetrics {
	/**
	 * Time taken for layout discovery
	 */
	discoveryTime: number;

	/**
	 * Time taken for data loading
	 */
	dataLoadingTime: number;

	/**
	 * Time taken for component rendering
	 */
	renderingTime: number;

	/**
	 * Total resolution time
	 */
	totalTime: number;

	/**
	 * Number of layouts in chain
	 */
	layoutCount: number;

	/**
	 * Whether result was cached
	 */
	cacheHit: boolean;

	/**
	 * Memory usage during resolution
	 */
	memoryUsage?: number;
}

/**
 * Layout Debug Information
 * Debug information for development mode
 */
export interface LayoutDebugInfo {
	/**
	 * Layout resolution chain
	 */
	resolutionChain: string[];

	/**
	 * Applied rules
	 */
	appliedRules: LayoutRule[];

	/**
	 * Skipped layouts
	 */
	skippedLayouts: string[];

	/**
	 * Error information
	 */
	errors: LayoutErrorInfo[];

	/**
	 * Performance metrics
	 */
	metrics: LayoutPerformanceMetrics;

	/**
	 * Cache information
	 */
	cacheInfo: {
		hit: boolean;
		key: string;
		size: number;
	};
}

// === Event Type Definitions ===

/**
 * Layout Event Types
 */
export type LayoutEventType =
	| 'layout-discovered'
	| 'layout-loaded'
	| 'layout-rendered'
	| 'layout-error'
	| 'layout-cached'
	| 'island-state-saved'
	| 'island-state-loaded'
	| 'streaming-started'
	| 'streaming-completed';

/**
 * Layout Event Data
 */
export interface LayoutEventData {
	type: LayoutEventType;
	timestamp: number;
	layoutPath?: string;
	error?: Error;
	metrics?: LayoutPerformanceMetrics;
	data?: Record<string, unknown>;
}

/**
 * Layout Event Handler
 */
export type LayoutEventHandler = (event: LayoutEventData) => void;

/**
 * Layout Event Emitter Interface
 */
export interface ILayoutEventEmitter {
	/**
	 * Add event listener
	 */
	on(event: LayoutEventType, handler: LayoutEventHandler): void;

	/**
	 * Remove event listener
	 */
	off(event: LayoutEventType, handler: LayoutEventHandler): void;

	/**
	 * Emit event
	 */
	emit(event: LayoutEventType, data?: Record<string, unknown>): void;

	/**
	 * Remove all listeners
	 */
	removeAllListeners(): void;
}
