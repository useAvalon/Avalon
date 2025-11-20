/**
 * Error Handler - Comprehensive error handling and debugging for file-system routing
 */

import { basename, dirname, relative } from '@std/path';
import type { FileSystemRoute, FileSystemApiRoute } from '../../schemas/routing.ts';
import type {
	RoutingError,
	ErrorSeverity,
	RouteDebugInfo,
} from './error-handler.types.ts';
import { RoutingErrorCode as ErrorCodes, ErrorSeverity as Severity } from './error-handler.types.ts';

export { RoutingErrorCode, ErrorSeverity, type RoutingError, type RouteDebugInfo } from './error-handler.types.ts';

/**
 * Options for error handling and debugging
 */
export interface ErrorHandlerOptions {
	/** Enable development mode features */
	developmentMode?: boolean;
	/** Enable debug logging */
	enableDebugLogging?: boolean;
	/** Enable detailed error messages */
	enableDetailedErrors?: boolean;
	/** Enable suggestions for fixing errors */
	enableSuggestions?: boolean;
	/** Custom logger function */
	logger?: (level: string, message: string, ...args: unknown[]) => void;
}

/**
 * Comprehensive error handler for file-system routing
 */
export class RoutingErrorHandler {
	private options: Required<ErrorHandlerOptions>;
	private errors: RoutingError[] = [];
	private warnings: RoutingError[] = [];

	constructor(options: ErrorHandlerOptions = {}) {
		this.options = {
			developmentMode: options.developmentMode ?? false,
			enableDebugLogging: options.enableDebugLogging ?? false,
			enableDetailedErrors: options.enableDetailedErrors ?? true,
			enableSuggestions: options.enableSuggestions ?? true,
			logger: options.logger ?? this.defaultLogger,
		};
	}

	/**
	 * Create a detailed error for route conflicts
	 */
	createRouteConflictError(conflictingRoutes: FileSystemRoute[], pattern: string): RoutingError {
		const primaryRoute = conflictingRoutes[0];
		const conflictingFiles = conflictingRoutes.map(r => r.filePath);

		const message = `Route conflict detected for pattern "${pattern}"`;
		const details = this.options.enableDetailedErrors
			? `Multiple files are trying to handle the same route pattern. This can cause unpredictable behavior.

Conflicting files:
${conflictingRoutes
	.map((route, index) => `  ${index + 1}. ${route.filePath} (priority: ${route.priority}, type: ${route.routeType})`)
	.join('\n')}

Winner: ${primaryRoute.filePath} (will be used)
Ignored: ${conflictingRoutes
					.slice(1)
					.map(r => r.filePath)
					.join(', ')}`
			: undefined;

		const suggestions = this.options.enableSuggestions
			? this.generateRouteConflictSuggestions(conflictingRoutes, pattern)
			: undefined;

		return {
			code: ErrorCodes.ROUTE_CONFLICT,
			severity: Severity.ERROR,
			message,
			details,
			filePath: primaryRoute.filePath,
			suggestions,
			relatedFiles: conflictingFiles,
			context: {
				pattern,
				conflictingRoutes: conflictingRoutes.map(r => ({
					filePath: r.filePath,
					priority: r.priority,
					routeType: r.routeType,
				})),
			},
		};
	}

	/**
	 * Create a detailed error for API route conflicts
	 */
	createApiRouteConflictError(
		conflictingRoutes: FileSystemApiRoute[],
		pattern: string,
		conflictingMethods: string[]
	): RoutingError {
		const message = `API route conflict detected for pattern "${pattern}" with methods [${conflictingMethods.join(
			', '
		)}]`;
		const details = this.options.enableDetailedErrors
			? `Multiple API files are trying to handle the same route pattern with overlapping HTTP methods.

Conflicting files and methods:
${conflictingRoutes
	.map(
		(route, index) =>
			`  ${index + 1}. ${route.filePath} (methods: [${route.methods.join(', ')}], priority: ${route.priority})`
	)
	.join('\n')}

Overlapping methods: [${conflictingMethods.join(', ')}]`
			: undefined;

		const suggestions = this.options.enableSuggestions
			? this.generateApiRouteConflictSuggestions(conflictingRoutes, conflictingMethods)
			: undefined;

		return {
			code: ErrorCodes.API_ROUTE_CONFLICT,
			severity: Severity.ERROR,
			message,
			details,
			filePath: conflictingRoutes[0].filePath,
			suggestions,
			relatedFiles: conflictingRoutes.map(r => r.filePath),
			context: {
				pattern,
				conflictingMethods,
				conflictingRoutes: conflictingRoutes.map(r => ({
					filePath: r.filePath,
					methods: r.methods,
					priority: r.priority,
				})),
			},
		};
	}

