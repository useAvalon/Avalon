/**
 * Pattern Builder - Creates URLPattern objects from file paths
 */

import { RoutingErrorHandler } from '../error-handler.ts';
import {
	filePathToRoutePath,
	filePathToApiRoutePath,
	convertDynamicSegments,
	convertApiDynamicSegments,
	validateDynamicSegments,
} from '../route-discovery.utils.ts';

/**
 * Builds URLPattern objects for routes
 */
export class PatternBuilder {
	constructor(private errorHandler: RoutingErrorHandler) {}

	/**
	 * Creates a URLPattern from a file path
	 */
	createRoutePattern(filePath: string): URLPattern {
		try {
			// Convert file path to route pattern
			let routePath = filePathToRoutePath(filePath);

			// Validate route path structure
			if (!routePath.startsWith('/')) {
				const error = this.errorHandler.createInvalidFileStructureError(
					filePath,
					'Route path must start with forward slash'
				);
				this.errorHandler.handleError(error);
				routePath = '/' + routePath;
			}

			// Handle dynamic segments
			routePath = convertDynamicSegments(routePath);

			// Validate dynamic segment syntax
			const validationErrors = validateDynamicSegments(filePath, routePath);
			if (validationErrors.length > 0) {
				for (const errorMsg of validationErrors) {
					const error = this.errorHandler.createInvalidFileStructureError(filePath, errorMsg);
					this.errorHandler.handleError(error);
				}
			}

			// Create URLPattern
			return new URLPattern({ pathname: routePath });
		} catch (error) {
			if (error instanceof Error && error.message.includes('Invalid route')) {
				throw error; // Re-throw our own errors
			}

			const routingError = this.errorHandler.createInvalidFileStructureError(
				filePath,
				`Failed to create URLPattern: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
			this.errorHandler.handleError(routingError);
			throw new Error(`Failed to create URLPattern for ${filePath}`);
		}
	}

	/**
	 * Creates a URLPattern from an API file path with /api prefix
	 */
	createApiRoutePattern(filePath: string): URLPattern {
		try {
			// Convert file path to route pattern with /api prefix
			let routePath = filePathToApiRoutePath(filePath);

			// Validate route path structure
			if (!routePath.startsWith('/api')) {
				const error = this.errorHandler.createInvalidFileStructureError(
					filePath,
					'API route path must start with /api prefix'
				);
				this.errorHandler.handleError(error);
				throw new Error(`Invalid API route path: ${routePath}`);
			}

			// Handle dynamic segments for API routes (with named catch-all groups)
			routePath = convertApiDynamicSegments(routePath);

			// Create URLPattern
			return new URLPattern({ pathname: routePath });
		} catch (error) {
			if (error instanceof Error && error.message.includes('Invalid API route path')) {
				throw error; // Re-throw our own errors
			}

			const routingError = this.errorHandler.createInvalidFileStructureError(
				filePath,
				`Failed to create URLPattern for API route: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
			this.errorHandler.handleError(routingError);
			throw new Error(`Failed to create URLPattern for API route ${filePath}`);
		}
	}
}
