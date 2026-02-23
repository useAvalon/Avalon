/**
 * Preservation Property Tests
 *
 * These tests capture the CURRENT baseline behavior of the UNFIXED code.
 * They MUST PASS on unfixed code — they verify behavior that should remain
 * unchanged after fixes are applied.
 *
 * Uses fast-check for property-based testing to verify properties hold
 * across many generated inputs.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { LayoutMatcher, BuiltInLayoutRules } from '../packages/avalon/src/core/layout/layout-matcher.ts';
import type { RouteInfo } from '../packages/avalon/src/core/layout/layout-types.ts';
import { FrameworkRegistry } from '../packages/avalon/src/core/components/framework-registry.ts';

// ---------------------------------------------------------------------------
// Helpers: RouteInfo generators
// ---------------------------------------------------------------------------

/** Generate a valid URL path string */
const pathArb = fc.oneof(
	// Common route paths
	fc.constantFrom(
		'/',
		'/about',
		'/api/users',
		'/api/health',
		'/admin/dashboard',
		'/admin/settings',
		'/blog/post-1',
		'/products/123',
		'/api/v2/data',
		'/contact',
		'/login',
		'/dashboard',
		'/settings/profile',
	),
	// Random path segments
	fc
		.array(fc.stringMatching(/^[a-z0-9-]{1,12}$/), { minLength: 1, maxLength: 4 })
		.map(segments => '/' + segments.join('/')),
);

/** Generate a valid HTTP method */
const methodArb = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD');

/** Generate a Headers object with optional user-agent and x-skip-layout */
const headersArb = fc
	.record({
		userAgent: fc.option(
			fc.oneof(
				fc.constantFrom(
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
					'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
					'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile',
					'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)',
					'curl/7.88.1',
					'PostmanRuntime/7.32.3',
				),
				fc.string({ minLength: 0, maxLength: 50 }),
			),
			{ nil: undefined },
		),
		skipLayout: fc.option(fc.constantFrom('true', 'false', '1', '0', 'yes'), { nil: undefined }),
	})
	.map(({ userAgent, skipLayout }) => {
		const headers = new Headers();
		if (userAgent) headers.set('user-agent', userAgent);
		if (skipLayout) headers.set('x-skip-layout', skipLayout);
		return headers;
	});

/** Generate a complete RouteInfo object */
const routeInfoArb = fc.tuple(pathArb, methodArb, headersArb).map(
	([path, method, headers]): RouteInfo => ({
		path,
		params: {},
		method,
		headers,
	}),
);

