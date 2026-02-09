/**
 * Nitro Caching Utilities for Avalon
 *
 * This module provides helper utilities and type definitions for using Nitro's
 * built-in caching system. Nitro provides two main caching primitives:
 *
 * 1. `defineCachedEventHandler` - Caches entire HTTP responses
 * 2. `defineCachedFunction` - Caches function return values
 *
 * Both support:
 * - Time-based expiration (maxAge)
 * - Stale-while-revalidate (SWR) pattern
 * - Custom cache key generation
 * - Named caches for organization
 *
 * USAGE:
 *
 * For API routes, use `defineCachedEventHandler` from 'nitropack/runtime':
 *
 * ```typescript
 * // api/expensive-data.ts
 * import { defineCachedEventHandler, getRouterParam } from 'h3';
 *
 * export default defineCachedEventHandler(
 *   async (event) => {
 *     const id = getRouterParam(event, 'id');
 *     const data = await fetchExpensiveData(id);
 *     return data;
 *   },
 *   {
 *     maxAge: 60,        // Cache for 60 seconds
 *     swr: true,         // Serve stale while revalidating
 *     name: 'expensive-data',
 *     getKey: (event) => getRouterParam(event, 'id') || 'default',
 *   }
 * );
 * ```
 *
 * For cached computations, use `defineCachedFunction`:
 *
 * ```typescript
 * // utils/cached-fetch.ts
 * import { defineCachedFunction } from 'nitropack/runtime';
 *
 * export const getGitHubStars = defineCachedFunction(
 *   async (owner: string, repo: string) => {
 *     const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
 *     const data = await response.json();
 *     return data.stargazers_count;
 *   },
 *   {
 *     maxAge: 3600,      // Cache for 1 hour
 *     name: 'github-stars',
 *     getKey: (owner, repo) => `${owner}/${repo}`,
 *   }
 * );
 * ```
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */

import type { H3Event } from "./types.ts";

/**
 * Cache options for defineCachedEventHandler
 *
 * These options control how responses are cached by Nitro's caching layer.
 *
 * Requirements: 4.1, 4.3
 */
export interface CachedEventHandlerOptions<T = unknown> {
  /**
   * Maximum age in seconds before the cache entry expires.
   * After this time, the cached response is considered stale.
   *
   * @example maxAge: 60 // Cache for 1 minute
   */
  maxAge?: number;

  /**
   * Enable stale-while-revalidate behavior.
   * When true, stale content is served immediately while fresh content
   * is fetched in the background.
   *
   * @default false
   */
  swr?: boolean;

  /**
   * Maximum age in seconds for stale content when SWR is enabled.
   * After this time, even stale content won't be served.
   *
   * @example staleMaxAge: 86400 // Allow stale content for 24 hours
   */
  staleMaxAge?: number;

  /**
   * Name for the cache entry. Used for cache organization and debugging.
   * If not provided, a name is generated from the handler.
   *
   * @example name: 'user-profile'
   */
  name?: string;

  /**
   * Cache group for organizing related cache entries.
   * Useful for bulk invalidation of related caches.
   *
   * @example group: 'api'
   */
  group?: string;

  /**
   * Function to generate a unique cache key from the event.
   * If not provided, the request URL is used as the key.
   *
   * @example getKey: (event) => getRouterParam(event, 'id')
   */
  getKey?: (event: H3Event) => string | Promise<string>;

  /**
   * Enable integrity checking for cached responses.
   * When true, cached responses are validated before serving.
   *
   * @default false
   */
  integrity?: boolean;

  /**
   * Transform the response before caching.
   * Useful for normalizing or sanitizing cached data.
   */
  transform?: (response: T) => T | Promise<T>;

  /**
   * Validate whether a response should be cached.
   * Return false to skip caching for specific responses.
   */
  shouldCache?: (response: T) => boolean | Promise<boolean>;

  /**
   * Headers to vary the cache by.
   * Different cache entries are created for different header values.
   *
   * @example varies: ['Accept-Language', 'Accept-Encoding']
   */
  varies?: string[];
}

/**
 * Cache options for defineCachedFunction
 *
 * These options control how function results are cached.
 *
 * Requirements: 4.2, 4.5
 */
