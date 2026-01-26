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

// Static assets exports
export {
  serveStaticAsset,
  createStaticAssetHandler,
  createStaticAssetRouteRules,
  resolveStaticAsset,
  getMimeType,
  getExtension,
  isImmutableAsset,
  getCacheControl,
  parseAcceptEncoding,
  findCompressedFile,
  generateETag,
  shouldReturn304,
  createStaticAssetHeaders,
  MIME_TYPES,
  COMPRESSION_ENCODINGS,
  DEFAULT_STATIC_ASSET_CONFIG,
  type StaticAssetConfig,
  type ResolvedStaticAsset,
} from "./static-assets.ts";

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
} from "./renderer.ts";

// API Handler exports
export {
  createApiHandler,
  createApiContext,
  createApiErrorResponse,
  handleApiResponse,
  getAllowedMethods,
  getRequestURL,
  getRequestHeaders,
  toRequest,
  getRouterParams,
  getQuery,
  isValidApiMethod,
  extractParamNames,
  filePathToRoutePattern,
  matchRoutePattern as matchApiRoutePattern,
  type CreateApiHandlerOptions,
} from "./api-handler.ts";

// Middleware Adapter exports
export {
  createMiddlewareHandler,
  createCombinedMiddlewareHandler,
  createMiddlewareContext,
  storeMiddlewareContext,
  getMiddlewareContext,
  executeMiddlewareChain,
  createMiddlewareErrorResponse,
  withMiddleware,
  isMiddlewareHandler,
  validateMiddlewareChain,
  getRequestURL as getMiddlewareRequestURL,
  getRequestHeaders as getMiddlewareRequestHeaders,
  toRequest as middlewareToRequest,
  getRouterParams as getMiddlewareRouterParams,
  type CreateMiddlewareHandlerOptions,
  type NitroMiddlewareResult,
} from "./middleware-adapter.ts";

// Route Discovery exports
export {
  discoverRoutes,
  discoverPageRoutes,
  discoverApiRoutes,
  filePathToPattern,
  filePathToApiPattern,
  isPrivateFile,
  isMiddlewareFile,
  calculateRouteSpecificity,
  sortRoutesBySpecificity,
  validateRoutePattern,
  extractParamsFromPattern,
  matchRoutePattern,
  PAGE_EXTENSIONS,
  API_EXTENSIONS,
  VALID_HTTP_METHODS,
  type RouteDiscoveryOptions,
  type FilePathPatternResult,
  type ApiFilePathPatternResult,
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
} from "./island-manifest.ts";

// Runtime Configuration exports
export {
  useRuntimeConfig,
  setRuntimeConfig,
  resetRuntimeConfig,
  getRuntimeConfigValue,
  applyEnvOverrides,
  envKeyToConfigKey,
  configKeyToEnvKey,
  parseEnvValue,
  setNestedValue,
  getNestedValue,
  deepClone,
  getEnvironmentVariables,
  createDefaultRuntimeConfig,
  validateRuntimeConfig,
  mergeRuntimeConfigs,
  initializeRuntimeConfig,
  isRuntimeConfigInitialized,
  NITRO_ENV_PREFIX,
  NITRO_PUBLIC_ENV_PREFIX,
  type RuntimeConfig,
} from "./runtime-config.ts";