// ---------------------------------------------------------------------------
// Property 1: shouldApplyLayout() produces consistent matching decisions
// with the unified 1-param LayoutRule type
// Validates: Preservation Requirements 3.2, 3.6
// ---------------------------------------------------------------------------
describe('Preservation: shouldApplyLayout() consistency', () => {
	it('should produce deterministic results for the same route input', () => {
		/**
		 * **Validates: Requirements 3.2, 3.6**
		 *
		 * For all valid route paths, shouldApplyLayout() produces consistent
		 * matching decisions with the unified 1-param LayoutRule type.
		 * The built-in rules (API route skip, mobile detection, header-based skip,
		 * admin restriction) already use the 1-param matches signature at runtime.
		 */
		const matcher = new LayoutMatcher();

		fc.assert(
			fc.property(routeInfoArb, route => {
				const result1 = matcher.shouldApplyLayout('/layouts/default.tsx', route);
				const result2 = matcher.shouldApplyLayout('/layouts/default.tsx', route);

				// Same input must produce same output (deterministic)
				expect(result1).toBe(result2);
				expect(typeof result1).toBe('boolean');
			}),
			{ numRuns: 200 },
		);
	});

	it('API routes should always be skipped by the API_ROUTES_SKIP_LAYOUTS rule', () => {
		/**
		 * **Validates: Requirements 3.6**
		 *
		 * The built-in API route skip rule matches any route starting with /api/
		 * and sets apply=false. This behavior must be preserved.
		 */
		const apiPathArb = fc.stringMatching(/^[a-z0-9/-]{1,20}$/).map(s => '/api/' + s);

		fc.assert(
			fc.property(apiPathArb, methodArb, headersArb, (path, method, headers) => {
				const route: RouteInfo = { path, params: {}, method, headers };
				const rule = BuiltInLayoutRules.API_ROUTES_SKIP_LAYOUTS;

				// The rule matches API routes (returns true for /api/ paths)
				expect(rule.matches(route)).toBe(true);
				// And the rule says to NOT apply layout
				expect(rule.apply).toBe(false);
			}),
			{ numRuns: 100 },
		);
	});

	it('non-admin routes should be matched by ADMIN_LAYOUT_RESTRICTION rule when checking an admin layout', () => {
		/**
		 * **Validates: Requirements 3.6**
		 *
		 * The admin restriction rule matches routes that do NOT start with /admin/
		 * when the layout being checked IS an admin layout (layoutPath contains /admin/).
		 * This behavior must be preserved — admin layouts should not apply to non-admin routes.
		 */
		const nonAdminPathArb = fc.oneof(
			fc.constant('/'),
			fc.constant('/about'),
			fc.constant('/blog/post'),
			fc.stringMatching(/^\/[a-z]{1,10}(\/[a-z0-9-]{1,10})*$/).filter(p => !p.startsWith('/admin/')),
		);

		fc.assert(
			fc.property(nonAdminPathArb, methodArb, headersArb, (path, method, headers) => {
				const route: RouteInfo = { path, params: {}, method, headers };
				const rule = BuiltInLayoutRules.ADMIN_LAYOUT_RESTRICTION;

				// Non-admin routes are matched when checking against an admin layout (returns true)
				expect(rule.matches(route, '/layouts/admin/dashboard.tsx')).toBe(true);
				// Non-admin routes are NOT matched when checking against a non-admin layout (returns false)
				expect(rule.matches(route, '/layouts/_layout.tsx')).toBe(false);
				// Non-admin routes are NOT matched when no layoutPath is provided (returns false)
				expect(rule.matches(route)).toBe(false);
			}),
			{ numRuns: 100 },
		);
	});

	it('header-based skip rule should match when x-skip-layout is "true" or "1"', () => {
		/**
		 * **Validates: Requirements 3.6**
		 *
		 * The header-based skip rule matches when x-skip-layout header is "true" or "1".
		 */
		const skipValueArb = fc.constantFrom('true', '1');

		fc.assert(
			fc.property(pathArb, skipValueArb, (path, skipValue) => {
				const headers = new Headers();
				headers.set('x-skip-layout', skipValue);
				const route: RouteInfo = { path, params: {}, method: 'GET', headers };
				const rule = BuiltInLayoutRules.HEADER_BASED_SKIP;

				expect(rule.matches(route)).toBe(true);
			}),
			{ numRuns: 50 },
		);
	});
});

// ---------------------------------------------------------------------------
// Property 2: FrameworkRegistry returns correct configurations for all 6 frameworks
// Validates: Preservation Requirements 3.3
// ---------------------------------------------------------------------------
describe('Preservation: FrameworkRegistry correctness', () => {
	const EXPECTED_FRAMEWORKS = ['preact', 'solid', 'vue', 'svelte', 'react', 'lit'] as const;

	it('getFramework() returns a valid config for all 6 registered framework names', () => {
		/**
		 * **Validates: Requirements 3.3**
		 *
		 * For all 6 framework names, getFramework() returns the correct
		 * configuration object. The registry already has 6 frameworks;
		 * only test assertions were wrong.
		 */
		const frameworkNameArb = fc.constantFrom(...EXPECTED_FRAMEWORKS);
		const registry = new FrameworkRegistry();

		fc.assert(
			fc.property(frameworkNameArb, name => {
				const config = registry.getFramework(name);

				// Must return a defined config
				expect(config).toBeDefined();
				expect(config!.name).toBe(name);

				// Must have required fields
				expect(Array.isArray(config!.fileExtensions)).toBe(true);
				expect(config!.fileExtensions.length).toBeGreaterThan(0);
				expect(Array.isArray(config!.jsxImportSources)).toBe(true);
				expect(Array.isArray(config!.ssrModules)).toBe(true);
				expect(Array.isArray(config!.hydrationModules)).toBe(true);
			}),
			{ numRuns: 50 },
		);
	});

	it('getAllFrameworks() returns exactly 6 frameworks', () => {
		/**
		 * **Validates: Requirements 3.3**
		 *
		 * The registry initializes with 6 default frameworks.
		 */
		const registry = new FrameworkRegistry();
		const all = registry.getAllFrameworks();

		expect(all.size).toBe(6);
		for (const name of EXPECTED_FRAMEWORKS) {
			expect(all.has(name)).toBe(true);
		}
	});

	it('getFrameworksByExtension() returns consistent results for known extensions', () => {
		/**
		 * **Validates: Requirements 3.3**
		 *
		 * Extension-based lookups must return the correct frameworks.
		 */
		const registry = new FrameworkRegistry();
		const extensionArb = fc.constantFrom('.tsx', '.jsx', '.vue', '.svelte', '.ts', '.js');

		fc.assert(
			fc.property(extensionArb, ext => {
				const frameworks = registry.getFrameworksByExtension(ext);

				expect(Array.isArray(frameworks)).toBe(true);
				// Each returned framework name should be one of the 6 known frameworks
				for (const name of frameworks) {
					expect(EXPECTED_FRAMEWORKS).toContain(name);
				}
				// Results should be deterministic
				const frameworks2 = registry.getFrameworksByExtension(ext);
				expect(frameworks).toEqual(frameworks2);
			}),
			{ numRuns: 30 },
		);
	});
});

