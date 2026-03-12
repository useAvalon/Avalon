/**
 * Stats API Route
 * GET /api/stats?userId=123
 */

import { defineHandler, HTTPError } from 'nitro/h3';

export default defineHandler(event => {
	const userId = event.url.searchParams.get('userId');

	if (!userId) {
		throw new HTTPError('userId query parameter is required', { status: 400 });
	}

	return {
		user: {
			userId,
			totalPosts: 42,
			totalComments: 128,
			totalLikes: 567,
			lastActive: new Date().toISOString(),
		},
		config: {
			version: '1.0.0',
			features: ['islands', 'streaming', 'multi-framework'],
		},
		requestedAt: new Date().toISOString(),
	};
});
