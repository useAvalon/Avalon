import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { describe, it, beforeEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';
import { LayoutMatcher, BuiltInLayoutRules } from '../layout-matcher.ts';
import type { LayoutRule, RouteInfo } from '../../../schemas/layout.ts';

// Helper function to create mock RouteInfo
function createMockRoute(path: string, method: string = 'GET', headers: Record<string, string> = {}): RouteInfo {
	const headersObj = new Headers();
	Object.entries(headers).forEach(([key, value]) => {
		headersObj.set(key, value);
	});

	return {
		path,
		params: {},
		method,
		headers: headersObj,
	};
}

describe('LayoutMatcher', () => {
	let matcher: LayoutMatcher;

	beforeEach(() => {
		matcher = new LayoutMatcher({ developmentMode: false });
	});

	describe('Basic functionality', () => {
		it('should apply layouts by default when no rules match', () => {
			const route = createMockRoute('/home');
			const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
			assertEquals(result, true);
		});

		it('should add custom rules', () => {
			const customRule: LayoutRule = {
				matches: () => true,
				apply: false,
				priority: 10,
			};

			matcher.addRule(customRule);
			const rules = matcher.getRules();

			// Should have built-in rules plus the custom rule
			assertEquals(rules.length > 4, true); // At least 4 built-in rules + 1 custom
		});

		it('should remove rules', () => {
			const customRule: LayoutRule = {
				matches: () => true,
				apply: false,
				priority: 10,
			};

			matcher.addRule(customRule);
			const initialCount = matcher.getRules().length;

			matcher.removeRule(customRule);
			const finalCount = matcher.getRules().length;

			assertEquals(finalCount, initialCount - 1);
		});

		it('should clear all rules', () => {
			matcher.clearRules();
			assertEquals(matcher.getRules().length, 0);
		});

		it('should validate rule structure', () => {
			assertThrows(
				() => {
					matcher.addRule({
						matches: null as any,
						apply: true,
						priority: 10,
					});
				},
				Error,
				'Layout rule must have a valid matches function'
			);

			assertThrows(
				() => {
					matcher.addRule({
						matches: () => true,
						apply: 'true' as any,
						priority: 10,
					});
				},
				Error,
				'Layout rule must have a boolean apply property'
			);

			assertThrows(
				() => {
					matcher.addRule({
						matches: () => true,
						apply: true,
						priority: 'high' as any,
					});
				},
				Error,
				'Layout rule must have a numeric priority'
			);
		});
	});

	describe('Built-in rules', () => {
		describe('API routes skip layouts', () => {
			it('should skip layouts for API routes', () => {
				const apiRoute = createMockRoute('/api/users');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', apiRoute);
				assertEquals(result, false);
			});

			it('should apply layouts for non-API routes', () => {
				const regularRoute = createMockRoute('/users');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', regularRoute);
				assertEquals(result, true);
			});

			it('should skip layouts for nested API routes', () => {
				const nestedApiRoute = createMockRoute('/api/v1/users/123');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', nestedApiRoute);
				assertEquals(result, false);
			});
		});

		describe('Mobile layout detection', () => {
			it('should apply mobile layouts for mobile user agents', () => {
				const mobileRoute = createMockRoute('/home', 'GET', {
					'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
				});
				const result = matcher.shouldApplyLayout('/layouts/mobile/_layout.tsx', mobileRoute);
				assertEquals(result, true);
			});

			it('should skip mobile layouts for desktop user agents', () => {
				const desktopRoute = createMockRoute('/home', 'GET', {
					'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				});
				const result = matcher.shouldApplyLayout('/layouts/mobile/_layout.tsx', desktopRoute);
				assertEquals(result, false);
			});

			it('should apply regular layouts for desktop user agents', () => {
				const desktopRoute = createMockRoute('/home', 'GET', {
					'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				});
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', desktopRoute);
				assertEquals(result, true);
			});

			it('should handle missing user agent gracefully', () => {
				const route = createMockRoute('/home');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				assertEquals(result, true);
			});
		});

		describe('Header-based skip', () => {
			it('should skip layouts when X-Skip-Layout header is true', () => {
				const route = createMockRoute('/home', 'GET', {
					'x-skip-layout': 'true',
				});
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				assertEquals(result, false);
			});

			it('should skip layouts when X-Skip-Layout header is 1', () => {
				const route = createMockRoute('/home', 'GET', {
					'x-skip-layout': '1',
				});
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				assertEquals(result, false);
			});

			it('should apply layouts when X-Skip-Layout header is false', () => {
				const route = createMockRoute('/home', 'GET', {
					'x-skip-layout': 'false',
				});
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				assertEquals(result, true);
			});

			it('should apply layouts when X-Skip-Layout header is missing', () => {
				const route = createMockRoute('/home');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				assertEquals(result, true);
			});
		});

		describe('Admin layout restriction', () => {
			it('should apply admin layouts to admin routes', () => {
				const adminRoute = createMockRoute('/admin/dashboard');
				const result = matcher.shouldApplyLayout('/layouts/admin/_layout.tsx', adminRoute);
				assertEquals(result, true);
			});

			it('should not apply admin layouts to non-admin routes', () => {
				const regularRoute = createMockRoute('/home');
				const result = matcher.shouldApplyLayout('/layouts/admin/_layout.tsx', regularRoute);
				assertEquals(result, false);
			});

			it('should apply regular layouts to any route', () => {
				const adminRoute = createMockRoute('/admin/dashboard');
				const regularRoute = createMockRoute('/home');

				assertEquals(matcher.shouldApplyLayout('/layouts/_layout.tsx', adminRoute), true);
				assertEquals(matcher.shouldApplyLayout('/layouts/_layout.tsx', regularRoute), true);
			});
		});
	});

	describe('Priority-based conflict resolution', () => {
		beforeEach(() => {
			// Clear built-in rules for cleaner testing
			matcher.clearRules();
		});

		it('should apply highest priority rule when rules conflict', () => {
			const lowPriorityRule: LayoutRule = {
				matches: () => true,
				apply: true,
				priority: 10,
			};

			const highPriorityRule: LayoutRule = {
				matches: () => true,
				apply: false,
				priority: 100,
			};

			matcher.addRule(lowPriorityRule);
			matcher.addRule(highPriorityRule);

			const route = createMockRoute('/test');
			const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);

			// High priority rule should win (apply: false)
			assertEquals(result, false);
		});

		it('should handle equal priority conflicts by preferring skip', () => {
			const applyRule: LayoutRule = {
				matches: () => true,
				apply: true,
				priority: 50,
			};

			const skipRule: LayoutRule = {
				matches: () => true,
				apply: false,
				priority: 50,
			};

			matcher.addRule(applyRule);
			matcher.addRule(skipRule);

			const route = createMockRoute('/test');
			const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);

			// Should prefer skip in tie-breaker
			assertEquals(result, false);
		});

		it('should apply majority rule when multiple equal priority rules exist', () => {
			const applyRule1: LayoutRule = {
				matches: () => true,
				apply: true,
				priority: 50,
			};

			const applyRule2: LayoutRule = {
				matches: () => true,
				apply: true,
				priority: 50,
			};

			const skipRule: LayoutRule = {
				matches: () => true,
				apply: false,
				priority: 50,
			};

			matcher.addRule(applyRule1);
			matcher.addRule(applyRule2);
			matcher.addRule(skipRule);

			const route = createMockRoute('/test');
			const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);

			// Majority says apply (2 vs 1)
			assertEquals(result, true);
		});
	});

	describe('Custom rule creation helpers', () => {
		it('should create custom rules', () => {
			const rule = LayoutMatcher.createCustomRule(
				'test-rule',
				(layoutPath, route) => route.path === '/test',
				false,
				25
			);

			assertEquals(rule.apply, false);
			assertEquals(rule.priority, 25);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test')), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/other')), false);
		});

		it('should create path-based rules with string patterns', () => {
			const rule = LayoutMatcher.createPathRule('/admin', false, 30);

			assertEquals(rule.apply, false);
			assertEquals(rule.priority, 30);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/admin/users')), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/users')), false);
		});

		it('should create path-based rules with regex patterns', () => {
			const rule = LayoutMatcher.createPathRule(/^\/api\/v\d+/, false, 40);

			assertEquals(rule.apply, false);
			assertEquals(rule.priority, 40);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/api/v1/users')), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/api/v2/posts')), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/api/users')), false);
		});

		it('should create header-based rules with string values', () => {
			const rule = LayoutMatcher.createHeaderRule('x-api-version', 'v2', true, 20);

			assertEquals(rule.apply, true);
			assertEquals(rule.priority, 20);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'GET', { 'x-api-version': 'v2' })), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'GET', { 'x-api-version': 'v1' })), false);
		});

		it('should create header-based rules with regex values', () => {
			const rule = LayoutMatcher.createHeaderRule('authorization', /^Bearer /, true, 35);

			assertEquals(rule.apply, true);
			assertEquals(rule.priority, 35);
			assertEquals(
				rule.matches('/layout.tsx', createMockRoute('/test', 'GET', { authorization: 'Bearer token123' })),
				true
			);
			assertEquals(
				rule.matches('/layout.tsx', createMockRoute('/test', 'GET', { authorization: 'Basic dXNlcjpwYXNz' })),
				false
			);
		});

		it('should create method-based rules with single method', () => {
			const rule = LayoutMatcher.createMethodRule('POST', false, 15);

			assertEquals(rule.apply, false);
			assertEquals(rule.priority, 15);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'POST')), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'GET')), false);
		});

		it('should create method-based rules with multiple methods', () => {
			const rule = LayoutMatcher.createMethodRule(['POST', 'PUT', 'DELETE'], false, 25);

			assertEquals(rule.apply, false);
			assertEquals(rule.priority, 25);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'POST')), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'PUT')), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'DELETE')), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'GET')), false);
		});

		it('should handle case-insensitive method matching', () => {
			const rule = LayoutMatcher.createMethodRule('post', false, 15);

			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'POST')), true);
			assertEquals(rule.matches('/layout.tsx', createMockRoute('/test', 'post')), true);
		});
	});

	describe('Debug information', () => {
		beforeEach(() => {
			matcher.clearRules();
		});

		it('should provide debug information', () => {
			const rule1: LayoutRule = {
				matches: () => true,
				apply: true,
				priority: 10,
			};

			const rule2: LayoutRule = {
				matches: () => false,
				apply: false,
				priority: 20,
			};

			matcher.addRule(rule1);
			matcher.addRule(rule2);

			const route = createMockRoute('/test');
			const debugInfo = matcher.getDebugInfo('/layout.tsx', route);

			assertEquals(debugInfo.totalRules, 2);
			assertEquals(debugInfo.matchingRules.length, 1); // Only rule1 matches
			assertEquals(debugInfo.matchingRules[0].priority, 10);
			assertEquals(debugInfo.matchingRules[0].apply, true);
			assertEquals(debugInfo.finalDecision, true);
			assertEquals(debugInfo.conflictResolution, 'single-rule');
		});

		it('should indicate conflict resolution when multiple rules match', () => {
			const rule1: LayoutRule = {
				matches: () => true,
				apply: true,
				priority: 10,
			};

			const rule2: LayoutRule = {
				matches: () => true,
				apply: false,
				priority: 20,
			};

			matcher.addRule(rule1);
			matcher.addRule(rule2);

			const route = createMockRoute('/test');
			const debugInfo = matcher.getDebugInfo('/layout.tsx', route);

			assertEquals(debugInfo.totalRules, 2);
			assertEquals(debugInfo.matchingRules.length, 2);
			assertEquals(debugInfo.conflictResolution, 'priority-based');
		});
	});

	describe('Error handling', () => {
		it('should handle rule evaluation errors gracefully', () => {
			const faultyRule: LayoutRule = {
				matches: () => {
					throw new Error('Rule evaluation failed');
				},
				apply: false,
				priority: 10,
			};

			matcher.addRule(faultyRule);

			const route = createMockRoute('/test');
			// Should not throw and should default to applying layout
			const result = matcher.shouldApplyLayout('/layout.tsx', route);
			assertEquals(result, true);
		});

		it('should continue with other rules when one fails', () => {
			const faultyRule: LayoutRule = {
				matches: () => {
					throw new Error('Rule evaluation failed');
				},
				apply: false,
				priority: 10,
			};

			const workingRule: LayoutRule = {
				matches: () => true,
				apply: false,
				priority: 20,
			};

			matcher.addRule(faultyRule);
			matcher.addRule(workingRule);

			const route = createMockRoute('/test');
			const result = matcher.shouldApplyLayout('/layout.tsx', route);

			// Working rule should be applied
			assertEquals(result, false);
		});
	});

	describe('Built-in rules access', () => {
		it('should provide access to all built-in rules', () => {
			const builtInRules = BuiltInLayoutRules.getAllRules();
			assertEquals(builtInRules.length, 4);

			// Verify rule priorities are set correctly
			const priorities = builtInRules.map(rule => rule.priority);
			assertEquals(priorities.includes(100), true); // API routes
			assertEquals(priorities.includes(90), true); // Header-based skip
			assertEquals(priorities.includes(60), true); // Admin restriction
			assertEquals(priorities.includes(50), true); // Mobile detection
		});

		it('should have API routes rule with highest priority', () => {
			const apiRule = BuiltInLayoutRules.API_ROUTES_SKIP_LAYOUTS;
			assertEquals(apiRule.priority, 100);
			assertEquals(apiRule.apply, false);
		});

		it('should have mobile detection rule with medium priority', () => {
			const mobileRule = BuiltInLayoutRules.MOBILE_LAYOUT_DETECTION;
			assertEquals(mobileRule.priority, 50);
			assertEquals(mobileRule.apply, false); // Skip mobile layouts for non-mobile user agents
		});
	});
});
