import { assertEquals, assertExists } from '@std/assert';
import { describe, it, beforeEach, afterEach } from '@std/testing/bdd';
import { LayoutDiscovery } from '../packages/avalon/src/core/layout/layout-discovery.ts';
import { LayoutMatcher } from '../packages/avalon/src/core/layout/layout-matcher.ts';
import type { LayoutRule, LayoutContext } from '../packages/avalon/src/schemas/layout.ts';
import { join } from '@std/path';
import { ensureDir, emptyDir } from '@std/fs';

describe('Layout Conditional Rendering Integration', () => {
	let testDir: string;
	let layoutDiscovery: LayoutDiscovery;

	beforeEach(async () => {
		// Create a temporary test directory
		testDir = await Deno.makeTempDir({ prefix: 'layout_test_' });

		// Create test layout structure
		await createTestLayoutStructure(testDir);

		// Initialize layout discovery
		layoutDiscovery = new LayoutDiscovery({
			baseDirectory: testDir,
			filePattern: '_layout.tsx',
			developmentMode: true,
		});
	});

	afterEach(async () => {
		// Clean up test directory
		await Deno.remove(testDir, { recursive: true });
	});

	async function createTestLayoutStructure(baseDir: string) {
		const pagesDir = join(baseDir, 'pages');
		await ensureDir(pagesDir);

		// Create root layout
		await Deno.writeTextFile(
			join(pagesDir, '_layout.tsx'),
			`export default function RootLayout({ children }) { return children; }`
		);

		// Create admin layout
		const adminDir = join(pagesDir, 'admin');
		await ensureDir(adminDir);
		await Deno.writeTextFile(
			join(adminDir, '_layout.tsx'),
			`export default function AdminLayout({ children }) { return children; }`
		);

		// Create mobile layout
		const mobileDir = join(pagesDir, 'mobile');
		await ensureDir(mobileDir);
		await Deno.writeTextFile(
			join(mobileDir, '_layout.tsx'),
			`export default function MobileLayout({ children }) { return children; }`
		);

		// Create API layout (should be skipped)
		const apiDir = join(pagesDir, 'api');
		await ensureDir(apiDir);
		await Deno.writeTextFile(
			join(apiDir, '_layout.tsx'),
			`export default function ApiLayout({ children }) { return children; }`
		);
	}

	function createMockRequest(path: string, method: string = 'GET', headers: Record<string, string> = {}): Request {
		const url = new URL(`http://localhost${path}`);
		const headersObj = new Headers();
		Object.entries(headers).forEach(([key, value]) => {
			headersObj.set(key, value);
		});

		return new Request(url, {
			method,
			headers: headersObj,
		});
	}

	describe('Built-in conditional rendering rules', () => {
		it('should skip layouts for API routes', async () => {
			const request = createMockRequest('/api/users');
			const url = new URL(request.url);

			const handlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// Should not include any layouts for API routes
			assertEquals(handlers.length, 0);
		});

		it('should apply layouts for regular routes', async () => {
			const request = createMockRequest('/home');
			const url = new URL(request.url);

			const handlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// Should include root layout
			assertEquals(handlers.length, 1);
			assertEquals(handlers[0].path.includes('_layout.tsx'), true);
		});

		it('should skip mobile layouts for desktop user agents', async () => {
			const request = createMockRequest('/mobile/dashboard', 'GET', {
				'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			});
			const url = new URL(request.url);

			const handlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// Should only include root layout, not mobile layout
			assertEquals(handlers.length, 1);
			assertEquals(handlers[0].path.includes('pages/_layout.tsx'), true);
			assertEquals(
				handlers.some(h => h.path.includes('mobile')),
				false
			);
		});

		it('should apply mobile layouts for mobile user agents', async () => {
			const request = createMockRequest('/mobile/dashboard', 'GET', {
				'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
			});
			const url = new URL(request.url);

			const handlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// Should include both root and mobile layouts
			assertEquals(handlers.length, 2);
			assertEquals(
				handlers.some(h => h.path.includes('pages/_layout.tsx')),
				true
			);
			assertEquals(
				handlers.some(h => h.path.includes('mobile/_layout.tsx')),
				true
			);
		});

		it('should skip admin layouts for non-admin routes', async () => {
			const request = createMockRequest('/home');
			const url = new URL(request.url);

			// First, let's check what layouts would be discovered without conditional rendering
			const allHandlers = await layoutDiscovery.buildLayoutChain(url);

			// Now check with conditional rendering
			const filteredHandlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// Should only include root layout, not admin layout
			assertEquals(filteredHandlers.length, 1);
			assertEquals(filteredHandlers[0].path.includes('pages/_layout.tsx'), true);
			assertEquals(
				filteredHandlers.some(h => h.path.includes('admin')),
				false
			);
		});

		it('should apply admin layouts for admin routes', async () => {
			const request = createMockRequest('/admin/dashboard');
			const url = new URL(request.url);

			const handlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// Should include both root and admin layouts
			assertEquals(handlers.length, 2);
			assertEquals(
				handlers.some(h => h.path.includes('pages/_layout.tsx')),
				true
			);
			assertEquals(
				handlers.some(h => h.path.includes('admin/_layout.tsx')),
				true
			);
		});

		it('should skip layouts when X-Skip-Layout header is present', async () => {
			const request = createMockRequest('/home', 'GET', {
				'x-skip-layout': 'true',
			});
			const url = new URL(request.url);

			const handlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// Should skip all layouts
			assertEquals(handlers.length, 0);
		});
	});

	describe('Custom conditional rendering rules', () => {
		it('should allow adding custom rules', async () => {
			const matcher = layoutDiscovery.getLayoutMatcher();

			// Add a custom rule to skip layouts for POST requests
			const customRule: LayoutRule = {
				matches: (layoutPath: string, route: any) => route.method === 'POST',
				apply: false,
				priority: 80,
			};

			matcher.addRule(customRule);

			const request = createMockRequest('/home', 'POST');
			const url = new URL(request.url);

			const handlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// Should skip all layouts for POST requests
			assertEquals(handlers.length, 0);
		});

		it('should handle rule priority correctly', async () => {
			const matcher = layoutDiscovery.getLayoutMatcher();

			// Add a low priority rule that would apply layouts
			const lowPriorityRule: LayoutRule = {
				matches: () => true,
				apply: true,
				priority: 10,
			};

			// Add a high priority rule that would skip layouts
			const highPriorityRule: LayoutRule = {
				matches: () => true,
				apply: false,
				priority: 200, // Higher than built-in API rule
			};

			matcher.addRule(lowPriorityRule);
			matcher.addRule(highPriorityRule);

			const request = createMockRequest('/home');
			const url = new URL(request.url);

			const handlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// High priority rule should win (skip layouts)
			assertEquals(handlers.length, 0);
		});
	});

	describe('Integration with data loading', () => {
		it('should load data only for layouts that pass conditional rendering', async () => {
			// Create a layout with a data loader
			const layoutWithLoader = join(testDir, 'pages', 'blog', '_layout.tsx');
			await ensureDir(join(testDir, 'pages', 'blog'));
			await Deno.writeTextFile(
				layoutWithLoader,
				`
export default function BlogLayout({ children, data }) { 
	return children; 
}

export async function layoutLoader(ctx) {
	return { blogTitle: 'My Blog' };
}
				`
			);

			const request = createMockRequest('/blog/post-1');
			const url = new URL(request.url);

			const context: LayoutContext = {
				request,
				params: {},
				query: url.searchParams,
				state: new Map(),
			};

			const result = await layoutDiscovery.buildLayoutChainWithConditionalRenderingAndData(url, context);

			// Should have root and blog layouts
			assertEquals(result.handlers.length, 2);
			assertEquals(result.data.length, 2);

			// Root layout has no loader, so empty data
			assertEquals(Object.keys(result.data[0]).length, 0);

			// Blog layout has loader, so should have data
			assertEquals(result.data[1].blogTitle, 'My Blog');
		});

		it('should not load data for layouts that are skipped by conditional rendering', async () => {
			// Create an API layout with a data loader
			const apiLayoutWithLoader = join(testDir, 'pages', 'api', '_layout.tsx');
			await Deno.writeTextFile(
				apiLayoutWithLoader,
				`
export default function ApiLayout({ children, data }) { 
	return children; 
}

export async function layoutLoader(ctx) {
	throw new Error('This should not be called for API routes');
}
				`
			);

			const request = createMockRequest('/api/users');
			const url = new URL(request.url);

			const context: LayoutContext = {
				request,
				params: {},
				query: url.searchParams,
				state: new Map(),
			};

			const result = await layoutDiscovery.buildLayoutChainWithConditionalRenderingAndData(url, context);

			// Should have no layouts for API routes
			assertEquals(result.handlers.length, 0);
			assertEquals(result.data.length, 0);
			assertEquals(result.errors.length, 0);
		});
	});

	describe('Layout matcher configuration', () => {
		it('should allow replacing the layout matcher', async () => {
			const customMatcher = new LayoutMatcher({ developmentMode: true });

			// Clear all rules and add only a custom one
			customMatcher.clearRules();
			customMatcher.addRule({
				matches: (layoutPath: string, route: any) => route.path.startsWith('/special'),
				apply: false,
				priority: 100,
			});

			layoutDiscovery.setLayoutMatcher(customMatcher);

			const specialRequest = createMockRequest('/special/page');
			const regularRequest = createMockRequest('/regular/page');

			const specialUrl = new URL(specialRequest.url);
			const regularUrl = new URL(regularRequest.url);

			const specialHandlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(
				specialUrl,
				specialRequest
			);
			const regularHandlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(
				regularUrl,
				regularRequest
			);

			// Special route should be skipped
			assertEquals(specialHandlers.length, 0);

			// Regular route should have layouts (no rules match)
			assertEquals(regularHandlers.length, 1);
		});

		it('should provide access to the current layout matcher', () => {
			const matcher = layoutDiscovery.getLayoutMatcher();
			assertExists(matcher);

			// Should have built-in rules
			const rules = matcher.getRules();
			assertEquals(rules.length >= 4, true); // At least 4 built-in rules
		});
	});

	describe('Error handling in conditional rendering', () => {
		it('should handle layout matcher errors gracefully', async () => {
			const matcher = layoutDiscovery.getLayoutMatcher();

			// Add a faulty rule
			const faultyRule: LayoutRule = {
				matches: () => {
					throw new Error('Rule evaluation failed');
				},
				apply: false,
				priority: 150,
			};

			matcher.addRule(faultyRule);

			const request = createMockRequest('/home');
			const url = new URL(request.url);

			// Should not throw and should still return layouts
			const handlers = await layoutDiscovery.buildLayoutChainWithConditionalRendering(url, request);

			// Should still have root layout (error handling defaults to applying layouts)
			assertEquals(handlers.length, 1);
		});
	});
});