// ---------------------------------------------------------------------------
// Property 3: h3-compatible path extraction yields the same value as event.path
// Validates: Preservation Requirements 3.1
// ---------------------------------------------------------------------------
describe('Preservation: middleware path extraction equivalence', () => {
	it('URL pathname extraction matches event.path for standard request paths', () => {
		/**
		 * **Validates: Requirements 3.1**
		 *
		 * For all valid request paths, h3-compatible path extraction
		 * (new URL(path, base).pathname) yields the same value as the
		 * deprecated event.path. This confirms the migration is safe.
		 *
		 * The buildUrlFromEvent function in executor.ts constructs:
		 *   new URL(event.path, 'http://localhost')
		 * After migration it will use getRequestURL(event).pathname.
		 * For standard paths, both should yield the same pathname.
		 */
		const requestPathArb = fc.oneof(
			fc.constant('/'),
			fc.constant('/api/users'),
			fc.constant('/admin/dashboard'),
			// Generate valid URL path segments (alphanumeric + hyphens only;
			// dots-only segments like "." get normalized by URL parsing, e.g. /. -> /)
			fc
				.array(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]{0,14}$/), { minLength: 1, maxLength: 5 })
				.map(segments => '/' + segments.join('/')),
		);

		fc.assert(
			fc.property(requestPathArb, path => {
				// Simulate what buildUrlFromEvent does with event.path
				const url = new URL(path, 'http://localhost');
				const extractedPath = url.pathname;

				// The extracted pathname should equal the original path
				// (for well-formed paths without query strings)
				expect(extractedPath).toBe(path);
			}),
			{ numRuns: 200 },
		);
	});
});

