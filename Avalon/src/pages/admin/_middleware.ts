/**
 * Admin Page Middleware - Authentication Guard
 *
 * Runs for all routes under /admin/*.
 * Checks for auth token in header or cookie, validates it,
 * and redirects to login/forbidden as needed.
 *
 * Demo tokens:
 * - demo-admin-token: Full admin access
 * - demo-user-token: User only (redirects to /admin/forbidden)
 */

import { defineMiddleware } from '@avalon/avalon/middleware';
import { getCookie } from 'h3';

export default defineMiddleware(async (event) => {
	const path = event.url.pathname || '';

	// Skip middleware for login and forbidden pages (avoid redirect loops)
	if (path.includes('/admin/login') || path.includes('/admin/forbidden')) {
		return;
	}

	// Check for token in Authorization header first, then fall back to cookie
	const authHeader = event.req.headers.get('Authorization');
	const cookieToken = getCookie(event, 'auth_token');

	const token = authHeader || (cookieToken ? `Bearer ${cookieToken}` : null);

	// No token — redirect to login page
	if (!token) {
		return Response.redirect(new URL('/admin/login', 'http://localhost:8012').href, 302);
	}

	// Validate the token
	try {
		const user = await validateToken(token);

		// Check for admin role
		if (!user.roles?.includes('admin')) {
			return Response.redirect(new URL('/admin/forbidden', 'http://localhost:8012').href, 302);
		}

		event.context.user = user;
	} catch {
		return Response.redirect(new URL('/admin/login', 'http://localhost:8012').href, 302);
	}
});

async function validateToken(token: string): Promise<{ id: string; email: string; roles: string[] }> {
	const cleanToken = token.replace(/^Bearer\s+/i, '');

	if (cleanToken === 'demo-admin-token') {
		return { id: 'admin-123', email: 'admin@example.com', roles: ['admin', 'user'] };
	}
	if (cleanToken === 'demo-user-token') {
		return { id: 'user-456', email: 'user@example.com', roles: ['user'] };
	}

	throw new Error('Invalid token');
}
