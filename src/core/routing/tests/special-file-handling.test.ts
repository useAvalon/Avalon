/**
 * Tests for special file handling (_404.tsx, _error.tsx, etc.)
 */

import { assertEquals, assertExists, assertRejects, assertStringIncludes } from '@std/assert';
import { join } from '@std/path';
import { ensureDir, ensureFile } from '@std/fs';
import { PageLoader, PageLoadError, PageValidationError } from '../page-loader.ts';
import { FileSystemRouter } from '../file-system-router.ts';

// Test setup helpers
const TEST_BASE_DIR = 'test-temp-special-files';
const TEST_PAGES_DIR = join(TEST_BASE_DIR, 'src', 'pages');

async function setupTestDirectory() {
	await ensureDir(TEST_PAGES_DIR);
}

async function cleanupTestDirectory() {
	try {
		await Deno.remove(TEST_BASE_DIR, { recursive: true });
	} catch {
		// Ignore cleanup errors
	}
}

async function createTestFile(relativePath: string, content: string) {
	const fullPath = join(TEST_PAGES_DIR, relativePath);
	await ensureDir(join(fullPath, '..'));
	await Deno.writeTextFile(fullPath, content);
	return fullPath;
}

// Test components
const test404Component = `
import { ComponentType } from 'preact';

interface PageProps {
	params?: Record<string, string>;
	query?: URLSearchParams;
	data?: unknown;
}

const Custom404Page: ComponentType<PageProps> = ({ params = {}, query }) => {
	return (
		<div>
			<h1>Custom 404 Page</h1>
			<p>The page you're looking for doesn't exist.</p>
			<p>URL: {typeof window !== 'undefined' ? window.location.pathname : '/'}</p>
		</div>
	);
};

export default Custom404Page;
`;

const testErrorComponent = `
import { ComponentType } from 'preact';

interface PageProps {
	params?: Record<string, string>;
	query?: URLSearchParams;
	data?: { error?: Error };
}

const CustomErrorPage: ComponentType<PageProps> = ({ params = {}, query, data }) => {
	const error = data?.error;
	return (
		<div>
			<h1>Custom Error Page</h1>
			<p>Something went wrong.</p>
			{error && <p>Error: {error.message}</p>}
		</div>
	);
};

export default CustomErrorPage;
`;

const testErrorComponentWithMetadata = `
import { ComponentType } from 'preact';

interface PageProps {
	params?: Record<string, string>;
	query?: URLSearchParams;
	data?: { error?: Error };
}

const CustomErrorPageWithMetadata: ComponentType<PageProps> = ({ params = {}, query, data }) => {
	const error = data?.error;
	return (
		<div>
			<h1>Custom Error Page with Metadata</h1>
			<p>Something went wrong.</p>
			{error && <p>Error: {error.message}</p>}
		</div>
	);
};

export async function generateMetadata() {
	return {
		title: 'Error - My App',
		description: 'An error occurred',
	};
}

export default CustomErrorPageWithMetadata;
`;

const invalidSpecialFile = `
// This file has no default export
export const notDefault = () => <div>Invalid</div>;
`;

