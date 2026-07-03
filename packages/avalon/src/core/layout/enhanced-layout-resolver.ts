import type { ComponentChildren } from "preact";
import { renderShell } from "../../render/shell-engine.ts";
import { defaultCacheConfig, LayoutCacheManager } from "./layout-cache-manager.ts";
import { LayoutComposer } from "./layout-composer.ts";
import { LayoutDataLoader } from "./layout-data-loader.ts";
import { LayoutDiscovery } from "./layout-discovery.ts";
import { LayoutMatcher } from "./layout-matcher.ts";
import type {
	ComponentType,
	LayoutCache,
	LayoutContext,
	LayoutData,
	LayoutDiscoveryOptions,
	LayoutErrorInfo,
	LayoutHandler,
	LayoutProps,
	PageModule,
	ResolvedLayout,
} from "./layout-types.ts";

/**
 * Call a ComponentType as a plain function regardless of whether
 * it's a class constructor or a function component.
 */
function callComponent<P>(component: ComponentType<P>, props: P): unknown {
	return (component as (props: P) => unknown)(props);
}

interface IEnhancedLayoutResolver {
	resolveAndRender(
		routePath: string,
		pageModule: PageModule,
		context: LayoutContext,
	): Promise<ResolvedLayout>;
	getCachedResolution(routePath: string): ResolvedLayout | null;
	clearCache(): void;
	setCaching(enabled: boolean): void;
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
	private readonly layoutDiscovery: LayoutDiscovery;
	private readonly layoutMatcher: LayoutMatcher;
	private readonly layoutComposer: LayoutComposer;
	private readonly layoutDataLoader: LayoutDataLoader;
	private readonly cache: LayoutCache;
	private readonly cacheManager: LayoutCacheManager;
	private readonly options: Required<EnhancedLayoutResolverOptions>;

	constructor(options: EnhancedLayoutResolverOptions) {
		this.options = {
			baseDirectory: options.baseDirectory,
			filePattern: options.filePattern || "_layout.tsx",
			excludeDirectories: options.excludeDirectories || ["node_modules", ".git", "dist"],
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
	async resolveLayouts(
		routePath: string,
		pageModule: PageModule,
		context: LayoutContext,
	): Promise<ResolvedLayout> {
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
			// Stage 1–3: Composition Control (subsumes discovery + filtering)
			handlers = await this.layoutComposer.resolveLayouts(routePath, pageModule);

			// Stage 4: Data Loading
			const loadingResults = await this.layoutDataLoader.loadLayoutData(handlers, context);
			const { errors: loadErrors } = this.layoutDataLoader.processLoadingResults(
				loadingResults,
				handlers,
			);
			errors.push(...loadErrors);
		} catch (error) {
			errors.push({ layoutPath: routePath, errorType: "rendering", timestamp: Date.now() });
			if (this.options.developmentMode) {
				console.warn(`[EnhancedLayoutResolver] Error resolving layouts:`, error);
			}
		}

		const totalTime = performance.now() - startTime;
		const resolvedLayout: ResolvedLayout = {
			handlers,
			dataLoaders: handlers
				.map((h) => h.loader)
				.filter((l): l is (ctx: LayoutContext) => Promise<LayoutData> => l !== undefined),
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
			if (errors.length > 0) {
				console.warn(
					`[EnhancedLayoutResolver] ${errors.length} error(s) during layout resolution for ${routePath}`,
				);
			}
			console.log(
				`[EnhancedLayoutResolver] Resolved ${handlers.length} layouts for ${routePath} in ${totalTime.toFixed(2)}ms`,
			);
		}

		return resolvedLayout;
	}

	/**
	 * Resolve and render complete layout chain
	 */
	async resolveAndRender(
		routePath: string,
		pageModule: PageModule,
		context: LayoutContext,
	): Promise<ResolvedLayout> {
		const resolvedLayout = await this.resolveLayouts(routePath, pageModule, context);

		if (this.options.developmentMode) {
			console.log(
				`[EnhancedLayoutResolver] Rendering ${resolvedLayout.handlers.length} layouts for ${routePath}`,
			);
		}

		const loadingResults = await this.layoutDataLoader.loadLayoutData(
			resolvedLayout.handlers,
			context,
		);
		const { data } = this.layoutDataLoader.processLoadingResults(
			loadingResults,
			resolvedLayout.handlers,
		);

		if (this.options.developmentMode) {
			this.renderLayoutsToString(resolvedLayout, pageModule, context, data);
		}

		return resolvedLayout;
	}

	private renderLayoutsToString(
		resolvedLayout: ResolvedLayout,
		pageModule: PageModule,
		context: LayoutContext,
		layoutData: LayoutData[] = [],
	): string {
		try {
			const PageComponent = (pageModule.default ??
				(() => null)) as unknown as ComponentType<LayoutProps>;
			let currentComponent: ComponentType<LayoutProps> = PageComponent;

			for (let i = resolvedLayout.handlers.length - 1; i >= 0; i--) {
				const handler = resolvedLayout.handlers[i];
				const LayoutComponent = handler.component;
				const previousComponent = currentComponent;
				const layoutDataForThis: LayoutData = layoutData[i] || {};

				currentComponent = (props: LayoutProps) =>
					callComponent(LayoutComponent, {
						...props,
						data: layoutDataForThis,
						frontmatter: pageModule.frontmatter,
						children: callComponent(previousComponent, props) as ComponentChildren,
					});
			}

			return renderShell(
				callComponent(currentComponent, {
					children: null,
					data: {},
					route: {
						path: new URL(context.request.url).pathname,
						params: context.params,
						query: context.query,
					},
				}),
			);
		} catch (error) {
			if (this.options.developmentMode) {
				console.warn("[EnhancedLayoutResolver] Rendering failed:", error);
			}
			return "";
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
		this.cache.resolved.clear();
		this.cache.handlers.clear();
		this.cache.data.clear();
		this.cache.ttl.clear();
		this.layoutDiscovery.clearCache();
		this.layoutComposer.clearCache();
	}

	setCaching(enabled: boolean): void {
		this.options.enableCaching = enabled;
		if (!enabled) this.clearCache();
	}

	private generateCacheKey(
		routePath: string,
		pageModule: PageModule,
		context: LayoutContext,
	): string {
		const pageConfigHash = pageModule.layoutConfig ? JSON.stringify(pageModule.layoutConfig) : "";
		return `${routePath}:${pageConfigHash}:${context.request.method}:${context.request.url}`;
	}

	getResolverStats(): {
		cacheSize: number;
		cacheHitRate: number;
		totalResolutions: number;
		averageResolutionTime: number;
		errorCount: number;
		cacheStats: ReturnType<LayoutCacheManager["getStats"]>;
		discoveryStats: ReturnType<LayoutDiscovery["getCacheStats"]>;
	} {
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

	getLayoutDiscovery(): LayoutDiscovery {
		return this.layoutDiscovery;
	}
	getLayoutMatcher(): LayoutMatcher {
		return this.layoutMatcher;
	}
	getLayoutComposer(): LayoutComposer {
		return this.layoutComposer;
	}
	getLayoutDataLoader(): LayoutDataLoader {
		return this.layoutDataLoader;
	}
	getCacheManager(): LayoutCacheManager {
		return this.cacheManager;
	}

	destroy(): void {
		this.cacheManager.destroy();
	}
}

export function createEnhancedLayoutResolver(
	options: EnhancedLayoutResolverOptions,
): EnhancedLayoutResolver {
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
