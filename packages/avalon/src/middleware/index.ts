/**
 * Avalon Middleware Module
 *
 * This module provides a Nitro-aligned middleware system for Avalon that supports
 * both global middleware (via Nitro's middleware/ directory) and route-scoped
 * middleware (via _middleware.ts files in page/API directories).
 *
 * Key features:
 * - Nitro-compatible handler signature: return void to continue, return Response to terminate
 * - Route-scoped middleware discovery in src/pages/ and src/api/
 * - Priority-based execution order (parent before child)
 * - Type-safe context augmentation for H3 events
 *
 * @example
 * ```ts
 * // Define middleware with proper typing
 * import { defineMiddleware } from 'avalon/middleware';
 * import { getHeader, createError } from 'h3';
 *
 * export default defineMiddleware(async (event) => {
 *   const token = getHeader(event, 'Authorization');
 *   if (!token) {
 *     throw createError({ statusCode: 401, message: 'Unauthorized' });
 *   }
 *   event.context.user = await validateToken(token);
 * });
 * ```
 *
 * @example
 * ```ts
 * // Discover and execute middleware in your server
 * import { discoverScopedMiddleware, executeScopedMiddleware } from 'avalon/middleware';
 *
 * const routes = await discoverScopedMiddleware({ baseDir: 'src', devMode: true });
 * const response = await executeScopedMiddleware(event, routes);
 * if (response) return response;
 * ```
 *
 * Requirements: 4.3
 */

// =============================================================================
// Type Exports
// =============================================================================

export type {
	MiddlewareHandler,
	MiddlewareFileExport,
	MiddlewareRoute,
	MiddlewareDiscoveryOptions,
	MiddlewareExecutorOptions,
} from './types.ts';

// =============================================================================
// Helper Functions (defineMiddleware removed — use defineHandler from 'nitro/h3')
// =============================================================================

// =============================================================================
// Discovery Functions
// =============================================================================

export { discoverScopedMiddleware, getMatchingMiddleware, clearDiscoveryCache } from './discovery.ts';

// =============================================================================
// Executor Functions
// =============================================================================

export {
	executeScopedMiddleware,
	clearMiddlewareCache,
	invalidateMiddleware,
	getMiddlewareCacheSize,
	hasContextValue,
	getContextValue,
	setContextValue,
} from './executor.ts';
