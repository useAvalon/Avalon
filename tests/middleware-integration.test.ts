import { describe, it, expect } from 'vitest';
import {
	type MiddlewareContext,
	type MiddlewareResponse,
	type MiddlewareHandler,
	type MiddlewareRoute,
	type MiddlewareChain,
	type MiddlewareConfig,
	type MiddlewareDiscoveryOptions,
	safeValidators,
	isValidMiddlewareConfig,
	isValidMiddlewareDiscoveryOptions,
} from '../packages/avalon/src/schemas/index.ts';

describe('Middleware Integration - All types exported from main schemas', () => {
	it('should create instances of all middleware types', () => {
		const context: MiddlewareContext = {
			request: new Request('https://example.com'),
			url: new URL('https://example.com'),
			params: {},
			query: {},
			state: new Map(),
			locals: {},
		};

		const response: MiddlewareResponse = {
			continue: true,
		};

		const handler: MiddlewareHandler = async (ctx, next) => next();

		const route: MiddlewareRoute = {
			pattern: new URLPattern({ pathname: '/*' }),
			middlewarePath: 'src/_middleware.ts',
			priority: 0,
			type: 'global',
		};

		const chain: MiddlewareChain = {
			global: [handler],
			scoped: [],
			route: '/',
			totalMiddleware: 1,
		};

		const config: MiddlewareConfig = {
			developmentMode: true,
			enableLogging: false,
		};

		const discoveryOptions: MiddlewareDiscoveryOptions = {
			baseDirectory: 'src',
			filePattern: '_middleware.ts',
		};

		expect(typeof context).toEqual('object');
		expect(typeof response).toEqual('object');
		expect(typeof handler).toEqual('function');
		expect(typeof route).toEqual('object');
		expect(typeof chain).toEqual('object');
		expect(typeof config).toEqual('object');
		expect(typeof discoveryOptions).toEqual('object');
	});
});

describe('Middleware Integration - Validators work from main export', () => {
	it('should validate valid configs', () => {
		const validConfig = {
			developmentMode: true,
			enableLogging: false,
			maxExecutionTime: 3000,
		};

		const validDiscoveryOptions = {
			baseDirectory: 'src',
			filePattern: '_middleware.ts',
			enableWatching: true,
		};

		const configResult = safeValidators.middlewareConfig(validConfig);
		const discoveryResult = safeValidators.middlewareDiscoveryOptions(validDiscoveryOptions);

		expect(configResult.success).toEqual(true);
		expect(discoveryResult.success).toEqual(true);

		expect(isValidMiddlewareConfig(validConfig)).toEqual(true);
		expect(isValidMiddlewareDiscoveryOptions(validDiscoveryOptions)).toEqual(true);
	});

	it('should reject invalid configs', () => {
		const invalidConfigResult = safeValidators.middlewareConfig({
			developmentMode: 'not-boolean',
			maxExecutionTime: -1,
		});
		const invalidDiscoveryResult = safeValidators.middlewareDiscoveryOptions({
			baseDirectory: 123,
			filePattern: '',
		});

		expect(invalidConfigResult.success).toEqual(false);
		expect(invalidDiscoveryResult.success).toEqual(false);

		expect(
			isValidMiddlewareConfig({
				developmentMode: 'not-boolean',
				maxExecutionTime: -1,
			})
		).toEqual(false);
		expect(
			isValidMiddlewareDiscoveryOptions({
				baseDirectory: 123,
				filePattern: '',
			})
		).toEqual(false);
	});
});
