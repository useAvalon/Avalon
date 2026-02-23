/**
 * Admin Page Middleware - Authentication Guard
 *
 * This middleware runs for all routes under /admin/*.
 * It demonstrates:
 * - Authentication checking (via header OR cookie)
 * - Redirecting to login/error pages (proper Preact components)
 * - Context passing (user data)
 *
 * Demo tokens:
 * - demo-admin-token: Full admin access
 * - demo-user-token: User only (will redirect to /admin/forbidden)
 */

import { defineMiddleware } from '@avalon/avalon/middleware';
import { getHeader, getCookie, getRequestURL } from 'h3';

export default defineMiddleware(async event => {
	const path = getRequestURL(event).pathname || '';

	// Skip middleware for login and forbidden pages (avoid redirect loops)
	if (path.includes('/admin/login') || path.includes('/admin/forbidden')) {
		return;
	}

	// Check for token in Authorization header first, then fall back to cookie
	const authHeader = getHeader(event, 'Authorization');
	const cookieToken = getCookie(event, 'auth_token');

	const token = authHeader || (cookieToken ? `Bearer ${cookieToken}` : null);
	console.log(
		'[admin middleware]',
		token ? 'Token found' : 'No token',
		authHeader ? '(header)' : cookieToken ? '(cookie)' : '',
	);

	// No token - redirect to login page
	if (!token) {
		return Response.redirect(new URL('/admin/login', 'http://localhost:8012').href, 302);
	}

	// Validate the token
	try {
		const user = await validateToken(token);
		console.log('[admin middleware] User:', user.email, 'Roles:', user.roles);

		// Check for admin role - redirect to forbidden page if not admin
		if (!user.roles?.includes('admin')) {
			return Response.redirect(new URL('/admin/forbidden', 'http://localhost:8012').href, 302);
		}

		// Store user in context for downstream handlers
		event.context.user = user;
		console.log(`[admin middleware] ✅ Authenticated: ${user.email}`);
	} catch (error) {
		// Invalid token - redirect to login
		console.log('[admin middleware] Invalid token, redirecting to login');
		return Response.redirect(new URL('/admin/login', 'http://localhost:8012').href, 302);
	}

	// Return nothing to continue to the actual page
});

/**
 * Example token validation function
 */
async function validateToken(token: string): Promise<{
	id: string;
	email: string;
	roles: string[];
}> {
	const cleanToken = token.replace(/^Bearer\s+/i, '');

	if (cleanToken === 'demo-admin-token') {
		return { id: 'admin-123', email: 'admin@example.com', roles: ['admin', 'user'] };
	}

	if (cleanToken === 'demo-user-token') {
		return { id: 'user-456', email: 'user@example.com', roles: ['user'] };
	}

	throw new Error('Invalid token');
}
