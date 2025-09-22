import { assertEquals, assertExists } from 'jsr:@std/assert';
import { MiddlewareDiscovery } from '../middleware-discovery.ts';
import { MiddlewareExecutor } from '../middleware-executor.ts';
import { MiddlewareContextManager } from '../middleware-context.ts';
import type { MiddlewareHandler, MiddlewareContext } from '../../../schemas/middleware.ts';

/**
 * Unit tests for middleware integration with server components
 * Requirements: 5.1, 5.2
 */

Deno.test('Server Middleware Integration - Unit Tests', async t => {
	await t.step('should initialize middleware discovery system', async () => {
		const discovery = new MiddlewareDiscovery({
			baseDirectory: 'src',
			filePattern: '_middleware.ts',
			excludeDirectories: ['node_modules', '.git', 'dist'],
			developmentMode: true,
		});

		assertExists(discovery);

		// Test discovery without actual middleware files
		const routes = await discovery.discoverMiddleware();
		assertEquals(Array.isArray(routes), true);
	});

	await t.step('should initialize middleware executor', () => {
		const executor = new MiddlewareExecutor({
			developmentMode: true,
			enableLogging: false,
		});

		assertExists(executor);

		const config = executor.getConfig();
		assertEquals(config.developmentMode, true);
		assertEquals(config.enableLogging, false);
	});

	await t.step('should create middleware context', () => {
		const request = new Request('http://localhost:8080/test?param=value');
		const context = MiddlewareContextManager.createContext(request);

		assertExists(context);
		assertEquals(context.url.pathname, '/test');
		assertEquals(context.query.param, 'value');
		assertEquals(context.request, request);
		assertExists(context.state);
		assertExists(context.locals);
	});

	await t.step('should execute empty middleware chain', async () => {
		const executor = new MiddlewareExecutor({
			developmentMode: true,
			enableLogging: false,
		});

		const request = new Request('http://localhost:8080/test');
		const context = MiddlewareContextManager.createContext(request);

		const result = await executor.execute([], context);

		assertExists(result);
		assertEquals(result.response, undefined); // No middleware, no response
		assertEquals(result.metadata.middlewareExecuted, 0);
		assertEquals(result.metadata.earlyTermination, false);
	});

	await t.step('should execute middleware chain with mock middleware', async () => {
		const executor = new MiddlewareExecutor({
			developmentMode: true,
			enableLogging: false,
		});

		// Mock middleware that adds data to context
		const mockMiddleware: MiddlewareHandler = async (context, next) => {
			context.locals.middlewareExecuted = true;
			const result = await next();
			return result;
		};

		const request = new Request('http://localhost:8080/test');
		const context = MiddlewareContextManager.createContext(request);

		const result = await executor.execute([mockMiddleware], context);

		assertExists(result);
		assertEquals(result.response, undefined); // No early termination
		assertEquals(result.metadata.middlewareExecuted, 1);
		assertEquals(result.context.locals.middlewareExecuted, true);
	});

	await t.step('should handle middleware early termination', async () => {
		const executor = new MiddlewareExecutor({
			developmentMode: true,
			enableLogging: false,
		});

		// Mock middleware that returns early response
		const earlyTerminationMiddleware: MiddlewareHandler = async () => {
			return {
				response: new Response('Early termination', { status: 200 }),
				continue: false,
			};
		};

		const request = new Request('http://localhost:8080/test');
		const context = MiddlewareContextManager.createContext(request);

		const result = await executor.execute([earlyTerminationMiddleware], context);

		assertExists(result);
		assertExists(result.response);
		assertEquals(result.metadata.middlewareExecuted, 1);
		assertEquals(result.metadata.earlyTermination, true);
		assertEquals(await result.response.text(), 'Early termination');
	});
});

