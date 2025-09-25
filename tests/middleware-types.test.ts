import { assertEquals, assertExists } from '@std/assert';
import {
	type MiddlewareContext,
	type MiddlewareResponse,
	type MiddlewareHandler,
	type MiddlewareRoute,
	type MiddlewareChain,
	isMiddlewareContext,
	isMiddlewareResponse,
	isMiddlewareRoute,
	isMiddlewareChain,
} from '../src/schemas/middleware.ts';
import { safeValidators } from '../src/schemas/index.ts';

Deno.test('Middleware Types - MiddlewareContext interface', () => {
	const mockContext: MiddlewareContext = {
		request: new Request('https://example.com/test'),
		url: new URL('https://example.com/test'),
		params: { id: '123' },
		query: { search: 'test', tags: ['tag1', 'tag2'] },
		state: new Map([['user', { id: 1, name: 'Test User' }]]),
		locals: { startTime: Date.now() },
	};

	// Verify all required properties exist
	assertExists(mockContext.request);
	assertExists(mockContext.url);
	assertExists(mockContext.params);
	assertExists(mockContext.query);
	assertExists(mockContext.state);
	assertExists(mockContext.locals);

	// Verify type guard works
	assertEquals(isMiddlewareContext(mockContext), true);
	assertEquals(isMiddlewareContext({}), false);
});

Deno.test('Middleware Types - MiddlewareResponse interface', () => {
	const mockResponse: MiddlewareResponse = {
		response: new Response('Hello World'),
		continue: false,
	};

	const mockContinueResponse: MiddlewareResponse = {
		continue: true,
	};

	// Verify required properties
	assertEquals(mockResponse.continue, false);
	assertEquals(mockContinueResponse.continue, true);
	assertExists(mockResponse.response);

	// Verify type guard works
	assertEquals(isMiddlewareResponse(mockResponse), true);
	assertEquals(isMiddlewareResponse(mockContinueResponse), true);
	assertEquals(isMiddlewareResponse({ continue: 'invalid' }), false);
});

Deno.test('Middleware Types - MiddlewareHandler function type', async () => {
	const mockHandler: MiddlewareHandler = async (context, next) => {
		// Add some data to context
		context.locals.processed = true;

		// Call next middleware
		const result = await next();

		// Return result
		return result;
	};

	const mockContext: MiddlewareContext = {
		request: new Request('https://example.com/test'),
		url: new URL('https://example.com/test'),
		params: {},
		query: {},
		state: new Map(),
		locals: {},
	};

	const mockNext = async (): Promise<MiddlewareResponse> => ({
		continue: true,
	});

	// Test handler execution
	const result = await mockHandler(mockContext, mockNext);

	assertEquals(result.continue, true);
	assertEquals(mockContext.locals.processed, true);
});

Deno.test('Middleware Types - MiddlewareRoute interface', () => {
	const mockRoute: MiddlewareRoute = {
		pattern: new URLPattern({ pathname: '/api/*' }),
		middlewarePath: 'src/api/_middleware.ts',
		priority: 1,
		type: 'api',
	};

	// Verify all required properties exist
	assertExists(mockRoute.pattern);
	assertEquals(mockRoute.middlewarePath, 'src/api/_middleware.ts');
	assertEquals(mockRoute.priority, 1);
	assertEquals(mockRoute.type, 'api');

	// Verify type guard works
	assertEquals(isMiddlewareRoute(mockRoute), true);
	assertEquals(isMiddlewareRoute({ pattern: 'invalid' }), false);
});

Deno.test('Middleware Types - MiddlewareChain interface', () => {
	const mockHandler: MiddlewareHandler = async (context, next) => next();

	const mockChain: MiddlewareChain = {
		global: [mockHandler],
		scoped: [mockHandler, mockHandler],
		route: '/api/users',
		totalMiddleware: 3,
	};

	// Verify all required properties exist
	assertEquals(mockChain.global.length, 1);
	assertEquals(mockChain.scoped.length, 2);
	assertEquals(mockChain.route, '/api/users');
	assertEquals(mockChain.totalMiddleware, 3);

	// Verify type guard works
	assertEquals(isMiddlewareChain(mockChain), true);
	assertEquals(isMiddlewareChain({ global: 'invalid' }), false);
});

Deno.test('Middleware Types - Configuration validation', () => {
	const validConfig = {
		developmentMode: true,
		enableLogging: true,
		maxExecutionTime: 5000,
	};

	const invalidConfig = {
		developmentMode: 'invalid',
		maxExecutionTime: -1,
	};

	// Test validators
	const validResult = safeValidators.middlewareConfig(validConfig);
	const invalidResult = safeValidators.middlewareConfig(invalidConfig);

	assertEquals(validResult.success, true);
	assertEquals(invalidResult.success, false);

	if (validResult.success) {
		assertEquals(validResult.data.developmentMode, true);
		assertEquals(validResult.data.enableLogging, true);
		assertEquals(validResult.data.maxExecutionTime, 5000);
	}
});

Deno.test('Middleware Types - Discovery options validation', () => {
	const validOptions = {
		baseDirectory: 'src',
		filePattern: '_middleware.ts',
		enableWatching: true,
		excludeDirectories: ['node_modules', 'dist'],
	};

	const invalidOptions = {
		baseDirectory: 123, // Should be string
		filePattern: '', // Should not be empty
	};

	// Test validators
	const validResult = safeValidators.middlewareDiscoveryOptions(validOptions);
	const invalidResult = safeValidators.middlewareDiscoveryOptions(invalidOptions);

	assertEquals(validResult.success, true);
	assertEquals(invalidResult.success, false);

	if (validResult.success) {
		assertEquals(validResult.data.baseDirectory, 'src');
		assertEquals(validResult.data.filePattern, '_middleware.ts');
		assertEquals(validResult.data.enableWatching, true);
		assertEquals(validResult.data.excludeDirectories?.length, 2);
	}
});
