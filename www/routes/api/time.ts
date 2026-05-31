/**
 * Time API Route
 * GET /api/time
 */

import { defineHandler } from "nitro/h3";

export default defineHandler(() => {
	const now = new Date();

	return {
		timestamp: now.toISOString(),
		unix: now.getTime(),
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		formatted: {
			date: now.toDateString(),
			time: now.toTimeString(),
			locale: now.toLocaleString(),
		},
		server: "Avalon/Nitro",
	};
});