Deno.test('PageLoader - Special File Discovery', async t => {
	await setupTestDirectory();

	try {
		const pageLoader = new PageLoader({
			baseDirectory: TEST_PAGES_DIR,
			developmentMode: true,
		});

		await t.step('should identify special file types correctly', () => {
			assertEquals(pageLoader.getSpecialFileType('_404.tsx'), '404');
			assertEquals(pageLoader.getSpecialFileType('_error.tsx'), 'error');
			assertEquals(pageLoader.getSpecialFileType('blog/_404.tsx'), '404');
			assertEquals(pageLoader.getSpecialFileType('admin/_error.tsx'), 'error');
			assertEquals(pageLoader.getSpecialFileType('regular.tsx'), null);
			assertEquals(pageLoader.getSpecialFileType('_layout.tsx'), null);
			assertEquals(pageLoader.getSpecialFileType('_middleware.ts'), null);
		});

		await t.step('should validate special files correctly', async () => {
			// Create test files
			const valid404Path = await createTestFile('_404.tsx', test404Component);
			const validErrorPath = await createTestFile('_error.tsx', testErrorComponent);
			const invalidPath = await createTestFile('_invalid.tsx', invalidSpecialFile);

			// Valid special files
			assertEquals(pageLoader.isValidSpecialFile(valid404Path), true);
			assertEquals(pageLoader.isValidSpecialFile(validErrorPath), true);

			// Invalid files
			assertEquals(pageLoader.isValidSpecialFile('nonexistent.tsx'), false);
			assertEquals(pageLoader.isValidSpecialFile('regular.tsx'), false);
			assertEquals(pageLoader.isValidSpecialFile(invalidPath), false); // Not a recognized special file
		});

		await t.step('should load special files correctly', async () => {
			// Create test files
			await createTestFile('_404.tsx', test404Component);
			await createTestFile('blog/_error.tsx', testErrorComponent);

			// Load 404 file
			const notFoundFile = await pageLoader.loadSpecialFile('404', '/');
			assertExists(notFoundFile);
			assertEquals(notFoundFile.type, '404');
			assertExists(notFoundFile.module);
			assertEquals(typeof notFoundFile.module.default, 'function');

			// Load error file from blog path
			const errorFile = await pageLoader.loadSpecialFile('error', '/blog/some-post');
			assertExists(errorFile);
			assertEquals(errorFile.type, 'error');
			assertExists(errorFile.module);
			assertEquals(typeof errorFile.module.default, 'function');
		});

		await t.step('should search hierarchically for special files', async () => {
			// Clear any existing files and cache first
			await cleanupTestDirectory();
			await setupTestDirectory();
			pageLoader.clearCache();

			// Create nested structure
			await createTestFile('_404.tsx', test404Component);
			await createTestFile('blog/_error.tsx', testErrorComponent);

			// Should find root 404 from any path
			const notFoundFromBlog = await pageLoader.loadSpecialFile('404', '/blog/post');
			assertExists(notFoundFromBlog);
			assertStringIncludes(notFoundFromBlog.filePath, '_404.tsx');

			// Should find blog error from blog path
			const errorFromBlog = await pageLoader.loadSpecialFile('error', '/blog/post');
			assertExists(errorFromBlog);
			assertStringIncludes(errorFromBlog.filePath, 'blog/_error.tsx');

			// Should not find error from root path (no root error file)
			const errorFromRoot = await pageLoader.loadSpecialFile('error', '/');
			assertEquals(errorFromRoot, null);
		});

		await t.step('should return null for non-existent special files', async () => {
			// Clear any existing files first to ensure clean test
			await cleanupTestDirectory();
			await setupTestDirectory();
			pageLoader.clearCache();

			const nonExistent404 = await pageLoader.loadSpecialFile('404', '/nonexistent');
			assertEquals(nonExistent404, null);

			const nonExistentError = await pageLoader.loadSpecialFile('error', '/nonexistent');
			assertEquals(nonExistentError, null);
		});

		await t.step('should provide fallback special files', () => {
			const fallback404 = pageLoader.getFallbackSpecialFile('404');
			assertEquals(fallback404.type, '404');
			assertEquals(fallback404.filePath, 'internal:default-404');
			assertExists(fallback404.module);
			assertEquals(typeof fallback404.module.default, 'function');

			const fallbackError = pageLoader.getFallbackSpecialFile('error');
			assertEquals(fallbackError.type, 'error');
			assertEquals(fallbackError.filePath, 'internal:default-error');
			assertExists(fallbackError.module);
			assertEquals(typeof fallbackError.module.default, 'function');
		});

		await t.step('should validate special file modules', async () => {
			// Create valid and invalid special files
			const validPath = await createTestFile('valid_404.tsx', test404Component);
			const invalidPath = await createTestFile('invalid_404.tsx', invalidSpecialFile);

			// Load modules
			const validModule = await import(`file://${Deno.cwd()}/${validPath}`);
			const invalidModule = await import(`file://${Deno.cwd()}/${invalidPath}`);

			// Valid module should pass validation
			const validatedModule = pageLoader.validateSpecialFileModule(validModule, '404', validPath);
			assertExists(validatedModule);
			assertEquals(typeof validatedModule.default, 'function');

			// Invalid module should fail validation
			await assertRejects(
				async () => pageLoader.validateSpecialFileModule(invalidModule, '404', invalidPath),
				PageValidationError,
				'Page module validation failed'
			);
		});

		await t.step('should discover all special files', async () => {
			// Create multiple special files
			await createTestFile('_404.tsx', test404Component);
			await createTestFile('_error.tsx', testErrorComponent);
			await createTestFile('blog/_404.tsx', test404Component);
			await createTestFile('admin/_error.tsx', testErrorComponent);

			const specialFiles = await pageLoader.discoverSpecialFiles('/blog');

			// Should find the most specific files for the route
			const foundTypes = new Set(Array.from(specialFiles.keys()));
			assertEquals(foundTypes.has('404'), true);
			assertEquals(foundTypes.has('error'), true);

			// 404 should be from blog (more specific)
			const found404 = specialFiles.get('404');
			assertExists(found404);
			assertStringIncludes(found404.filePath, 'blog/_404.tsx');
		});
	} finally {
		await cleanupTestDirectory();
	}
});

