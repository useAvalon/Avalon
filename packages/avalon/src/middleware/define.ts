/**
 * defineMiddleware Helper
 *
 * Provides a typed helper function for defining route-scoped middleware
 * with Nitro-compatible signatures and H3 event context augmentation.
 *
 * Context Preservation (Requirements 2.1, 2.2):
 * - Middleware can modify event.context to pass data to downstream handlers
 * - All modifications persist through the entire request lifecycle
 * - In development mode, context changes are logged for debugging
 * - Use the type augmentation below to add custom context properties
 *
 * Requirements: 4.3, 4.4, 2.1, 2.2
 */

import type { H3Event } from 'h3';
import type { MiddlewareHandler } from './types.ts';

/**
 * Defines a route-scoped middleware handler with proper typing
 *
 * This helper provides:
 * - Type-safe middleware handler definition
 * - Access to h3 utilities (getHeader, setHeader, etc.)
 * - Consistent API with Nitro's defineEventHandler
 *
 * @example
 * ```ts
 * // src/pages/admin/_middleware.ts
 * import { defineMiddleware } from 'avalon/middleware';
 * import { getHeader, createError } from 'h3';
 *
 * export default defineMiddleware(async (event) => {
 *   const token = getHeader(event, 'Authorization');
 *
 *   if (!token) {
 *     throw createError({ statusCode: 401, message: 'Unauthorized' });
 *   }
 *
 *   // Validate token and set user in context
 *   const user = await validateToken(token);
 *   event.context.user = user;
 *
 *   // Return nothing to continue to next middleware/handler
 * });
 * ```
 *
 * @example
 * ```ts
 * // src/pages/_middleware.ts - Logging middleware
 * import { defineMiddleware } from 'avalon/middleware';
 *
 * export default defineMiddleware((event) => {
 *   // Add request timing
 *   event.context.timing = {
 *     start: Date.now(),
 *   };
 *
 *   // Log request in development
 *   if (import.meta.env?.DEV) {
 *     console.log(`[page] ${event.method} ${event.path}`);
 *   }
 *
 *   // Continue to next middleware
 * });
 * ```
 *
 * @example
 * ```ts
 * // src/api/admin/_middleware.ts - Early termination
 * import { defineMiddleware } from 'avalon/middleware';
 * import { getHeader } from 'h3';
 *
 * export default defineMiddleware(async (event) => {
 *   const apiKey = getHeader(event, 'X-API-Key');
 *
 *   if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
 *     // Return Response to terminate chain
 *     return new Response(JSON.stringify({ error: 'Invalid API key' }), {
 *       status: 401,
 *       headers: { 'Content-Type': 'application/json' },
 *     });
 *   }
 *
 *   // Continue to next middleware
 * });
 * ```
 *
 * @param handler - The middleware handler function
 * @returns The same handler with proper typing
 */
export function defineMiddleware(handler: MiddlewareHandler): MiddlewareHandler {
  return handler;
}

/**
 * Type augmentation for H3Event context
 *
 * Users can extend this interface in their own code to add custom context properties.
 * This provides type-safe access to common context properties set by middleware.
 *
 * @example
 * ```ts
 * // In your app's types file
 * declare module 'h3' {
 *   interface H3EventContext {
 *     myCustomProperty?: string;
 *   }
 * }
 * ```
 */
declare module 'h3' {
  interface H3EventContext {
    /**
     * Authenticated user information
     * Set by auth middleware after validating credentials
     */
    user?: {
      /** Unique user identifier */
      id: string;
      /** User email address */
      email?: string;
      /** User roles for authorization */
      roles?: string[];
      /** Additional user properties */
      [key: string]: unknown;
    };

    /**
     * Session data
     * Set by session middleware for stateful requests
     */
    session?: {
      /** Session identifier */
      id?: string;
      /** Session data */
      [key: string]: unknown;
    };

    /**
     * Request timing information
     * Set by logging/monitoring middleware
     */
    timing?: {
      /** Request start timestamp */
      start: number;
      /** Middleware completion timestamp */
      middlewareEnd?: number;
      /** Additional timing markers */
      [key: string]: number | undefined;
    };

    /**
     * Request metadata
     * Set by various middleware for request tracking
     */
    requestId?: string;

    /**
     * Client IP address
     * Set by proxy/forwarding middleware
     */
    clientIp?: string;
  }
}

export type { MiddlewareHandler } from './types.ts';
