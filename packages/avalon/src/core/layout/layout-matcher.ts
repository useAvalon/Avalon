import type { LayoutRule, RouteInfo } from './layout-types.ts';

/**
 * Built-in layout rules for common scenarios
 */
export class BuiltInLayoutRules {
	/**
	 * Rule to skip HTML layouts for API routes
	 * Requirements: 4.1
	 */
	static readonly API_ROUTES_SKIP_LAYOUTS: LayoutRule = {
		matches: (route: RouteInfo): boolean => {
			return route.path.startsWith('/api/');
		},
		apply: false,
		priority: 100,
	};

	/**
	 * Rule to apply mobile-specific layouts for mobile user agents
	 * Requirements: 4.2
	 */
	static readonly MOBILE_LAYOUT_DETECTION: LayoutRule = {
		matches: (route: RouteInfo, layoutPath?: string): boolean => {
			const userAgent = route.headers.get('user-agent')?.toLowerCase() || '';
			const isMobile = /mobile|android|iphone|ipad|phone|tablet/i.test(userAgent);
			const isMobileLayout = layoutPath?.includes('/mobile/') ?? false;
			// Skip mobile layouts for non-mobile user agents; skip non-mobile layouts for mobile users
			if (isMobileLayout) return !isMobile;
			return isMobile;
		},
		apply: false,
		priority: 50,
	};

	/**
	 * Rule to skip layouts based on specific headers
	 * Requirements: 4.3
	 */
	static readonly HEADER_BASED_SKIP: LayoutRule = {
		matches: (route: RouteInfo): boolean => {
			const skipLayout = route.headers.get('x-skip-layout');
			return skipLayout === 'true' || skipLayout === '1';
		},
		apply: false,
		priority: 90,
	};

	/**
	 * Rule to apply admin layouts only for admin routes
	 * Requirements: 4.3
	 */
	static readonly ADMIN_LAYOUT_RESTRICTION: LayoutRule = {
		matches: (route: RouteInfo, layoutPath?: string): boolean => {
			// Only restrict admin layouts — if no layoutPath or not an admin layout, don't match
			if (!layoutPath?.includes('/admin/')) return false;
			// Admin layout should only apply to admin routes
			return !route.path.startsWith('/admin/');
		},
		apply: false,
		priority: 60,
	};

	static getAllRules(): LayoutRule[] {
		return [
			this.API_ROUTES_SKIP_LAYOUTS,
			this.MOBILE_LAYOUT_DETECTION,
			this.HEADER_BASED_SKIP,
			this.ADMIN_LAYOUT_RESTRICTION,
		];
	}
}

