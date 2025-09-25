import type { ApiHandler } from '@avalon/avalon';

export const GET: ApiHandler = async () => {
	const now = new Date();

	return Response.json({
		timestamp: now.toISOString(),
		unix: now.getTime(),
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		formatted: {
			date: now.toDateString(),
			time: now.toTimeString(),
			locale: now.toLocaleString(),
		},
		server: 'Avalon/Deno',
	});
};
