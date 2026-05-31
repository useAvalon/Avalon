import type { LayoutData, LayoutHandler, ResolvedLayout } from "./layout-types.ts";

export interface CacheEntry<T> {
	value: T;
	timestamp: number;
	ttl: number;
	accessCount: number;
	lastAccessed: number;
}

export interface CacheStats {
	hits: number;
	misses: number;
	evictions: number;
	totalEntries: number;
	memoryUsage: number;
}

export interface CacheConfig {
	defaultTtl: number;
	maxEntries: number;
	cleanupInterval: number;
	enableStats: boolean;
	enableCompression?: boolean;
	intelligentInvalidation?: boolean;
	preloadThreshold?: number;
}

export class LayoutCacheManager {
	private readonly resolvedLayouts = new Map<string, CacheEntry<ResolvedLayout>>();
	private readonly layoutHandlers = new Map<string, CacheEntry<LayoutHandler>>();
	private readonly layoutData = new Map<string, CacheEntry<LayoutData>>();
	private readonly dependencyGraph = new Map<string, Set<string>>(); // Track cache dependencies
	private readonly accessOrder = new Map<string, number>(); // LRU tracking
	private accessCounter = 0;
	private stats: CacheStats = {
		hits: 0,
		misses: 0,
		evictions: 0,
		totalEntries: 0,
		memoryUsage: 0,
	};
	private cleanupTimer?: ReturnType<typeof setInterval>;

	constructor(private readonly config: CacheConfig) {
		// Don't start cleanup timer in test environment
		if (process.env.NODE_ENV !== "test") {
			this.startCleanupTimer();
		}
	}

	// Resolved layouts cache
	setResolvedLayout(key: string, layout: ResolvedLayout, ttl?: number): void {
		const entry: CacheEntry<ResolvedLayout> = {
			value: layout,
			timestamp: Date.now(),
			ttl: ttl || this.config.defaultTtl,
			accessCount: 0,
			lastAccessed: Date.now(),
		};

		this.resolvedLayouts.set(key, entry);
		this.updateAccessOrder(key);
		this.updateStats();
		this.enforceMaxEntries();
	}

	getResolvedLayout(key: string): ResolvedLayout | null {
		const entry = this.resolvedLayouts.get(key);
		if (!entry) {
			this.stats.misses++;
			return null;
		}

		if (this.isExpired(entry)) {
			this.resolvedLayouts.delete(key);
			this.accessOrder.delete(key);
			this.stats.misses++;
			this.stats.evictions++;
			return null;
		}

		entry.accessCount++;
		entry.lastAccessed = Date.now();
		this.updateAccessOrder(key);
		this.stats.hits++;
		return entry.value;
	}

	// Layout handlers cache
	setLayoutHandler(key: string, handler: LayoutHandler, ttl?: number): void {
		const entry: CacheEntry<LayoutHandler> = {
			value: handler,
			timestamp: Date.now(),
			ttl: ttl || this.config.defaultTtl,
			accessCount: 0,
			lastAccessed: Date.now(),
		};

		this.layoutHandlers.set(key, entry);
		this.updateAccessOrder(key);
		this.updateStats();
		this.enforceMaxEntries();
	}

	getLayoutHandler(key: string): LayoutHandler | null {
		const entry = this.layoutHandlers.get(key);
		if (!entry) {
			this.stats.misses++;
			return null;
		}

		if (this.isExpired(entry)) {
			this.layoutHandlers.delete(key);
			this.accessOrder.delete(key);
			this.stats.misses++;
			this.stats.evictions++;
			return null;
		}

		entry.accessCount++;
		entry.lastAccessed = Date.now();
		this.updateAccessOrder(key);
		this.stats.hits++;
		return entry.value;
	}

	// Layout data cache
	setLayoutData(key: string, data: LayoutData, ttl?: number): void {
		const entry: CacheEntry<LayoutData> = {
			value: data,
			timestamp: Date.now(),
			ttl: ttl || this.config.defaultTtl,
			accessCount: 0,
			lastAccessed: Date.now(),
		};

		this.layoutData.set(key, entry);
		this.updateAccessOrder(key);
		this.updateStats();
		this.enforceMaxEntries();
	}

	getLayoutData(key: string): LayoutData | null {
		const entry = this.layoutData.get(key);
		if (!entry) {
			this.stats.misses++;
			return null;
		}

		if (this.isExpired(entry)) {
			this.layoutData.delete(key);
			this.accessOrder.delete(key);
			this.stats.misses++;
			this.stats.evictions++;
			return null;
		}

		entry.accessCount++;
		entry.lastAccessed = Date.now();
		this.updateAccessOrder(key);
		this.stats.hits++;
		return entry.value;
	}

