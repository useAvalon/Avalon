/**
 * Advanced Layout System - TypeScript Declarations
 *
 * This file provides comprehensive TypeScript declarations for the layout system,
 * ensuring proper type checking and IntelliSense support.
 */

import type { ComponentType, ComponentChildren } from 'preact';
import type { Component } from 'preact';

// === Core Layout Types ===

export interface LayoutContext {
	request: Request;
	params: Record<string, string>;
	query: URLSearchParams;
	state: Map<string, unknown>;
	middlewareContext?: any;
}

export interface LayoutData {
	[key: string]: unknown;
}

export interface LayoutRoute {
	pattern: URLPattern;
	layoutPath: string;
	priority: number;
	type: 'root' | 'nested';
	depth: number;
}

export interface LayoutHandler {
	component: ComponentType<LayoutProps>;
	loader?: LayoutLoader;
	path: string;
	priority: number;
}

export interface LayoutProps {
	children: ComponentChildren;
	data: LayoutData;
	route: {
		path: string;
		params: Record<string, string>;
		query: URLSearchParams;
	};
}

export interface LayoutDiscoveryOptions {
	baseDirectory: string;
	filePattern?: string;
	excludeDirectories?: string[];
	enableWatching?: boolean;
	developmentMode?: boolean;
}

export interface RouteInfo {
	path: string;
	params: Record<string, string>;
	method: string;
	headers: Headers;
}

export interface LayoutRule {
	matches: (layoutPath: string, route: RouteInfo) => boolean;
	apply: boolean;
	priority: number;
}

export interface LayoutConfig {
	skipLayouts?: string[];
	replaceLayout?: boolean;
	onlyLayouts?: string[];
	customLayout?: string;
}

// === Function Types ===

export type LayoutLoader = (ctx: LayoutContext) => Promise<LayoutData>;
export type LayoutMatcher = (layoutPath: string, route: RouteInfo) => boolean;
export type LayoutErrorHandler = (error: Error, errorInfo: LayoutErrorInfo) => void;
export type LayoutRetryFunction = () => void;
export type LayoutFallbackRenderer = (error: Error, retry: LayoutRetryFunction) => ComponentChildren;

// === Persistent Islands Types ===

export interface IslandState {
	[key: string]: unknown;
}

export interface PersistentIslandProps {
	persistentId: string;
	children: ComponentChildren;
}

export interface PersistentIslandContext {
	saveState: (state: IslandState) => void;
	loadState: () => IslandState | null;
	clearState: () => void;
}

export type IslandStateSaver = (state: IslandState) => void;
export type IslandStateLoader = () => IslandState | null;
export type IslandStateClearer = () => void;

// === Error Boundary Types ===

export interface LayoutErrorInfo {
	layoutPath: string;
	errorType: 'component' | 'loader' | 'rendering' | 'island';
	timestamp: number;
	componentStack?: string;
	errorBoundary?: string;
}

export interface LayoutErrorBoundaryProps {
	children: ComponentChildren;
	fallback?: (error: Error, retry: () => void) => ComponentChildren;
	onError?: (error: Error, errorInfo: LayoutErrorInfo) => void;
	recoveryStrategy?: ErrorRecoveryStrategy;
	layoutPath?: string;
	errorType?: 'component' | 'loader' | 'rendering' | 'island';
}

export interface ErrorRecoveryStrategy {
	type: 'retry' | 'fallback' | 'skip' | 'redirect';
	maxRetries?: number;
	fallbackComponent?: ComponentType;
	redirectUrl?: string;
}

// === Streaming Types ===

export interface StreamingLayoutProps {
	children: ComponentChildren;
	fallback?: ComponentChildren;
	priority?: 'high' | 'medium' | 'low';
}

export interface StreamingComponent {
	component: ComponentType;
	fallback: ComponentType;
	priority: number;
	isReady: () => Promise<boolean>;
}

export type StreamingReadyCheck = () => Promise<boolean>;

// === Resolution Types ===

export interface ResolvedLayout {
	handlers: LayoutHandler[];
	dataLoaders: LayoutLoader[];
	errorBoundaries: any[];
	streamingComponents: StreamingComponent[];
	metadata: {
		totalLayouts: number;
		resolutionTime: number;
		cacheHit: boolean;
	};
}

export interface LayoutCache {
	resolved: Map<string, ResolvedLayout>;
	handlers: Map<string, LayoutHandler>;
	data: Map<string, LayoutData>;
	ttl: Map<string, number>;
}

export interface EnhancedLayoutContext extends LayoutContext {
	layouts: LayoutHandler[];
	parentData: LayoutData[];
	islandStates: Map<string, IslandState>;
	streamingEnabled: boolean;
	errorBoundaries: any[];
}

// === Interface Definitions ===

export interface ILayoutDiscovery {
	discoverLayouts(routePath: string): Promise<LayoutRoute[]>;
	buildLayoutChain(url: URL): Promise<LayoutHandler[]>;
	setWatching(enabled: boolean): void;
	getOptions(): LayoutDiscoveryOptions;
}

