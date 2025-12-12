/**
 * Route Builder - Creates route objects from discovered files
 */

import { resolve } from '@std/path';
import type {
	FileSystemRoute,
	FileSystemApiRoute,
	PageFile,
	RouteDiscoveryOptions,
	FileSystemApiModule,
} from '../../../schemas/routing.ts';
import { FileSystemRouteSchema, FileSystemApiRouteSchema } from '../../../schemas/routing.ts';
import { RoutingErrorHandler } from '../error-handler.ts';
import { PatternBuilder } from './pattern-builder.ts';
import {
	determineRouteType,
	extractDynamicSegments,
	calculateRoutePriority,
	calculateApiRoutePriority,
} from '../route-discovery.utils.ts';

/**
 * Builds route objects from discovered files
 */
export class RouteBuilder {
	private patternBuilder: PatternBuilder;

	constructor(private options: RouteDiscoveryOptions, private errorHandler: RoutingErrorHandler) {
		this.patternBuilder = new PatternBuilder(errorHandler);
	}

	/**
	 * Converts discovered page files to FileSystemRoute objects
	 */
	createRoutes(pageFiles: PageFile[]): FileSystemRoute[] {
		const startTime = performance.now();
		const routes: FileSystemRoute[] = [];
		const errors: string[] = [];
		const routesByType: Record<string, number> = {};

		if (this.options.developmentMode && !this.options.quietMode) {
			console.log(`🔧 Creating routes from ${pageFiles.length} files...`);
		}

		for (const pageFile of pageFiles) {
			// Skip private files for routing
			if (pageFile.isPrivate) {
				if (this.options.developmentMode) {
					console.log(`  Skipping private file: ${pageFile.relativePath}`);
				}
				continue;
			}

			try {
				const pattern = this.patternBuilder.createRoutePattern(pageFile.relativePath);
				const routeType = determineRouteType(pageFile.relativePath);
				const dynamicSegments = extractDynamicSegments(pageFile.relativePath);
				const priority = calculateRoutePriority(routeType, pageFile.relativePath);

				// Track route types for debug info
				routesByType[routeType] = (routesByType[routeType] || 0) + 1;

				const route: FileSystemRoute = {
					pattern,
					filePath: pageFile.filePath,
					routeType,
					dynamicSegments,
					priority,
					isPrivate: pageFile.isPrivate,
					routeGroup: pageFile.routeGroup,
				};

				// Validate the route
				const validationResult = FileSystemRouteSchema.safeParse(route);
				if (validationResult.success) {
					routes.push(route);
					if (this.options.developmentMode && !this.options.quietMode) {
						const dynamicInfo = dynamicSegments.length > 0 ? ` [${dynamicSegments.join(', ')}]` : '';
						console.log(`  ✓ Created ${routeType} route: ${pattern.pathname} → ${pageFile.relativePath}${dynamicInfo}`);
					}
				} else {
					const error = this.errorHandler.createInvalidFileStructureError(
						pageFile.filePath,
						`Route validation failed: ${validationResult.error.message}`
					);
					this.errorHandler.handleError(error);
					errors.push(error.message);
				}
			} catch (error) {
				const routingError = this.errorHandler.createSyntaxError(
					pageFile.filePath,
					'page',
					error instanceof Error ? error : new Error(String(error))
				);
				this.errorHandler.handleError(routingError);
				errors.push(routingError.message);
			}
		}

		const createTime = performance.now() - startTime;

		if (this.options.developmentMode) {
			console.log(`🔧 Created ${routes.length} routes in ${createTime.toFixed(2)}ms`);
			if (errors.length > 0) {
				console.warn(`⚠️  ${errors.length} route creation errors occurred`);
			}
		}

		return routes;
	}

	/**
	 * Converts discovered API files to FileSystemApiRoute objects
	 */
	async createApiRoutes(apiFiles: PageFile[]): Promise<FileSystemApiRoute[]> {
		const startTime = performance.now();
		const routes: FileSystemApiRoute[] = [];
		const errors: string[] = [];

		if (this.options.developmentMode && !this.options.quietMode) {
			console.log(`🔧 Creating API routes from ${apiFiles.length} files...`);
		}

		for (const apiFile of apiFiles) {
			// Skip private files for routing (except middleware files)
			if (apiFile.isPrivate && !apiFile.relativePath.includes('_middleware')) {
				if (this.options.developmentMode) {
					console.log(`  Skipping private file: ${apiFile.relativePath}`);
				}
				continue;
			}

			// Skip middleware files - they're handled separately
			if (apiFile.relativePath.includes('_middleware')) {
				if (this.options.developmentMode && !this.options.quietMode) {
					console.log(`  Skipping middleware file: ${apiFile.relativePath}`);
				}
				continue;
			}

			try {
				const pattern = this.patternBuilder.createApiRoutePattern(apiFile.relativePath);
				const dynamicSegments = extractDynamicSegments(apiFile.relativePath);
				const priority = calculateApiRoutePriority(apiFile.relativePath);

				// Determine supported HTTP methods by loading the module
				const methods = await this.extractApiMethods(apiFile.filePath);

				const route: FileSystemApiRoute = {
					pattern,
					filePath: apiFile.filePath,
					methods,
					priority,
					dynamicSegments,
				};

				// Validate the route
				const validationResult = FileSystemApiRouteSchema.safeParse(route);
				if (validationResult.success) {
					routes.push(route);
					if (this.options.developmentMode && !this.options.quietMode) {
						console.log(`  ✓ Created API route: [${methods.join(',')}] ${pattern.pathname} → ${apiFile.relativePath}`);
					}
				} else {
					const error = this.errorHandler.createInvalidFileStructureError(
						apiFile.filePath,
						`API route validation failed: ${validationResult.error.message}`
					);
					this.errorHandler.handleError(error);
					errors.push(error.message);
				}
			} catch (error) {
				const routingError = this.errorHandler.createSyntaxError(
					apiFile.filePath,
					'page',
					error instanceof Error ? error : new Error(String(error))
				);
				this.errorHandler.handleError(routingError);
				errors.push(routingError.message);
			}
		}

		const createTime = performance.now() - startTime;

		if (this.options.developmentMode && !this.options.quietMode) {
			console.log(`🔧 Created ${routes.length} API routes in ${createTime.toFixed(2)}ms`);
			if (errors.length > 0) {
				console.warn(`⚠️  ${errors.length} API route creation errors occurred`);
			}
		}

		return routes;
	}

	/**
	 * Extracts supported HTTP methods from an API module
	 */
	private async extractApiMethods(filePath: string): Promise<('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS')[]> {
		try {
			const absolutePath = resolve(filePath);
			const fileUrl = `file://${absolutePath}`;
			const apiModule = (await import(fileUrl)) as FileSystemApiModule;

			const supportedMethods: ('GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS')[] = [];
			const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

			for (const method of httpMethods) {
				if (typeof apiModule[method as keyof FileSystemApiModule] === 'function') {
					supportedMethods.push(method);
				}
			}

			return supportedMethods.length > 0 ? supportedMethods : ['GET']; // Default to GET if no methods found
		} catch (error) {
			if (this.options.developmentMode) {
				console.warn(`Failed to extract API methods from ${filePath}:`, error);
			}
			return ['GET']; // Default fallback
		}
	}
}
