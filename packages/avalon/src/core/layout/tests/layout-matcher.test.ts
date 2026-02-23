import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutMatcher, BuiltInLayoutRules } from '../layout-matcher.ts';
import type { LayoutRule, RouteInfo } from '../layout-types.ts';

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
			expect(result).toEqual(true);
		});

		it('should add custom rules', () => {
			const customRule: LayoutRule = {
				matches: () => true,
				apply: false,
				priority: 10,
			};

			matcher.addRule(customRule);
			const rules = matcher.getRules();

			expect(rules.length > 4).toEqual(true);
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

			expect(finalCount).toEqual(initialCount - 1);
		});

		it('should clear all rules', () => {
			matcher.clearRules();
			expect(matcher.getRules().length).toEqual(0);
		});

		it('should validate rule structure', () => {
			expect(() => {
				matcher.addRule({
					matches: null as any,
					apply: true,
					priority: 10,
				});
			}).toThrow('Layout rule must have a valid matches function');

			expect(() => {
				matcher.addRule({
					matches: () => true,
					apply: 'true' as any,
					priority: 10,
				});
			}).toThrow('Layout rule must have a boolean apply property');

			expect(() => {
				matcher.addRule({
					matches: () => true,
					apply: true,
					priority: 'high' as any,
				});
			}).toThrow('Layout rule must have a numeric priority');
		});
	});

	describe('Built-in rules', () => {
		describe('API routes skip layouts', () => {
			it('should skip layouts for API routes', () => {
				const apiRoute = createMockRoute('/api/users');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', apiRoute);
				expect(result).toEqual(false);
			});

			it('should apply layouts for non-API routes', () => {
				const regularRoute = createMockRoute('/users');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', regularRoute);
				expect(result).toEqual(true);
			});

			it('should skip layouts for nested API routes', () => {
				const nestedApiRoute = createMockRoute('/api/v1/users/123');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', nestedApiRoute);
				expect(result).toEqual(false);
			});
		});

		describe('Mobile layout detection', () => {
			it('should apply mobile layouts for mobile user agents', () => {
				const mobileRoute = createMockRoute('/home', 'GET', {
					'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
				});
				const result = matcher.shouldApplyLayout('/layouts/mobile/_layout.tsx', mobileRoute);
				expect(result).toEqual(true);
			});

			it('should skip mobile layouts for desktop user agents', () => {
				const desktopRoute = createMockRoute('/home', 'GET', {
					'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				});
				const result = matcher.shouldApplyLayout('/layouts/mobile/_layout.tsx', desktopRoute);
				expect(result).toEqual(false);
			});

			it('should apply regular layouts for desktop user agents', () => {
				const desktopRoute = createMockRoute('/home', 'GET', {
					'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				});
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', desktopRoute);
				expect(result).toEqual(true);
			});

			it('should handle missing user agent gracefully', () => {
				const route = createMockRoute('/home');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				expect(result).toEqual(true);
			});
		});

		describe('Header-based skip', () => {
			it('should skip layouts when X-Skip-Layout header is true', () => {
				const route = createMockRoute('/home', 'GET', {
					'x-skip-layout': 'true',
				});
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				expect(result).toEqual(false);
			});

			it('should skip layouts when X-Skip-Layout header is 1', () => {
				const route = createMockRoute('/home', 'GET', {
					'x-skip-layout': '1',
				});
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				expect(result).toEqual(false);
			});

			it('should apply layouts when X-Skip-Layout header is false', () => {
				const route = createMockRoute('/home', 'GET', {
					'x-skip-layout': 'false',
				});
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				expect(result).toEqual(true);
			});

			it('should apply layouts when X-Skip-Layout header is missing', () => {
				const route = createMockRoute('/home');
				const result = matcher.shouldApplyLayout('/layouts/_layout.tsx', route);
				expect(result).toEqual(true);
			});
		});

		describe('Admin layout restriction', () => {
			it('should apply admin layouts to admin routes', () => {
				const adminRoute = createMockRoute('/admin/dashboard');
				const result = matcher.shouldApplyLayout('/layouts/admin/_layout.tsx', adminRoute);
				expect(result).toEqual(true);
			});

			it('should not apply admin layouts to non-admin routes', () => {
				const regularRoute = createMockRoute('/home');
				const result = matcher.shouldApplyLayout('/layouts/admin/_layout.tsx', regularRoute);
				expect(result).toEqual(false);
			});

			it('should apply regular layouts to any route', () => {
				const adminRoute = createMockRoute('/admin/dashboard');
				const regularRoute = createMockRoute('/home');

				expect(matcher.shouldApplyLayout('/layouts/_layout.tsx', adminRoute)).toEqual(true);
				expect(matcher.shouldApplyLayout('/layouts/_layout.tsx', regularRoute)).toEqual(true);
			});
		});
	});

	describe('Priority-based conflict resolution', () => {
		beforeEach(() => {
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

			expect(result).toEqual(false);
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

			expect(result).toEqual(false);
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

			expect(result).toEqual(true);
		});
	});

	describe('Custom rule creation helpers', () => {
		it('should create custom rules', () => {
			const rule = LayoutMatcher.createCustomRule(route => route.path === '/test', false, 25);

			expect(rule.apply).toEqual(false);
			expect(rule.priority).toEqual(25);
			expect(rule.matches(createMockRoute('/test'))).toEqual(true);
			expect(rule.matches(createMockRoute('/other'))).toEqual(false);
		});

		it('should create path-based rules with string patterns', () => {
			const rule = LayoutMatcher.createPathRule('/admin', false, 30);

			expect(rule.apply).toEqual(false);
			expect(rule.priority).toEqual(30);
			expect(rule.matches(createMockRoute('/admin/users'))).toEqual(true);
			expect(rule.matches(createMockRoute('/users'))).toEqual(false);
		});

		it('should create path-based rules with regex patterns', () => {
			const rule = LayoutMatcher.createPathRule(/^\/api\/v\d+/, false, 40);

			expect(rule.apply).toEqual(false);
			expect(rule.priority).toEqual(40);
			expect(rule.matches(createMockRoute('/api/v1/users'))).toEqual(true);
			expect(rule.matches(createMockRoute('/api/v2/posts'))).toEqual(true);
			expect(rule.matches(createMockRoute('/api/users'))).toEqual(false);
		});

		it('should create header-based rules with string values', () => {
			const rule = LayoutMatcher.createHeaderRule('x-api-version', 'v2', true, 20);

			expect(rule.apply).toEqual(true);
			expect(rule.priority).toEqual(20);
			expect(rule.matches(createMockRoute('/test', 'GET', { 'x-api-version': 'v2' }))).toEqual(true);
			expect(rule.matches(createMockRoute('/test', 'GET', { 'x-api-version': 'v1' }))).toEqual(false);
		});

		it('should create header-based rules with regex values', () => {
			const rule = LayoutMatcher.createHeaderRule('authorization', /^Bearer /, true, 35);

			expect(rule.apply).toEqual(true);
			expect(rule.priority).toEqual(35);
			expect(rule.matches(createMockRoute('/test', 'GET', { authorization: 'Bearer token123' }))).toEqual(true);
			expect(rule.matches(createMockRoute('/test', 'GET', { authorization: 'Basic dXNlcjpwYXNz' }))).toEqual(false);
		});

		it('should create method-based rules with single method', () => {
			const rule = LayoutMatcher.createMethodRule('POST', false, 15);

			expect(rule.apply).toEqual(false);
			expect(rule.priority).toEqual(15);
			expect(rule.matches(createMockRoute('/test', 'POST'))).toEqual(true);
			expect(rule.matches(createMockRoute('/test', 'GET'))).toEqual(false);
		});

		it('should create method-based rules with multiple methods', () => {
			const rule = LayoutMatcher.createMethodRule(['POST', 'PUT', 'DELETE'], false, 25);

			expect(rule.apply).toEqual(false);
			expect(rule.priority).toEqual(25);
			expect(rule.matches(createMockRoute('/test', 'POST'))).toEqual(true);
			expect(rule.matches(createMockRoute('/test', 'PUT'))).toEqual(true);
			expect(rule.matches(createMockRoute('/test', 'DELETE'))).toEqual(true);
			expect(rule.matches(createMockRoute('/test', 'GET'))).toEqual(false);
		});

		it('should handle case-insensitive method matching', () => {
			const rule = LayoutMatcher.createMethodRule('post', false, 15);

			expect(rule.matches(createMockRoute('/test', 'POST'))).toEqual(true);
			expect(rule.matches(createMockRoute('/test', 'post'))).toEqual(true);
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

			expect(debugInfo.totalRules).toEqual(2);
			expect(debugInfo.matchingRules.length).toEqual(1);
			expect(debugInfo.matchingRules[0].priority).toEqual(10);
			expect(debugInfo.matchingRules[0].apply).toEqual(true);
			expect(debugInfo.finalDecision).toEqual(true);
			expect(debugInfo.conflictResolution).toEqual('single-rule');
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

			expect(debugInfo.totalRules).toEqual(2);
			expect(debugInfo.matchingRules.length).toEqual(2);
			expect(debugInfo.conflictResolution).toEqual('priority-based');
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
			const result = matcher.shouldApplyLayout('/layout.tsx', route);
			expect(result).toEqual(true);
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

			expect(result).toEqual(false);
		});
	});

	describe('Built-in rules access', () => {
		it('should provide access to all built-in rules', () => {
			const builtInRules = BuiltInLayoutRules.getAllRules();
			expect(builtInRules.length).toEqual(4);

			const priorities = builtInRules.map(rule => rule.priority);
			expect(priorities.includes(100)).toEqual(true);
			expect(priorities.includes(90)).toEqual(true);
			expect(priorities.includes(60)).toEqual(true);
			expect(priorities.includes(50)).toEqual(true);
		});

		it('should have API routes rule with highest priority', () => {
			const apiRule = BuiltInLayoutRules.API_ROUTES_SKIP_LAYOUTS;
			expect(apiRule.priority).toEqual(100);
			expect(apiRule.apply).toEqual(false);
		});

		it('should have mobile detection rule with medium priority', () => {
			const mobileRule = BuiltInLayoutRules.MOBILE_LAYOUT_DETECTION;
			expect(mobileRule.priority).toEqual(50);
			expect(mobileRule.apply).toEqual(false);
		});
	});
});