/**
 * Layout matcher class that handles conditional layout rendering based on rules
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
export class LayoutMatcher {
	private rules: LayoutRule[] = [];
	private readonly developmentMode: boolean;

	constructor(options: { developmentMode?: boolean } = {}) {
		this.developmentMode = options.developmentMode || false;
		this.addBuiltInRules();
	}

	/**
	 * Add a new layout rule
	 * Requirements: 4.3
	 */
	addRule(rule: LayoutRule): void {
		if (!rule.matches || typeof rule.matches !== 'function') {
			throw new Error('Layout rule must have a valid matches function');
		}
		if (typeof rule.apply !== 'boolean') {
			throw new TypeError('Layout rule must have a boolean apply property');
		}
		if (typeof rule.priority !== 'number') {
			throw new TypeError('Layout rule must have a numeric priority');
		}

		this.rules.push(rule);
		this.sortRulesByPriority();

		if (this.developmentMode) {
			console.log(`[LayoutMatcher] Added rule with priority ${rule.priority}`);
		}
	}

	/**
	 * Remove a layout rule
	 * Requirements: 4.3
	 */
	removeRule(rule: LayoutRule): void {
		const index = this.rules.indexOf(rule);
		if (index > -1) {
			this.rules.splice(index, 1);
			if (this.developmentMode) {
				console.log(`[LayoutMatcher] Removed rule with priority ${rule.priority}`);
			}
		}
	}

	/**
	 * Check if a layout should be applied based on all rules
	 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
	 */
	shouldApplyLayout(layoutPath: string, route: RouteInfo): boolean {
		try {
			const matchingRules = this.getMatchingRules(route, layoutPath);

			if (matchingRules.length === 0) {
				return true;
			}

			const result = this.resolveRuleConflicts(matchingRules);

			if (this.developmentMode) {
				console.log(
					`[LayoutMatcher] Layout ${layoutPath} for route ${route.path}: ${result ? 'APPLY' : 'SKIP'} ` +
						`(${matchingRules.length} rules matched)`,
				);
			}

			return result;
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[LayoutMatcher] Error evaluating rules for layout ${layoutPath}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
			return true;
		}
	}

	getRules(): LayoutRule[] {
		return [...this.rules];
	}

	clearRules(): void {
		this.rules = [];
		if (this.developmentMode) {
			console.log('[LayoutMatcher] Cleared all rules');
		}
	}

	private addBuiltInRules(): void {
		for (const rule of BuiltInLayoutRules.getAllRules()) {
			this.rules.push(rule);
		}
		this.sortRulesByPriority();
		if (this.developmentMode) {
			console.log(`[LayoutMatcher] Added ${this.rules.length} built-in rules`);
		}
	}

	private sortRulesByPriority(): void {
		this.rules.sort((a, b) => b.priority - a.priority);
	}

	private getMatchingRules(route: RouteInfo, layoutPath?: string): LayoutRule[] {
		const matchingRules: LayoutRule[] = [];
		for (const rule of this.rules) {
			try {
				if (rule.matches(route, layoutPath)) {
					matchingRules.push(rule);
				}
			} catch (error) {
				if (this.developmentMode) {
					console.warn(
						`[LayoutMatcher] Error in rule evaluation: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
		}
		return matchingRules;
	}

	private resolveRuleConflicts(matchingRules: LayoutRule[]): boolean {
		if (matchingRules.length === 0) return true;
		if (matchingRules.length === 1) return matchingRules[0].apply;

		const rulesByPriority = new Map<number, LayoutRule[]>();
		for (const rule of matchingRules) {
			if (!rulesByPriority.has(rule.priority)) {
				rulesByPriority.set(rule.priority, []);
			}
			rulesByPriority.get(rule.priority)!.push(rule);
		}

		const priorities = Array.from(rulesByPriority.keys()).sort((a, b) => b - a);
		const highestPriorityRules = rulesByPriority.get(priorities[0])!;

		if (highestPriorityRules.length === 1) {
			return highestPriorityRules[0].apply;
		}

		return this.resolveEqualPriorityConflicts(highestPriorityRules);
	}

	private resolveEqualPriorityConflicts(rules: LayoutRule[]): boolean {
		const applyCount = rules.filter(rule => rule.apply).length;
		const skipCount = rules.filter(rule => !rule.apply).length;

		if (skipCount > applyCount) {
			if (this.developmentMode) console.log(`[LayoutMatcher] Conflict resolution: SKIP`);
			return false;
		} else if (applyCount > skipCount) {
			if (this.developmentMode) console.log(`[LayoutMatcher] Conflict resolution: APPLY`);
			return true;
		} else {
			if (this.developmentMode) console.log(`[LayoutMatcher] Conflict resolution: SKIP (tie-breaker)`);
			return false;
		}
	}

	/**
	 * Create a custom rule
	 * Requirements: 4.3
	 */
	static createCustomRule(matcher: (route: RouteInfo) => boolean, apply: boolean, priority: number = 10): LayoutRule {
		return { matches: matcher, apply, priority };
	}

	static createPathRule(pathPattern: string | RegExp, apply: boolean, priority: number = 10): LayoutRule {
		const matches =
			typeof pathPattern === 'string'
				? (route: RouteInfo) => route.path.includes(pathPattern)
				: (route: RouteInfo) => pathPattern.test(route.path);
		return { matches, apply, priority };
	}

	static createHeaderRule(
		headerName: string,
		headerValue: string | RegExp,
		apply: boolean,
		priority: number = 10,
	): LayoutRule {
		return {
			matches: (route: RouteInfo) => {
				const val = route.headers.get(headerName.toLowerCase());
				if (!val) return false;
				return typeof headerValue === 'string' ? val === headerValue : headerValue.test(val);
			},
			apply,
			priority,
		};
	}

	static createMethodRule(methods: string | string[], apply: boolean, priority: number = 10): LayoutRule {
		const normalizedMethods = new Set((Array.isArray(methods) ? methods : [methods]).map(m => m.toUpperCase()));
		return {
			matches: (route: RouteInfo) => normalizedMethods.has(route.method.toUpperCase()),
			apply,
			priority,
		};
	}

	getDebugInfo(
		layoutPath: string,
		route: RouteInfo,
	): {
		totalRules: number;
		matchingRules: Array<{ priority: number; apply: boolean }>;
		finalDecision: boolean;
		conflictResolution?: string;
	} {
		const matchingRules = this.getMatchingRules(route, layoutPath);
		const finalDecision = this.shouldApplyLayout(layoutPath, route);
		return {
			totalRules: this.rules.length,
			matchingRules: matchingRules.map(rule => ({ priority: rule.priority, apply: rule.apply })),
			finalDecision,
			conflictResolution: matchingRules.length > 1 ? 'priority-based' : 'single-rule',
		};
	}
}