export interface CachedFunctionOptions<TArgs extends unknown[], TResult> {
  /**
   * Maximum age in seconds before the cache entry expires.
   *
   * @example maxAge: 3600 // Cache for 1 hour
   */
  maxAge?: number;

  /**
   * Enable stale-while-revalidate behavior.
   *
   * @default false
   */
  swr?: boolean;

  /**
   * Maximum age in seconds for stale content when SWR is enabled.
   */
  staleMaxAge?: number;

  /**
   * Name for the cached function. Used for cache organization.
   *
   * @example name: 'github-stars'
   */
  name?: string;

  /**
   * Cache group for organizing related cache entries.
   */
  group?: string;

  /**
   * Function to generate a unique cache key from the function arguments.
   * If not provided, arguments are serialized to create the key.
   *
   * @example getKey: (owner, repo) => `${owner}/${repo}`
   */
  getKey?: (...args: TArgs) => string | Promise<string>;

  /**
   * Enable integrity checking for cached results.
   */
  integrity?: boolean;

  /**
   * Transform the result before caching.
   */
  transform?: (result: TResult) => TResult | Promise<TResult>;

  /**
   * Validate whether a result should be cached.
   */
  shouldCache?: (result: TResult) => boolean | Promise<boolean>;
}

/**
 * Default cache options for API handlers
 *
 * These defaults provide a reasonable starting point for API caching:
 * - 60 second cache duration
 * - SWR enabled for better user experience
 * - 5 minute stale window
 */
export const DEFAULT_API_CACHE_OPTIONS: CachedEventHandlerOptions = {
  maxAge: 60,
  swr: true,
  staleMaxAge: 300,
  group: "api",
};

/**
 * Default cache options for expensive computations
 *
 * These defaults are suitable for expensive operations:
 * - 1 hour cache duration
 * - SWR enabled
 * - 24 hour stale window
 */
export const DEFAULT_COMPUTATION_CACHE_OPTIONS: CachedFunctionOptions<unknown[], unknown> = {
  maxAge: 3600,
  swr: true,
  staleMaxAge: 86400,
  group: "computation",
};

/**
 * Creates cache options for short-lived API responses
 *
 * Use for data that changes frequently but can tolerate brief staleness.
 *
 * @param maxAge - Cache duration in seconds (default: 30)
 * @returns Cache options configured for short-lived responses
 *
 * @example
 * export default defineCachedEventHandler(
 *   handler,
 *   createShortLivedCacheOptions(15) // 15 second cache
 * );
 */
export function createShortLivedCacheOptions(
  maxAge: number = 30
): CachedEventHandlerOptions {
  return {
    maxAge,
    swr: true,
    staleMaxAge: maxAge * 2,
    group: "short-lived",
  };
}

/**
 * Creates cache options for long-lived API responses
 *
 * Use for data that rarely changes, like configuration or reference data.
 *
 * @param maxAge - Cache duration in seconds (default: 3600 = 1 hour)
 * @returns Cache options configured for long-lived responses
 *
 * @example
 * export default defineCachedEventHandler(
 *   handler,
 *   createLongLivedCacheOptions(7200) // 2 hour cache
 * );
 */
export function createLongLivedCacheOptions(
  maxAge: number = 3600
): CachedEventHandlerOptions {
  return {
    maxAge,
    swr: true,
    staleMaxAge: maxAge * 24, // 24x the maxAge for stale window
    group: "long-lived",
  };
}

/**
 * Creates cache options with a custom key generator based on route parameters
 *
 * Use when caching responses that vary by route parameters.
 *
 * @param paramNames - Array of parameter names to include in the cache key
 * @param baseOptions - Additional cache options to merge
 * @returns Cache options with parameter-based key generation
 *
 * @example
 * export default defineCachedEventHandler(
 *   handler,
 *   createParamBasedCacheOptions(['userId', 'postId'], { maxAge: 300 })
 * );
 */