	/**
	 * Create an error for invalid file structures
	 */
	createInvalidFileStructureError(filePath: string, reason: string, originalError?: Error): RoutingError {
		const fileName = basename(filePath);
		const message = `Invalid file structure: ${fileName}`;
		const details = this.options.enableDetailedErrors
			? `The file "${filePath}" has an invalid structure for file-system routing.

Reason: ${reason}

${originalError ? `Original error: ${originalError.message}` : ''}`
			: undefined;

		const suggestions = this.options.enableSuggestions
			? this.generateFileStructureSuggestions(filePath, reason)
			: undefined;

		return {
			code: ErrorCodes.INVALID_FILE_STRUCTURE,
			severity: Severity.ERROR,
			message,
			details,
			filePath,
			suggestions,
			originalError,
			context: { reason },
		};
	}

	/**
	 * Create an error for missing route parameters
	 */
	createMissingRouteParamError(routePath: string, paramName: string, availableParams: string[]): RoutingError {
		const message = `Missing required route parameter: ${paramName}`;
		const details = this.options.enableDetailedErrors
			? `The route "${routePath}" requires parameter "${paramName}" but it was not provided.

Available parameters: [${availableParams.join(', ')}]

This usually happens when:
1. The route pattern doesn't match the requested URL
2. The parameter name in the file doesn't match the expected parameter
3. The URL doesn't contain the required dynamic segment`
			: undefined;

		const suggestions = this.options.enableSuggestions
			? this.generateMissingParamSuggestions(routePath, paramName, availableParams)
			: undefined;

		return {
			code: ErrorCodes.MISSING_ROUTE_PARAM,
			severity: Severity.ERROR,
			message,
			details,
			suggestions,
			context: {
				routePath,
				paramName,
				availableParams,
			},
		};
	}

	/**
	 * Create an error for syntax errors in layout/middleware files
	 */
	createSyntaxError(
		filePath: string,
		fileType: 'layout' | 'middleware' | 'metadata' | 'page',
		originalError: Error
	): RoutingError {
		const fileName = basename(filePath);
		const message = `Syntax error in ${fileType} file: ${fileName}`;
		const details = this.options.enableDetailedErrors
			? `The ${fileType} file "${filePath}" contains syntax errors and cannot be loaded.

Error details: ${originalError.message}

${originalError.stack ? `Stack trace:\n${originalError.stack}` : ''}`
			: undefined;

		const suggestions = this.options.enableSuggestions
			? this.generateSyntaxErrorSuggestions(filePath, fileType, originalError)
			: undefined;

		return {
			code: ErrorCodes.SYNTAX_ERROR,
			severity: Severity.ERROR,
			message,
			details,
			filePath,
			suggestions,
			originalError,
			context: { fileType },
		};
	}

	/**
	 * Create a warning for development mode
	 */
	createDevelopmentWarning(message: string, filePath?: string, suggestions?: string[]): RoutingError {
		return {
			code: ErrorCodes.UNKNOWN_ERROR,
			severity: Severity.WARNING,
			message,
			filePath,
			suggestions,
		};
	}

	/**
	 * Log route discovery debug information
	 */
	logRouteDiscoveryDebug(debugInfo: RouteDebugInfo): void {
		if (!this.options.enableDebugLogging) return;

		this.options.logger('debug', '🔍 Route Discovery Debug Information');
		this.options.logger('debug', `  Total routes discovered: ${debugInfo.totalRoutes}`);
		this.options.logger('debug', `  Discovery time: ${debugInfo.discoveryTime}ms`);
		this.options.logger('debug', `  File scan time: ${debugInfo.filesScanTime}ms`);
		this.options.logger('debug', `  Validation time: ${debugInfo.validationTime}ms`);

		this.options.logger('debug', '  Routes by type:');
		for (const [type, count] of Object.entries(debugInfo.routesByType)) {
			this.options.logger('debug', `    ${type}: ${count}`);
		}

		if (debugInfo.conflicts.length > 0) {
			this.options.logger('debug', `  Conflicts found: ${debugInfo.conflicts.length}`);
		}

		if (debugInfo.warnings.length > 0) {
			this.options.logger('debug', `  Warnings: ${debugInfo.warnings.length}`);
		}
	}