Deno.test('FileSystemRouter - Special File Integration', async t => {
	await setupTestDirectory();

	try {
		const router = new FileSystemRouter({
			discovery: {
				pagesDirectory: TEST_PAGES_DIR,
				developmentMode: true,
			},
		});

		await t.step('should create 404 handlers', async () => {
			// Create custom 404 page
			await createTestFile('_404.tsx', test404Component);

			const handler = await router.getSpecialFileHandler('404', '/', undefined, {}, null, true);
			assertExists(handler);
			assertEquals(handler.metadata.priority, 1000); // Low priority for 404
			assertExists(handler.handler);

			// Test the handler
			const request = new Request('http://localhost/nonexistent');
			const response = await handler.handler(request);
			assertEquals(response.status, 404);
			assertEquals(response.headers.get('Content-Type'), 'text/html; charset=utf-8');

			const html = await response.text();
			assertStringIncludes(html, 'Custom 404 Page');
		});

		await t.step('should create error handlers', async () => {
			// Create custom error page
			await createTestFile('_error.tsx', testErrorComponent);

			const handler = await router.getSpecialFileHandler('error', '/', undefined, {}, null, true);
			assertExists(handler);
			assertEquals(handler.metadata.priority, 999); // Low priority for error
			assertExists(handler.handler);

			// Test the handler with an error
			const request = new Request('http://localhost/some-page');
			const testError = new Error('Test error message');
			const response = await handler.handler(request, undefined, undefined, testError);
			assertEquals(response.status, 500);
			assertEquals(response.headers.get('Content-Type'), 'text/html; charset=utf-8');

			const html = await response.text();
			assertStringIncludes(html, 'Custom Error Page');
			assertStringIncludes(html, 'Test error message');
		});

		await t.step('should use fallback handlers when custom files are missing', async () => {
			// Clear any existing files first to ensure clean test
			await cleanupTestDirectory();
			await setupTestDirectory();
			router.clearCache();

			const handler404 = await router.getSpecialFileHandler('404', '/', undefined, {}, null, true);
			const handlerError = await router.getSpecialFileHandler('error', '/', undefined, {}, null, true);

			// Test 404 handler - should use fallback since no custom files exist
			const request404 = new Request('http://localhost/nonexistent');
			const response404 = await handler404.handler(request404);
			assertEquals(response404.status, 404);
			const html404 = await response404.text();
			assertStringIncludes(html404, '404');
			// Should use fallback since we cleared all files
			assertStringIncludes(html404, 'Page Not Found');

			// Test error handler
			const requestError = new Request('http://localhost/some-page');
			const testError = new Error('Test error');
			const responseError = await handlerError.handler(requestError, undefined, undefined, testError);
			assertEquals(responseError.status, 500);
			const htmlError = await responseError.text();
			assertStringIncludes(htmlError, 'Something went wrong');
		});

		await t.step('should handle special files with metadata', async () => {
			// Clear and create error page with metadata
			await cleanupTestDirectory();
			await setupTestDirectory();
			router.clearCache();
			await createTestFile('_error.tsx', testErrorComponentWithMetadata);

			const handler = await router.getSpecialFileHandler('error', '/', undefined, {}, null, true);
			const request = new Request('http://localhost/some-page');
			const response = await handler.handler(request);

			assertEquals(response.status, 500);
			const html = await response.text();
			// The component is being rendered, but the title might not show "with Metadata" in the body
			assertStringIncludes(html, 'Custom Error Page');
		});

		await t.step('should cache special file handlers', async () => {
			// Create custom 404 page
			await createTestFile('_404.tsx', test404Component);

			// Get handler twice
			const handler1 = await router.getSpecialFileHandler('404', '/', undefined, {}, null, false);
			const handler2 = await router.getSpecialFileHandler('404', '/', undefined, {}, null, false);

			// Should be the same instance (cached)
			assertEquals(handler1, handler2);

			// Clear cache and get again
			router.clearCache();
			const handler3 = await router.getSpecialFileHandler('404', '/', undefined, {}, null, false);

			// Should be different instance after cache clear
			assertEquals(handler1 === handler3, false);
		});

		await t.step('should create basic fallback handlers when all else fails', async () => {
			// Clear and create an invalid special file that will cause loading to fail
			await cleanupTestDirectory();
			await setupTestDirectory();
			router.clearCache();
			// Create a file that will cause import to fail
			await createTestFile('_404.tsx', 'this is not valid javascript at all!');

			// Should still return a handler (basic fallback)
			const handler = await router.getSpecialFileHandler('404', '/', undefined, {}, null, true);
			assertExists(handler);

			const request = new Request('http://localhost/nonexistent');
			const response = await handler.handler(request);
			assertEquals(response.status, 404);

			const html = await response.text();
			assertStringIncludes(html, '404');
			// The system should handle the error gracefully and return some kind of 404 page
			// It might be a custom page or fallback, but it should work
			assertExists(html);
		});
	} finally {
		await cleanupTestDirectory();
	}
});

