import type { MiddlewareHandler } from '@avalon/avalon';

const middleware: MiddlewareHandler = async (context, next) => {
	const start = Date.now();
	const userAgent = context.request.headers.get('user-agent') || 'Unknown';

	console.log(`🌐 ${context.request.method} ${context.url.pathname} - ${userAgent.split(' ')[0]}`);

	// Store security headers in context state for later application
	context.state.set('securityHeaders', {
		'X-Frame-Options': 'DENY',
		'X-Content-Type-Options': 'nosniff',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
	});

	const result = await next();

	const duration = Date.now() - start;
	console.log(`✅ ${context.request.method} ${context.url.pathname} - ${duration}ms`);

	return result;
};

export default middleware;
