/**
 * API CORS Middleware (Global)
 *
 * Adds CORS headers for API routes and handles OPTIONS preflight.
 */

import { defineMiddleware } from '@avalon/avalon/middleware';

export default defineMiddleware((event) => {
	if (!event.url.pathname.startsWith('/api')) {
		return;
	}

	event.res.headers.set('Access-Control-Allow-Origin', '*');
	event.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
	event.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
	event.res.headers.set('Access-Control-Max-Age', '86400');

	if (event.req.method === 'OPTIONS') {
		return new Response(null, { status: 204 });
	}
});
