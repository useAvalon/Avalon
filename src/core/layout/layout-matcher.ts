import type { LayoutRule, RouteInfo } from '../../schemas/layout.ts';

/**
 * Built-in layout rules for common scenarios
 */
export class BuiltInLayoutRules {
	/**
	 * Rule to skip HTML layouts for API routes
	 * Requirements: 4.1
	 */
	static readonly API_ROUTES_SKIP_LAYOUTS: LayoutRule = {
		matches: (layoutPath: string, route: RouteInfo): boolean => {
			return route.path.startsWith('/api/');
		},
		apply: false, // Skip layouts for API routes
		priority: 100, // High priority to ensure API routes are handled first
	};

	/**
	 * Rule to apply mobile-specific layouts for mobile user agents
	 * Requirements: 4.2
	 */
	static readonly MOBILE_LAYOUT_DETECTION: LayoutRule = {
		matches: (layoutPath: string, route: RouteInfo): boolean => {
			const userAgent = route.headers.get('user-agent')?.toLowerCase() || '';
			const isMobile = /mobile|android|iphone|ipad|phone|tablet/i.test(userAgent);
			const isMobileLayout = layoutPath.includes('mobile') || layoutPath.includes('_mobile');

			// Only match mobile layouts when user agent is NOT mobile (to skip them)
			return isMobileLayout && !isMobile;
		},
		apply: false, // Skip mobile layouts for non-mobile user agents
		priority: 50, // Medium priority
	};

	/**
	 * Rule to skip layouts based on specific headers
	 * Requirements: 4.3
	 */
	static readonly HEADER_BASED_SKIP: LayoutRule = {
		matches: (layoutPath: string, route: RouteInfo): boolean => {
			// Skip layouts if X-Skip-Layout header is present
			const skipLayout = route.headers.get('x-skip-layout');
			return skipLayout === 'true' || skipLayout === '1';
		},
		apply: false, // Skip layouts when header is present
		priority: 90, // High priority
	};

	/**
	 * Rule to apply admin layouts only for admin routes
	 * Requirements: 4.3
	 */
	static readonly ADMIN_LAYOUT_RESTRICTION: LayoutRule = {
		matches: (layoutPath: string, route: RouteInfo): boolean => {
			const isAdminLayout = layoutPath.includes('/admin/') || layoutPath.includes('admin');
			const isAdminRoute = route.path.startsWith('/admin/');

			// Only match admin layouts on non-admin routes (to skip them)
			return isAdminLayout && !isAdminRoute;
		},
		apply: false, // Skip admin layouts for non-admin routes
		priority: 60, // Medium-high priority
	};

	/**
	 * Get all built-in rules
	 */
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
	private developmentMode: boolean;

	constructor(options: { developmentMode?: boolean } = {}) {
		this.developmentMode = options.developmentMode || false;

		// Add built-in rules by default
		this.addBuiltInRules();
	}

	/**
	 * Add a new layout rule
	 * Requirements: 4.3
	 */
	addRule(rule: LayoutRule): void {
		// Validate rule
		if (!rule.matches || typeof rule.matches !== 'function') {
			throw new Error('Layout rule must have a valid matches function');
		}

		if (typeof rule.apply !== 'boolean') {
			throw new Error('Layout rule must have a boolean apply property');
		}

		if (typeof rule.priority !== 'number') {
			throw new Error('Layout rule must have a numeric priority');
		}

		this.rules.push(rule);

		// Sort rules by priority (higher priority first)
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
			// Evaluate all matching rules
			const matchingRules = this.getMatchingRules(layoutPath, route);

			if (matchingRules.length === 0) {
				// No rules match, apply layout by default
				return true;
			}

			// Apply priority-based conflict resolution
			// Requirements: 4.5 - most specific rule wins
			const result = this.resolveRuleConflicts(matchingRules, layoutPath, route);

			if (this.developmentMode) {
				console.log(
					`[LayoutMatcher] Layout ${layoutPath} for route ${route.path}: ${result ? 'APPLY' : 'SKIP'} ` +
						`(${matchingRules.length} rules matched)`
				);
			}

			return result;
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[LayoutMatcher] Error evaluating rules for layout ${layoutPath}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}

