/**
 * Logging Middleware (Global)
 *
 * Enables request logging flag for downstream handlers.
 */

import { defineMiddleware } from '@avalon/avalon/middleware';

export default defineMiddleware((event) => {
	event.context.loggingEnabled = true;
});
