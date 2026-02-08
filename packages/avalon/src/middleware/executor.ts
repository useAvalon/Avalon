/**
 * Simplified Middleware Executor
 *
 * This module provides a streamlined middleware execution system that aligns
 * with Nitro's conventions while supporting Avalon's route-scoped middleware.
 *
 * Key features:
 * - Nitro-style handler signature: return void to continue, return Response to terminate
 * - Middleware caching for performance
 * - Support for legacy middleware format with deprecation warnings
 * - Error propagation to Nitro's error handling
 * - Context preservation: event.context modifications persist through the chain
 * - Development logging for context changes
 *
 * Requirements: 1.2, 1.3, 1.4, 2.1, 2.2
 */

import type { H3Event } from 'h3';
import type {
  MiddlewareHandler,
  MiddlewareRoute,
  MiddlewareFileExport,
  MiddlewareExecutorOptions,
  LegacyMiddlewareResponse,
} from './types.ts';
import { isLegacyMiddlewareResponse } from './types.ts';
import { getMatchingMiddleware } from './discovery.ts';

/**
 * Captures a snapshot of the event context for comparison
 * Used in development mode to log context changes
 */
function captureContextSnapshot(context: Record<string, unknown>): Map<string, unknown> {
  const snapshot = new Map<string, unknown>();
  for (const key of Object.keys(context)) {
    // Deep clone primitive values, shallow reference for objects
    const value = context[key];
    snapshot.set(key, value);
  }
  return snapshot;
}

/**
 * Compares two context snapshots and returns the changes
 * Used in development mode to log context modifications
 */
function getContextChanges(
  before: Map<string, unknown>,
  after: Record<string, unknown>
): { added: string[]; modified: string[]; removed: string[] } {
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];

  // Check for added and modified keys
  for (const key of Object.keys(after)) {
    if (!before.has(key)) {
      added.push(key);
    } else if (before.get(key) !== after[key]) {
      modified.push(key);
    }
  }

  // Check for removed keys
  for (const key of before.keys()) {
    if (!(key in after)) {
      removed.push(key);
    }
  }

  return { added, modified, removed };
}

/**
 * Logs context changes in development mode
 * Requirements: 2.1, 2.2
 * 
 * Note: This is intentionally minimal to reduce log noise.
 * Only logs when there are actual changes.
 */
function logContextChanges(
  _filePath: string,
  changes: { added: string[]; modified: string[]; removed: string[] }
): void {
  const hasChanges = changes.added.length > 0 || changes.modified.length > 0 || changes.removed.length > 0;
  
  // Skip logging - too verbose for normal development
  // Uncomment for debugging middleware context issues:
  // if (!hasChanges) return;
  // console.log(`[middleware] Context changes: ${parts.join(', ')}`);
  void hasChanges; // Suppress unused variable warning
}

/**
 * Default executor options
 */
const DEFAULT_OPTIONS: Required<MiddlewareExecutorOptions> = {
  devMode: false,
  timeout: 30000, // 30 seconds
};

/**
 * Middleware cache for performance
 * Maps file paths to loaded middleware handlers
 */
const middlewareCache = new Map<string, MiddlewareHandler>();

/**
 * Executes route-scoped middleware chain for a request
 *
 * This function:
 * 1. Finds middleware that matches the request URL
 * 2. Executes them in priority order (parent before child)
 * 3. Handles void return (continue) and Response return (terminate)
 * 4. Propagates errors to Nitro's error handling
 * 5. Preserves event.context modifications across the chain
 * 6. Logs context changes in development mode
 *
 * Context Preservation (Requirements 2.1, 2.2):
 * - Middleware can modify event.context to pass data to downstream handlers
 * - All modifications persist through the entire request lifecycle
 * - In development mode, context changes are logged for debugging
 *
 * @param event - H3 event object from Nitro
 * @param routes - Discovered middleware routes from discoverScopedMiddleware
 * @param options - Execution options
 * @returns Response if middleware terminated the chain, undefined otherwise
 *
 * @example
 * ```ts
 * const routes = await discoverScopedMiddleware({ baseDir: 'src' });
 * const response = await executeScopedMiddleware(event, routes, { devMode: true });
 *
 * if (response) {
 *   // Middleware terminated - return the response
 *   return response;
 * }
 *
 * // Continue with normal request handling
 * // event.context now contains any data set by middleware
 * console.log(event.context.user); // Data set by auth middleware
 * ```
 */
