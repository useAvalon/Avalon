/**
 * Tests for PageLoader class
 */

import { assertEquals, assertRejects, assert } from '@std/assert';
import { ComponentType } from 'preact';
import {
	PageLoader,
	PageLoadError,
	PageValidationError,
	createPageLoader,
	isValidPageModule,
	getPageComponentName,
	defaultPageLoader,
} from '../page-loader.ts';
import { RoutePageModule } from '../../../schemas/routing.ts';
import { LayoutConfig } from '../../../schemas/layout.ts';

// Test fixtures
const mockPageComponent: ComponentType<any> = () => null;
mockPageComponent.displayName = 'TestPage';

const validPageModule: RoutePageModule = {
	default: mockPageComponent,
};

const pageModuleWithLayoutConfig: RoutePageModule = {
	default: mockPageComponent,
	layoutConfig: {
		skipLayouts: ['header'],
		customLayout: 'custom-layout',
	},
};

const pageModuleWithMetadata: RoutePageModule = {
	default: mockPageComponent,
	generateMetadata: async (params: any) => ({
		title: `Page ${params.id}`,
		description: 'Test page',
	}),
};

const pageModuleWithLoader: RoutePageModule = {
	default: mockPageComponent,
	loader: async (context: any) => ({ data: 'test' }),
};

const completePageModule: RoutePageModule = {
	default: mockPageComponent,
	layoutConfig: { skipLayouts: ['footer'] },
	generateMetadata: async () => ({ title: 'Complete Page' }),
	loader: async () => ({ complete: true }),
};

Deno.test('PageLoader - constructor with default options', () => {
	const loader = new PageLoader();
	const options = loader.getOptions();

	assertEquals(options.baseDirectory, 'src/pages');
	assertEquals(options.extensions, ['.tsx', '.ts', '.jsx', '.js']);
	assertEquals(options.developmentMode, false);
	assertEquals(options.strictValidation, true);
});

Deno.test('PageLoader - constructor with custom options', () => {
	const loader = new PageLoader({
		baseDirectory: 'custom/pages',
		extensions: ['.tsx', '.jsx'],
		developmentMode: true,
		strictValidation: false,
	});
	const options = loader.getOptions();

	assertEquals(options.baseDirectory, 'custom/pages');
	assertEquals(options.extensions, ['.tsx', '.jsx']);
	assertEquals(options.developmentMode, true);
	assertEquals(options.strictValidation, false);
});

Deno.test('PageLoader - validatePageModule with valid module', () => {
	const pageLoader = new PageLoader();
	const result = pageLoader.validatePageModule(validPageModule, '/test/page.tsx');
	assertEquals(result, validPageModule);
});

Deno.test('PageLoader - validatePageModule throws error for null module', () => {
	const pageLoader = new PageLoader();

	try {
		pageLoader.validatePageModule(null, '/test/page.tsx');
		assert(false, 'Should have thrown PageValidationError');
	} catch (error) {
		assert(error instanceof PageValidationError);
		assertEquals(error.filePath, '/test/page.tsx');
	}
});

Deno.test('PageLoader - validatePageModule throws error for missing default export', () => {
	const pageLoader = new PageLoader();
	const invalidModule = { notDefault: mockPageComponent };

	try {
		pageLoader.validatePageModule(invalidModule, '/test/page.tsx');
		assert(false, 'Should have thrown PageValidationError');
	} catch (error) {
		assert(error instanceof PageValidationError);
		assert(error.validationErrors.some(err => err.includes('default export')));
	}
});

Deno.test('PageLoader - validatePageModule throws error for non-function default export', () => {
	const pageLoader = new PageLoader();
	const invalidModule = { default: 'not a component' };

	try {
		pageLoader.validatePageModule(invalidModule, '/test/page.tsx');
		assert(false, 'Should have thrown PageValidationError');
	} catch (error) {
		assert(error instanceof PageValidationError);
		assert(error.validationErrors.some(err => err.includes('component')));
	}
});

Deno.test('PageLoader - validatePageModule with layout config', () => {
	const pageLoader = new PageLoader();
	const result = pageLoader.validatePageModule(pageModuleWithLayoutConfig, '/test/page.tsx');
	assertEquals(result, pageModuleWithLayoutConfig);
	assertEquals(result.layoutConfig, {
		skipLayouts: ['header'],
		customLayout: 'custom-layout',
	});
});