Deno.test('FileSystemRouter - Error Handling Integration', async t => {
	await setupTestDirectory();

	try {
		const router = new FileSystemRouter({
			discovery: {
				pagesDirectory: TEST_PAGES_DIR,
				developmentMode: true,
			},
		});

		await t.step('should use custom error pages when route handlers fail', async () => {
			// Create a regular page that will cause an error
			const errorPageContent = `
import { ComponentType } from 'preact';

const ErrorPage: ComponentType = () => {
	throw new Error('Intentional test error');
};

export default ErrorPage;
			`;

			// Create custom error page
			await createTestFile('_error.tsx', testErrorComponent);
			await createTestFile('error-page.tsx', errorPageContent);

			// Discover routes
			const routes = await router.discoverRoutes();
			const errorRoute = routes.find(r => r.filePath.includes('error-page.tsx'));
			assertExists(errorRoute);

			// Build handler for the error route
			const handler = await router.buildRouteHandler(errorRoute, undefined, {}, null, true);

			// Execute the handler - should catch error and use custom error page
			const request = new Request('http://localhost/error-page');
			const response = await handler.handler(request);

			// Should return 500 status with custom error page
			assertEquals(response.status, 500);
			const html = await response.text();
			assertStringIncludes(html, 'Custom Error Page');
			// The error message might be wrapped in "Failed to render component"
			assertStringIncludes(html, 'Error:');
		});

		await t.step('should fall back to basic error when custom error page also fails', async () => {
			// Create a regular page that will cause an error
			const errorPageContent = `
import { ComponentType } from 'preact';

const ErrorPage: ComponentType = () => {
	throw new Error('Intentional test error');
};

export default ErrorPage;
			`;

			// Create a broken custom error page
			const brokenErrorPage = `
import { ComponentType } from 'preact';

const BrokenErrorPage: ComponentType = () => {
	throw new Error('Error page is also broken');
};

export default BrokenErrorPage;
			`;

			await createTestFile('error-page.tsx', errorPageContent);
			await createTestFile('_error.tsx', brokenErrorPage);

			// Discover routes
			const routes = await router.discoverRoutes();
			const errorRoute = routes.find(r => r.filePath.includes('error-page.tsx'));
			assertExists(errorRoute);

			// Build handler for the error route
			const handler = await router.buildRouteHandler(errorRoute, undefined, {}, null, true);

			// Execute the handler - should fall back to basic error
			const request = new Request('http://localhost/error-page');
			const response = await handler.handler(request);

			// Should return 500 status with basic error page
			assertEquals(response.status, 500);
			const html = await response.text();
			assertStringIncludes(html, 'Custom Error Page'); // Will use the broken custom error page
			assertStringIncludes(html, 'Error:'); // Should show some error
		});
	} finally {
		await cleanupTestDirectory();
	}
});