export function createParamBasedCacheOptions(
  paramNames: string[],
  baseOptions: Partial<CachedEventHandlerOptions> = {}
): CachedEventHandlerOptions {
  return {
    ...DEFAULT_API_CACHE_OPTIONS,
    ...baseOptions,
    getKey: (event: H3Event) => {
      const params = (event.context.params as Record<string, string>) || {};
      const keyParts = paramNames.map((name) => params[name] || "");
      return keyParts.join(":");
    },
  };
}

/**
 * Creates cache options with query parameter-based key generation
 *
 * Use when caching responses that vary by query parameters.
 *
 * @param queryParams - Array of query parameter names to include in the cache key
 * @param baseOptions - Additional cache options to merge
 * @returns Cache options with query-based key generation
 *
 * @example
 * export default defineCachedEventHandler(
 *   handler,
 *   createQueryBasedCacheOptions(['page', 'limit'], { maxAge: 120 })
 * );
 */
export function createQueryBasedCacheOptions(
  queryParams: string[],
  baseOptions: Partial<CachedEventHandlerOptions> = {}
): CachedEventHandlerOptions {
  return {
    ...DEFAULT_API_CACHE_OPTIONS,
    ...baseOptions,
    getKey: (event: H3Event) => {
      const url = new URL(event.path, "http://localhost");
      const keyParts = queryParams.map(
        (name) => url.searchParams.get(name) || ""
      );
      return keyParts.join(":");
    },
  };
}

/**
 * Merges cache options with defaults
 *
 * @param options - User-provided cache options
 * @param defaults - Default options to use as base
 * @returns Merged cache options
 */
export function mergeCacheOptions<T extends CachedEventHandlerOptions | CachedFunctionOptions<unknown[], unknown>>(
  options: Partial<T>,
  defaults: T
): T {
  return {
    ...defaults,
    ...options,
  };
}

// ============================================================================
// NITRO CACHING DOCUMENTATION
// ============================================================================
//
// Nitro provides built-in caching through two main functions:
//
// 1. defineCachedEventHandler (for HTTP handlers)
// ------------------------------------------------
// Import: import { defineCachedEventHandler } from 'nitropack/runtime';
//
// Usage:
// ```typescript
// export default defineCachedEventHandler(
//   async (event) => {
//     // Your handler logic
//     return { data: 'expensive result' };
//   },
//   {
//     maxAge: 60,           // Cache for 60 seconds
//     swr: true,            // Enable stale-while-revalidate
//     staleMaxAge: 300,     // Serve stale for up to 5 minutes
//     name: 'my-handler',   // Cache name for debugging
//     getKey: (event) => {  // Custom cache key
//       return getRouterParam(event, 'id') || 'default';
//     },
//   }
// );
// ```
//
// 2. defineCachedFunction (for any async function)
// ------------------------------------------------
// Import: import { defineCachedFunction } from 'nitropack/runtime';
//
// Usage:
// ```typescript
// const cachedFetch = defineCachedFunction(
//   async (url: string) => {
//     const response = await fetch(url);
//     return response.json();
//   },
//   {
//     maxAge: 3600,         // Cache for 1 hour
//     name: 'external-api',
//     getKey: (url) => url, // Use URL as cache key
//   }
// );
//
// // Use in handlers
// const data = await cachedFetch('https://api.example.com/data');
// ```
//
// CACHE STORAGE
// -------------
// By default, Nitro uses in-memory caching. For production, configure
// persistent storage in your Nitro config:
//
// ```typescript
// // nitro.config.ts or vite.config.ts
// export default defineConfig({
//   nitro: {
//     storage: {
//       cache: {
//         driver: 'redis',
//         url: process.env.REDIS_URL,
//       },
//     },
//   },
// });
// ```
//
// Available storage drivers:
// - memory (default)
// - redis
// - cloudflare-kv
// - vercel-kv
// - fs (file system)
//
// CACHE INVALIDATION
// ------------------
// Nitro automatically invalidates cache entries when they expire.
// For manual invalidation, use the storage API:
//
// ```typescript
// import { useStorage } from 'nitropack/runtime';
//
// // Clear specific cache entry
// await useStorage('cache').removeItem('my-handler:key');
//
// // Clear all entries in a group
// await useStorage('cache').clear('api');
// ```
//
// ============================================================================