	// Cache invalidation with intelligent dependency tracking
	invalidateResolvedLayout(key: string): boolean {
		const deleted = this.resolvedLayouts.delete(key);
		this.accessOrder.delete(key);
		this.invalidateDependents(key);
		return deleted;
	}

	invalidateLayoutHandler(key: string): boolean {
		const deleted = this.layoutHandlers.delete(key);
		this.accessOrder.delete(key);
		this.invalidateDependents(key);
		return deleted;
	}

	invalidateLayoutData(key: string): boolean {
		const deleted = this.layoutData.delete(key);
		this.accessOrder.delete(key);
		this.invalidateDependents(key);
		return deleted;
	}

	// Intelligent invalidation based on file path changes
	invalidateByFilePath(filePath: string): number {
		let invalidated = 0;
		const normalizedPath = this.normalizePath(filePath);

		// Invalidate all entries that depend on this file
		for (const key of this.resolvedLayouts.keys()) {
			if (this.isKeyAffectedByPath(key, normalizedPath)) {
				this.resolvedLayouts.delete(key);
				this.accessOrder.delete(key);
				invalidated++;
			}
		}

		for (const key of this.layoutHandlers.keys()) {
			if (this.isKeyAffectedByPath(key, normalizedPath)) {
				this.layoutHandlers.delete(key);
				this.accessOrder.delete(key);
				invalidated++;
			}
		}

		for (const key of this.layoutData.keys()) {
			if (this.isKeyAffectedByPath(key, normalizedPath)) {
				this.layoutData.delete(key);
				this.accessOrder.delete(key);
				invalidated++;
			}
		}

		this.updateStats();
		return invalidated;
	}

	// Add cache dependency tracking
	addDependency(key: string, dependsOn: string): void {
		if (!this.dependencyGraph.has(dependsOn)) {
			this.dependencyGraph.set(dependsOn, new Set());
		}
		this.dependencyGraph.get(dependsOn)!.add(key);
	}

	// Remove cache dependency
	removeDependency(key: string, dependsOn: string): void {
		const dependents = this.dependencyGraph.get(dependsOn);
		if (dependents) {
			dependents.delete(key);
			if (dependents.size === 0) {
				this.dependencyGraph.delete(dependsOn);
			}
		}
	}

	invalidateByPattern(pattern: RegExp): number {
		let invalidated = 0;

		for (const key of this.resolvedLayouts.keys()) {
			if (pattern.test(key)) {
				this.resolvedLayouts.delete(key);
				invalidated++;
			}
		}

		for (const key of this.layoutHandlers.keys()) {
			if (pattern.test(key)) {
				this.layoutHandlers.delete(key);
				invalidated++;
			}
		}

		for (const key of this.layoutData.keys()) {
			if (pattern.test(key)) {
				this.layoutData.delete(key);
				invalidated++;
			}
		}

		this.updateStats();
		return invalidated;
	}

	// Clear all caches
	clear(): void {
		this.resolvedLayouts.clear();
		this.layoutHandlers.clear();
		this.layoutData.clear();
		this.dependencyGraph.clear();
		this.accessOrder.clear();
		this.accessCounter = 0;
		this.resetStats();
	}

	// Cache statistics
	getStats(): CacheStats {
		this.updateStats();
		return { ...this.stats };
	}

	getHitRate(): number {
		const total = this.stats.hits + this.stats.misses;
		return total === 0 ? 0 : this.stats.hits / total;
	}

	// Private methods
	private isExpired(entry: CacheEntry<any>): boolean {
		return Date.now() - entry.timestamp > entry.ttl;
	}

	private invalidateDependents(key: string): void {
		const dependents = this.dependencyGraph.get(key);
		if (dependents) {
			for (const dependent of dependents) {
				this.resolvedLayouts.delete(dependent);
				this.layoutHandlers.delete(dependent);
				this.layoutData.delete(dependent);
				this.accessOrder.delete(dependent);
				// Recursively invalidate dependents of dependents
				this.invalidateDependents(dependent);
			}
			this.dependencyGraph.delete(key);
		}
	}

	private normalizePath(filePath: string): string {
		return filePath.replaceAll("\\", "/").toLowerCase();
	}

