import { assertEquals } from '@std/assert';
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
} from '../src/schemas/index.ts';

Deno.test('Middleware Integration - All types exported from main schemas', () => {
	// Test that we can create instances of all middleware types
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

	// Verify all types are properly defined
	assertEquals(typeof context, 'object');
	assertEquals(typeof response, 'object');
	assertEquals(typeof handler, 'function');
	assertEquals(typeof route, 'object');
	assertEquals(typeof chain, 'object');
	assertEquals(typeof config, 'object');
	assertEquals(typeof discoveryOptions, 'object');
});

Deno.test('Middleware Integration - Validators work from main export', () => {
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

	// Test safe validators
	const configResult = safeValidators.middlewareConfig(validConfig);
	const discoveryResult = safeValidators.middlewareDiscoveryOptions(validDiscoveryOptions);

	assertEquals(configResult.success, true);
	assertEquals(discoveryResult.success, true);

	// Test type guards
	assertEquals(isValidMiddlewareConfig(validConfig), true);
	assertEquals(isValidMiddlewareDiscoveryOptions(validDiscoveryOptions), true);

	// Test invalid data - use data that violates the schema constraints
	const invalidConfigResult = safeValidators.middlewareConfig({
		developmentMode: 'not-boolean',
		maxExecutionTime: -1, // negative number should fail
	});
	const invalidDiscoveryResult = safeValidators.middlewareDiscoveryOptions({
		baseDirectory: 123, // should be string
		filePattern: '', // empty string should fail
	});

	assertEquals(invalidConfigResult.success, false);
	assertEquals(invalidDiscoveryResult.success, false);

	assertEquals(
		isValidMiddlewareConfig({
			developmentMode: 'not-boolean',
			maxExecutionTime: -1,
		}),
		false
	);
	assertEquals(
		isValidMiddlewareDiscoveryOptions({
			baseDirectory: 123,
			filePattern: '',
		}),
		false
	);
});