			// Default to applying layout if rule evaluation fails
			return true;
		}
	}

	/**
	 * Get all active rules
	 * Requirements: 4.3
	 */
	getRules(): LayoutRule[] {
		return [...this.rules]; // Return a copy to prevent external modification
	}

	/**
	 * Clear all rules
	 * Requirements: 4.3
	 */
	clearRules(): void {
		this.rules = [];

		if (this.developmentMode) {
			console.log('[LayoutMatcher] Cleared all rules');
		}
	}

	/**
	 * Add built-in rules
	 * Requirements: 4.1, 4.2, 4.3
	 */
	private addBuiltInRules(): void {
		const builtInRules = BuiltInLayoutRules.getAllRules();

		for (const rule of builtInRules) {
			this.rules.push(rule);
		}

		this.sortRulesByPriority();

		if (this.developmentMode) {
			console.log(`[LayoutMatcher] Added ${builtInRules.length} built-in rules`);
		}
	}

	/**
	 * Sort rules by priority (higher priority first)
	 * Requirements: 4.5
	 */
	private sortRulesByPriority(): void {
		this.rules.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Get all rules that match the current layout and route
	 * Requirements: 4.4
	 */
	private getMatchingRules(layoutPath: string, route: RouteInfo): LayoutRule[] {
		const matchingRules: LayoutRule[] = [];

		for (const rule of this.rules) {
			try {
				if (rule.matches(layoutPath, route)) {
					matchingRules.push(rule);
				}
			} catch (error) {
				if (this.developmentMode) {
					console.warn(
						`[LayoutMatcher] Error in rule evaluation: ${error instanceof Error ? error.message : String(error)}`
					);
				}
				// Continue with other rules if one fails
			}
		}

		return matchingRules;
	}

	/**
	 * Resolve conflicts when multiple rules match
	 * Requirements: 4.5
	 */
	private resolveRuleConflicts(matchingRules: LayoutRule[], layoutPath: string, route: RouteInfo): boolean {
		if (matchingRules.length === 0) {
			return true; // Default to applying layout
		}

		if (matchingRules.length === 1) {
			return matchingRules[0].apply;
		}

		// Multiple rules match - apply priority-based resolution
		// Rules are already sorted by priority (highest first)

		// Group rules by priority
		const rulesByPriority = new Map<number, LayoutRule[]>();
		for (const rule of matchingRules) {
			if (!rulesByPriority.has(rule.priority)) {
				rulesByPriority.set(rule.priority, []);
			}
			rulesByPriority.get(rule.priority)!.push(rule);
		}

		// Get the highest priority group
		const priorities = Array.from(rulesByPriority.keys()).sort((a, b) => b - a);
		const highestPriorityRules = rulesByPriority.get(priorities[0])!;

		if (highestPriorityRules.length === 1) {
			// Single highest priority rule wins
			return highestPriorityRules[0].apply;
		}

		// Multiple rules with same highest priority
		// Apply additional conflict resolution logic
		return this.resolveEqualPriorityConflicts(highestPriorityRules, layoutPath, route);
	}

	/**
	 * Resolve conflicts between rules with equal priority
	 * Requirements: 4.5
	 */
	private resolveEqualPriorityConflicts(rules: LayoutRule[], layoutPath: string, route: RouteInfo): boolean {
		// Count apply vs skip rules
		const applyCount = rules.filter(rule => rule.apply).length;
		const skipCount = rules.filter(rule => !rule.apply).length;

		if (skipCount > applyCount) {
			// More rules say skip, so skip
			if (this.developmentMode) {
				console.log(`[LayoutMatcher] Conflict resolution: SKIP (${skipCount} skip vs ${applyCount} apply)`);
			}
			return false;
		} else if (applyCount > skipCount) {
			// More rules say apply, so apply
			if (this.developmentMode) {
				console.log(`[LayoutMatcher] Conflict resolution: APPLY (${applyCount} apply vs ${skipCount} skip)`);
			}
			return true;
		} else {
			// Equal number of apply and skip rules
			// Default to more restrictive behavior (skip)
			if (this.developmentMode) {
				console.log(
					`[LayoutMatcher] Conflict resolution: SKIP (tie-breaker, ${applyCount} apply vs ${skipCount} skip)`
				);
			}
			return false;
		}
	}

	/**
	 * Create a custom rule for specific conditions
	 * Requirements: 4.3
	 */
	static createCustomRule(
		name: string,
		matcher: (layoutPath: string, route: RouteInfo) => boolean,
		apply: boolean,
		priority: number = 10
	): LayoutRule {
		return {
			matches: matcher,
			apply,
			priority,
		};
	}

	/**
	 * Create a path-based rule
	 * Requirements: 4.3
	 */
	static createPathRule(pathPattern: string | RegExp, apply: boolean, priority: number = 10): LayoutRule {
		const matcher =
			typeof pathPattern === 'string'
				? (layoutPath: string, route: RouteInfo) => route.path.includes(pathPattern)
				: (layoutPath: string, route: RouteInfo) => pathPattern.test(route.path);

		return {
			matches: matcher,
			apply,
			priority,
		};
	}

	/**
	 * Create a header-based rule
	 * Requirements: 4.3
	 */
	static createHeaderRule(
		headerName: string,
		headerValue: string | RegExp,
		apply: boolean,
		priority: number = 10
	): LayoutRule {
		const matcher = (layoutPath: string, route: RouteInfo) => {
			const headerVal = route.headers.get(headerName.toLowerCase());
			if (!headerVal) return false;

			if (typeof headerValue === 'string') {
				return headerVal === headerValue;
			} else {
				return headerValue.test(headerVal);
			}
		};

		return {
			matches: matcher,
			apply,
			priority,
		};
	}

	/**
	 * Create a method-based rule
	 * Requirements: 4.3
	 */
	static createMethodRule(methods: string | string[], apply: boolean, priority: number = 10): LayoutRule {
		const methodArray = Array.isArray(methods) ? methods : [methods];
		const normalizedMethods = methodArray.map(m => m.toUpperCase());

		return {
			matches: (layoutPath: string, route: RouteInfo) => {
				return normalizedMethods.includes(route.method.toUpperCase());
			},
			apply,
			priority,
		};
	}

	/**
	 * Get debug information about rule evaluation
	 * Requirements: Development debugging
	 */
	getDebugInfo(
		layoutPath: string,
		route: RouteInfo
	): {
		totalRules: number;
		matchingRules: Array<{ priority: number; apply: boolean; description?: string }>;
		finalDecision: boolean;
		conflictResolution?: string;
	} {
		const matchingRules = this.getMatchingRules(layoutPath, route);
		const finalDecision = this.shouldApplyLayout(layoutPath, route);

		return {
			totalRules: this.rules.length,
			matchingRules: matchingRules.map(rule => ({
				priority: rule.priority,
				apply: rule.apply,
			})),
			finalDecision,
			conflictResolution: matchingRules.length > 1 ? 'priority-based' : 'single-rule',
		};
	}
}
