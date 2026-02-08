import { render as preactRenderToString } from 'preact-render-to-string';

import { LayoutDiscovery } from './layout-discovery.ts';
import { LayoutMatcher } from './layout-matcher.ts';
import { LayoutComposer } from './layout-composer.ts';
import { LayoutDataLoader } from './layout-data-loader.ts';
import { LayoutCacheManager, defaultCacheConfig } from './layout-cache-manager.ts';

// NOTE: Using inline types to avoid importing heavy types/layout.ts (which imports schemas/layout.ts with zod)
// This significantly improves cold start time

// deno-lint-ignore no-explicit-any
type ComponentType<P = any> = ((props: P) => any) | (new (props: P) => any);

interface LayoutContext {
	request: Request;
	params: Record<string, string>;
	query: URLSearchParams;
	state: Map<string, unknown>;
	middlewareContext?: unknown;
}

type LayoutData = Record<string, unknown>;

interface LayoutHandler {
	// deno-lint-ignore no-explicit-any
	component: ComponentType<any>;
	// deno-lint-ignore no-explicit-any
	loader?: (ctx: LayoutContext) => Promise<any>;
	path: string;
	priority: number;
}

interface LayoutDiscoveryOptions {
	baseDirectory: string;
	filePattern?: string;
	excludeDirectories?: string[];
	enableWatching?: boolean;
	developmentMode?: boolean;
}

interface ResolvedLayout {
	// deno-lint-ignore no-explicit-any
	handlers: any[];
	// deno-lint-ignore no-explicit-any
	dataLoaders: any[];
	// deno-lint-ignore no-explicit-any
	errorBoundaries: any[];
	// deno-lint-ignore no-explicit-any
	streamingComponents: any[];
	metadata: {
		totalLayouts: number;
		resolutionTime: number;
		cacheHit: boolean;
	};
}

interface LayoutCache {
	resolved: Map<string, ResolvedLayout>;
	handlers: Map<string, LayoutHandler>;
	data: Map<string, LayoutData>;
	ttl: Map<string, number>;
}

interface RouteInfo {
	path: string;
	params: Record<string, string>;
	method: string;
	headers: Headers;
}

interface LayoutConfig {
	skipLayouts?: string[];
	replaceLayout?: boolean;
	onlyLayouts?: string[];
	customLayout?: string;
}

interface LayoutErrorInfo {
	layoutPath: string;
	errorType: 'component' | 'loader' | 'rendering' | 'island';
	timestamp: number;
	componentStack?: string;
	errorBoundary?: string;
}

interface IEnhancedLayoutResolver {
	resolveAndRender(routePath: string, pageModule: PageModule, context: LayoutContext): Promise<ResolvedLayout>;
	getCachedResolution(routePath: string): ResolvedLayout | null;
	clearCache(): void;
	setCaching(enabled: boolean): void;
}

interface LayoutProps {
	children: unknown;
	data: LayoutData;
	frontmatter?: Record<string, unknown>;
	route: {
		path: string;
		params: Record<string, string>;
		query: URLSearchParams;
	};
}

/**
 * Page module interface with optional layout configuration
 */
interface PageModule {
	default: ComponentType<any>;
	layoutConfig?: LayoutConfig;
	loader?: (ctx: any) => Promise<any>;
}

/**
 * Enhanced Layout Resolver Options
 */
export interface EnhancedLayoutResolverOptions extends LayoutDiscoveryOptions {
	enableCaching?: boolean;
	cacheTTL?: number;
	maxCacheSize?: number;
	enableMetrics?: boolean;
	enableDebugInfo?: boolean;
}

/**
 * Simplified Enhanced Layout Resolver
 * Handles: discovery → conditional filtering → composition → data loading → rendering
 */
export class EnhancedLayoutResolver implements IEnhancedLayoutResolver {
	private layoutDiscovery: LayoutDiscovery;
	private layoutMatcher: LayoutMatcher;
	private layoutComposer: LayoutComposer;
	private layoutDataLoader: LayoutDataLoader;
	private cache: LayoutCache;
	private cacheManager: LayoutCacheManager;
	private options: Required<EnhancedLayoutResolverOptions>;

