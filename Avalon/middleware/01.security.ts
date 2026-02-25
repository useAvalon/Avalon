/**
 * Security Middleware (Global)
 *
 * Adds security headers and request logging to all responses.
 */

import { defineMiddleware } from '@avalon/avalon/middleware';

export default defineMiddleware((event) => {
	const start = Date.now();
	const userAgent = event.req.headers.get('user-agent') || 'Unknown';

	console.log(`🌐 ${event.req.method} ${event.url.pathname} - ${userAgent.split(' ')[0]}`);

	event.context.securityHeaders = {
		'X-Frame-Options': 'DENY',
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
	};

	event.context.requestStartTime = start;
});
