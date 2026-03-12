/**
 * Cached Stats API Route
 * GET /api/cached-stats
 *
 * Demonstrates Nitro's built-in caching with defineCachedFunction.
 * The expensive computation only runs once per 60 seconds.
 */

import { defineHandler } from 'nitro/h3';
import { defineCachedFunction } from 'nitro/cache';

const getStats = defineCachedFunction(
	async () => {
		// Simulate an expensive database query
		const now = new Date();
		console.log(`[cached-stats] Cache MISS — computing stats at ${now.toISOString()}`);

		return {
			totalUsers: 1_247 + Math.floor(Math.random() * 10),
			activeToday: 89 + Math.floor(Math.random() * 5),
			totalPages: 42,
			uptime: '99.97%',
			computedAt: now.toISOString(),
		};
	},
	{
		maxAge: 60,
		name: 'dashboard-stats',
		swr: true,
	},
);

const getActivity = defineCachedFunction(
	async () => {
		console.log(`[cached-stats] Cache MISS — fetching activity`);

		return [
			{ action: 'Page created', page: '/blog/new-post', time: '2 min ago' },
			{ action: 'User signed up', page: '/register', time: '5 min ago' },
			{ action: 'Island hydrated', page: '/frameworks', time: '8 min ago' },
			{ action: 'API called', page: '/api/stats', time: '12 min ago' },
		];
	},
	{
		maxAge: 30,
		name: 'recent-activity',
	},
);

export default defineHandler(async () => {
	const [stats, activity] = await Promise.all([getStats(), getActivity()]);

	return { stats, activity };
});
