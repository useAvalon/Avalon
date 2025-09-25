/**
 * Type definitions for the cache manager module
 */

import type {
	FileSystemRoute,
	FileSystemApiRoute,
	ResolvedMetadata,
	RouteParams,
	PageFile,
} from '../../schemas/routing.ts';

/**
 * Cache entry with metadata for intelligent invalidation
 */
export interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
	dependencies: string[]; // File paths this entry depends on
	accessCount: number;
	lastAccessed: number;
	size: number; // Estimated memory size in bytes
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
	totalEntries: number;
	totalMemoryUsage: number; // Estimated bytes
	hitRate: number;
	missRate: number;
	evictionCount: number;
	oldestEntry: number;
	newestEntry: number;
	averageAccessCount: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
	maxMemoryUsage: number; // Maximum memory usage in bytes
	defaultTTL: number; // Default TTL in milliseconds
	maxEntries: number; // Maximum number of entries
	enableLRU: boolean; // Enable LRU eviction
	enableStats: boolean; // Enable statistics collection
	compressionThreshold: number; // Compress entries larger than this size
}

/**
 * Cache set options
 */
export interface CacheSetOptions {
	ttl?: number;
	dependencies?: string[];
}

/**
 * Performance metrics for cache operations
 */
export interface PerformanceMetrics {
	totalTime: number;
	callCount: number;
	averageTime: number;
	minTime: number;
	maxTime: number;
}

/**
 * Performance summary statistics
 */
export interface PerformanceSummary {
	totalOperations: number;
	totalTime: number;
	averageOperationTime: number;
	slowestOperation: string;
	fastestOperation: string;
}

/**
 * Cache warmup entry
 */
export interface CacheWarmupEntry {
	key: string;
	data: any;
	dependencies?: string[];
}
