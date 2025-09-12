// === Core Avalon + Vite Architecture ===

// Main exports
export { renderToHtml } from './src/render/ssr.ts';
export { createServer, createServerSafe } from './src/render/server.ts';

// Universal Island component (replaces all framework-specific components)
export {
	default as Island,
	renderPreactIsland,
	renderVueIsland,
	renderSolidIsland,
	AsyncIsland,
} from './src/islands/Island.tsx';
export type { IslandProps } from './src/islands/Island.tsx';

// Build utilities
export { generateIslandManifest, loadIslandManifest, getIslandBundlePath } from './src/build/island-manifest.ts';
export type { IslandManifest, IslandEntry } from './src/build/island-manifest.ts';

// Build command (batteries included)
export { build } from './build.ts';

// API utilities
export * from './src/helpers/api.ts';
export { discoverApiRoutes, handleApiRequest } from './src/functions/api.ts';

// Core types
export type { RenderOptions, MetaTag, ScriptConfig } from './src/schemas/core.ts';
export type { Routes, ServerConfig, RouteConfig } from './src/schemas/server.ts';
export type { ApiContext, ApiHandler, ApiRouteConfig, ApiRoute, ApiMethod } from './src/schemas/api.ts';
