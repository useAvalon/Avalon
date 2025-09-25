/**
 * Conflict Resolver - Handles route conflicts and validation
 */

import type { FileSystemRoute, FileSystemApiRoute } from '../../../schemas/routing.ts';
import { RoutingErrorHandler } from '../error-handler.ts';
import { ErrorSeverity } from '../error-handler.types.ts';

/**
 * Resolves conflicts between routes
 */
export class ConflictResolver {
	constructor(private errorHandler: RoutingErrorHandler) {}

	/**
	 * Detects and resolves route conflicts
	 */
	detectAndResolveConflicts(routes: FileSystemRoute[]): FileSystemRoute[] {
		const routeMap = new Map<string, FileSystemRoute[]>();
		const resolvedRoutes: FileSystemRoute[] = [];

		// Group routes by their pattern pathname
		for (const route of routes) {
			const patternKey = route.pattern.pathname;
			if (!routeMap.has(patternKey)) {
				routeMap.set(patternKey, []);
			}
			routeMap.get(patternKey)!.push(route);
		}

		// Check each group for conflicts
		for (const [patternKey, conflictingRoutes] of routeMap) {
			if (conflictingRoutes.length === 1) {
				// No conflict, add the route
				resolvedRoutes.push(conflictingRoutes[0]);
			} else {
				// Multiple routes with same pattern - resolve conflict
				const resolved = this.resolveRouteConflict(patternKey, conflictingRoutes);
				if (resolved) {
					resolvedRoutes.push(resolved);
				}
			}
		}

		return resolvedRoutes;
	}

	/**
	 * Detects and resolves API route conflicts
	 */
	detectAndResolveApiConflicts(routes: FileSystemApiRoute[]): FileSystemApiRoute[] {
		const routeMap = new Map<string, FileSystemApiRoute[]>();
		const resolvedRoutes: FileSystemApiRoute[] = [];

		// Group routes by their pattern pathname
		for (const route of routes) {
			const patternKey = route.pattern.pathname;
			if (!routeMap.has(patternKey)) {
				routeMap.set(patternKey, []);
			}
			routeMap.get(patternKey)!.push(route);
		}

		// Check each group for conflicts
		for (const [patternKey, conflictingRoutes] of routeMap) {
			if (conflictingRoutes.length === 1) {
				// No conflict, add the route
				resolvedRoutes.push(conflictingRoutes[0]);
			} else {
				// Check for method conflicts
				const methodConflicts = this.findMethodConflicts(conflictingRoutes);
				if (methodConflicts.length > 0) {
					const resolved = this.resolveApiRouteConflict(patternKey, conflictingRoutes, methodConflicts);
					if (resolved) {
						resolvedRoutes.push(resolved);
					}
				} else {
					// No method conflicts, can coexist
					resolvedRoutes.push(...conflictingRoutes);
				}
			}
		}

		return resolvedRoutes;
	}

	/**
	 * Validates route patterns for potential conflicts
	 */
	validateRoutePatterns(routes: FileSystemRoute[]): string[] {
		const errors: string[] = [];
		const patterns = new Set<string>();

		for (const route of routes) {
			const patternStr = route.pattern.pathname;

			// Check for duplicate patterns
			if (patterns.has(patternStr)) {
				errors.push(`Duplicate route pattern: ${patternStr} (${route.filePath})`);
			}
			patterns.add(patternStr);

			// Check for invalid patterns
			if (!patternStr.startsWith('/')) {
				errors.push(`Invalid route pattern (must start with /): ${patternStr} (${route.filePath})`);
			}
		}

		return errors;
	}

	/**
	 * Validates API route patterns for potential conflicts
	 */
	validateApiRoutePatterns(routes: FileSystemApiRoute[]): string[] {
		const errors: string[] = [];
		const patternMethodMap = new Map<string, Set<string>>();

		for (const route of routes) {
			const patternStr = route.pattern.pathname;

			if (!patternMethodMap.has(patternStr)) {
				patternMethodMap.set(patternStr, new Set());
			}

			const existingMethods = patternMethodMap.get(patternStr)!;

			// Check for method conflicts
			for (const method of route.methods) {
				if (existingMethods.has(method)) {
					errors.push(`Duplicate API route method: ${method} ${patternStr} (${route.filePath})`);
				}
				existingMethods.add(method);
			}

			// Check for invalid patterns
			if (!patternStr.startsWith('/api')) {
				errors.push(`Invalid API route pattern (must start with /api): ${patternStr} (${route.filePath})`);
			}
		}

		return errors;
	}

	/**
	 * Resolves conflicts between routes with the same pattern
	 */
	private resolveRouteConflict(patternKey: string, conflictingRoutes: FileSystemRoute[]): FileSystemRoute | null {
		// Sort by priority (lower number = higher priority)
		const sortedRoutes = conflictingRoutes.sort((a, b) => a.priority - b.priority);

		const winner = sortedRoutes[0];
		const losers = sortedRoutes.slice(1);

		// Create detailed error for route conflict
		const conflictError = this.errorHandler.createRouteConflictError(conflictingRoutes, patternKey);

		// Check if the conflict is problematic (same priority)
		if (losers.some(loser => loser.priority === winner.priority)) {
			// This is an unresolvable conflict - handle as error
			this.errorHandler.handleError(conflictError);
			return null; // Return null to indicate unresolvable conflict
		} else {
			// This is a resolvable conflict - handle as warning
			const warningError = { ...conflictError, severity: ErrorSeverity.WARNING };
			this.errorHandler.handleError(warningError);
		}

		return winner;
	}

	/**
	 * Resolves conflicts between API routes with the same pattern
	 */
	private resolveApiRouteConflict(
		patternKey: string,
		conflictingRoutes: FileSystemApiRoute[],
		methodConflicts: string[]
	): FileSystemApiRoute | null {
		// Sort by priority (lower number = higher priority)
		const sortedRoutes = conflictingRoutes.sort((a, b) => a.priority - b.priority);

		const winner = sortedRoutes[0];
		const losers = sortedRoutes.slice(1);

		// Create detailed error for API route conflict
		const conflictError = this.errorHandler.createApiRouteConflictError(conflictingRoutes, patternKey, methodConflicts);

		// Check if the conflict is problematic (same priority)
		if (losers.some(loser => loser.priority === winner.priority)) {
			// This is an unresolvable conflict - handle as error
			this.errorHandler.handleError(conflictError);
			return null;
		} else {
			// This is a resolvable conflict - handle as warning
			const warningError = { ...conflictError, severity: ErrorSeverity.WARNING };
			this.errorHandler.handleError(warningError);
		}

		return winner;
	}

	/**
	 * Finds method conflicts between API routes
	 */
	private findMethodConflicts(routes: FileSystemApiRoute[]): string[] {
		const methodCounts = new Map<string, number>();

		for (const route of routes) {
			for (const method of route.methods) {
				methodCounts.set(method, (methodCounts.get(method) || 0) + 1);
			}
		}

		return Array.from(methodCounts.entries())
			.filter(([, count]) => count > 1)
			.map(([method]) => method);
	}
}