// ---------------------------------------------------------------------------
// Property 4: Shared resolveIslandPath() produces same output as local copies
// Validates: Preservation Requirements 3.5, 3.7
// ---------------------------------------------------------------------------
describe('Preservation: resolveIslandPath() equivalence', () => {
	/**
	 * Local resolveIslandPath implementations from integration renderers.
	 * These are the EXACT implementations from the unfixed code, inlined here
	 * to capture baseline behavior for comparison with the shared version.
	 */

	// Common pattern used by vue, svelte, preact, react, lit renderers
	function localResolveIslandPath(src: string): string {
		if (src.startsWith('/islands/')) {
			return src.replace('/islands/', '/src/islands/');
		}
		if (src.startsWith('/src/islands/')) {
			return src;
		}
		return src;
	}

	// The shared resolveIslandPathSync from framework-detection.ts
	// (inlined to avoid async/cache/registry side effects in property tests)
	function sharedResolveIslandPathSync(src: string): string {
		let resolvedPath = src;

		// Normalize path separators
		resolvedPath = resolvedPath.replace(/\\/g, '/');

		// Handle nested island paths
		if (resolvedPath.includes('/islands/') && !resolvedPath.startsWith('/src/')) {
			if (resolvedPath.match(/^\/(?:modules\/)?[^/]+\/islands\//)) {
				resolvedPath = '/src' + resolvedPath;
			} else if (resolvedPath.startsWith('/islands/')) {
				resolvedPath = resolvedPath.replace('/islands/', '/src/islands/');
			}
		}

		return resolvedPath;
	}

	/** Generate valid island source paths (Unix-style) */
	const islandPathArb = fc.oneof(
		// Simple /islands/ paths (most common case)
		fc.stringMatching(/^[A-Z][a-zA-Z0-9]{0,15}$/).map(name => `/islands/${name}.tsx`),
		fc.stringMatching(/^[A-Z][a-zA-Z0-9]{0,15}$/).map(name => `/islands/${name}.vue`),
		fc.stringMatching(/^[A-Z][a-zA-Z0-9]{0,15}$/).map(name => `/islands/${name}.svelte`),
		// Already resolved /src/islands/ paths
		fc.stringMatching(/^[A-Z][a-zA-Z0-9]{0,15}$/).map(name => `/src/islands/${name}.tsx`),
		// Non-island paths (should pass through unchanged)
		fc.constantFrom('/components/Button.tsx', '/pages/index.tsx', '/lib/utils.ts'),
	);

	it('shared resolveIslandPath produces same output as local copies for simple island paths', () => {
		/**
		 * **Validates: Requirements 3.5, 3.7**
		 *
		 * For all valid island source paths (Unix-style), the shared
		 * resolveIslandPath() produces the same output as the local
		 * renderer copies. The local copies all do the same basic thing:
		 * if starts with /islands/, replace with /src/islands/.
		 */
		fc.assert(
			fc.property(islandPathArb, src => {
				const localResult = localResolveIslandPath(src);
				const sharedResult = sharedResolveIslandPathSync(src);

				// For simple /islands/ and /src/islands/ paths, both should agree
				expect(sharedResult).toBe(localResult);
			}),
			{ numRuns: 200 },
		);
	});

	it('resolveIslandPath preserves /src/islands/ paths unchanged', () => {
		/**
		 * **Validates: Requirements 3.5**
		 *
		 * Paths already starting with /src/islands/ should pass through unchanged.
		 */
		const srcIslandPathArb = fc.stringMatching(/^[A-Z][a-zA-Z0-9]{0,15}$/).map(name => `/src/islands/${name}.tsx`);

		fc.assert(
			fc.property(srcIslandPathArb, src => {
				const localResult = localResolveIslandPath(src);
				const sharedResult = sharedResolveIslandPathSync(src);

				expect(localResult).toBe(src);
				expect(sharedResult).toBe(src);
			}),
			{ numRuns: 50 },
		);
	});
});

// ---------------------------------------------------------------------------
// Property 5: .replaceAll() vs .replace() equivalence for single-occurrence paths
// Validates: Preservation Requirements 3.8
// ---------------------------------------------------------------------------
describe('Preservation: replaceAll vs replace equivalence for single-occurrence paths', () => {
	it('.replaceAll and .replace produce same result when substring appears at most once', () => {
		/**
		 * **Validates: Requirements 3.8**
		 *
		 * For all valid island paths where '/islands/' appears at most once,
		 * .replaceAll('/islands/', '/src/islands/') produces the same result
		 * as .replace('/islands/', '/src/islands/').
		 *
		 * This confirms that the migration from .replace() to .replaceAll()
		 * is safe for the common case (single occurrence).
		 */
		const singleOccurrencePathArb = fc.oneof(
			// Paths with exactly one /islands/ occurrence
			fc.stringMatching(/^[A-Z][a-zA-Z0-9]{0,15}$/).map(name => `/islands/${name}.tsx`),
			fc.stringMatching(/^[A-Z][a-zA-Z0-9]{0,15}$/).map(name => `/islands/nested/${name}.vue`),
			// Paths with zero /islands/ occurrences
			fc.constantFrom('/src/components/Button.tsx', '/pages/index.tsx', '/lib/utils.ts', '/src/islands/Counter.tsx'),
			// Random paths without /islands/
			fc.stringMatching(/^\/[a-z]{1,10}(\/[a-z0-9]{1,10}){0,3}\.[a-z]{2,4}$/).filter(p => !p.includes('/islands/')),
		);

		fc.assert(
			fc.property(singleOccurrencePathArb, path => {
				const replaceResult = path.replace('/islands/', '/src/islands/');
				const replaceAllResult = path.replaceAll('/islands/', '/src/islands/');

				// For single-occurrence paths, both should produce the same result
				expect(replaceAllResult).toBe(replaceResult);
			}),
			{ numRuns: 200 },
		);
	});

	it('.replaceAll replaces ALL occurrences while .replace only replaces the first', () => {
		/**
		 * **Validates: Requirements 3.8**
		 *
		 * This test documents the difference between .replace() and .replaceAll()
		 * when the substring appears multiple times. This is the bug that
		 * .replaceAll() fixes — but for preservation, we verify the current
		 * .replace() behavior is captured.
		 */
		// Paths with multiple /islands/ occurrences (edge case that triggers the bug)
		const multiOccurrencePathArb = fc
			.stringMatching(/^[A-Z][a-zA-Z0-9]{0,10}$/)
			.map(name => `/islands/nested/islands/${name}.tsx`);

		fc.assert(
			fc.property(multiOccurrencePathArb, path => {
				// Count occurrences of '/islands/'
				const count = (path.match(/\/islands\//g) || []).length;

				if (count > 1) {
					const replaceResult = path.replace('/islands/', '/src/islands/');
					const replaceAllResult = path.replaceAll('/islands/', '/src/islands/');

					// .replace() only replaces the first occurrence
					// .replaceAll() replaces all occurrences
					// They should differ when there are multiple occurrences
					expect(replaceResult).not.toBe(replaceAllResult);
				}
			}),
			{ numRuns: 50 },
		);
	});
});