Deno.test('Server Middleware Integration - Context Management', async t => {
	await t.step('should manage middleware state correctly', () => {
		const request = new Request('http://localhost:8080/test');
		const context = MiddlewareContextManager.createContext(request);

		// Test state management
		MiddlewareContextManager.setState(context, 'testKey', 'testValue');
		assertEquals(MiddlewareContextManager.getState(context, 'testKey'), 'testValue');
		assertEquals(MiddlewareContextManager.hasState(context, 'testKey'), true);

		// Test locals management
		MiddlewareContextManager.setLocal(context, 'localKey', 'localValue');
		assertEquals(MiddlewareContextManager.getLocal(context, 'localKey'), 'localValue');
		assertEquals(MiddlewareContextManager.hasLocal(context, 'localKey'), true);
	});

	await t.step('should extract route parameters correctly', () => {
		const url = new URL('http://localhost:8080/users/123/posts/456');
		const pattern = new URLPattern({ pathname: '/users/:userId/posts/:postId' });

		const params = MiddlewareContextManager.extractRouteParams(url, pattern);
		assertEquals(params.userId, '123');
		assertEquals(params.postId, '456');
	});

	await t.step('should validate context correctly', () => {
		const request = new Request('http://localhost:8080/test');
		const context = MiddlewareContextManager.createContext(request);

		assertEquals(MiddlewareContextManager.validateContext(context), true);
		assertEquals(MiddlewareContextManager.validateContext({}), false);
		assertEquals(MiddlewareContextManager.validateContext(null), false);
	});

	await t.step('should clone context correctly', () => {
		const request = new Request('http://localhost:8080/test');
		const context = MiddlewareContextManager.createContext(request);

		MiddlewareContextManager.setState(context, 'original', 'value');
		MiddlewareContextManager.setLocal(context, 'local', 'data');

		const cloned = MiddlewareContextManager.cloneContext(context);

		// Should be different objects
		assertEquals(context === cloned, false);
		assertEquals(context.state === cloned.state, false);
		assertEquals(context.locals === cloned.locals, false);

		// But should have same data
		assertEquals(MiddlewareContextManager.getState(cloned, 'original'), 'value');
		assertEquals(MiddlewareContextManager.getLocal(cloned, 'local'), 'data');
	});
});

Deno.test('Server Middleware Integration - URL Pattern Matching', async t => {
	await t.step('should build middleware chain for different URL patterns', async () => {
		const discovery = new MiddlewareDiscovery({
			baseDirectory: 'src',
			filePattern: '_middleware.ts',
			excludeDirectories: ['node_modules', '.git', 'dist'],
			developmentMode: true,
		});

		// Test different URL patterns
		const pageUrl = new URL('http://localhost:8080/about');
		const apiUrl = new URL('http://localhost:8080/api/users');
		const rootUrl = new URL('http://localhost:8080/');

		const pageChain = await discovery.buildMiddlewareChain(pageUrl);
		const apiChain = await discovery.buildMiddlewareChain(apiUrl);
		const rootChain = await discovery.buildMiddlewareChain(rootUrl);

		// All should return arrays (even if empty)
		assertEquals(Array.isArray(pageChain), true);
		assertEquals(Array.isArray(apiChain), true);
		assertEquals(Array.isArray(rootChain), true);
	});

	await t.step('should handle cache operations correctly', () => {
		const discovery = new MiddlewareDiscovery({
			baseDirectory: 'src',
			filePattern: '_middleware.ts',
			excludeDirectories: ['node_modules', '.git', 'dist'],
			developmentMode: true,
		});

		// Test cache operations
		const initialStats = discovery.getCacheStats();
		assertEquals(typeof initialStats.middlewareCount, 'number');
		assertEquals(typeof initialStats.routeCacheCount, 'number');

		// Clear cache
		discovery.clearCache();
		const clearedStats = discovery.getCacheStats();
		assertEquals(clearedStats.middlewareCount, 0);
		assertEquals(clearedStats.routeCacheCount, 0);
	});
});
