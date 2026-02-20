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

// Re-export component types from preact
import type { ComponentType, ComponentChildren } from 'preact';
export type { ComponentType, ComponentChildren };

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
} from '../core/islands/persistent-island-context.tsx';
export { PersistentIsland } from '../components/PersistentIsland.tsx';

// Export error boundary functionality
export { LayoutErrorBoundary } from '../components/LayoutErrorBoundary.tsx';
export { LayoutDataErrorBoundary } from '../components/LayoutDataErrorBoundary.tsx';
export { IslandErrorBoundary, withIslandErrorBoundary } from '../components/IslandErrorBoundary.tsx';

// Export streaming functionality
export {
	StreamingLayout,
	StreamingSuspense,
	withStreaming,
	useStreamingState,
} from '../components/StreamingLayout.tsx';

// Export enhanced layout resolver
export {
	EnhancedLayoutResolver,
	createEnhancedLayoutResolver,
	EnhancedLayoutResolverUtils,
	type EnhancedLayoutResolverOptions,
} from '../core/layout/enhanced-layout-resolver.ts';

// Export only essential layout cache types (no debug/performance tooling)
export {
	LayoutCacheManager,
	type CacheEntry,
	type CacheStats,
	type CacheConfig,
} from '../core/layout/layout-cache-manager.ts';

// === Enhanced Interface Definitions ===

/**
 * Layout Discovery Interface
 */
export interface ILayoutDiscovery {
	discoverLayouts(routePath: string): Promise<LayoutRoute[]>;
	buildLayoutChain(url: URL): Promise<LayoutHandler[]>;
	setWatching(enabled: boolean): void;
	getOptions(): LayoutDiscoveryOptions;
}

/**
 * Layout Matcher Interface
 */
export interface ILayoutMatcher {
	addRule(rule: LayoutRule): void;
	removeRule(rule: LayoutRule): void;
	shouldApplyLayout(layoutPath: string, route: RouteInfo): boolean;
	getRules(): LayoutRule[];
	clearRules(): void;
}

/**
 * Layout Composer Interface
 */
export interface ILayoutComposer {
	resolveLayouts(routePath: string, pageModule: PageModule): Promise<LayoutHandler[]>;
	applyConfiguration(layouts: LayoutHandler[], config: LayoutConfig): Promise<LayoutHandler[]>;
	validateLayoutConfig(config: LayoutConfig): { valid: boolean; errors: string[] };
	clearCache(): void;
	getCompositionStats(): {
		customLayoutCacheSize: number;
		discoveryStats: { layoutCount: number; routeCacheCount: number };
	};
}

/**
 * Island Persistence Interface
 */
export interface IIslandPersistence {
	saveState(id: string, state: IslandState): void;
	loadState(id: string): IslandState | null;
	clearState(id: string): void;
	hasState(id: string): boolean;
	getStoredIds(): string[];
	clearAllStates(): void;
}

/**
 * Layout Error Recovery Interface
 */
export interface ILayoutErrorRecovery {
	handleLayoutError(error: Error, context: LayoutContext): Promise<Response>;
	registerStrategy(errorType: string, strategy: ErrorRecoveryStrategy): void;
	getStrategy(error: Error): ErrorRecoveryStrategy | null;
}

/**
 * Layout Streaming Interface
 */
export interface ILayoutStreaming {
	renderWithStreaming(layout: LayoutHandler, props: LayoutProps): Promise<ReadableStream>;
	isStreamingSupported(): boolean;
	createStreamingResponse(components: StreamingComponent[]): ReadableStream;
	generateSkeleton(component: StreamingComponent): string;
}

/**
 * Enhanced Layout Resolver Interface
 */
export interface IEnhancedLayoutResolver {
	resolveAndRender(routePath: string, pageModule: PageModule, context: LayoutContext): Promise<ResolvedLayout>;
	getCachedResolution(routePath: string): ResolvedLayout | null;
	clearCache(): void;
	setCaching(enabled: boolean): void;
}

// === Component Interface Definitions ===

export interface ILayoutComponent {
	props: LayoutProps;
	layoutLoader?: LayoutLoader;
	layoutConfig?: LayoutConfig;
}

export interface IPersistentIslandComponent {
	props: PersistentIslandProps;
	saveState(): void;
	loadState(): void;
	clearState(): void;
	hasState(): boolean;
}

export interface ILayoutErrorBoundaryComponent {
	props: LayoutErrorBoundaryProps;
	handleRetry(): void;
	getErrorState(): { hasError: boolean; error?: Error };
	resetErrorState(): void;
}

export interface IStreamingLayoutComponent {
	props: StreamingLayoutProps;
	isReady(): Promise<boolean>;
	renderFallback(): ComponentChildren;
	getPriority(): number;
}

// === Utility Type Definitions ===

export interface LayoutModule {
	default: ComponentType<LayoutProps>;
	layoutLoader?: LayoutLoader;
	layoutConfig?: LayoutConfig;
	ErrorBoundary?: ComponentType<LayoutErrorBoundaryProps>;
}

export interface PageModule {
	default: ComponentType<Record<string, unknown>>;
	layoutConfig?: LayoutConfig;
	frontmatter?: Record<string, unknown>;
	loader?: (ctx: LayoutContext) => Promise<Record<string, unknown>>;
}

export interface LayoutResolutionContext {
	route: RouteInfo;
	pageModule: PageModule;
	layoutContext: LayoutContext;
	cachingEnabled: boolean;
	streamingEnabled: boolean;
	developmentMode: boolean;
}

export interface LayoutPerformanceMetrics {
	discoveryTime: number;
	dataLoadingTime: number;
	renderingTime: number;
	totalTime: number;
	layoutCount: number;
	cacheHit: boolean;
	memoryUsage?: number;
}

export interface LayoutDebugInfo {
	resolutionChain: string[];
	appliedRules: LayoutRule[];
	skippedLayouts: string[];
	errors: LayoutErrorInfo[];
	metrics: LayoutPerformanceMetrics;
	cacheInfo: {
		hit: boolean;
		key: string;
		size: number;
	};
}

// === Event Type Definitions ===

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

export interface LayoutEventData {
	type: LayoutEventType;
	timestamp: number;
	layoutPath?: string;
	error?: Error;
	metrics?: LayoutPerformanceMetrics;
	data?: Record<string, unknown>;
}

export type LayoutEventHandler = (event: LayoutEventData) => void;

export interface ILayoutEventEmitter {
	on(event: LayoutEventType, handler: LayoutEventHandler): void;
	off(event: LayoutEventType, handler: LayoutEventHandler): void;
	emit(event: LayoutEventType, data?: Record<string, unknown>): void;
	removeAllListeners(): void;
}