export async function executeScopedMiddleware(
  event: H3Event,
  routes: MiddlewareRoute[],
  options: MiddlewareExecutorOptions = {}
): Promise<Response | undefined> {
  const { devMode, timeout } = { ...DEFAULT_OPTIONS, ...options };

  // Build URL from event
  const url = buildUrlFromEvent(event);

  // Find matching middleware for this request
  const matchingRoutes = getMatchingMiddleware(routes, url);

  if (matchingRoutes.length === 0) {
    return undefined;
  }

  // Reduce log noise - only log middleware execution summary, not per-request details
  // if (devMode) {
  //   console.log(`[middleware] Executing ${matchingRoutes.length} middleware for ${url.pathname}`);
  // }

  // Execute middleware in order (already sorted by priority)
  for (const route of matchingRoutes) {
    try {
      const handler = await loadMiddleware(route.filePath, devMode);
      if (!handler) {
        continue;
      }

      // Capture context snapshot before execution (for dev logging)
      // Requirements: 2.1, 2.2 - Context preservation and logging
      const contextBefore = devMode ? captureContextSnapshot(event.context) : null;

      // Execute middleware with timeout
      const result = await executeWithTimeout(
        () => handler(event),
        timeout,
        route.filePath
      );

      // Log context changes in development mode
      // Requirements: 2.1, 2.2 - Development logging for context changes
      if (devMode && contextBefore) {
        const changes = getContextChanges(contextBefore, event.context);
        logContextChanges(route.filePath, changes);
      }

      // Handle the result based on Nitro conventions
      const response = handleMiddlewareResult(result, route.filePath, devMode);

      if (response) {
        if (devMode) {
          console.log(`[middleware] Chain terminated by ${route.filePath}`);
        }
        return response;
      }
    } catch (error) {
      // Re-throw to let Nitro's error handling take over
      // This satisfies Requirement 1.4
      if (devMode) {
        console.error(`[middleware] Error in ${route.filePath}:`, error);
      }
      throw error;
    }
  }

  // Log final context state summary in development mode
  // Disabled to reduce log noise - uncomment for debugging
  // if (devMode) {
  //   const contextKeys = Object.keys(event.context);
  //   if (contextKeys.length > 0) {
  //     console.log(`[middleware] Final context keys: [${contextKeys.join(', ')}]`);
  //   }
  // }

  return undefined;
}

/**
 * Builds a URL object from an H3 event
 *
 * @param event - H3 event object
 * @returns URL object for the request
 */
function buildUrlFromEvent(event: H3Event): URL {
  const req = event.node.req;
  const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
  const host = req.headers.host || 'localhost';
  const path = req.url || '/';

  return new URL(path, `${protocol}://${host}`);
}

/**
 * Loads a middleware handler from a file path
 *
 * Uses caching to avoid re-importing middleware files on every request.
 * In development mode, uses Vite's ssrLoadModule for proper HMR support.
 * The cache can be cleared for hot reload support.
 *
 * @param filePath - Absolute path to the middleware file
 * @param devMode - Whether to log debug information
 * @returns The middleware handler, or null if loading failed
 */
async function loadMiddleware(
  filePath: string,
  devMode: boolean
): Promise<MiddlewareHandler | null> {
  // Check cache first (improves performance in production)
  // In dev mode, skip cache to always get latest version via Vite's HMR
  if (!devMode && middlewareCache.has(filePath)) {
    return middlewareCache.get(filePath)!;
  }

  try {
    let module: MiddlewareFileExport;

    // In development mode, try to use Vite's ssrLoadModule for proper HMR support
    const viteServer = globalThis.__viteDevServer;
    if (devMode && viteServer) {
      // Convert absolute path to a path Vite can resolve
      const viteRoot = viteServer.config.root || '';
      let vitePath = filePath;
      
      // If the path starts with the Vite root, make it relative
      if (filePath.startsWith(viteRoot)) {
        vitePath = '/' + filePath.slice(viteRoot.length + 1);
      }
      
      module = await viteServer.ssrLoadModule(vitePath) as MiddlewareFileExport;
    } else {
      // Production mode or no Vite server - use dynamic import
      module = await import(/* @vite-ignore */ filePath) as MiddlewareFileExport;
    }

    if (!module.default || typeof module.default !== 'function') {
      if (devMode) {
        console.warn(`[middleware] ${filePath} does not export a default function`);
      }
      return null;
    }

    const handler = module.default;

    // Cache the handler for future requests (only in production)
    if (!devMode) {
      middlewareCache.set(filePath, handler);
    }

    return handler;
  } catch (error) {
    if (devMode) {
      console.error(`[middleware] Failed to load ${filePath}:`, error);
    }
    return null;
  }
}

/**
 * Executes a middleware handler with a timeout
 *
 * @param fn - Function to execute
 * @param timeout - Timeout in milliseconds
 * @param filePath - File path for error messages
 * @returns The result of the function
 * @throws Error if execution times out
 */
