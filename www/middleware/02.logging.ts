/**
 * Logging Middleware (Global)
 *
 * Enables request logging flag for downstream handlers.
 */

import { defineHandler } from "nitro/h3";

export default defineHandler((event) => {
	event.context.loggingEnabled = true;
});
