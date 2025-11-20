/**
 * Type definitions for the RouteDiscovery module
 */

import type { PageFile } from '../../schemas/routing.ts';

/**
 * File system watcher event types
 */
export type FileWatchEvent = 'create' | 'modify' | 'remove';

/**
 * File system change event
 */
export interface FileChangeEvent {
	type: FileWatchEvent;
	path: string;
	isDirectory: boolean;
}

/**
 * File watcher callback function
 */
export type FileWatcherCallback = (event: FileChangeEvent) => void | Promise<void>;

/**
 * Scan cache entry for performance optimization
 */
export interface ScanCacheEntry {
	files: PageFile[];
	timestamp: number;
}

/**
 * Statistics for scan cache
 */
export interface ScanCacheStats {
	totalEntries: number;
	totalFiles: number;
	oldestEntry: number;
	newestEntry: number;
}

/**
 * Options for optimized file walking
 */
export interface OptimizedWalkOptions {
	includeDirs?: boolean;
	followSymlinks?: boolean;
	exts?: string[];
	maxDepth?: number;
	batchSize?: number;
}

/**
 * Route validation result
 */
export interface RouteValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * API method extraction result
 */
export interface ApiMethodsResult {
	methods: string[];
	hasValidExports: boolean;
	errors: string[];
}
