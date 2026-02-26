/**
 * Cached Time API Route
 * GET /api/cached-time
 */

import { defineHandler } from 'nitro/h3';

export default defineHandler(() => {
	const now = new Date();

	return {
		timestamp: now.toISOString(),
		unix: now.getTime(),
		message: 'Current server time',
		generatedAt: now.toISOString(),
	};
});