	/**
	 * Log detailed route information
	 */
	logRouteDetails(routes: FileSystemRoute[]): void {
		if (!this.options.enableDebugLogging) return;

		this.options.logger('debug', '📋 Discovered Routes:');

		// Group routes by type for better organization
		const routesByType = new Map<string, FileSystemRoute[]>();
		for (const route of routes) {
			if (!routesByType.has(route.routeType)) {
				routesByType.set(route.routeType, []);
			}
			routesByType.get(route.routeType)!.push(route);
		}

		for (const [type, typeRoutes] of routesByType) {
			this.options.logger('debug', `  ${type.toUpperCase()} routes (${typeRoutes.length}):`);

			// Sort by priority for better readability
			const sortedRoutes = typeRoutes.sort((a, b) => a.priority - b.priority);

			for (const route of sortedRoutes) {
				const pattern = route.pattern.pathname;
				const relativePath = relative(Deno.cwd(), route.filePath);
				const dynamicInfo = route.dynamicSegments.length > 0 ? ` [params: ${route.dynamicSegments.join(', ')}]` : '';

				this.options.logger('debug', `    ${pattern} → ${relativePath} (priority: ${route.priority})${dynamicInfo}`);
			}
		}
	}

	/**
	 * Log API route details
	 */
	logApiRouteDetails(apiRoutes: FileSystemApiRoute[]): void {
		if (!this.options.enableDebugLogging) return;

		this.options.logger('debug', '🔌 Discovered API Routes:');

		// Sort by priority for better readability
		const sortedRoutes = apiRoutes.sort((a, b) => a.priority - b.priority);

		for (const route of sortedRoutes) {
			const pattern = route.pattern.pathname;
			const relativePath = relative(Deno.cwd(), route.filePath);
			const methods = route.methods.join(', ');
			const dynamicInfo = route.dynamicSegments.length > 0 ? ` [params: ${route.dynamicSegments.join(', ')}]` : '';

			this.options.logger(
				'debug',
				`  [${methods}] ${pattern} → ${relativePath} (priority: ${route.priority})${dynamicInfo}`
			);
		}
	}

	/**
	 * Handle and log an error
	 */
	handleError(error: RoutingError): void {
		// Add to appropriate collection
		if (error.severity === Severity.ERROR) {
			this.errors.push(error);
		} else if (error.severity === Severity.WARNING) {
			this.warnings.push(error);
		}

		// Log the error
		this.logError(error);

		// In development mode, throw errors immediately
		if (this.options.developmentMode && error.severity === Severity.ERROR) {
			const errorMessage = this.formatErrorForThrow(error);
			const thrownError = new Error(errorMessage);
			thrownError.name = `RoutingError[${error.code}]`;
			throw thrownError;
		}
	}

	/**
	 * Log an error with appropriate formatting
	 */
	private logError(error: RoutingError): void {
		const level = error.severity === Severity.ERROR ? 'error' : error.severity === Severity.WARNING ? 'warn' : 'info';

		// Log the main message
		this.options.logger(level, `${this.getErrorIcon(error.severity)} ${error.message}`);

		// Log details if available and enabled
		if (error.details && this.options.enableDetailedErrors) {
			this.options.logger(level, error.details);
		}

		// Log file path if available
		if (error.filePath) {
			const relativePath = relative(Deno.cwd(), error.filePath);
			this.options.logger(level, `  File: ${relativePath}`);
		}

		// Log related files if available
		if (error.relatedFiles && error.relatedFiles.length > 0) {
			this.options.logger(level, `  Related files: ${error.relatedFiles.map(f => relative(Deno.cwd(), f)).join(', ')}`);
		}

		// Log suggestions if available and enabled
		if (error.suggestions && this.options.enableSuggestions && error.suggestions.length > 0) {
			this.options.logger(level, '  Suggestions:');
			for (const suggestion of error.suggestions) {
				this.options.logger(level, `    • ${suggestion}`);
			}
		}

		// Log original error in development mode
		if (error.originalError && this.options.developmentMode) {
			this.options.logger('debug', `  Original error: ${error.originalError.message}`);
			if (error.originalError.stack) {
				this.options.logger('debug', `  Stack: ${error.originalError.stack}`);
			}
		}
	}

