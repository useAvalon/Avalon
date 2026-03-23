import type { ComponentChildren, ComponentType } from "preact";
import type {
	ErrorRecoveryStrategy,
	IslandState,
	LayoutConfig,
	LayoutContext,
	LayoutDiscoveryOptions,
	LayoutErrorBoundaryProps,
	LayoutErrorInfo,
	LayoutHandler,
	LayoutLoader,
	LayoutProps,
	LayoutRoute,
	LayoutRule,
	PersistentIslandProps,
	ResolvedLayout,
	RouteInfo,
	StreamingComponent,
	StreamingLayoutProps,
} from "../schemas/layout.ts";

export type { ComponentChildren, ComponentType } from "preact";
// Export enhanced layout resolver
export {
	createEnhancedLayoutResolver,
	EnhancedLayoutResolver,
	type EnhancedLayoutResolverOptions,
	EnhancedLayoutResolverUtils,
} from "../core/layout/enhanced-layout-resolver.ts";
// Export only essential layout cache types (no debug/performance tooling)
export {
	type CacheConfig,
	type CacheEntry,
	type CacheStats,
	LayoutCacheManager,
} from "../core/layout/layout-cache-manager.ts";
export { LayoutComposer } from "../core/layout/layout-composer.ts";
export { LayoutDataLoader } from "../core/layout/layout-data-loader.ts";
// Import concrete implementations
export { LayoutDiscovery } from "../core/layout/layout-discovery.ts";
export { LayoutMatcher as LayoutMatcherClass } from "../core/layout/layout-matcher.ts";
export type {
	EnhancedLayoutContext,
	ErrorRecoveryStrategy,
	IslandState,
	IslandStateClearer,
	IslandStateLoader,
	IslandStateSaver,
	LayoutCache,
	LayoutConfig,
	LayoutContext,
	LayoutData,
	LayoutDiscoveryOptions,
	LayoutErrorBoundaryProps,
	LayoutErrorHandler,
	LayoutErrorInfo,
	LayoutFallbackRenderer,
	LayoutHandler,
	LayoutLoader,
	LayoutMatcherFunction,
	LayoutProps,
	LayoutRetryFunction,
	LayoutRoute,
	LayoutRule,
	PersistentIslandContext,
	PersistentIslandProps,
	ResolvedLayout,
	RouteInfo,
	StreamingComponent,
	StreamingLayoutProps,
	StreamingReadyCheck,
} from "../schemas/layout.ts";

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
	resolveAndRender(
		routePath: string,
		pageModule: PageModule,
		context: LayoutContext,
	): Promise<ResolvedLayout>;
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
	| "layout-discovered"
	| "layout-loaded"
	| "layout-rendered"
	| "layout-error"
	| "layout-cached"
	| "island-state-saved"
	| "island-state-loaded"
	| "streaming-started"
	| "streaming-completed";

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
