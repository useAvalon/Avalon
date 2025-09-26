/**
 * Utility functions for route discovery
 */

import { relative, extname, basename, dirname } from '@std/path';
import type { RouteType, PageFile } from '../../schemas/routing.ts';

/**
 * Converts a file path to a route path
 */
export function filePathToRoutePath(filePath: string): string {
	// Remove file extension (including markdown extensions)
	let routePath = filePath.replace(/\.(tsx?|jsx?|mdx?)$/, '');

	// Handle index files
	if (basename(routePath) === 'index') {
		routePath = dirname(routePath);
	}

	// Remove route groups (parentheses)
	routePath = routePath.replace(/\([^)]+\)\//g, '');

	// Normalize path separators and ensure leading slash
	routePath = routePath.replace(/\\/g, '/');
	if (!routePath.startsWith('/')) {
		routePath = '/' + routePath;
	}

	// Handle root index
	if (routePath === '/' || routePath === '') {
		return '/';
	}

	// Remove trailing slash except for root
	if (routePath.endsWith('/') && routePath !== '/') {
		routePath = routePath.slice(0, -1);
	}

	return routePath;
}

/**
 * Converts a file path to an API route path with /api prefix
 */
export function filePathToApiRoutePath(filePath: string): string {
	const routePath = filePathToRoutePath(filePath);
	return `/api${routePath === '/' ? '' : routePath}`;
}

/**
 * Converts dynamic segments in route path to URLPattern format
 */
export function convertDynamicSegments(routePath: string): string {
	// Convert [param] to :param
	routePath = routePath.replace(/\[([^\]]+)\]/g, (_match, param) => {
		if (param.startsWith('...')) {
			// Catch-all route: [...rest] becomes * (unnamed catch-all group for page routes)
			return '*';
		} else {
			// Dynamic route: [param] becomes :param
			return `:${param}`;
		}
	});

	return routePath;
}

/**
 * Converts dynamic segments in API route path to URLPattern format with named catch-all groups
 */
export function convertApiDynamicSegments(routePath: string): string {
	// Convert [param] to :param
	routePath = routePath.replace(/\[([^\]]+)\]/g, (_match, param) => {
		if (param.startsWith('...')) {
			// Catch-all route: [...rest] becomes :rest* (named catch-all group)
			const paramName = param.substring(3); // Remove '...' prefix
			return `:${paramName}*`;
		} else {
			// Dynamic route: [param] becomes :param
			return `:${param}`;
		}
	});

	return routePath;
}

/**
 * Determines the type of route based on the file path
 */
export function determineRouteType(filePath: string): RouteType {
	const routePath = filePathToRoutePath(filePath);

	// Check for route groups
	if (extractRouteGroup(filePath)) {
		return 'group';
	}

	// Check for index routes
	if (routePath.endsWith('/') || routePath === '' || basename(filePath, extname(filePath)) === 'index') {
		return 'index';
	}

	// Check for catch-all routes
	if (routePath.includes('[...')) {
		return 'catch-all';
	}

	// Check for dynamic routes
	if (routePath.includes('[') && routePath.includes(']')) {
		return 'dynamic';
	}

	// Default to static
	return 'static';
}

/**
 * Extracts dynamic segments from a file path
 */
export function extractDynamicSegments(filePath: string): string[] {
	const segments: string[] = [];
	const routePath = filePathToRoutePath(filePath);

	// Match dynamic segments like [param] or [...rest]
	const dynamicSegmentRegex = /\[([^\]]+)\]/g;
	let match;

	while ((match = dynamicSegmentRegex.exec(routePath)) !== null) {
		const segment = match[1];

		// Handle catch-all segments
		if (segment.startsWith('...')) {
			segments.push(segment.substring(3)); // Remove '...' prefix
		} else {
			segments.push(segment);
		}
	}

	return segments;
}

/**
 * Checks if a file is in a private folder (starts with _)
 */
export function isPrivateFile(relativePath: string): boolean {
	const pathParts = relativePath.split('/');
	return pathParts.some(part => part.startsWith('_'));
}

/**
 * Extracts route group from file path (parentheses notation)
 */
export function extractRouteGroup(relativePath: string): string | undefined {
	const match = relativePath.match(/\(([^)]+)\)/);
	return match ? match[1] : undefined;
}