Deno.test('PageLoader - validatePageModule throws error for invalid layout config', () => {
	const pageLoader = new PageLoader();
	const invalidModule = {
		default: mockPageComponent,
		layoutConfig: 'invalid config',
	};

	try {
		pageLoader.validatePageModule(invalidModule, '/test/page.tsx');
		assert(false, 'Should have thrown PageValidationError');
	} catch (error) {
		assert(error instanceof PageValidationError);
		assert(error.validationErrors.some(err => err.includes('layoutConfig')));
	}
});

Deno.test('PageLoader - validatePageModule throws error for non-function generateMetadata', () => {
	const pageLoader = new PageLoader();
	const invalidModule = {
		default: mockPageComponent,
		generateMetadata: 'not a function',
	};

	try {
		pageLoader.validatePageModule(invalidModule, '/test/page.tsx');
		assert(false, 'Should have thrown PageValidationError');
	} catch (error) {
		assert(error instanceof PageValidationError);
		assert(error.validationErrors.some(err => err.includes('generateMetadata')));
	}
});

Deno.test('PageLoader - validatePageModule throws error for non-function loader', () => {
	const pageLoader = new PageLoader();
	const invalidModule = {
		default: mockPageComponent,
		loader: 'not a function',
	};

	try {
		pageLoader.validatePageModule(invalidModule, '/test/page.tsx');
		assert(false, 'Should have thrown PageValidationError');
	} catch (error) {
		assert(error instanceof PageValidationError);
		assert(error.validationErrors.some(err => err.includes('loader')));
	}
});

Deno.test('PageLoader - validatePageModule allows undefined optional exports', () => {
	const pageLoader = new PageLoader();
	const moduleWithUndefined = {
		default: mockPageComponent,
		layoutConfig: undefined,
		generateMetadata: undefined,
		loader: undefined,
	};

	const result = pageLoader.validatePageModule(moduleWithUndefined, '/test/page.tsx');
	assertEquals(result.default, mockPageComponent);
	assertEquals(result.layoutConfig, undefined);
	assertEquals(result.generateMetadata, undefined);
	assertEquals(result.loader, undefined);
});

Deno.test('PageLoader - extractLayoutConfig returns valid config', () => {
	const pageLoader = new PageLoader();
	const config = pageLoader.extractLayoutConfig(pageModuleWithLayoutConfig);
	assertEquals(config, {
		skipLayouts: ['header'],
		customLayout: 'custom-layout',
	});
});

Deno.test('PageLoader - extractLayoutConfig returns null if no config', () => {
	const pageLoader = new PageLoader();
	const config = pageLoader.extractLayoutConfig(validPageModule);
	assertEquals(config, null);
});

Deno.test('PageLoader - extractLayoutConfig handles all layout config options', () => {
	const pageLoader = new PageLoader();
	const fullLayoutConfig: LayoutConfig = {
		skipLayouts: ['header', 'footer'],
		replaceLayout: true,
		onlyLayouts: ['main'],
		customLayout: 'special-layout',
	};

	const moduleWithFullConfig: RoutePageModule = {
		default: mockPageComponent,
		layoutConfig: fullLayoutConfig,
	};

	const config = pageLoader.extractLayoutConfig(moduleWithFullConfig);
	assertEquals(config, fullLayoutConfig);
});

Deno.test('PageLoader - isValidPageFile validates extensions and naming', () => {
	const pageLoader = new PageLoader();

	// Note: These tests focus on extension and naming validation
	// File existence checks would require file system permissions

	// Test private file detection (should return false regardless of existence)
	assert(pageLoader.isValidPageFile('/pages/_layout.tsx') === false);
	assert(pageLoader.isValidPageFile('/pages/_middleware.ts') === false);

	// Test test file detection (should return false regardless of existence)
	assert(pageLoader.isValidPageFile('/pages/component.test.tsx') === false);
	assert(pageLoader.isValidPageFile('/pages/utils.spec.ts') === false);

	// Test unsupported extensions (should return false)
	assert(pageLoader.isValidPageFile('/pages/style.css') === false);
	assert(pageLoader.isValidPageFile('/pages/data.json') === false);
});

