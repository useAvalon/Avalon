/**
 * Cache Manager - Intelligent caching system for file-system routing
 *
 * This module provides comprehensive caching strategies for route discovery,
 * metadata resolution, and file system operations with intelligent invalidation
 * and performance monitoring.
 */

import { resolve } from '@std/path';
import type {
	FileSystemRoute,
	FileSystemApiRoute,
	ResolvedMetadata,
	RouteParams,
	PageFile,
} from '../../schemas/routing.ts';
import type {
	CacheEntry,
	CacheStats,
	CacheConfig,
	CacheSetOptions,
	PerformanceMetrics,
	PerformanceSummary,
	CacheWarmupEntry,
} from './cache-manager.types.ts';

export type { CacheStats, CacheConfig } from './cache-manager.types.ts';

/**
 * File dependency tracker for cache invalidation
 */
class DependencyTracker {
	private fileDependencies = new Map<string, Set<string>>(); // file -> cache keys
	private keyDependencies = new Map<string, Set<string>>(); // cache key -> files

	/**
	 * Add a dependency between a cache key and file path
	 */
	addDependency(cacheKey: string, filePath: string): void {
		// Normalize file path
		const normalizedPath = resolve(filePath);

		// Track file -> keys mapping
		if (!this.fileDependencies.has(normalizedPath)) {
			this.fileDependencies.set(normalizedPath, new Set());
		}
		this.fileDependencies.get(normalizedPath)!.add(cacheKey);

		// Track key -> files mapping
		if (!this.keyDependencies.has(cacheKey)) {
			this.keyDependencies.set(cacheKey, new Set());
		}
		this.keyDependencies.get(cacheKey)!.add(normalizedPath);
	}

	/**
	 * Get all cache keys that depend on a file
	 */
	getDependentKeys(filePath: string): string[] {
		const normalizedPath = resolve(filePath);
		return Array.from(this.fileDependencies.get(normalizedPath) || []);
	}

	/**
	 * Get all files that a cache key depends on
	 */
	getKeyDependencies(cacheKey: string): string[] {
		return Array.from(this.keyDependencies.get(cacheKey) || []);
	}

	/**
	 * Remove all dependencies for a cache key
	 */
	removeDependencies(cacheKey: string): void {
		const files = this.getKeyDependencies(cacheKey);

		// Remove from file -> keys mapping
		for (const file of files) {
			const keys = this.fileDependencies.get(file);
			if (keys) {
				keys.delete(cacheKey);
				if (keys.size === 0) {
					this.fileDependencies.delete(file);
				}
			}
		}

		// Remove from key -> files mapping
		this.keyDependencies.delete(cacheKey);
	}

	/**
	 * Clear all dependencies
	 */
	clear(): void {
		this.fileDependencies.clear();
		this.keyDependencies.clear();
	}
}

/**
 * Intelligent cache manager for file-system routing
 */
