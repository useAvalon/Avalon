/**
 * Root Page Middleware
 *
 * This middleware runs for all page routes (non-API routes).
 * It demonstrates:
 * - Request timing/logging
 * - Context passing to downstream handlers
 * - Development-only logging
 *
 * Uses the new Nitro-aligned middleware format:
 * - Return nothing (void) to continue to next middleware
 * - Return a Response to terminate the chain
 * - Throw an error to trigger error handling
 */

import { defineMiddleware } from '@avalon/avalon/middleware';

export default defineMiddleware((event) => {
  // Add request timing to context for performance monitoring
  event.context.timing = {
    start: Date.now(),
  };

  // Generate a unique request ID for tracing
  event.context.requestId = crypto.randomUUID();

  // Development-only request logging - disabled to reduce noise
  // Uncomment for debugging request flow:
  // if (import.meta.env?.DEV) {
  //   const method = event.node.req.method || 'GET';
  //   const url = event.node.req.url || '/';
  //   console.log(`[page] ${method} ${url} - Request ID: ${event.context.requestId}`);
  // }

  // Return nothing to continue to next middleware/handler
});
