/**
 * User API Route
 * GET /api/users/:id
 */

import { defineHandler, getRouterParam, HTTPError } from "nitro/h3";

const users: Record<string, { id: string; name: string; email: string; role: string }> = {
	"123": { id: "123", name: "Alice Johnson", email: "alice@example.com", role: "admin" },
	"456": { id: "456", name: "Bob Smith", email: "bob@example.com", role: "user" },
	"789": { id: "789", name: "Carol Davis", email: "carol@example.com", role: "moderator" },
};

export default defineHandler((event) => {
	const userId = getRouterParam(event, "id");

	if (!userId) {
		throw new HTTPError("User ID is required", { status: 400 });
	}

	const user = users[userId];

	if (!user) {
		throw new HTTPError("User not found", { status: 404 });
	}

	return {
		user,
		requestedAt: new Date().toISOString(),
		route: `/api/users/${userId}`,
	};
});
