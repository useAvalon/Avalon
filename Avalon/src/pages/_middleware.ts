/**
 * Root Page Middleware
 *
 * Runs for all page routes (non-API routes).
 * Adds request timing and a unique request ID.
 */

import { defineMiddleware } from '@avalon/avalon/middleware';

export default defineMiddleware((event) => {
	event.context.timing = { start: Date.now() };
	event.context.requestId = crypto.randomUUID();
});