export class CacheManager {
	private cache = new Map<string, CacheEntry<unknown>>();
	private dependencyTracker = new DependencyTracker();
	private config: CacheConfig;
	private stats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		totalRequests: 0,
	};

	constructor(config: Partial<CacheConfig> = {}) {
		this.config = {
			maxMemoryUsage: 50 * 1024 * 1024, // 50MB default
			defaultTTL: 5 * 60 * 1000, // 5 minutes default
			maxEntries: 1000,
			enableLRU: true,
			enableStats: true,
			compressionThreshold: 10 * 1024, // 10KB
			...config,
		};
	}

	/**
	 * Get an item from cache
	 */
	get<T>(key: string): T | null {
		this.stats.totalRequests++;

		const entry = this.cache.get(key);
		if (!entry) {
			this.stats.misses++;
			return null;
		}

		// Check TTL
		if (Date.now() - entry.timestamp > entry.ttl) {
			this.delete(key);
			this.stats.misses++;
			return null;
		}

		// Update access statistics
		entry.accessCount++;
		entry.lastAccessed = Date.now();
		this.stats.hits++;

		return entry.data as T;
	}

	/**
	 * Set an item in cache with dependencies
	 */
	set<T>(key: string, data: T, options: CacheSetOptions = {}): void {
		const ttl = options.ttl || this.config.defaultTTL;
		const dependencies = options.dependencies || [];
		const size = this.estimateSize(data);

		// Check if we need to evict entries
		this.ensureCapacity(size);

		// Create cache entry
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl,
			dependencies,
			accessCount: 1,
			lastAccessed: Date.now(),
			size,
		};

		// Store in cache
		this.cache.set(key, entry);

		// Track dependencies
		for (const dep of dependencies) {
			this.dependencyTracker.addDependency(key, dep);
		}
	}

	/**
	 * Delete an item from cache
	 */
	delete(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) {
			return false;
		}

		// Remove dependencies
		this.dependencyTracker.removeDependencies(key);

		// Remove from cache
		return this.cache.delete(key);
	}

	/**
	 * Invalidate cache entries based on file changes
	 */
	invalidateByFile(filePath: string): string[] {
		const dependentKeys = this.dependencyTracker.getDependentKeys(filePath);

		for (const key of dependentKeys) {
			this.delete(key);
		}

		return dependentKeys;
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
		this.dependencyTracker.clear();
		this.stats = {
			hits: 0,
			misses: 0,
			evictions: 0,
			totalRequests: 0,
		};
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats {
		const entries = Array.from(this.cache.values());
		const totalMemoryUsage = entries.reduce((sum, entry) => sum + entry.size, 0);
		const hitRate = this.stats.totalRequests > 0 ? this.stats.hits / this.stats.totalRequests : 0;
		const missRate = this.stats.totalRequests > 0 ? this.stats.misses / this.stats.totalRequests : 0;

		return {
			totalEntries: this.cache.size,
			totalMemoryUsage,
			hitRate,
			missRate,
			evictionCount: this.stats.evictions,
			oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : 0,
			newestEntry: entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : 0,
			averageAccessCount: entries.length > 0 ? entries.reduce((sum, e) => sum + e.accessCount, 0) / entries.length : 0,
		};
	}

	/**
	 * Ensure cache capacity by evicting entries if necessary
	 */
	private ensureCapacity(newEntrySize: number): void {
		// Check memory usage
		const currentMemoryUsage = this.getCurrentMemoryUsage();
		const wouldExceedMemory = currentMemoryUsage + newEntrySize > this.config.maxMemoryUsage;

		// Check entry count
		const wouldExceedCount = this.cache.size >= this.config.maxEntries;

		if (wouldExceedMemory || wouldExceedCount) {
			this.evictEntries(newEntrySize);
		}
	}

	/**
	 * Evict cache entries using LRU or other strategies
	 */
	private evictEntries(requiredSpace: number): void {
		const entries = Array.from(this.cache.entries());

		if (this.config.enableLRU) {
			// Sort by last accessed time (oldest first)
			entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
		} else {
			// Sort by timestamp (oldest first)
			entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
		}

		let freedSpace = 0;
		let evictedCount = 0;

		for (const [key, entry] of entries) {
			if (freedSpace >= requiredSpace && evictedCount >= Math.ceil(this.cache.size * 0.1)) {
				break; // Evicted enough space and at least 10% of entries
			}

			this.delete(key);
			freedSpace += entry.size;
			evictedCount++;
			this.stats.evictions++;
		}
	}

	/**
	 * Get current memory usage
	 */
	private getCurrentMemoryUsage(): number {
		return Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0);
	}

	/**
	 * Estimate the memory size of data
	 */
	private estimateSize(data: unknown): number {
		try {
			// Simple estimation based on JSON serialization
			const jsonString = JSON.stringify(data);
			return jsonString.length * 2; // Rough estimate for UTF-16 encoding
		} catch {
			// Fallback for non-serializable data
			return 1024; // 1KB default estimate
		}
	}

	/**
	 * Cleanup expired entries
	 */
	cleanup(): number {
		const now = Date.now();
		let cleanedCount = 0;

		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > entry.ttl) {
				this.delete(key);
				cleanedCount++;
			}
		}

		return cleanedCount;
	}

	/**
	 * Get cache keys matching a pattern
	 */
	getKeysMatching(pattern: RegExp): string[] {
		return Array.from(this.cache.keys()).filter(key => pattern.test(key));
	}

	/**
	 * Warm up cache with commonly accessed data
	 */
	warmup(entries: CacheWarmupEntry[]): void {
		for (const entry of entries) {
			this.set(entry.key, entry.data, { dependencies: entry.dependencies });
		}
	}
}

/**
 * Specialized cache for route discovery results
 */
export class RouteCache extends CacheManager {
	constructor(config: Partial<CacheConfig> = {}) {
		super({
			maxMemoryUsage: 20 * 1024 * 1024, // 20MB for routes
			defaultTTL: 10 * 60 * 1000, // 10 minutes for routes
			...config,
		});
	}

	/**
	 * Cache discovered routes with file dependencies
	 */
	setRoutes(key: string, routes: FileSystemRoute[], pageFiles: PageFile[]): void {
		const dependencies = pageFiles.map(f => f.filePath);
		this.set(key, routes, { dependencies });
	}