async function executeWithTimeout<T>(
  fn: () => T | Promise<T>,
  timeout: number,
  filePath: string
): Promise<T> {
  return Promise.race([
    Promise.resolve(fn()),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Middleware timeout after ${timeout}ms: ${filePath}`));
      }, timeout);
    }),
  ]);
}

/**
 * Handles the result of a middleware execution
 *
 * Supports both Nitro-style returns (void/Response) and legacy format
 * ({ continue: boolean, response?: Response }) with deprecation warnings.
 *
 * @param result - The result from middleware execution
 * @param filePath - File path for deprecation warnings
 * @param devMode - Whether to log deprecation warnings
 * @returns Response if chain should terminate, undefined otherwise
 */
function handleMiddlewareResult(
  result: unknown,
  filePath: string,
  devMode: boolean
): Response | undefined {
  // Nitro-style: void/undefined means continue
  if (result === undefined || result === null) {
    return undefined;
  }

  // Nitro-style: Response means terminate
  if (result instanceof Response) {
    return result;
  }

  // Legacy format support with deprecation warning
  if (isLegacyMiddlewareResponse(result)) {
    if (devMode) {
      console.warn(
        `[middleware] DEPRECATED: ${filePath} uses legacy { continue, response } format. ` +
        `Please migrate to Nitro-style: return void to continue, return Response to terminate.`
      );
    }

    // Convert legacy format to Nitro-style
    if (!result.continue || result.response) {
      return result.response || new Response(null, { status: 500 });
    }

    return undefined;
  }

  // Unknown return type - log warning and continue
  if (devMode) {
    console.warn(
      `[middleware] ${filePath} returned unexpected value: ${typeof result}. ` +
      `Expected void, Response, or legacy { continue, response } format.`
    );
  }

  return undefined;
}

/**
 * Clears the middleware cache
 *
 * Call this function when middleware files change (e.g., during hot reload)
 * to ensure the latest version is loaded on the next request.
 *
 * @example
 * ```ts
 * // In your HMR handler
 * if (file.endsWith('_middleware.ts')) {
 *   clearMiddlewareCache();
 * }
 * ```
 */
export function clearMiddlewareCache(): void {
  middlewareCache.clear();
}

/**
 * Removes a specific middleware from the cache
 *
 * Useful for targeted cache invalidation during hot reload.
 *
 * @param filePath - Absolute path to the middleware file
 * @returns true if the middleware was in the cache and removed
 *
 * @example
 * ```ts
 * // In your HMR handler
 * invalidateMiddleware('/abs/path/to/src/pages/admin/_middleware.ts');
 * ```
 */
export function invalidateMiddleware(filePath: string): boolean {
  return middlewareCache.delete(filePath);
}

/**
 * Gets the current size of the middleware cache
 *
 * Useful for debugging and monitoring.
 *
 * @returns Number of cached middleware handlers
 */
export function getMiddlewareCacheSize(): number {
  return middlewareCache.size;
}

/**
 * Verifies that context modifications persist through middleware execution
 * 
 * This utility function is useful for testing and debugging context preservation.
 * It checks that a value set in event.context is accessible after middleware execution.
 * 
 * Requirements: 2.1, 2.2
 * 
 * @param event - H3 event object
 * @param key - The context key to check
 * @returns true if the key exists in event.context
 * 
 * @example
 * ```ts
 * // In middleware
 * event.context.user = { id: '123', name: 'John' };
 * 
 * // Later in handler
 * if (hasContextValue(event, 'user')) {
 *   const user = event.context.user;
 *   // user is available
 * }
 * ```
 */
export function hasContextValue(event: H3Event, key: string): boolean {
  return key in event.context;
}

/**
 * Gets a typed value from event.context
 * 
 * This utility provides type-safe access to context values set by middleware.
 * 
 * Requirements: 2.1, 2.2
 * 
 * @param event - H3 event object
 * @param key - The context key to retrieve
 * @returns The value if it exists, undefined otherwise
 * 
 * @example
 * ```ts
 * // In middleware
 * event.context.user = { id: '123', name: 'John' };
 * 
 * // Later in handler
 * const user = getContextValue<{ id: string; name: string }>(event, 'user');
 * if (user) {
 *   console.log(user.name); // Type-safe access
 * }
 * ```
 */
export function getContextValue<T>(event: H3Event, key: string): T | undefined {
  return event.context[key] as T | undefined;
}

/**
 * Sets a value in event.context with optional development logging
 * 
 * This utility provides a consistent way to set context values with
 * automatic logging in development mode.
 * 
 * Requirements: 2.1, 2.2
 * 
 * @param event - H3 event object
 * @param key - The context key to set
 * @param value - The value to store
 * @param devMode - Whether to log the change
 * 
 * @example
 * ```ts
 * // In middleware
 * setContextValue(event, 'user', { id: '123', name: 'John' }, true);
 * // Logs: [middleware] Context set: user
 * ```
 */
export function setContextValue<T>(
  event: H3Event,
  key: string,
  value: T,
  devMode: boolean = false
): void {
  const isNew = !(key in event.context);
  event.context[key] = value;
  
  if (devMode) {
    console.log(`[middleware] Context ${isNew ? 'set' : 'updated'}: ${key}`);
  }
}

