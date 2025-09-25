import type { MiddlewareHandler } from '@avalon/avalon';

const middleware: MiddlewareHandler = async (context, next) => {
	const start = Date.now();

	console.log(`🔌 API ${context.request.method} ${context.url.pathname} - Started`);

	// Store CORS headers in context state for later application
	context.state.set('corsHeaders', {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	});

	const result = await next();

	const duration = Date.now() - start;
	console.log(`✅ API ${context.request.method} ${context.url.pathname} - Completed in ${duration}ms`);

	return result;
};

export default middleware;
