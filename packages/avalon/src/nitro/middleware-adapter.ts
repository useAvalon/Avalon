/**
 * Nitro Middleware Adapter for Avalon
 *
 * This module provides utilities for creating and managing middleware context
 * in Nitro's h3 middleware system. Nitro handles middleware ordering and execution
 * automatically via the middleware/ directory with numbered prefixes.
 *
 * Key responsibilities:
 * - Create MiddlewareContext from H3 events
 * - Store/retrieve context in event.context.avalon for downstream handlers
 * - Provide utilities for middleware to access request data
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import type {
  H3Event,
  AvalonEventContext,
} from "./types.ts";
import type {
  MiddlewareContext,
} from "../schemas/middleware.ts";

/**
 * Options for middleware context creation
 */
export interface MiddlewareContextOptions {
  /** Whether running in development mode */
  isDev?: boolean;
  /** Enable detailed logging */
  enableLogging?: boolean;
}

/**
 * Gets the request URL from an H3 event
 * Requirements: 6.3
 */
export function getRequestURL(event: H3Event): URL {
  const protocol = "http";
  const host = "localhost";
  return new URL(event.path, `${protocol}://${host}`);
}

/**
 * Gets request headers from an H3 event
 */
export function getRequestHeaders(event: H3Event): Headers {
  const headers = new Headers();
  const nodeReq = event.node.req as { headers?: Record<string, string | string[] | undefined> };
  if (nodeReq && nodeReq.headers) {
    for (const [key, value] of Object.entries(nodeReq.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }
  }
  return headers;
}

/**
 * Converts an H3 event to a standard Request object
 * Requirements: 6.3
 */
export function toRequest(event: H3Event): Request {
  const url = getRequestURL(event);
  const method = event.method.toUpperCase();
  
  return new Request(url, {
    method,
    headers: getRequestHeaders(event),
  });
}

/**
 * Extracts route parameters from an H3 event
 * Uses Nitro's built-in parameter extraction via event.context.params
 * Requirements: 6.3
 */
export function getRouterParams(event: H3Event): Record<string, string> {
  const params = event.context.params as Record<string, string> | undefined;
  return params ?? {};
}

/**
 * Creates a MiddlewareContext from an H3 event
 * Requirements: 6.3, 6.4
 *
 * This context is used by downstream handlers to access request data
 * and any state set by middleware.
 *
 * @param event - The H3 event
 * @param options - Optional configuration
 * @returns MiddlewareContext for use in handlers
 */
export function createMiddlewareContext(
  event: H3Event,
  options: MiddlewareContextOptions = {}
): MiddlewareContext {
  const { enableLogging = false } = options;
  
  const url = getRequestURL(event);
  const params = getRouterParams(event);
  
  // Parse query parameters
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (query[key]) {
      if (Array.isArray(query[key])) {
        (query[key] as string[]).push(value);
      } else {
        query[key] = [query[key] as string, value];
      }
    } else {
      query[key] = value;
    }
  }

  if (enableLogging) {
    console.log(`[Middleware Context] Created for ${event.method} ${event.path}`);
  }

  return {
    request: toRequest(event),
    url,
    params,
    query,
    state: new Map(),
    locals: {},
  };
}

/**
 * Stores the middleware context in the H3 event for downstream handlers
 * Requirements: 6.3, 6.4
 *
 * This allows API handlers and page renderers to access the middleware context
 * that was created during middleware execution.
 *
 * @param event - The H3 event
 * @param context - The middleware context to store
 */
export function storeMiddlewareContext(
  event: H3Event,
  context: MiddlewareContext
): void {
  // Initialize avalon context if not present
  if (!event.context.avalon) {
    event.context.avalon = {} as AvalonEventContext;
  }
  
  // Store the middleware context
  (event.context.avalon as AvalonEventContext).middlewareContext = context;
}

/**
 * Retrieves the middleware context from an H3 event
 * Requirements: 6.3, 6.4
 *
 * @param event - The H3 event
 * @returns The stored middleware context or undefined
 */
export function getMiddlewareContext(event: H3Event): MiddlewareContext | undefined {
  const avalonContext = event.context.avalon as AvalonEventContext | undefined;
  return avalonContext?.middlewareContext;
}

/**
 * Gets or creates a middleware context for an H3 event
 * Requirements: 6.3, 6.4
 *
 * This is a convenience function that retrieves an existing context
 * or creates a new one if none exists.
 *
 * @param event - The H3 event
 * @param options - Optional configuration for context creation
 * @returns The middleware context
 */
export function getOrCreateMiddlewareContext(
  event: H3Event,
  options: MiddlewareContextOptions = {}
): MiddlewareContext {
  const existingContext = getMiddlewareContext(event);
  if (existingContext) {
    return existingContext;
  }
  
  const newContext = createMiddlewareContext(event, options);
  storeMiddlewareContext(event, newContext);
  return newContext;
}

/**
 * Updates the middleware context state
 * Requirements: 6.3, 6.4
 *
 * Allows middleware to set state that can be accessed by downstream handlers.
 *
 * @param event - The H3 event
 * @param key - The state key
 * @param value - The state value
 */
export function setMiddlewareState(
  event: H3Event,
  key: string,
  value: unknown
): void {
  const context = getOrCreateMiddlewareContext(event);
  context.state.set(key, value);
}

/**
 * Gets a value from the middleware context state
 * Requirements: 6.3, 6.4
 *
 * @param event - The H3 event
 * @param key - The state key
 * @returns The state value or undefined
 */
export function getMiddlewareState<T = unknown>(
  event: H3Event,
  key: string
): T | undefined {
  const context = getMiddlewareContext(event);
  return context?.state.get(key) as T | undefined;
}

/**
 * Sets a local value in the middleware context
 * Requirements: 6.3, 6.4
 *
 * Locals are similar to state but use a plain object for simpler access.
 *
 * @param event - The H3 event
 * @param key - The local key
 * @param value - The local value
 */
export function setMiddlewareLocal(
  event: H3Event,
  key: string,
  value: unknown
): void {
  const context = getOrCreateMiddlewareContext(event);
  context.locals[key] = value;
}

/**
 * Gets a local value from the middleware context
 * Requirements: 6.3, 6.4
 *
 * @param event - The H3 event
 * @param key - The local key
 * @returns The local value or undefined
 */
export function getMiddlewareLocal<T = unknown>(
  event: H3Event,
  key: string
): T | undefined {
  const context = getMiddlewareContext(event);
  return context?.locals[key] as T | undefined;
}

/**
 * Type guard to check if avalon context exists on an event
 */
export function hasAvalonContext(event: H3Event): boolean {
  return event.context.avalon !== undefined;
}

/**
 * Ensures the avalon context is initialized on an event
 * Requirements: 6.3
 *
 * @param event - The H3 event
 * @returns The avalon context
 */
export function ensureAvalonContext(event: H3Event): AvalonEventContext {
  if (!event.context.avalon) {
    event.context.avalon = {} as AvalonEventContext;
  }
  return event.context.avalon as AvalonEventContext;
}
