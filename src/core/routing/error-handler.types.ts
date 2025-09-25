/**
 * Type definitions for the error handler module
 */

import type { FileSystemRoute, FileSystemApiRoute, RouteParams } from '../../schemas/routing.ts';

/**
 * Error codes for different types of routing errors
 */
export const RoutingErrorCode = {
	// Route discovery errors
	ROUTE_CONFLICT: 'ROUTE_CONFLICT',
	INVALID_ROUTE_PATTERN: 'INVALID_ROUTE_PATTERN',
	INVALID_FILE_STRUCTURE: 'INVALID_FILE_STRUCTURE',
	MISSING_DIRECTORY: 'MISSING_DIRECTORY',

	// Page loading errors
	PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
	INVALID_PAGE_MODULE: 'INVALID_PAGE_MODULE',
	MISSING_DEFAULT_EXPORT: 'MISSING_DEFAULT_EXPORT',
	INVALID_LAYOUT_CONFIG: 'INVALID_LAYOUT_CONFIG',
	SYNTAX_ERROR: 'SYNTAX_ERROR',

	// Runtime errors
	MISSING_ROUTE_PARAM: 'MISSING_ROUTE_PARAM',
	INVALID_ROUTE_PARAM: 'INVALID_ROUTE_PARAM',
	METADATA_GENERATION_FAILED: 'METADATA_GENERATION_FAILED',
	MIDDLEWARE_ERROR: 'MIDDLEWARE_ERROR',

	// API route errors
	API_ROUTE_CONFLICT: 'API_ROUTE_CONFLICT',
	INVALID_API_MODULE: 'INVALID_API_MODULE',
	UNSUPPORTED_HTTP_METHOD: 'UNSUPPORTED_HTTP_METHOD',

	// General errors
	UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type RoutingErrorCode = (typeof RoutingErrorCode)[keyof typeof RoutingErrorCode];

/**
 * Severity levels for routing errors and warnings
 */
export const ErrorSeverity = {
	ERROR: 'error',
	WARNING: 'warning',
	INFO: 'info',
	DEBUG: 'debug',
} as const;

export type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

/**
 * Structured routing error with context and suggestions
 */
export interface RoutingError {
	code: RoutingErrorCode;
	message: string;
	severity: ErrorSeverity;
	details?: string;
	filePath?: string;
	suggestions?: string[];
	relatedFiles?: string[];
	context?: Record<string, unknown>;
	originalError?: Error;
	timestamp?: number;
}

/**
 * Debug information for route discovery
 */
export interface RouteDebugInfo {
	totalRoutes: number;
	routesByType: Record<string, number>;
	conflicts: RoutingError[];
	warnings: RoutingError[];
	discoveryTime: number;
	filesScanTime: number;
	validationTime: number;
}

/**
 * Configuration for the routing error handler
 */
export interface ErrorHandlerConfig {
	developmentMode: boolean;
	enableDebugLogging: boolean;
	enableDetailedErrors: boolean;
	enableSuggestions: boolean;
	maxErrorHistory: number;
}

/**
 * Error context for route conflicts
 */
export interface RouteConflictContext {
	conflictingRoutes: FileSystemRoute[];
	pattern: string;
	resolutionStrategy?: 'priority' | 'manual' | 'error';
}

/**
 * Error context for API route conflicts
 */
export interface ApiRouteConflictContext {
	conflictingRoutes: FileSystemApiRoute[];
	pattern: string;
	methods: string[];
}

/**
 * Error context for missing route parameters
 */
export interface MissingRouteParamContext {
	routePath: string;
	expectedParam: string;
	availableParams: string[];
}

/**
 * Error context for file structure issues
 */
export interface FileStructureContext {
	filePath: string;
	expectedStructure?: string;
	actualStructure?: string;
}