	/**
	 * Get all collected errors
	 */
	getErrors(): RoutingError[] {
		return [...this.errors];
	}

	/**
	 * Get all collected warnings
	 */
	getWarnings(): RoutingError[] {
		return [...this.warnings];
	}

	/**
	 * Check if there are any errors
	 */
	hasErrors(): boolean {
		return this.errors.length > 0;
	}

	/**
	 * Check if there are any warnings
	 */
	hasWarnings(): boolean {
		return this.warnings.length > 0;
	}

	/**
	 * Clear all collected errors and warnings
	 */
	clear(): void {
		this.errors = [];
		this.warnings = [];
	}

	/**
	 * Create a summary of all errors and warnings
	 */
	createSummary(): string {
		const errorCount = this.errors.length;
		const warningCount = this.warnings.length;

		if (errorCount === 0 && warningCount === 0) {
			return '✅ No routing errors or warnings found.';
		}

		let summary = `📊 Routing Summary: ${errorCount} error(s), ${warningCount} warning(s)\n`;

		if (errorCount > 0) {
			summary += '\n❌ Errors:\n';
			for (const error of this.errors) {
				const filePath = error.filePath ? ` (${relative(Deno.cwd(), error.filePath)})` : '';
				summary += `  • ${error.message}${filePath}\n`;
			}
		}

		if (warningCount > 0) {
			summary += '\n⚠️  Warnings:\n';
			for (const warning of this.warnings) {
				const filePath = warning.filePath ? ` (${relative(Deno.cwd(), warning.filePath)})` : '';
				summary += `  • ${warning.message}${filePath}\n`;
			}
		}

		return summary;
	}

	// Private helper methods

	private defaultLogger(level: string, message: string, ...args: unknown[]): void {
		const logFn =
			level === 'error'
				? console.error
				: level === 'warn'
				? console.warn
				: level === 'debug'
				? console.debug
				: console.log;

		logFn(message, ...args);
	}

	private getErrorIcon(severity: ErrorSeverity): string {
		switch (severity) {
			case Severity.ERROR:
				return '❌';
			case Severity.WARNING:
				return '⚠️';
			case Severity.INFO:
				return 'ℹ️';
			case Severity.DEBUG:
				return '🔍';
			default:
				return '•';
		}
	}

	private formatErrorForThrow(error: RoutingError): string {
		let message = error.message;

		if (error.filePath) {
			message += ` (${relative(Deno.cwd(), error.filePath)})`;
		}

		if (error.details && this.options.enableDetailedErrors) {
			message += `\n\n${error.details}`;
		}

		if (error.suggestions && this.options.enableSuggestions && error.suggestions.length > 0) {
			message += '\n\nSuggestions:\n' + error.suggestions.map(s => `• ${s}`).join('\n');
		}

		return message;
	}

	private generateRouteConflictSuggestions(conflictingRoutes: FileSystemRoute[], _pattern: string): string[] {
		const suggestions: string[] = [];

		// Check if routes are in different directories
		const directories = new Set(conflictingRoutes.map(r => dirname(r.filePath)));
		if (directories.size > 1) {
			suggestions.push('Consider using route groups (parentheses) to organize related routes without affecting URLs');
			suggestions.push('Move conflicting routes to different directory structures');
		}

		// Check for index file conflicts
		const hasIndexFiles = conflictingRoutes.some(r => basename(r.filePath).startsWith('index.'));
		if (hasIndexFiles) {
			suggestions.push('Remove duplicate index files - only one index file should exist per directory');
		}

		// Check for dynamic route conflicts
		const hasDynamicRoutes = conflictingRoutes.some(r => r.routeType === 'dynamic');
		if (hasDynamicRoutes) {
			suggestions.push('Rename dynamic route parameters to be more specific');
			suggestions.push('Consider using catch-all routes ([...param]) for more flexible matching');
		}

		// General suggestions
		suggestions.push('Rename one of the conflicting files to create a unique route pattern');
		suggestions.push('Use private folders (underscore prefix) for components that should not be routes');

		return suggestions;
	}