	constructor(options: EnhancedLayoutResolverOptions) {
		this.options = {
			baseDirectory: options.baseDirectory,
			filePattern: options.filePattern || '_layout.tsx',
			excludeDirectories: options.excludeDirectories || ['node_modules', '.git', 'dist'],
			enableWatching: options.enableWatching || false,
			developmentMode: options.developmentMode || false,
			enableCaching: options.enableCaching ?? true,
			cacheTTL: options.cacheTTL || 5 * 60 * 1000,
			maxCacheSize: options.maxCacheSize || 1000,
			enableMetrics: options.enableMetrics ?? true,
			enableDebugInfo: options.enableDebugInfo || false,
		};

		this.layoutDiscovery = new LayoutDiscovery(this.options);
		this.layoutMatcher = new LayoutMatcher({ developmentMode: this.options.developmentMode });
		this.layoutComposer = new LayoutComposer(this.options);
		this.layoutDataLoader = new LayoutDataLoader({
			developmentMode: this.options.developmentMode,
			enableParallelLoading: true,
			continueOnError: true,
		});

		this.cache = {
			resolved: new Map<string, ResolvedLayout>(),
			handlers: new Map<string, LayoutHandler>(),
			data: new Map<string, LayoutData>(),
			ttl: new Map<string, number>(),
		};

		this.cacheManager = new LayoutCacheManager({
			...defaultCacheConfig,
			defaultTtl: this.options.cacheTTL,
			maxEntries: this.options.maxCacheSize,
			enableStats: this.options.enableMetrics,
		});
	}

	/**
	 * Resolve layout chain for a route
	 */
	async resolveLayouts(routePath: string, pageModule: any, context: LayoutContext): Promise<ResolvedLayout> {
		const startTime = performance.now();
		const cacheKey = this.generateCacheKey(routePath, pageModule, context);

		// Check cache first
		if (this.options.enableCaching) {
			const cached = this.cacheManager.getResolvedLayout(cacheKey);
			if (cached) {
				if (this.options.developmentMode) {
					console.log(`[EnhancedLayoutResolver] Cache hit for route: ${routePath}`);
				}
				return { ...cached, metadata: { ...cached.metadata, cacheHit: true } };
			}
		}

		const errors: LayoutErrorInfo[] = [];
		let handlers: LayoutHandler[] = [];

		try {
			// Stage 1: Discovery
			const url = new URL(`http://localhost${routePath}`);
			handlers = await this.layoutDiscovery.buildLayoutChain(url);

			// Stage 2: Conditional Filtering
			const routeInfo: RouteInfo = {
				path: routePath,
				params: context.params,
				method: context.request.method,
				headers: context.request.headers,
			};
			handlers = handlers.filter(h => this.layoutMatcher.shouldApplyLayout(h.path, routeInfo));

			// Stage 3: Composition Control
			handlers = await this.layoutComposer.resolveLayouts(routePath, pageModule);

			// Stage 4: Data Loading
			const loadingResults = await this.layoutDataLoader.loadLayoutData(handlers, context);
			const { errors: loadErrors } = this.layoutDataLoader.processLoadingResults(loadingResults, handlers);
			errors.push(...loadErrors);

		} catch (error) {
			errors.push({ layoutPath: routePath, errorType: 'rendering', timestamp: Date.now() });
			if (this.options.developmentMode) {
				console.warn(`[EnhancedLayoutResolver] Error resolving layouts:`, error);
			}
		}

		const totalTime = performance.now() - startTime;
		const resolvedLayout: ResolvedLayout = {
			handlers,
			dataLoaders: handlers.map(h => h.loader).filter(Boolean),
			errorBoundaries: [],
			streamingComponents: [],
			metadata: { totalLayouts: handlers.length, resolutionTime: totalTime, cacheHit: false },
		};

		// Cache the result
		if (this.options.enableCaching) {
			this.cacheManager.setResolvedLayout(cacheKey, resolvedLayout);
			for (const handler of handlers) {
				this.cacheManager.addDependency(cacheKey, handler.path);
			}
		}

		if (this.options.developmentMode) {
			console.log(`[EnhancedLayoutResolver] Resolved ${handlers.length} layouts for ${routePath} in ${totalTime.toFixed(2)}ms`);
		}

		return resolvedLayout;
	}

	/**
	 * Resolve and render complete layout chain
	 */
	async resolveAndRender(routePath: string, pageModule: any, context: LayoutContext): Promise<ResolvedLayout> {
		const resolvedLayout = await this.resolveLayouts(routePath, pageModule, context);

		if (this.options.developmentMode) {
			console.log(`[EnhancedLayoutResolver] Rendering ${resolvedLayout.handlers.length} layouts for ${routePath}`);
		}

		const loadingResults = await this.layoutDataLoader.loadLayoutData(resolvedLayout.handlers, context);
		const { data } = this.layoutDataLoader.processLoadingResults(loadingResults, resolvedLayout.handlers);

		if (this.options.developmentMode) {
			this.renderLayoutsToString(resolvedLayout, pageModule, context, data);
		}

		return resolvedLayout;
	}

