/**
 * Nitro Integration Module for Avalon
 *
 * This module provides the Nitro server runtime integration for Avalon,
 * enabling universal deployment through Nitro presets while maintaining
 * Avalon's multi-framework SSR and islands architecture.
 */

// Build Configuration exports
export {
	type AvalonBuildConfig,
	type BuildMode,
	createClientBuildConfig,
	createCombinedBuildConfig,
	createNitroBuildPlugin,
	createServerBuildConfig,
	createSourceMapConfig,
	createSourceMapPlugin,
	DEFAULT_BUILD_CONFIG,
	DEFAULT_SOURCEMAP_CONFIG,
	getPresetOutputConfig,
	getViteSourceMapOption,
	PRESET_OUTPUT_CONFIGS,
	type PresetOutputConfig,
	presetSupportsStreaming,
	type SourceMapConfig,
	validateBuildConfig,
} from "./build-config.ts";
// Configuration exports
export {
	type AvalonNitroConfig,
	type AvalonRuntimeConfig,
	type CacheOptions,
	createDefaultStaticAssetRouteRules,
	createNitroConfig,
	DEFAULT_NITRO_CONFIG,
	DEFAULT_STATIC_ASSETS_CONFIG,
	isValidPreset,
	mergeRouteRules,
	type NitroConfigOutput,
	type RouteRule,
	type StaticAssetsConfig,
} from "./config.ts";
// Error Handler exports
export {
	clearErrorPageCache,
	createErrorPageProps,
	discoverErrorPages,
	type ErrorHandlerOptions,
	type ErrorPageProps,
	generateDefaultErrorPage,
	getErrorPageModule,
	handleApiError,
	handleInternalError,
	handleNotFound,
	handleRenderError,
	renderErrorPage,
} from "./error-handler.ts";
// Island Manifest exports
export {
	type AssetMetadata,
	type BuildIslandEntry,
	type BuildIslandManifest,
	createIslandEntry,
	createIslandManifestPlugin,
	DEFAULT_MANIFEST_OPTIONS,
	detectIslandFramework,
	extractIslandDependencies,
	generateContentHash,
	generatePreloadHints,
	generatePreloadTags,
	getIslandAssetPath,
	getPageCssAssets,
	type IslandManifestOptions,
	loadIslandManifest,
	type PreloadHint,
} from "./island-manifest.ts";
// Middleware Adapter exports
export {
	createMiddlewareContext,
	ensureAvalonContext,
	getMiddlewareContext,
	getMiddlewareLocal,
	getMiddlewareState,
	getOrCreateMiddlewareContext,
	getRequestHeaders as getMiddlewareRequestHeaders,
	getRequestURL as getMiddlewareRequestURL,
	getRouterParams as getMiddlewareRouterParams,
	hasAvalonContext,
	type MiddlewareContextOptions,
	setMiddlewareLocal,
	setMiddlewareState,
	storeMiddlewareContext,
	toRequest as middlewareToRequest,
} from "./middleware-adapter.ts";
// Renderer exports
export {
	createErrorResponse,
	createNitroCatchAllRenderer,
	createNitroRenderer,
	createRenderContext,
	createStreamingResponse,
	ensureHydrationMarkers,
	extractIslandMarkers,
	getRequestURL as getRendererRequestURL,
	type IslandMarker,
	injectHydrationScript,
	type NitroCatchAllOptions,
	processHydrationRequirements,
	type RenderHandlerOptions,
	type ResolvedPageRoute,
	renderPage,
	renderPageStream,
	type StreamingSSROptions,
	setResponseHeader,
	toRequest as rendererToRequest,
	validateHydrationMarkers,
} from "./renderer.ts";
// Route Discovery exports
// NOTE: API routes are now auto-discovered by Nitro from the api/ directory.
// Only page discovery is needed for SSR rendering of page components.
export {
	calculateRouteSpecificity,
	discoverPageRoutes,
	extractParamsFromPattern,
	type FilePathPatternResult,
	filePathToPattern,
	isPrivateFile,
	matchRoutePattern,
	PAGE_EXTENSIONS,
	type PageDiscoveryOptions,
	sortRoutesBySpecificity,
	validateRoutePattern,
} from "./route-discovery.ts";
// Type exports
export {
	type AvalonEventContext,
	type BuildOptions,
	createInternalError,
	createMethodNotAllowedError,
	createNotFoundError,
	// Options types
	type DevServerOptions,
	type DiscoveredRoute,
	// Error types
	type ErrorResponse,
	// Core types
	type H3Event,
	HttpError,
	// Island types
	type IslandEntry,
	type IslandManifest,
	isHttpError,
	type LayoutContext,
	type NitroRenderContext,
	type NitroRouteConfig,
	type PageMetadata,
	// Page types
	type PageModule,
	type SSRRenderOptions,
	type SSRRenderResult,
} from "./types.ts";
