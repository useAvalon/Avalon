/**
 * Nitro Integration Module for Avalon
 *
 * This module provides the Nitro server runtime integration for Avalon,
 * enabling universal deployment through Nitro presets while maintaining
 * Avalon's multi-framework SSR and islands architecture.
 */

// Configuration exports
export {
  createNitroConfig,
  isValidPreset,
  mergeRouteRules,
  createDefaultStaticAssetRouteRules,
  DEFAULT_NITRO_CONFIG,
  DEFAULT_STATIC_ASSETS_CONFIG,
  type AvalonNitroConfig,
  type CacheOptions,
  type RouteRule,
  type NitroConfigOutput,
  type AvalonRuntimeConfig,
  type StaticAssetsConfig,
} from "./config.ts";

// Type exports
export {
  // Core types
  type H3Event,
  type NitroRenderContext,
  type LayoutContext,
  type DiscoveredRoute,
  type NitroRouteConfig,
  type SSRRenderOptions,
  type SSRRenderResult,
  type NitroApiContext,
  type AvalonEventContext,

  // Island types
  type IslandEntry,
  type IslandManifest,

  // Page types
  type PageModule,
  type PageMetadata,

  // Error types
  type ErrorResponse,
  HttpError,
  isHttpError,
  createNotFoundError,
  createMethodNotAllowedError,
  createInternalError,

  // Options types
  type DevServerOptions,
  type BuildOptions,
} from "./types.ts";

// Renderer exports
export {
  createNitroRenderer,
  createNitroCatchAllRenderer,
  createRenderContext,
  renderPage,
  renderPageStream,
  createStreamingResponse,
  injectHydrationScript,
  validateHydrationMarkers,
  extractIslandMarkers,
  ensureHydrationMarkers,
  processHydrationRequirements,
  createErrorResponse,
  getRequestURL as getRendererRequestURL,
  toRequest as rendererToRequest,
  setResponseHeader,
  type RenderHandlerOptions,
  type ResolvedPageRoute,
  type StreamingSSROptions,
  type IslandMarker,
  type NitroCatchAllOptions,
} from "./renderer.ts";

// Middleware Adapter exports
export {
  createMiddlewareContext,
  storeMiddlewareContext,
  getMiddlewareContext,
  getOrCreateMiddlewareContext,
  setMiddlewareState,
  getMiddlewareState,
  setMiddlewareLocal,
  getMiddlewareLocal,
  hasAvalonContext,
  ensureAvalonContext,
  getRequestURL as getMiddlewareRequestURL,
  getRequestHeaders as getMiddlewareRequestHeaders,
  toRequest as middlewareToRequest,
  getRouterParams as getMiddlewareRouterParams,
  type MiddlewareContextOptions,
} from "./middleware-adapter.ts";

// Route Discovery exports
// NOTE: API routes are now auto-discovered by Nitro from the api/ directory.
// Only page discovery is needed for SSR rendering of page components.
export {
  discoverPageRoutes,
  filePathToPattern,
  isPrivateFile,
  calculateRouteSpecificity,
  sortRoutesBySpecificity,
  validateRoutePattern,
  extractParamsFromPattern,
  matchRoutePattern,
  PAGE_EXTENSIONS,
  type PageDiscoveryOptions,
  type FilePathPatternResult,
} from "./route-discovery.ts";

// Build Configuration exports
export {
  createClientBuildConfig,
  createServerBuildConfig,
  createCombinedBuildConfig,
  createNitroBuildPlugin,
  getPresetOutputConfig,
  presetSupportsStreaming,
  validateBuildConfig,
  createSourceMapConfig,
  createSourceMapPlugin,
  getViteSourceMapOption,
  DEFAULT_BUILD_CONFIG,
  DEFAULT_SOURCEMAP_CONFIG,
  PRESET_OUTPUT_CONFIGS,
  type BuildMode,
  type PresetOutputConfig,
  type AvalonBuildConfig,
  type SourceMapConfig,
} from "./build-config.ts";

// Island Manifest exports
export {
  createIslandManifestPlugin,
  createIslandEntry,
  detectIslandFramework,
  generateContentHash,
  extractIslandDependencies,
  generatePreloadHints,
  generatePreloadTags,
  loadIslandManifest,
  getIslandAssetPath,
  getPageCssAssets,
  DEFAULT_MANIFEST_OPTIONS,
  type BuildIslandEntry,
  type BuildIslandManifest,
  type PreloadHint,
  type IslandManifestOptions,
  type AssetMetadata,
} from "./island-manifest.ts";

// Error Handler exports
export {
  discoverErrorPages,
  getErrorPageModule,
  renderErrorPage,
  generateDefaultErrorPage,
  createErrorPageProps,
  clearErrorPageCache,
  handleRenderError,
  handleApiError,
  handleNotFound,
  handleInternalError,
  type ErrorPageProps,
  type ErrorHandlerOptions,
} from "./error-handler.ts";