	private renderLayoutsToString(
		resolvedLayout: ResolvedLayout,
		pageModule: any,
		context: LayoutContext,
		layoutData: LayoutData[] = []
	): string {
		try {
			const PageComponent = pageModule.default || (() => null);
			let currentComponent = PageComponent;

			for (let i = resolvedLayout.handlers.length - 1; i >= 0; i--) {
				const handler = resolvedLayout.handlers[i];
				const LayoutComponent = handler.component;
				const previousComponent = currentComponent;
				const layoutDataForThis = layoutData[i] || {};

				currentComponent = (props: any) => {
					return LayoutComponent({
						...props,
						data: layoutDataForThis,
						frontmatter: pageModule.frontmatter,
						children: previousComponent(props),
					});
				};
			}

			return preactRenderToString(
				currentComponent({ url: new URL(context.request.url), params: context.params })
			);
		} catch (error) {
			if (this.options.developmentMode) {
				console.warn('[EnhancedLayoutResolver] Rendering failed:', error);
			}
			return '';
		}
	}

	getCachedResolution(cacheKey: string): ResolvedLayout | null {
		return this.cacheManager.getResolvedLayout(cacheKey);
	}

	invalidateCacheByFilePath(filePath: string): number {
		return this.cacheManager.invalidateByFilePath(filePath);
	}

	clearCache(): void {
		this.cacheManager.clear();
		(this.cache.resolved as Map<string, ResolvedLayout>).clear();
		(this.cache.handlers as Map<string, LayoutHandler>).clear();
		(this.cache.data as Map<string, LayoutData>).clear();
		(this.cache.ttl as Map<string, number>).clear();
		this.layoutDiscovery.clearCache();
		this.layoutComposer.clearCache();
	}

	setCaching(enabled: boolean): void {
		this.options.enableCaching = enabled;
		if (!enabled) this.clearCache();
	}

	private generateCacheKey(routePath: string, pageModule: any, context: LayoutContext): string {
		const pageConfigHash = pageModule.layoutConfig ? JSON.stringify(pageModule.layoutConfig) : '';
		return `${routePath}:${pageConfigHash}:${context.request.method}:${context.request.url}`;
	}

	private getMemoryUsage(): number | undefined {
		if (typeof performance !== 'undefined' && 'memory' in performance) {
			return (performance as any).memory.usedJSHeapSize;
		}
		return undefined;
	}

	getResolverStats() {
		const cacheStats = this.cacheManager.getStats();
		const discoveryStats = this.layoutDiscovery.getCacheStats();
		return {
			cacheSize: cacheStats.totalEntries,
			cacheHitRate: this.cacheManager.getHitRate(),
			totalResolutions: cacheStats.hits + cacheStats.misses,
			averageResolutionTime: 0,
			errorCount: 0,
			cacheStats,
			discoveryStats,
		};
	}

	updateOptions(options: Partial<EnhancedLayoutResolverOptions>): void {
		Object.assign(this.options, options);
		if (options.developmentMode !== undefined) {
			this.layoutDataLoader.updateOptions({ developmentMode: options.developmentMode });
		}
	}

	getOptions(): Required<EnhancedLayoutResolverOptions> {
		return { ...this.options };
	}

	getLayoutDiscovery(): LayoutDiscovery { return this.layoutDiscovery; }
	getLayoutMatcher(): LayoutMatcher { return this.layoutMatcher; }
	getLayoutComposer(): LayoutComposer { return this.layoutComposer; }
	getLayoutDataLoader(): LayoutDataLoader { return this.layoutDataLoader; }
	getCacheManager(): LayoutCacheManager { return this.cacheManager; }

	destroy(): void {
		this.cacheManager.destroy();
	}
}

export function createEnhancedLayoutResolver(options: EnhancedLayoutResolverOptions): EnhancedLayoutResolver {
	return new EnhancedLayoutResolver(options);
}

export const EnhancedLayoutResolverUtils = {
	createBasicConfig(baseDirectory: string, developmentMode = false): EnhancedLayoutResolverOptions {
		return {
			baseDirectory,
			developmentMode,
			enableCaching: true,
			enableMetrics: developmentMode,
			enableDebugInfo: developmentMode,
		};
	},

	createProductionConfig(baseDirectory: string): EnhancedLayoutResolverOptions {
		return {
			baseDirectory,
			developmentMode: false,
			enableCaching: true,
			enableMetrics: false,
			enableDebugInfo: false,
		};
	},
};