	/**
	 * Cache discovered API routes with file dependencies
	 */
	setApiRoutes(key: string, routes: FileSystemApiRoute[], apiFiles: PageFile[]): void {
		const dependencies = apiFiles.map(f => f.filePath);
		this.set(key, routes, { dependencies });
	}

	/**
	 * Get cached routes
	 */
	getRoutes(key: string): FileSystemRoute[] | null {
		return this.get<FileSystemRoute[]>(key);
	}

	/**
	 * Get cached API routes
	 */
	getApiRoutes(key: string): FileSystemApiRoute[] | null {
		return this.get<FileSystemApiRoute[]>(key);
	}
}

/**
 * Specialized cache for metadata resolution
 */
export class MetadataCache extends CacheManager {
	constructor(config: Partial<CacheConfig> = {}) {
		super({
			maxMemoryUsage: 10 * 1024 * 1024, // 10MB for metadata
			defaultTTL: 15 * 60 * 1000, // 15 minutes for metadata
			...config,
		});
	}

	/**
	 * Cache resolved metadata with file dependencies
	 */
	setMetadata(routePath: string, params: RouteParams, metadata: ResolvedMetadata, dependencies: string[]): void {
		const key = this.createMetadataKey(routePath, params);
		this.set(key, metadata, { dependencies });
	}

	/**
	 * Get cached metadata
	 */
	getMetadata(routePath: string, params: RouteParams): ResolvedMetadata | null {
		const key = this.createMetadataKey(routePath, params);
		return this.get<ResolvedMetadata>(key);
	}

	/**
	 * Create a cache key for metadata
	 */
	private createMetadataKey(routePath: string, params: RouteParams): string {
		const paramString = Object.keys(params).length > 0 ? JSON.stringify(params) : '';
		return `metadata:${routePath}:${paramString}`;
	}
}

/**
 * Performance monitoring for cache operations
 */
export class CachePerformanceMonitor {
	private metrics = new Map<string, PerformanceMetrics>();

	/**
	 * Time a cache operation
	 */
	async timeOperation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
		const startTime = performance.now();

		try {
			const result = await fn();
			this.recordMetric(operation, performance.now() - startTime);
			return result;
		} catch (error) {
			this.recordMetric(`${operation}:error`, performance.now() - startTime);
			throw error;
		}
	}

	/**
	 * Record a performance metric
	 */
	private recordMetric(operation: string, time: number): void {
		const existing = this.metrics.get(operation);

		if (existing) {
			existing.totalTime += time;
			existing.callCount++;
			existing.averageTime = existing.totalTime / existing.callCount;
			existing.minTime = Math.min(existing.minTime, time);
			existing.maxTime = Math.max(existing.maxTime, time);
		} else {
			this.metrics.set(operation, {
				totalTime: time,
				callCount: 1,
				averageTime: time,
				minTime: time,
				maxTime: time,
			});
		}
	}

	/**
	 * Get performance metrics
	 */
	getMetrics(): Record<string, PerformanceMetrics> {
		const result: Record<string, PerformanceMetrics> = {};

		for (const [operation, metrics] of this.metrics) {
			result[operation] = { ...metrics };
		}

		return result;
	}

	/**
	 * Clear all metrics
	 */
	clearMetrics(): void {
		this.metrics.clear();
	}

	/**
	 * Get summary statistics
	 */
	getSummary(): PerformanceSummary {
		const operations = Array.from(this.metrics.entries());
		const totalOperations = operations.reduce((sum, [, metrics]) => sum + metrics.callCount, 0);
		const totalTime = operations.reduce((sum, [, metrics]) => sum + metrics.totalTime, 0);

		let slowestOp = '';
		let slowestTime = 0;
		let fastestOp = '';
		let fastestTime = Infinity;

		for (const [operation, metrics] of operations) {
			if (metrics.averageTime > slowestTime) {
				slowestTime = metrics.averageTime;
				slowestOp = operation;
			}
			if (metrics.averageTime < fastestTime) {
				fastestTime = metrics.averageTime;
				fastestOp = operation;
			}
		}

		return {
			totalOperations,
			totalTime,
			averageOperationTime: totalOperations > 0 ? totalTime / totalOperations : 0,
			slowestOperation: slowestOp,
			fastestOperation: fastestOp,
		};
	}
}

/**
 * Default cache instances
 */
export const defaultRouteCache = new RouteCache();
export const defaultMetadataCache = new MetadataCache();
export const defaultPerformanceMonitor = new CachePerformanceMonitor();
