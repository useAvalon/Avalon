/**
 * User Profile API Route
 * GET /api/users/:id/profile
 */

import { defineHandler, getRouterParam, HTTPError } from 'nitro/h3';

const userProfiles: Record<string, { id: string; name: string; email: string; bio: string; joinedAt: string }> = {
	'123': {
		id: '123',
		name: 'Alice Johnson',
		email: 'alice@example.com',
		bio: 'Software engineer passionate about web technologies',
		joinedAt: '2023-01-15',
	},
	'456': {
		id: '456',
		name: 'Bob Smith',
		email: 'bob@example.com',
		bio: 'Full-stack developer and open source contributor',
		joinedAt: '2023-03-22',
	},
	'789': {
		id: '789',
		name: 'Carol Davis',
		email: 'carol@example.com',
		bio: 'DevOps engineer specializing in cloud infrastructure',
		joinedAt: '2023-06-10',
	},
};

export default defineHandler(event => {
	const userId = getRouterParam(event, 'id');

	if (!userId) {
		throw new HTTPError('User ID is required', { status: 400 });
	}

	const profile = userProfiles[userId];

	if (!profile) {
		throw new HTTPError('User profile not found', { status: 404 });
	}

	return { profile, fetchedAt: new Date().toISOString() };
});