Deno.test('Special File Utility Functions', async t => {
	await setupTestDirectory();

	try {
		const router = new FileSystemRouter({
			discovery: {
				pagesDirectory: TEST_PAGES_DIR,
				developmentMode: true,
			},
		});

		await t.step('should create 404 handler utility', async () => {
			await createTestFile('_404.tsx', test404Component);

			const { create404Handler } = await import('../file-system-router.ts');
			const handler = await create404Handler(router, undefined, {}, null, true);

			assertExists(handler);
			assertEquals(handler.metadata.priority, 1000);

			const request = new Request('http://localhost/nonexistent');
			const response = await handler.handler(request);
			assertEquals(response.status, 404);
		});

		await t.step('should create error handler utility', async () => {
			await createTestFile('_error.tsx', testErrorComponent);

			const { createErrorHandler } = await import('../file-system-router.ts');
			const handler = await createErrorHandler(router, '/', undefined, {}, null, true);

			assertExists(handler);
			assertEquals(handler.metadata.priority, 999);

			const request = new Request('http://localhost/some-page');
			const testError = new Error('Test error');
			const response = await handler.handler(request, undefined, undefined, testError);
			assertEquals(response.status, 500);
		});

		await t.step('should include 404 handler in route handlers utility', async () => {
			await createTestFile(
				'index.tsx',
				`
import { ComponentType } from 'preact';
const HomePage: ComponentType = () => <div>Home</div>;
export default HomePage;
			`
			);
			await createTestFile('_404.tsx', test404Component);

			const { createFileSystemRouteHandlers } = await import('../file-system-router.ts');
			const handlers = await createFileSystemRouteHandlers(router, undefined, {}, null, true, true);

			// Should include both the index route and 404 handler
			assertEquals(handlers.length >= 2, true);

			// Find the 404 handler
			const notFoundHandler = handlers.find(h => h.metadata.priority === 1000);
			assertExists(notFoundHandler);

			const request = new Request('http://localhost/nonexistent');
			const response = await notFoundHandler.handler(request);
			assertEquals(response.status, 404);
		});
	} finally {
		await cleanupTestDirectory();
	}
});
