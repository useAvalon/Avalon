import { assertEquals, assertExists, assert } from 'jsr:@std/assert';
import {
	LayoutContextSchema,
	LayoutDataSchema,
	LayoutRouteSchema,
	LayoutHandlerSchema,
	LayoutPropsSchema,
	LayoutDiscoveryOptionsSchema,
	LayoutConfigSchema,
	ResolvedLayoutSchema,
} from '../../schemas/layout.ts';
import { validators, safeValidators } from '../../schemas/index.ts';
import type {
	LayoutContext,
	LayoutData,
	LayoutRoute,
	LayoutHandler,
	LayoutProps,
	LayoutDiscoveryOptions,
	LayoutConfig,
	ResolvedLayout,
} from '../layout.ts';

Deno.test('Layout System Types and Schemas', async t => {
	await t.step('LayoutContext - should validate valid layout context', () => {
		const mockRequest = new Request('https://example.com/test');
		const mockParams = { id: '123' };
		const mockQuery = new URLSearchParams('?page=1');
		const mockState = new Map();

		const validContext: LayoutContext = {
			request: mockRequest,
			params: mockParams,
			query: mockQuery,
			state: mockState,
		};

		const result = safeValidators.layoutContext(validContext);
		assertEquals(result.success, true);
	});

	await t.step('LayoutContext - should reject invalid layout context', () => {
		const invalidContext = {
			request: 'not-a-request',
			params: 'not-an-object',
			query: 'not-urlsearchparams',
			state: 'not-a-map',
		};

		const result = safeValidators.layoutContext(invalidContext);
		assertEquals(result.success, false);
	});

	await t.step('LayoutData - should validate layout data as record', () => {
		const validData: LayoutData = {
			user: { name: 'John', id: 123 },
			settings: { theme: 'dark' },
			items: [1, 2, 3],
		};

		const result = safeValidators.layoutData(validData);
		assertEquals(result.success, true);
	});

	await t.step('LayoutData - should accept empty layout data', () => {
		const emptyData: LayoutData = {};

		const result = safeValidators.layoutData(emptyData);
		assertEquals(result.success, true);
	});

	await t.step('LayoutHandler - should validate valid layout handler', () => {
		const validHandler = {
			component: () => null,
			path: '/src/pages/blog/_layout.tsx',
			priority: 10,
		};

		const result = safeValidators.layoutHandler(validHandler);
		assertEquals(result.success, true);
	});

	await t.step('LayoutDiscoveryOptions - should validate with defaults', () => {
		const options = {
			baseDirectory: '/src/pages',
		};

		const result = safeValidators.layoutDiscoveryOptions(options);
		assertEquals(result.success, true);
		if (result.success) {
			assertEquals(result.data.filePattern, '_layout.tsx');
			assertEquals(result.data.excludeDirectories, []);
			assertEquals(result.data.enableWatching, false);
			assertEquals(result.data.developmentMode, false);
		}
	});

	await t.step('LayoutDiscoveryOptions - should validate with custom options', () => {
		const options: LayoutDiscoveryOptions = {
			baseDirectory: '/src/pages',
			filePattern: 'layout.tsx',
			excludeDirectories: ['node_modules', '.git'],
			enableWatching: true,
			developmentMode: true,
		};

		const result = safeValidators.layoutDiscoveryOptions(options);
		assertEquals(result.success, true);
		if (result.success) {
			assertEquals(result.data.filePattern, 'layout.tsx');
			assertEquals(result.data.excludeDirectories, ['node_modules', '.git']);
			assertEquals(result.data.enableWatching, true);
			assertEquals(result.data.developmentMode, true);
		}
	});

	await t.step('LayoutConfig - should validate layout config with all options', () => {
		const config: LayoutConfig = {
			skipLayouts: ['root', 'admin'],
			replaceLayout: true,
			onlyLayouts: ['custom'],
			customLayout: '/custom/layout.tsx',
		};

		const result = safeValidators.layoutConfig(config);
		assertEquals(result.success, true);
	});

	await t.step('LayoutConfig - should validate empty layout config', () => {
		const config: LayoutConfig = {};

		const result = safeValidators.layoutConfig(config);
		assertEquals(result.success, true);
	});

	await t.step('ResolvedLayout - should validate complete resolved layout', () => {
		const resolvedLayout: ResolvedLayout = {
			handlers: [],
			dataLoaders: [],
			errorBoundaries: [],
			streamingComponents: [],
			metadata: {
				totalLayouts: 2,
				resolutionTime: 15.5,
				cacheHit: false,
			},
		};

		const result = safeValidators.resolvedLayout(resolvedLayout);
		assertEquals(result.success, true);
	});

	await t.step('ResolvedLayout - should require all metadata fields', () => {
		const incompleteLayout = {
			handlers: [],
			dataLoaders: [],
			errorBoundaries: [],
			streamingComponents: [],
			metadata: {
				totalLayouts: 2,
				// missing resolutionTime and cacheHit
			},
		};

		const result = safeValidators.resolvedLayout(incompleteLayout);
		assertEquals(result.success, false);
	});

	await t.step('Type compatibility - should ensure TypeScript types match Zod schemas', () => {
		// This test ensures that our TypeScript types are compatible with Zod schemas
		// by attempting to use the validators with properly typed data

		const mockRequest = new Request('https://example.com');
		const layoutContext: LayoutContext = {
			request: mockRequest,
			params: { id: '123' },
			query: new URLSearchParams(),
			state: new Map(),
		};

		// This should compile without TypeScript errors
		const validatedContext = validators.layoutContext(layoutContext);
		assertExists(validatedContext);
		assertEquals(validatedContext.request, mockRequest);
	});

	await t.step('Error handling - should provide meaningful error messages', () => {
		const invalidData = {
			request: null,
			params: null,
			query: null,
			state: null,
		};

		const result = safeValidators.layoutContext(invalidData);
		assertEquals(result.success, false);
		if (!result.success) {
			assert(result.error.message.includes('Invalid layout context'));
			assert(result.error.getFormattedErrors().length > 0);
		}
	});
});
