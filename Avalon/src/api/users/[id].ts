import type { ApiHandler } from '@avalon/avalon';

// Mock user data
const users = {
	'123': { id: '123', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
	'456': { id: '456', name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
	'789': { id: '789', name: 'Carol Davis', email: 'carol@example.com', role: 'moderator' },
};

export const GET: ApiHandler = async (req, { params }) => {
	const userId = params?.id as string;

	if (!userId) {
		return Response.json({ error: 'User ID is required' }, { status: 400 });
	}

	const user = users[userId as keyof typeof users];

	if (!user) {
		return Response.json(
			{
				error: 'User not found',
				availableIds: Object.keys(users),
			},
			{ status: 404 }
		);
	}

	return Response.json({
		user,
		requestedAt: new Date().toISOString(),
		route: `/api/users/${userId}`,
	});
};
