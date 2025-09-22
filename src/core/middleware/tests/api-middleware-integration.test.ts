/**
 * Integration tests for API middleware support
 *  3.1, 3.3, 3.4, 5.2
 */

import { assertEquals, assertExists } from 'jsr:@std/assert';
import { handleApiRequest } from '../../../functions/api.ts';
import type { ApiRoute, ApiContext } from '../../../schemas/api.ts';
import type { MiddlewareContext } from '../../../schemas/middleware.ts';

// Mock API route for testing
const mockApiRoute: ApiRoute = {
	pattern: new URLPattern({ pathname: '/api/test/:id' }),
	config: {
		GET: async (context: ApiContext) => {
			return new Response(
				JSON.stringify({
					method: 'GET',
					params: context.params,
					query: context.query,
					hasState: !!context.state,
					hasLocals: !!context.locals,
					stateValue: context.state?.get('testKey'),
					localsValue: context.locals?.testLocal,
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		},
		POST: async (context: ApiContext) => {
			return new Response(
				JSON.stringify({
					method: 'POST',
					params: context.params,
					query: context.query,
					hasState: !!context.state,
					hasLocals: !!context.locals,
					stateValue: context.state?.get('postData'),
					localsValue: context.locals?.authUser,
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		},
	},
	filePath: 'test/[id].ts',
	paramNames: ['id'],
};

// Mock API route with single handler function
const mockSingleHandlerRoute: ApiRoute = {
	pattern: new URLPattern({ pathname: '/api/single' }),
	config: async (context: ApiContext) => {
		return new Response(
			JSON.stringify({
				hasMiddlewareData: !!(context.state || context.locals),
				stateKeys: context.state ? Array.from(context.state.keys()) : [],
				localsKeys: context.locals ? Object.keys(context.locals) : [],
			}),
			{
				headers: { 'Content-Type': 'application/json' },
			}
		);
	},
	filePath: 'single.ts',
	paramNames: [],
};

Deno.test('API Middleware Integration - Basic middleware context passing', async () => {
	const request = new Request('http://localhost:3000/api/test/123?filter=active&sort=name');

	// Create middleware context with state and locals
	const middlewareContext: MiddlewareContext = {
		request,
		url: new URL(request.url),
		params: { id: '123' },
		query: { filter: 'active', sort: 'name' },
		state: new Map([['testKey', 'testValue']]),
		locals: { testLocal: 'localValue', authUser: 'john_doe' },
	};

	const response = await handleApiRequest(request, [mockApiRoute], middlewareContext);

	assertEquals(response.status, 200);

	const responseData = await response.json();
	assertEquals(responseData.method, 'GET');
	assertEquals(responseData.params, { id: '123' });
	assertEquals(responseData.query, { filter: 'active', sort: 'name' });
	assertEquals(responseData.hasState, true);
	assertEquals(responseData.hasLocals, true);
	assertEquals(responseData.stateValue, 'testValue');
	assertEquals(responseData.localsValue, 'localValue');
});

Deno.test('API Middleware Integration - POST request with middleware context', async () => {
	const request = new Request('http://localhost:3000/api/test/456', {
		method: 'POST',
		body: JSON.stringify({ data: 'test' }),
		headers: { 'Content-Type': 'application/json' },
	});

	// Create middleware context with different state and locals
	const middlewareContext: MiddlewareContext = {
		request,
		url: new URL(request.url),
		params: { id: '456' },
		query: {},
		state: new Map([['postData', { submitted: true }]]),
		locals: { authUser: 'jane_doe', role: 'admin' },
	};

	const response = await handleApiRequest(request, [mockApiRoute], middlewareContext);

	assertEquals(response.status, 200);

	const responseData = await response.json();
	assertEquals(responseData.method, 'POST');
	assertEquals(responseData.params, { id: '456' });
	assertEquals(responseData.hasState, true);
	assertEquals(responseData.hasLocals, true);
	assertEquals(responseData.stateValue, { submitted: true });
	assertEquals(responseData.localsValue, 'jane_doe');
});

Deno.test('API Middleware Integration - Without middleware context (backward compatibility)', async () => {
	const request = new Request('http://localhost:3000/api/test/789?page=1');

	const response = await handleApiRequest(request, [mockApiRoute]);

	assertEquals(response.status, 200);

	const responseData = await response.json();
	assertEquals(responseData.method, 'GET');
	assertEquals(responseData.params, { id: '789' });
	assertEquals(responseData.query, { page: '1' });
	assertEquals(responseData.hasState, false);
	assertEquals(responseData.hasLocals, false);
	assertEquals(responseData.stateValue, undefined);
	assertEquals(responseData.localsValue, undefined);
});

Deno.test('API Middleware Integration - Single handler function with middleware', async () => {
	const request = new Request('http://localhost:3000/api/single');

	const middlewareContext: MiddlewareContext = {
		request,
		url: new URL(request.url),
		params: {},
		query: {},
		state: new Map([
			['key1', 'value1'],
			['key2', 'value2'],
		]),
		locals: { local1: 'localValue1', local2: 'localValue2' },
	};

	const response = await handleApiRequest(request, [mockSingleHandlerRoute], middlewareContext);

	assertEquals(response.status, 200);

	const responseData = await response.json();
	assertEquals(responseData.hasMiddlewareData, true);
	assertEquals(responseData.stateKeys, ['key1', 'key2']);
	assertEquals(responseData.localsKeys, ['local1', 'local2']);
});

Deno.test('API Middleware Integration - Parameter extraction from middleware context', async () => {
	const request = new Request('http://localhost:3000/api/test/original-id?original=param');

	// Middleware context with transformed parameters
	const middlewareContext: MiddlewareContext = {
		request,
		url: new URL(request.url),
		params: { id: 'transformed-id' }, // Middleware transformed the parameter
		query: { transformed: 'param', validated: 'true' }, // Middleware added validation
		state: new Map([['testKey', 'passed']]),
		locals: { testLocal: 'middleware' },
	};

	const response = await handleApiRequest(request, [mockApiRoute], middlewareContext);

	assertEquals(response.status, 200);

	const responseData = await response.json();
	// Should use middleware-processed parameters, not original URL parameters
	assertEquals(responseData.params, { id: 'transformed-id' });
	assertEquals(responseData.query, { transformed: 'param', validated: 'true' });
	assertEquals(responseData.stateValue, 'passed');
	assertEquals(responseData.localsValue, 'middleware');
});

Deno.test('API Middleware Integration - Query parameter parsing with multiple values', async () => {
	const request = new Request('http://localhost:3000/api/test/123?tags=tag1&tags=tag2&category=test');

	// Middleware context with processed query parameters
	const middlewareContext: MiddlewareContext = {
		request,
		url: new URL(request.url),
		params: { id: '123' },
		query: {
			tags: ['tag1', 'tag2'], // Multiple values as array
			category: 'test',
			processed: 'true', // Added by middleware
		},
		state: new Map(),
		locals: {},
	};

	const response = await handleApiRequest(request, [mockApiRoute], middlewareContext);

	assertEquals(response.status, 200);

	const responseData = await response.json();
	assertEquals(responseData.params, { id: '123' });
	assertEquals(responseData.query, {
		tags: ['tag1', 'tag2'],
		category: 'test',
		processed: 'true',
	});
});

Deno.test('API Middleware Integration - Error handling with middleware context', async () => {
	// Create a route that throws an error
	const errorRoute: ApiRoute = {
		pattern: new URLPattern({ pathname: '/api/error' }),
		config: {
			GET: async (context: ApiContext) => {
				// Access middleware locals to determine error handling mode
				const isDev = context.locals?.developmentMode === true;
				throw new Error('Test error for middleware integration');
			},
		},
		filePath: 'error.ts',
		paramNames: [],
	};

	const request = new Request('http://localhost:3000/api/error');

	const middlewareContext: MiddlewareContext = {
		request,
		url: new URL(request.url),
		params: {},
		query: {},
		state: new Map(),
		locals: { developmentMode: true }, // Enable development mode error details
	};

	const response = await handleApiRequest(request, [errorRoute], middlewareContext);

	assertEquals(response.status, 500);

	const responseData = await response.json();
	assertEquals(responseData.error, 'Internal Server Error');
	// Should include details in development mode
	assertExists(responseData.details);
	assertEquals(responseData.route, 'error.ts');
});

Deno.test('API Middleware Integration - Method not allowed with middleware context', async () => {
	const request = new Request('http://localhost:3000/api/test/123', {
		method: 'DELETE', // Not supported by mockApiRoute
	});

	const middlewareContext: MiddlewareContext = {
		request,
		url: new URL(request.url),
		params: { id: '123' },
		query: {},
		state: new Map(),
		locals: {},
	};

	const response = await handleApiRequest(request, [mockApiRoute], middlewareContext);

	assertEquals(response.status, 405); // Method Not Allowed

	const allowHeader = response.headers.get('Allow');
	assertExists(allowHeader);
	// Should include the allowed methods
	assertEquals(allowHeader.includes('GET'), true);
	assertEquals(allowHeader.includes('POST'), true);
});

Deno.test('API Middleware Integration - Route not found', async () => {
	const request = new Request('http://localhost:3000/api/nonexistent');

	const middlewareContext: MiddlewareContext = {
		request,
		url: new URL(request.url),
		params: {},
		query: {},
		state: new Map(),
		locals: {},
	};

	const response = await handleApiRequest(request, [mockApiRoute], middlewareContext);

	assertEquals(response.status, 404);

	const responseData = await response.json();
	assertEquals(responseData.error, 'API route not found');
});