Deno.test('PageLoader - cache management', () => {
	const prodLoader = new PageLoader({ developmentMode: false });

	// Simulate cached entry
	prodLoader['moduleCache'].set('/test/page.tsx', validPageModule);
	assertEquals(prodLoader.getCacheStats().size, 1);

	prodLoader.clearCache();
	assertEquals(prodLoader.getCacheStats().size, 0);
});

Deno.test('PageLoader - cache statistics', () => {
	const prodLoader = new PageLoader({ developmentMode: false });

	// Add some cached entries
	prodLoader['moduleCache'].set('/test/page1.tsx', validPageModule);
	prodLoader['moduleCache'].set('/test/page2.tsx', validPageModule);

	const stats = prodLoader.getCacheStats();
	assertEquals(stats.size, 2);
	assertEquals(stats.keys, ['/test/page1.tsx', '/test/page2.tsx']);
});

Deno.test('createPageLoader - creates with custom options', () => {
	const loader = createPageLoader({
		baseDirectory: 'custom',
		developmentMode: true,
	});

	const options = loader.getOptions();
	assertEquals(options.baseDirectory, 'custom');
	assertEquals(options.developmentMode, true);
});

Deno.test('createPageLoader - creates with default options', () => {
	const loader = createPageLoader();
	const options = loader.getOptions();

	assertEquals(options.baseDirectory, 'src/pages');
	assertEquals(options.developmentMode, false);
});

Deno.test('isValidPageModule - returns true for valid modules', () => {
	assert(isValidPageModule(validPageModule));
	assert(isValidPageModule(pageModuleWithLayoutConfig));
	assert(isValidPageModule(completePageModule));
});

Deno.test('isValidPageModule - returns false for invalid modules', () => {
	assert(isValidPageModule(null) === false);
	assert(isValidPageModule(undefined) === false);
	assert(isValidPageModule('string') === false);
	assert(isValidPageModule(123) === false);
});

Deno.test('getPageComponentName - returns displayName if available', () => {
	const componentWithDisplayName: ComponentType<any> = () => null;
	componentWithDisplayName.displayName = 'CustomDisplayName';

	const module: RoutePageModule = { default: componentWithDisplayName };
	assertEquals(getPageComponentName(module), 'CustomDisplayName');
});

Deno.test('getPageComponentName - returns function name if displayName not available', () => {
	function NamedComponent() {
		return null;
	}

	const module: RoutePageModule = { default: NamedComponent };
	assertEquals(getPageComponentName(module), 'NamedComponent');
});

Deno.test('getPageComponentName - returns Anonymous for anonymous functions', () => {
	const anonymousComponent = () => null;
	// Clear the name to make it truly anonymous
	Object.defineProperty(anonymousComponent, 'name', { value: '' });
	const module: RoutePageModule = { default: anonymousComponent };
	assertEquals(getPageComponentName(module), 'Anonymous');
});

Deno.test('defaultPageLoader - is PageLoader instance with default config', () => {
	assert(defaultPageLoader instanceof PageLoader);

	const options = defaultPageLoader.getOptions();
	assertEquals(options.baseDirectory, 'src/pages');
	assertEquals(options.extensions, ['.tsx', '.ts', '.jsx', '.js']);
	assertEquals(options.developmentMode, false);
	assertEquals(options.strictValidation, true);
});

Deno.test('PageLoadError - creates error with message and file path', () => {
	const error = new PageLoadError('Test error', '/test/file.tsx');

	assertEquals(error.message, 'Test error');
	assertEquals(error.filePath, '/test/file.tsx');
	assertEquals(error.name, 'PageLoadError');
	assertEquals(error.originalError, undefined);
});

Deno.test('PageLoadError - creates error with original error', () => {
	const originalError = new Error('Original error');
	const error = new PageLoadError('Test error', '/test/file.tsx', originalError);

	assertEquals(error.originalError, originalError);
});

Deno.test('PageValidationError - creates error with validation errors', () => {
	const validationErrors = ['Missing default export', 'Invalid config'];
	const error = new PageValidationError('Validation failed', '/test/file.tsx', validationErrors);

	assertEquals(error.message, 'Validation failed');
	assertEquals(error.filePath, '/test/file.tsx');
	assertEquals(error.validationErrors, validationErrors);
	assertEquals(error.name, 'PageValidationError');
});
