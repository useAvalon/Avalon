import { describe, it, expect } from 'vitest';
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
} from '../packages/avalon/src/schemas/middleware.ts';
import { safeValidators } from '../packages/avalon/src/schemas/index.ts';

describe('Middleware Types - MiddlewareContext interface', () => {
	it('should validate middleware context', () => {
		const mockContext: MiddlewareContext = {
			request: new Request('https://example.com/test'),
			url: new URL('https://example.com/test'),
			params: { id: '123' },
			query: { search: 'test', tags: ['tag1', 'tag2'] },
			state: new Map([['user', { id: 1, name: 'Test User' }]]),
			locals: { startTime: Date.now() },
		};

		expect(mockContext.request).toBeDefined();
		expect(mockContext.url).toBeDefined();
		expect(mockContext.params).toBeDefined();
		expect(mockContext.query).toBeDefined();
		expect(mockContext.state).toBeDefined();
		expect(mockContext.locals).toBeDefined();

		expect(isMiddlewareContext(mockContext)).toEqual(true);
		expect(isMiddlewareContext({})).toEqual(false);
	});
});

describe('Middleware Types - MiddlewareResponse interface', () => {
	it('should validate middleware response', () => {
		const mockResponse: MiddlewareResponse = {
			response: new Response('Hello World'),
			continue: false,
		};

		const mockContinueResponse: MiddlewareResponse = {
			continue: true,
		};

		expect(mockResponse.continue).toEqual(false);
		expect(mockContinueResponse.continue).toEqual(true);
		expect(mockResponse.response).toBeDefined();

		expect(isMiddlewareResponse(mockResponse)).toEqual(true);
		expect(isMiddlewareResponse(mockContinueResponse)).toEqual(true);
		expect(isMiddlewareResponse({ continue: 'invalid' })).toEqual(false);
	});
});

describe('Middleware Types - MiddlewareHandler function type', () => {
	it('should execute handler correctly', async () => {
		const mockHandler: MiddlewareHandler = async (context, next) => {
			context.locals.processed = true;
			const result = await next();
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

		const result = await mockHandler(mockContext, mockNext);

		expect(result.continue).toEqual(true);
		expect(mockContext.locals.processed).toEqual(true);
	});
});

describe('Middleware Types - MiddlewareRoute interface', () => {
	it('should validate middleware route', () => {
		const mockRoute: MiddlewareRoute = {
			pattern: new URLPattern({ pathname: '/api/*' }),
			middlewarePath: 'src/api/_middleware.ts',
			priority: 1,
			type: 'api',
		};

		expect(mockRoute.pattern).toBeDefined();
		expect(mockRoute.middlewarePath).toEqual('src/api/_middleware.ts');
		expect(mockRoute.priority).toEqual(1);
		expect(mockRoute.type).toEqual('api');

		expect(isMiddlewareRoute(mockRoute)).toEqual(true);
		expect(isMiddlewareRoute({ pattern: 'invalid' })).toEqual(false);
	});
});

describe('Middleware Types - MiddlewareChain interface', () => {
	it('should validate middleware chain', () => {
		const mockHandler: MiddlewareHandler = async (context, next) => next();

		const mockChain: MiddlewareChain = {
			global: [mockHandler],
			scoped: [mockHandler, mockHandler],
			route: '/api/users',
			totalMiddleware: 3,
		};

		expect(mockChain.global.length).toEqual(1);
		expect(mockChain.scoped.length).toEqual(2);
		expect(mockChain.route).toEqual('/api/users');
		expect(mockChain.totalMiddleware).toEqual(3);

		expect(isMiddlewareChain(mockChain)).toEqual(true);
		expect(isMiddlewareChain({ global: 'invalid' })).toEqual(false);
	});
});

describe('Middleware Types - Configuration validation', () => {
	it('should validate valid config', () => {
		const validConfig = {
			developmentMode: true,
			enableLogging: true,
			maxExecutionTime: 5000,
		};

		const invalidConfig = {
			developmentMode: 'invalid',
			maxExecutionTime: -1,
		};

		const validResult = safeValidators.middlewareConfig(validConfig);
		const invalidResult = safeValidators.middlewareConfig(invalidConfig);

		expect(validResult.success).toEqual(true);
		expect(invalidResult.success).toEqual(false);

		if (validResult.success) {
			expect(validResult.data.developmentMode).toEqual(true);
			expect(validResult.data.enableLogging).toEqual(true);
			expect(validResult.data.maxExecutionTime).toEqual(5000);
		}
	});
});

describe('Middleware Types - Discovery options validation', () => {
	it('should validate valid options', () => {
		const validOptions = {
			baseDirectory: 'src',
			filePattern: '_middleware.ts',
			enableWatching: true,
			excludeDirectories: ['node_modules', 'dist'],
		};

		const invalidOptions = {
			baseDirectory: 123,
			filePattern: '',
		};

		const validResult = safeValidators.middlewareDiscoveryOptions(validOptions);
		const invalidResult = safeValidators.middlewareDiscoveryOptions(invalidOptions);

		expect(validResult.success).toEqual(true);
		expect(invalidResult.success).toEqual(false);

		if (validResult.success) {
			expect(validResult.data.baseDirectory).toEqual('src');
			expect(validResult.data.filePattern).toEqual('_middleware.ts');
			expect(validResult.data.enableWatching).toEqual(true);
			expect(validResult.data.excludeDirectories?.length).toEqual(2);
		}
	});
});
