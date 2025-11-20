/**
 * Type definitions for the FileSystemRouter module
 */

import type { EnhancedLayoutResolver } from '../layout/enhanced-layout-resolver.ts';
import type { MiddlewareContext } from '../../schemas/middleware.ts';
import type { LayoutContext } from '../../types/layout.ts';
import type { IslandManifest } from '../../build/island-manifest.ts';
import type { RenderOptions } from '../../schemas/core.ts';
import type { RouteHandler } from '../../schemas/routing.ts';

/**
 * Error thrown when file-system routing operations fail
 */
export class FileSystemRouterError extends Error {
	public readonly code: string;
	public readonly originalError?: Error;

	constructor(message: string, code: string, originalError?: Error) {
		super(message);
		this.name = 'FileSystemRouterError';
		this.code = code;
		this.originalError = originalError;
	}
}

/**
 * Cache entry for route handlers
 */
export interface RouteHandlerCacheEntry {
	handler: RouteHandler;
	timestamp: number;
	filePath: string;
	mtime?: number;
}

/**
 * Options for building route handlers
 */
export interface RouteHandlerOptions {
	layoutResolver?: EnhancedLayoutResolver;
	renderOptions?: Partial<RenderOptions>;
	islandManifest?: IslandManifest | null;
	isDev?: boolean;
}

/**
 * Context for route handler execution
 */
export interface RouteHandlerContext {
	request: Request;
	middlewareContext?: MiddlewareContext;
	layoutContext?: LayoutContext;
	error?: Error;
}

/**
 * Special file types supported by the router
 */
export type SpecialFileType = 'error' | '404';

/**
 * Cache statistics interface
 */
export interface CacheStats {
	totalEntries: number;
	totalMemoryUsage: number;
	hitRate: number;
	missRate: number;
	evictionCount: number;
	oldestEntry: number;
	newestEntry: number;
	averageAccessCount: number;
}

/**
 * Comprehensive cache statistics
 */
export interface ComprehensiveCacheStats {
	routes: CacheStats;
	metadata: CacheStats;
	handlers: CacheStats;
	performance: {
		totalOperations: number;
		totalTime: number;
		averageOperationTime: number;
		slowestOperation: string;
		fastestOperation: string;
	};
}