/**
 * Calculates route priority based on type and specificity
 * Lower numbers = higher priority
 */
export function calculateRoutePriority(routeType: RouteType, filePath: string): number {
	let basePriority = 0;

	// Base priority by route type (lower = higher priority)
	switch (routeType) {
		case 'static':
			basePriority = 0; // Highest priority for exact matches
			break;
		case 'index':
			basePriority = 10; // High priority for index routes
			break;
		case 'group':
			basePriority = 20; // Route groups have medium-high priority
			break;
		case 'dynamic':
			basePriority = 100; // Lower priority for dynamic routes
			break;
		case 'catch-all':
			basePriority = 200; // Lowest priority for catch-all routes
			break;
	}

	// Calculate specificity based on path depth and segments
	const routePath = filePathToRoutePath(filePath);
	const segments = routePath.split('/').filter(s => s.length > 0);
	const depth = segments.length;

	// Count static vs dynamic segments for specificity
	let staticSegments = 0;
	let dynamicSegments = 0;
	let catchAllSegments = 0;

	for (const segment of segments) {
		if (segment.startsWith(':')) {
			dynamicSegments++;
		} else if (segment === '*') {
			catchAllSegments++;
		} else {
			staticSegments++;
		}
	}

	// More specific routes get lower priority numbers (higher actual priority)
	// Static segments are most specific, dynamic less so, catch-all least specific
	const specificityScore = staticSegments * 1 + dynamicSegments * 10 + catchAllSegments * 100;

	// Deeper paths are more specific (add depth penalty for less specific routes)
	const depthPenalty = Math.max(0, depth - 1); // Deeper = more specific = lower penalty

	// Ensure priority is never negative
	const calculatedPriority = basePriority + specificityScore + depthPenalty;
	return Math.max(0, calculatedPriority);
}

/**
 * Calculates API route priority based on specificity
 */
export function calculateApiRoutePriority(filePath: string): number {
	// API routes use similar logic but with different base priorities
	const routePath = filePathToApiRoutePath(filePath);
	const segments = routePath.split('/').filter(s => s.length > 0);

	// Remove 'api' from segments for calculation
	const apiSegments = segments.slice(1);
	const depth = apiSegments.length;

	// Count static vs dynamic segments
	let staticSegments = 0;
	let dynamicSegments = 0;
	let catchAllSegments = 0;

	for (const segment of apiSegments) {
		if (segment.startsWith(':')) {
			if (segment.endsWith('*')) {
				catchAllSegments++;
			} else {
				dynamicSegments++;
			}
		} else {
			staticSegments++;
		}
	}

	// Calculate priority (lower = higher priority)
	const specificityScore = staticSegments * 1 + dynamicSegments * 10 + catchAllSegments * 100;
	const depthPenalty = Math.max(0, depth - 1);

	return specificityScore + depthPenalty;
}

/**
 * Validates dynamic segment syntax in route paths
 */
export function validateDynamicSegments(filePath: string, routePath: string): string[] {
	const errors: string[] = [];

	// Check for malformed dynamic segments
	const malformedSegments = routePath.match(/\[[^\]]*$/g); // Unclosed brackets
	if (malformedSegments) {
		errors.push(
			`Malformed dynamic segments found: ${malformedSegments.join(
				', '
			)}. Dynamic segments must be properly closed with ]`
		);
	}

	// Check for empty dynamic segments
	const emptySegments = routePath.match(/\[\]/g);
	if (emptySegments) {
		errors.push(
			'Empty dynamic segments [] are not allowed. Use [param] for dynamic segments or [...rest] for catch-all'
		);
	}

	// Check for invalid catch-all syntax
	const invalidCatchAll = routePath.match(/\[\.{1,2}[^\]]*\]/g);
	if (invalidCatchAll) {
		errors.push(`Invalid catch-all syntax: ${invalidCatchAll.join(', ')}. Use [...param] for catch-all routes`);
	}

	// Check for nested dynamic segments (not supported)
	const nestedSegments = routePath.match(/\[[^\]]*\[[^\]]*\]/g);
	if (nestedSegments) {
		errors.push(`Nested dynamic segments are not supported: ${nestedSegments.join(', ')}`);
	}

	return errors;
}
