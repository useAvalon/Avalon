import { assertEquals, assertExists, assert } from '@std/assert';
import { describe, it, beforeEach } from '@std/testing/bdd';
import { MiddlewareContextManager } from '../middleware-context.ts';
import { MiddlewareContext } from '../../../schemas/middleware.ts';

describe('MiddlewareContextManager', () => {
	let mockRequest: Request;
	let mockUrl: URL;

	beforeEach(() => {
		mockUrl = new URL('https://example.com/test?param1=value1&param2=value2&param2=value3');
		mockRequest = new Request(mockUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: 'Bearer token123',
			},
			body: JSON.stringify({ test: 'data' }),
		});
	});

	describe('createContext', () => {
		it('should create a basic middleware context', () => {
			const context = MiddlewareContextManager.createContext(mockRequest);

			assertExists(context);
			assertEquals(context.request, mockRequest);
			assertEquals(context.url.toString(), mockUrl.toString());
			assertEquals(typeof context.params, 'object');
			assertEquals(typeof context.query, 'object');
			assert(context.state instanceof Map);
			assertEquals(typeof context.locals, 'object');
		});

		it('should include provided route parameters', () => {
			const params = { id: '123', slug: 'test-post' };
			const context = MiddlewareContextManager.createContext(mockRequest, params);

			assertEquals(context.params, params);
		});

		it('should parse query string correctly', () => {
			const context = MiddlewareContextManager.createContext(mockRequest);

			assertEquals(context.query.param1, 'value1');
			assertEquals(context.query.param2, ['value2', 'value3']); // Multiple values as array
		});

		it('should initialize empty state and locals', () => {
			const context = MiddlewareContextManager.createContext(mockRequest);

			assertEquals(context.state.size, 0);
			assertEquals(Object.keys(context.locals).length, 0);
		});
	});

	describe('initializeContext', () => {
		it('should initialize context with route params and additional locals', () => {
			const routeParams = { userId: '456' };
			const additionalLocals = { authUser: { id: 456, name: 'Test User' } };

			const context = MiddlewareContextManager.initializeContext(mockRequest, routeParams, additionalLocals);

			assertEquals(context.params, routeParams);
			assertEquals(context.locals.authUser, additionalLocals.authUser);
		});

		it('should work with empty parameters', () => {
			const context = MiddlewareContextManager.initializeContext(mockRequest);

			assertEquals(context.params, {});
			assertEquals(context.locals, {});
		});
	});

	describe('extractRouteParams', () => {
		it('should extract parameters from URL pattern', () => {
			const pattern = new URLPattern({ pathname: '/users/:id/posts/:postId' });
			const url = new URL('https://example.com/users/123/posts/456');

			const params = MiddlewareContextManager.extractRouteParams(url, pattern);

			assertEquals(params.id, '123');
			assertEquals(params.postId, '456');
		});

		it('should return empty object for non-matching pattern', () => {
			const pattern = new URLPattern({ pathname: '/different/:id' });
			const url = new URL('https://example.com/users/123');

			const params = MiddlewareContextManager.extractRouteParams(url, pattern);

			assertEquals(params, {});
		});
	});

	describe('state management', () => {
		let context: MiddlewareContext;

		beforeEach(() => {
			context = MiddlewareContextManager.createContext(mockRequest);
		});

		it('should set and get state values', () => {
			const testValue = { user: 'test', id: 123 };
			MiddlewareContextManager.setState(context, 'userData', testValue);

			const retrieved = MiddlewareContextManager.getState(context, 'userData');
			assertEquals(retrieved, testValue);
		});

		it('should return undefined for non-existent state keys', () => {
			const retrieved = MiddlewareContextManager.getState(context, 'nonExistent');
			assertEquals(retrieved, undefined);
		});

		it('should check if state key exists', () => {
			MiddlewareContextManager.setState(context, 'testKey', 'testValue');

			assert(MiddlewareContextManager.hasState(context, 'testKey'));
			assert(!MiddlewareContextManager.hasState(context, 'nonExistent'));
		});

		it('should delete state values', () => {
			MiddlewareContextManager.setState(context, 'toDelete', 'value');
			assert(MiddlewareContextManager.hasState(context, 'toDelete'));

			const deleted = MiddlewareContextManager.deleteState(context, 'toDelete');
			assert(deleted);
			assert(!MiddlewareContextManager.hasState(context, 'toDelete'));
		});

		it('should clear all state', () => {
			MiddlewareContextManager.setState(context, 'key1', 'value1');
			MiddlewareContextManager.setState(context, 'key2', 'value2');
			assertEquals(context.state.size, 2);

			MiddlewareContextManager.clearState(context);
			assertEquals(context.state.size, 0);
		});
	});

	describe('locals management', () => {
		let context: MiddlewareContext;

		beforeEach(() => {
			context = MiddlewareContextManager.createContext(mockRequest);
		});

		it('should set and get locals values', () => {
			const testValue = { cors: true, headers: ['*'] };
			MiddlewareContextManager.setLocal(context, 'corsConfig', testValue);

			const retrieved = MiddlewareContextManager.getLocal(context, 'corsConfig');
			assertEquals(retrieved, testValue);
		});

		it('should return undefined for non-existent locals keys', () => {
			const retrieved = MiddlewareContextManager.getLocal(context, 'nonExistent');
			assertEquals(retrieved, undefined);
		});

		it('should check if locals key exists', () => {
			MiddlewareContextManager.setLocal(context, 'testKey', 'testValue');

			assert(MiddlewareContextManager.hasLocal(context, 'testKey'));
			assert(!MiddlewareContextManager.hasLocal(context, 'nonExistent'));
		});

		it('should delete locals values', () => {
			MiddlewareContextManager.setLocal(context, 'toDelete', 'value');
			assert(MiddlewareContextManager.hasLocal(context, 'toDelete'));

			const deleted = MiddlewareContextManager.deleteLocal(context, 'toDelete');
			assert(deleted);
			assert(!MiddlewareContextManager.hasLocal(context, 'toDelete'));
		});

		it('should merge locals objects', () => {
			MiddlewareContextManager.setLocal(context, 'existing', 'value');

			const newLocals = {
				cors: { enabled: true },
				auth: { required: false },
			};

			MiddlewareContextManager.mergeLocals(context, newLocals);

			assertEquals(MiddlewareContextManager.getLocal(context, 'existing'), 'value');
			assertEquals(MiddlewareContextManager.getLocal(context, 'cors'), newLocals.cors);
			assertEquals(MiddlewareContextManager.getLocal(context, 'auth'), newLocals.auth);
		});
	});

	describe('cloneContext', () => {
		let originalContext: MiddlewareContext;

		beforeEach(() => {
			originalContext = MiddlewareContextManager.createContext(mockRequest, { id: '123' });
			MiddlewareContextManager.setState(originalContext, 'testState', 'value');
			MiddlewareContextManager.setLocal(originalContext, 'testLocal', 'value');
		});

		it('should create a deep copy of context', () => {
			const cloned = MiddlewareContextManager.cloneContext(originalContext);

			// Should be different objects
			assert(cloned !== originalContext);
			assert(cloned.params !== originalContext.params);
			assert(cloned.query !== originalContext.query);
			assert(cloned.state !== originalContext.state);
			assert(cloned.locals !== originalContext.locals);

			// But should have same values
			assertEquals(cloned.request, originalContext.request);
			assertEquals(cloned.url, originalContext.url);
			assertEquals(cloned.params, originalContext.params);
			assertEquals(cloned.query, originalContext.query);
			assertEquals(MiddlewareContextManager.getState(cloned, 'testState'), 'value');
			assertEquals(MiddlewareContextManager.getLocal(cloned, 'testLocal'), 'value');
		});

		it('should apply modifications to cloned context', () => {
			const modifications = {
				params: { newId: '456' },
				locals: { newLocal: 'newValue' },
			};

			const cloned = MiddlewareContextManager.cloneContext(originalContext, modifications);

			assertEquals(cloned.params, modifications.params);
			assertEquals(cloned.locals, modifications.locals);
			// Original should be unchanged
			assertEquals(originalContext.params.id, '123');
			assert(!MiddlewareContextManager.hasLocal(originalContext, 'newLocal'));
		});
	});

	describe('validateContext', () => {
		it('should validate a proper middleware context', () => {
			const context = MiddlewareContextManager.createContext(mockRequest);
			assert(MiddlewareContextManager.validateContext(context));
		});

		it('should reject invalid contexts', () => {
			assert(!MiddlewareContextManager.validateContext(null));
			assert(!MiddlewareContextManager.validateContext(undefined));
			assert(!MiddlewareContextManager.validateContext({}));
			assert(
				!MiddlewareContextManager.validateContext({
					request: 'not a request',
					url: new URL('https://example.com'),
					params: {},
					query: {},
					state: new Map(),
					locals: {},
				})
			);
		});
	});

	describe('utility methods', () => {
		let context: MiddlewareContext;

		beforeEach(() => {
			context = MiddlewareContextManager.createContext(mockRequest);
		});

		it('should serialize context for debugging', () => {
			MiddlewareContextManager.setState(context, 'testState', 'stateValue');
			MiddlewareContextManager.setLocal(context, 'testLocal', 'localValue');

			const serialized = MiddlewareContextManager.serializeContext(context);

			assertEquals(serialized.url, mockUrl.toString());
			assertEquals(serialized.method, 'POST');
			assertEquals(serialized.state, { testState: 'stateValue' });
			assertEquals(serialized.locals, { testLocal: 'localValue' });
		});

		it('should get request headers as object', () => {
			const headers = MiddlewareContextManager.getRequestHeaders(context);

			assertEquals(headers['content-type'], 'application/json');
			assertEquals(headers['authorization'], 'Bearer token123');
		});

		it('should get request method', () => {
			assertEquals(MiddlewareContextManager.getMethod(context), 'POST');
		});

		it('should check if method matches', () => {
			assert(MiddlewareContextManager.isMethod(context, 'POST'));
			assert(MiddlewareContextManager.isMethod(context, 'GET', 'POST', 'PUT'));
			assert(!MiddlewareContextManager.isMethod(context, 'GET'));
		});

		it('should get pathname', () => {
			assertEquals(MiddlewareContextManager.getPathname(context), '/test');
		});

		it('should match path patterns', () => {
			assert(MiddlewareContextManager.matchesPath(context, '/test'));
			assert(MiddlewareContextManager.matchesPath(context, '/'));
			assert(MiddlewareContextManager.matchesPath(context, /^\/test/));
			assert(!MiddlewareContextManager.matchesPath(context, '/other'));
		});

		it('should check content type', () => {
			assert(MiddlewareContextManager.hasContentType(context, 'application/json'));
			assert(MiddlewareContextManager.hasContentType(context, 'json'));
			assert(!MiddlewareContextManager.hasContentType(context, 'text/html'));
		});
	});

	describe('async request body methods', () => {
		it('should get request body as text', async () => {
			const context = MiddlewareContextManager.createContext(mockRequest);
			const body = await MiddlewareContextManager.getRequestBody(context);
			assertEquals(body, '{"test":"data"}');
		});

		it('should get request body as JSON', async () => {
			const context = MiddlewareContextManager.createContext(mockRequest);
			const json = await MiddlewareContextManager.getRequestJSON(context);
			assertEquals(json, { test: 'data' });
		});

		it('should handle invalid JSON gracefully', async () => {
			const invalidJsonRequest = new Request('https://example.com', {
				method: 'POST',
				body: 'invalid json',
			});
			const context = MiddlewareContextManager.createContext(invalidJsonRequest);

			const json = await MiddlewareContextManager.getRequestJSON(context);
			assertEquals(json, null);
		});

		it('should handle empty body gracefully', async () => {
			const emptyRequest = new Request('https://example.com');
			const context = MiddlewareContextManager.createContext(emptyRequest);

			const body = await MiddlewareContextManager.getRequestBody(context);
			assertEquals(body, '');
		});
	});
});