	private generateApiRouteConflictSuggestions(
		_conflictingRoutes: FileSystemApiRoute[],
		conflictingMethods: string[]
	): string[] {
		const suggestions: string[] = [];

		suggestions.push('Combine the conflicting API routes into a single file with multiple HTTP method exports');
		suggestions.push(`Move the conflicting methods [${conflictingMethods.join(', ')}] to different route patterns`);
		suggestions.push('Use different file names to create unique API endpoints');
		suggestions.push('Consider using a single handler file with method-based routing logic');

		return suggestions;
	}

	private generateFileStructureSuggestions(filePath: string, reason: string): string[] {
		const suggestions: string[] = [];
		const fileName = basename(filePath);

		if (reason.includes('extension')) {
			suggestions.push('Use supported file extensions: .tsx, .ts, .jsx, .js');
			suggestions.push('Ensure the file has a proper extension for TypeScript/JavaScript');
		}

		if (reason.includes('export')) {
			suggestions.push('Add a default export that returns a React/Preact component');
			suggestions.push('Ensure the component is properly exported as the default export');
		}

		if (
			fileName.startsWith('_') &&
			!['_layout', '_middleware', '_metadata', '_404', '_error'].some(special => fileName.startsWith(special))
		) {
			suggestions.push(
				'Private files (starting with _) should use recognized patterns: _layout, _middleware, _metadata, _404, _error'
			);
			suggestions.push('Move utility files to a _components or _utils directory');
		}

		suggestions.push('Check the file syntax and ensure it can be imported without errors');

		return suggestions;
	}

	private generateMissingParamSuggestions(_routePath: string, paramName: string, availableParams: string[]): string[] {
		const suggestions: string[] = [];

		suggestions.push(`Ensure the URL contains the required parameter: ${paramName}`);
		suggestions.push(`Check that the route file name includes [${paramName}] for dynamic segments`);

		if (availableParams.length > 0) {
			suggestions.push(`Available parameters are: [${availableParams.join(', ')}] - check for typos`);
		}

		suggestions.push('Verify that the route pattern matches the requested URL structure');
		suggestions.push('Consider making the parameter optional using [[param]] syntax if appropriate');

		return suggestions;
	}

	private generateSyntaxErrorSuggestions(_filePath: string, fileType: string, originalError: Error): string[] {
		const suggestions: string[] = [];
		const errorMessage = originalError.message.toLowerCase();

		if (errorMessage.includes('unexpected token')) {
			suggestions.push('Check for missing semicolons, brackets, or parentheses');
			suggestions.push('Ensure proper JSX syntax if using React/Preact components');
		}

		if (errorMessage.includes('import') || errorMessage.includes('export')) {
			suggestions.push('Check import/export statements for correct syntax');
			suggestions.push('Ensure all imported modules exist and are properly exported');
		}

		if (errorMessage.includes('typescript') || errorMessage.includes('type')) {
			suggestions.push('Check TypeScript type annotations and interfaces');
			suggestions.push('Ensure all types are properly imported or defined');
		}

		if (fileType === 'layout') {
			suggestions.push('Layout files should export a default component that accepts children');
			suggestions.push('Check that the layout component properly renders its children prop');
		}

		if (fileType === 'middleware') {
			suggestions.push('Middleware files should export functions that match the middleware signature');
			suggestions.push('Ensure middleware functions return appropriate responses or call next()');
		}

		suggestions.push('Use a code editor with syntax highlighting to identify syntax issues');
		suggestions.push('Check the browser console or terminal for more detailed error information');

		return suggestions;
	}
}

/**
 * Default error handler instance
 */
export const defaultRoutingErrorHandler = new RoutingErrorHandler();

/**
 * Create a new error handler with custom options
 */
export function createRoutingErrorHandler(options: ErrorHandlerOptions = {}): RoutingErrorHandler {
	return new RoutingErrorHandler(options);
}