export interface ILayoutMatcher {
	addRule(rule: LayoutRule): void;
	removeRule(rule: LayoutRule): void;
	shouldApplyLayout(layoutPath: string, route: RouteInfo): boolean;
	getRules(): LayoutRule[];
	clearRules(): void;
}

export interface ILayoutComposer {
	resolveLayouts(routePath: string, pageModule: any): Promise<LayoutHandler[]>;
	applyConfiguration(layouts: LayoutHandler[], config: LayoutConfig): Promise<LayoutHandler[]>;
	validateLayoutConfig(config: LayoutConfig): { valid: boolean; errors: string[] };
	clearCache(): void;
	getCompositionStats(): {
		customLayoutCacheSize: number;
		discoveryStats: { layoutCount: number; routeCacheCount: number };
	};
}

export interface IIslandPersistence {
	saveState(id: string, state: IslandState): void;
	loadState(id: string): IslandState | null;
	clearState(id: string): void;
	hasState(id: string): boolean;
	getStoredIds(): string[];
	clearAllStates(): void;
}

export interface ILayoutErrorRecovery {
	handleLayoutError(error: Error, context: LayoutContext): Promise<Response>;
	registerStrategy(errorType: string, strategy: ErrorRecoveryStrategy): void;
	getStrategy(error: Error): ErrorRecoveryStrategy | null;
}

export interface ILayoutStreaming {
	renderWithStreaming(layout: LayoutHandler, props: LayoutProps): Promise<ReadableStream>;
	isStreamingSupported(): boolean;
	createStreamingResponse(components: StreamingComponent[]): ReadableStream;
	generateSkeleton(component: StreamingComponent): string;
}

