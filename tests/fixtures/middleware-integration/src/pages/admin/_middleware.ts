/**
 * Admin-specific middleware fixture for integration tests
 * Simulates authentication and authorization for admin routes
 */

import type { MiddlewareHandler } from '../../../../../../packages/avalon/src/schemas/middleware.ts';

const adminMiddleware: MiddlewareHandler = async (context: any, next: any) => {
	// Mark that admin middleware executed
	context.state.set('adminMiddlewareExecuted', true);

	// Check for authentication
	const authHeader = context.request.headers.get('Authorization');
	const sessionId = context.locals.sessionId;

	if (!authHeader && !sessionId) {
		return {
			response: new Response(JSON.stringify({ error: 'Authentication required' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}),
			continue: false,
		};
	}

	// Simulate user authentication
	let user = null;
	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.slice(7);
		// Mock token validation
		if (token === 'admin-token') {
			user = { id: 'admin', role: 'admin', name: 'Admin User' };
		} else if (token === 'user-token') {
			user = { id: 'user', role: 'user', name: 'Regular User' };
		}
	} else if (sessionId === 'admin-session') {
		user = { id: 'admin', role: 'admin', name: 'Admin User' };
	}

	if (!user) {
		return {
			response: new Response(JSON.stringify({ error: 'Invalid credentials' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}),
			continue: false,
		};
	}

	// Check admin role
	if (user.role !== 'admin') {
		return {
			response: new Response(JSON.stringify({ error: 'Admin access required' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' },
			}),
			continue: false,
		};
	}

	// Set authenticated user in context
	context.locals.user = user;
	context.state.set('authenticated', true);
	context.state.set('userRole', user.role);

	return await next();
};

export default adminMiddleware;
