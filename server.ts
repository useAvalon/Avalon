export { createServer, createServerSafe, validateServerConfiguration } from './src/render/server.ts';
export { renderToHtml } from './src/render/ssr.ts';
export { mergeOptions, mergePartialOptions } from './src/functions/merge.ts';
export { discoverApiRoutes, registerApiRoutes, generateStaticRoutes, handleApiRequest } from './src/functions/api.ts';
export * from './src/helpers/api.ts';

export type { Routes, ServerConfig, RouteConfig } from './src/schemas/server.ts';
export type { RenderOptions } from './src/schemas/core.ts';
export type { ApiContext, ApiHandler, ApiRouteConfig, ApiRoute, ApiMethod } from './src/schemas/api.ts';