export interface IEnhancedLayoutResolver {
	resolveAndRender(routePath: string, pageModule: any, context: LayoutContext): Promise<ResolvedLayout>;
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

export interface ILayoutErrorBoundaryComponent extends Component<LayoutErrorBoundaryProps> {
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
	default: ComponentType<any>;
	layoutConfig?: LayoutConfig;
	loader?: (ctx: any) => Promise<any>;
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
	data?: any;
}

export type LayoutEventHandler = (event: LayoutEventData) => void;

export interface ILayoutEventEmitter {
	on(event: LayoutEventType, handler: LayoutEventHandler): void;
	off(event: LayoutEventType, handler: LayoutEventHandler): void;
	emit(event: LayoutEventType, data?: any): void;
	removeAllListeners(): void;
}

// === Utility Types ===

export interface LayoutUtilitiesConfig {
	cache?: CacheConfig;
	debug?: DebugConfig;
	performance?: PerformanceConfig;
	validation?: ValidationConfig;
}

export interface CacheConfig {
	maxSize?: number;
	ttl?: number;
	cleanupInterval?: number;
}

export interface DebugConfig {
	enabled?: boolean;
	logLevel?: 'error' | 'warn' | 'info' | 'debug';
	includeStackTrace?: boolean;
}

export interface PerformanceConfig {
	monitoring?: boolean;
	thresholds?: PerformanceThresholds;
	alerting?: boolean;
}

export interface ValidationConfig {
	strict?: boolean;
	warnings?: boolean;
	customRules?: ValidationRule[];
}

export interface PerformanceThresholds {
	discoveryTime?: number;
	dataLoadingTime?: number;
	renderingTime?: number;
	totalTime?: number;
}

export interface ValidationRule {
	name: string;
	validate: (config: any) => ValidationResult;
}

export interface ValidationResult {
	isValid: boolean;
	errors: ValidationError[];
	warnings: ValidationWarning[];
}

export interface ValidationError {
	field: string;
	message: string;
	code: string;
}

export interface ValidationWarning {
	field: string;
	message: string;
	code: string;
}

// === Class Declarations ===

export declare class LayoutDiscovery implements ILayoutDiscovery {
	constructor(options: LayoutDiscoveryOptions);
	discoverLayouts(routePath: string): Promise<LayoutRoute[]>;
	buildLayoutChain(url: URL): Promise<LayoutHandler[]>;
	setWatching(enabled: boolean): void;
	getOptions(): LayoutDiscoveryOptions;
}

export declare class LayoutMatcher implements ILayoutMatcher {
	constructor();
	addRule(rule: LayoutRule): void;
	removeRule(rule: LayoutRule): void;
	shouldApplyLayout(layoutPath: string, route: RouteInfo): boolean;
	getRules(): LayoutRule[];
	clearRules(): void;
}

export declare class LayoutComposer implements ILayoutComposer {
	constructor();
	resolveLayouts(routePath: string, pageModule: any): Promise<LayoutHandler[]>;
	applyConfiguration(layouts: LayoutHandler[], config: LayoutConfig): Promise<LayoutHandler[]>;
	validateLayoutConfig(config: LayoutConfig): { valid: boolean; errors: string[] };
	clearCache(): void;
	getCompositionStats(): {
		customLayoutCacheSize: number;
		discoveryStats: { layoutCount: number; routeCacheCount: number };
	};
}

export declare class IslandPersistence implements IIslandPersistence {
	constructor();
	saveState(id: string, state: IslandState): void;
	loadState(id: string): IslandState | null;
	clearState(id: string): void;
	hasState(id: string): boolean;
	getStoredIds(): string[];
	clearAllStates(): void;
}

export declare class LayoutErrorRecovery implements ILayoutErrorRecovery {
	constructor();
	handleLayoutError(error: Error, context: LayoutContext): Promise<Response>;
	registerStrategy(errorType: string, strategy: ErrorRecoveryStrategy): void;
	getStrategy(error: Error): ErrorRecoveryStrategy | null;
}

export declare class LayoutStreaming implements ILayoutStreaming {
	constructor();
	renderWithStreaming(layout: LayoutHandler, props: LayoutProps): Promise<ReadableStream>;
	isStreamingSupported(): boolean;
	createStreamingResponse(components: StreamingComponent[]): ReadableStream;
	generateSkeleton(component: StreamingComponent): string;
}

export declare class EnhancedLayoutResolver implements IEnhancedLayoutResolver {
	constructor(options?: any);
	resolveAndRender(routePath: string, pageModule: any, context: LayoutContext): Promise<ResolvedLayout>;
	getCachedResolution(routePath: string): ResolvedLayout | null;
	clearCache(): void;
	setCaching(enabled: boolean): void;
}

// === Component Declarations ===

export declare class LayoutErrorBoundary
	extends Component<LayoutErrorBoundaryProps>
	implements ILayoutErrorBoundaryComponent
{
	constructor(props: LayoutErrorBoundaryProps);
	handleRetry(): void;
	getErrorState(): { hasError: boolean; error?: Error };
	resetErrorState(): void;
}

export declare class PersistentIsland extends Component<PersistentIslandProps> implements IPersistentIslandComponent {
	constructor(props: PersistentIslandProps);
	saveState(): void;
	loadState(): void;
	clearState(): void;
	hasState(): boolean;
}

export declare function StreamingLayout(props: StreamingLayoutProps): ComponentChildren;

// === Factory Functions ===

export declare function createEnhancedLayoutResolver(options?: any): EnhancedLayoutResolver;
export declare function createLayoutDataLoader(options?: any): any;
export declare function createLayoutUtilities(config?: LayoutUtilitiesConfig): any;
export declare function createPersistentIslandContext(persistentId: string, persistence?: any): PersistentIslandContext;

// === Hook Declarations ===

export declare function usePersistentIslandContext(): PersistentIslandContext;
export declare function useStreamingState(): any;

// === Utility Functions ===

export declare function validateLayoutConfiguration(config: LayoutConfig): ValidationResult;
export declare function getLayoutSystemHealthReport(): any;
export declare function withLayoutUtilities(component: ComponentType): ComponentType;
export declare function withStreaming(component: ComponentType): ComponentType;
export declare function withIslandErrorBoundary(component: ComponentType): ComponentType;

// === Constants ===

export declare const LAYOUT_SYSTEM_VERSION: string;
export declare const LAYOUT_SYSTEM_FEATURES: {
	readonly DISCOVERY: true;
	readonly DATA_LOADING: true;
	readonly CONDITIONAL_RENDERING: true;
	readonly COMPOSITION_CONTROL: true;
	readonly PERSISTENT_ISLANDS: true;
	readonly ERROR_BOUNDARIES: true;
	readonly STREAMING: true;
	readonly CACHING: true;
	readonly PERFORMANCE_MONITORING: true;
	readonly DEBUG_UTILITIES: true;
};

export declare const LAYOUT_SYSTEM_DEFAULTS: {
	readonly DISCOVERY: {
		readonly baseDirectory: 'src/pages';
		readonly filePattern: '_layout.tsx';
		readonly excludeDirectories: readonly ['node_modules', '.git', 'dist'];
		readonly enableWatching: false;
		readonly developmentMode: false;
	};
	readonly CACHING: {
		readonly enabled: true;
		readonly ttl: 300000;
		readonly maxSize: 100;
		readonly cleanupInterval: 60000;
	};
	readonly STREAMING: {
		readonly enabled: true;
		readonly priority: 'medium';
		readonly timeout: 5000;
	};
	readonly ERROR_BOUNDARIES: {
		readonly enabled: true;
		readonly maxRetries: 3;
		readonly fallbackStrategy: 'component';
	};
	readonly PERFORMANCE: {
		readonly monitoring: true;
		readonly thresholds: {
			readonly discoveryTime: 100;
			readonly dataLoadingTime: 500;
			readonly renderingTime: 200;
			readonly totalTime: 1000;
		};
	};
};

// === Default Instances ===

export declare const defaultLayoutSystem: EnhancedLayoutResolver;
export declare const defaultPersistence: IslandPersistence;
export declare const defaultUtilities: any;

// === Convenience Aliases ===

export { EnhancedLayoutResolver as LayoutSystem };
export { createEnhancedLayoutResolver as createLayoutSystem };