	private isKeyAffectedByPath(key: string, filePath: string): boolean {
		// Check if the cache key contains or is related to the file path
		const normalizedKey = key.toLowerCase();
		return (
			normalizedKey.includes(filePath) ||
			normalizedKey.includes(filePath.replace("_layout.tsx", "")) ||
			normalizedKey.includes(filePath.replace(".tsx", ""))
		);
	}

	private updateAccessOrder(key: string): void {
		this.accessOrder.set(key, ++this.accessCounter);
	}

	private updateStats(): void {
		if (!this.config.enableStats) return;

		this.stats.totalEntries =
			this.resolvedLayouts.size + this.layoutHandlers.size + this.layoutData.size;

		// Estimate memory usage (rough calculation)
		this.stats.memoryUsage = this.estimateMemoryUsage();
	}

	private estimateMemoryUsage(): number {
		let size = 0;

		// Rough estimation of memory usage
		for (const [key, entry] of this.resolvedLayouts) {
			size += key.length * 2; // UTF-16 characters
			size += JSON.stringify(entry.value).length * 2;
			size += 64; // Entry metadata overhead
		}

		for (const [key] of this.layoutHandlers) {
			size += key.length * 2;
			size += 256; // Estimated handler size
			size += 64; // Entry metadata overhead
		}

		for (const [key, entry] of this.layoutData) {
			size += key.length * 2;
			size += JSON.stringify(entry.value).length * 2;
			size += 64; // Entry metadata overhead
		}

		return size;
	}

	private enforceMaxEntries(): void {
		const totalEntries =
			this.resolvedLayouts.size + this.layoutHandlers.size + this.layoutData.size;

		if (totalEntries <= this.config.maxEntries) return;

		// Use access order for more efficient LRU eviction
		const sortedByAccess = Array.from(this.accessOrder.entries())
			.sort((a, b) => a[1] - b[1]) // Sort by access order (oldest first)
			.map(([key]) => key);

		// Remove oldest entries until we're under the limit
		const toRemove = totalEntries - this.config.maxEntries;
		let removed = 0;

		for (const key of sortedByAccess) {
			if (removed >= toRemove) break;

			// Try to remove from each cache
			let wasRemoved = false;
			if (this.resolvedLayouts.has(key)) {
				this.resolvedLayouts.delete(key);
				wasRemoved = true;
			}
			if (this.layoutHandlers.has(key)) {
				this.layoutHandlers.delete(key);
				wasRemoved = true;
			}
			if (this.layoutData.has(key)) {
				this.layoutData.delete(key);
				wasRemoved = true;
			}

			if (wasRemoved) {
				this.accessOrder.delete(key);
				this.stats.evictions++;
				removed++;
			}
		}
	}

	private startCleanupTimer(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
		}

		this.cleanupTimer = setInterval(() => {
			this.cleanup();
		}, this.config.cleanupInterval);
	}

	private cleanup(): void {
		const now = Date.now();

		// Clean expired resolved layouts
		for (const [key, entry] of this.resolvedLayouts) {
			if (now - entry.timestamp > entry.ttl) {
				this.resolvedLayouts.delete(key);
				this.accessOrder.delete(key);
				this.stats.evictions++;
			}
		}

		// Clean expired layout handlers
		for (const [key, entry] of this.layoutHandlers) {
			if (now - entry.timestamp > entry.ttl) {
				this.layoutHandlers.delete(key);
				this.accessOrder.delete(key);
				this.stats.evictions++;
			}
		}

		// Clean expired layout data
		for (const [key, entry] of this.layoutData) {
			if (now - entry.timestamp > entry.ttl) {
				this.layoutData.delete(key);
				this.accessOrder.delete(key);
				this.stats.evictions++;
			}
		}

		// Clean up orphaned access order entries
		for (const key of this.accessOrder.keys()) {
			if (
				!this.resolvedLayouts.has(key) &&
				!this.layoutHandlers.has(key) &&
				!this.layoutData.has(key)
			) {
				this.accessOrder.delete(key);
			}
		}

		this.updateStats();
	}

	private resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			evictions: 0,
			totalEntries: 0,
			memoryUsage: 0,
		};
	}

	// Cleanup resources
	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = undefined;
		}
		this.clear();
	}
}

// Default cache configuration
export const defaultCacheConfig: CacheConfig = {
	defaultTtl: 5 * 60 * 1000, // 5 minutes
	maxEntries: 1000,
	cleanupInterval: 60 * 1000, // 1 minute
	enableStats: true,
	enableCompression: true,
	intelligentInvalidation: true,
	preloadThreshold: 0.8, // Preload when cache is 80% full
};

// Global cache instance
export const layoutCache = new LayoutCacheManager(defaultCacheConfig);
