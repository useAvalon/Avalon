/**
 * Root Page Middleware
 *
 * Runs for all page routes (non-API routes).
 * Adds request timing and a unique request ID.
 */

import { defineHandler } from 'nitro/h3';

export default defineHandler(event => {
	event.context.timing = { start: Date.now() };
	event.context.requestId = crypto.randomUUID();
});
