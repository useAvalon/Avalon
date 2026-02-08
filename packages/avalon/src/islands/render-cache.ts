/**
 * Island Render Cache Module
 * 
 * Provides caching for expensive operations in the island rendering pipeline:
 * - Component analysis results
 * - Resolved paths
 * - Framework detection results
 * 
 * This module helps optimize island rendering by avoiding repeated file I/O
 * and analysis operations for the same components.
 * 
 * @module render-cache
 */

import type { AnalysisReport } from "../core/components/component-analyzer.ts";
import type { Framework } from "./types.ts";

/**
 * Cache entry for component analysis results
 */
export interface AnalysisCacheEntry {
  /** The analysis result */
  result: AnalysisReport;
  /** Timestamp when the entry was cached */
  timestamp: number;
}

/**
 * Cache entry for resolved paths
 */
export interface PathCacheEntry {
  /** The resolved path */
  resolved: string;
  /** Timestamp when the entry was cached */
  timestamp: number;
}

/**
 * Cache entry for framework detection results
 */
export interface FrameworkCacheEntry {
  /** The detected framework */
  framework: Framework;
  /** Timestamp when the entry was cached */
  timestamp: number;
}

/**
 * Configuration options for the island render cache
 */
export interface CacheConfig {
  /** TTL for analysis cache entries in milliseconds (default: 60000ms = 1 minute) */
  analysisTTL: number;
  /** TTL for path cache entries in milliseconds (default: 60000ms = 1 minute) */
  pathTTL: number;
  /** TTL for framework cache entries in milliseconds (default: 60000ms = 1 minute) */
  frameworkTTL: number;
  /** Maximum number of entries per cache (default: 1000) */
  maxEntries: number;
}

/**
 * Cache statistics for monitoring and debugging
 */
export interface CacheStats {
  /** Number of analysis cache entries */
  analysisSize: number;
  /** Number of path cache entries */
  pathsSize: number;
  /** Number of framework cache entries */
  frameworksSize: number;
  /** Number of cache hits for analysis */
  analysisHits: number;
  /** Number of cache misses for analysis */
  analysisMisses: number;
  /** Number of cache hits for paths */
  pathHits: number;
  /** Number of cache misses for paths */
  pathMisses: number;
  /** Number of cache hits for frameworks */
  frameworkHits: number;
  /** Number of cache misses for frameworks */
  frameworkMisses: number;
}

/**
 * Island Render Cache interface
 * Centralized cache for all expensive operations in island rendering
 */
export interface IslandRenderCache {
  /** Analysis results by component path */
  analysis: Map<string, AnalysisCacheEntry>;
  /** Resolved paths by source path */
  paths: Map<string, PathCacheEntry>;
  /** Framework detection results by source path */
  frameworks: Map<string, FrameworkCacheEntry>;
  /** Cache configuration */
  config: CacheConfig;
  /** Cache statistics */
  stats: CacheStats;
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  analysisTTL: 60000,    // 1 minute
  pathTTL: 60000,        // 1 minute
  frameworkTTL: 60000,   // 1 minute
  maxEntries: 1000,
};

/**
 * Initial cache statistics
 */
const INITIAL_STATS: CacheStats = {
  analysisSize: 0,
  pathsSize: 0,
  frameworksSize: 0,
  analysisHits: 0,
  analysisMisses: 0,
  pathHits: 0,
  pathMisses: 0,
  frameworkHits: 0,
  frameworkMisses: 0,
};

/**
 * Global cache instance
 */
const islandCache: IslandRenderCache = {
  analysis: new Map(),
  paths: new Map(),
  frameworks: new Map(),
  config: { ...DEFAULT_CONFIG },
  stats: { ...INITIAL_STATS },
};

/**
 * Check if we're in development mode
 */
function isDev(): boolean {
  try {
    return typeof Deno !== "undefined" && Deno.env?.get("DENO_ENV") !== "production";
  } catch {
    return true; // Default to dev mode if we can't check
  }
}

function isVerbose(): boolean {
  try {
    return typeof Deno !== "undefined" && Deno.env?.get("AVALON_VERBOSE") === "1";
  } catch {
    return false;
  }
}

/**
 * Check if a cache entry is expired
 */
function isExpired(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp > ttl;
}

/**
 * Enforce max entries limit by removing oldest entries
 */
function enforceMaxEntries<T>(cache: Map<string, T & { timestamp: number }>, maxEntries: number): void {
  if (cache.size <= maxEntries) return;
  
  // Sort entries by timestamp and remove oldest
  const entries = Array.from(cache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  const toRemove = entries.slice(0, cache.size - maxEntries);
  for (const [key] of toRemove) {
    cache.delete(key);
  }
}

// ============================================================================
// Analysis Cache Functions
// ============================================================================

/**
 * Get cached analysis result for a component path
 * 
 * @param src - The component source path
 * @returns The cached analysis result or null if not found/expired
 */
export function getCachedAnalysis(src: string): AnalysisReport | null {
  const cached = islandCache.analysis.get(src);
  
  if (cached) {
    if (!isExpired(cached.timestamp, islandCache.config.analysisTTL)) {
      islandCache.stats.analysisHits++;
      return cached.result;
    }
    // Expired, remove from cache
    islandCache.analysis.delete(src);
  }
  
  islandCache.stats.analysisMisses++;
  return null;
}

/**
 * Store analysis result in cache
 * 
 * @param src - The component source path
 * @param result - The analysis result to cache
 */
export function setCachedAnalysis(src: string, result: AnalysisReport): void {
  islandCache.analysis.set(src, {
    result,
    timestamp: Date.now(),
  });
  
  islandCache.stats.analysisSize = islandCache.analysis.size;
  enforceMaxEntries(islandCache.analysis, islandCache.config.maxEntries);
}

// ============================================================================
// Path Cache Functions
// ============================================================================

/**
 * Get cached resolved path for a source path
 * 
 * @param src - The source path
 * @returns The cached resolved path or null if not found/expired
 */
export function getCachedPath(src: string): string | null {
  const cached = islandCache.paths.get(src);
  
  if (cached) {
    if (!isExpired(cached.timestamp, islandCache.config.pathTTL)) {
      islandCache.stats.pathHits++;
      return cached.resolved;
    }
    // Expired, remove from cache
    islandCache.paths.delete(src);
  }
  
  islandCache.stats.pathMisses++;
  return null;
}

/**
 * Store resolved path in cache
 * 
 * @param src - The source path
 * @param resolved - The resolved path to cache
 */
export function setCachedPath(src: string, resolved: string): void {
  islandCache.paths.set(src, {
    resolved,
    timestamp: Date.now(),
  });
  
  islandCache.stats.pathsSize = islandCache.paths.size;
  enforceMaxEntries(islandCache.paths, islandCache.config.maxEntries);
}

// ============================================================================
// Framework Cache Functions
// ============================================================================

/**
 * Get cached framework detection result for a source path
 * 
 * @param src - The source path
 * @returns The cached framework or null if not found/expired
 */
export function getCachedFramework(src: string): Framework | null {
  const cached = islandCache.frameworks.get(src);
  
  if (cached) {
    if (!isExpired(cached.timestamp, islandCache.config.frameworkTTL)) {
      islandCache.stats.frameworkHits++;
      return cached.framework;
    }
    // Expired, remove from cache
    islandCache.frameworks.delete(src);
  }
  
  islandCache.stats.frameworkMisses++;
  return null;
}

/**
 * Store framework detection result in cache
 * 
 * @param src - The source path
 * @param framework - The detected framework to cache
 */
export function setCachedFramework(src: string, framework: Framework): void {
  islandCache.frameworks.set(src, {
    framework,
    timestamp: Date.now(),
  });
  
  islandCache.stats.frameworksSize = islandCache.frameworks.size;
  enforceMaxEntries(islandCache.frameworks, islandCache.config.maxEntries);
}

// ============================================================================
// Cache Management Functions
// ============================================================================

/**
 * Clear all caches
 * Useful for testing or when file structure changes
 */
export function clearCache(): void {
  islandCache.analysis.clear();
  islandCache.paths.clear();
  islandCache.frameworks.clear();
  
  // Reset stats
  islandCache.stats = { ...INITIAL_STATS };
}

/**
 * Clear cache for a specific component path
 * Useful for HMR when a specific file changes
 * 
 * @param src - The component source path to invalidate
 */
export function invalidateCacheForPath(src: string): void {
  islandCache.analysis.delete(src);
  islandCache.paths.delete(src);
  islandCache.frameworks.delete(src);
  
  // Update sizes
  islandCache.stats.analysisSize = islandCache.analysis.size;
  islandCache.stats.pathsSize = islandCache.paths.size;
  islandCache.stats.frameworksSize = islandCache.frameworks.size;
}

/**
 * Configure cache settings
 * 
 * @param config - Partial configuration to merge with defaults
 */
export function configureCache(config: Partial<CacheConfig>): void {
  islandCache.config = {
    ...islandCache.config,
    ...config,
  };
}

/**
 * Get current cache configuration
 * 
 * @returns The current cache configuration
 */
export function getCacheConfig(): CacheConfig {
  return { ...islandCache.config };
}

/**
 * Get cache statistics for monitoring and debugging
 * Only logs in development mode
 * 
 * @returns Current cache statistics
 */
export function getCacheStats(): CacheStats {
  return {
    analysisSize: islandCache.analysis.size,
    pathsSize: islandCache.paths.size,
    frameworksSize: islandCache.frameworks.size,
    analysisHits: islandCache.stats.analysisHits,
    analysisMisses: islandCache.stats.analysisMisses,
    pathHits: islandCache.stats.pathHits,
    pathMisses: islandCache.stats.pathMisses,
    frameworkHits: islandCache.stats.frameworkHits,
    frameworkMisses: islandCache.stats.frameworkMisses,
  };
}

/**
 * Log cache statistics to console (dev mode only)
 * Useful for debugging and performance monitoring
 */
export function logCacheStats(): void {
  if (!isDev() || !isVerbose()) return;
  
  const stats = getCacheStats();
  const totalHits = stats.analysisHits + stats.pathHits + stats.frameworkHits;
  const totalMisses = stats.analysisMisses + stats.pathMisses + stats.frameworkMisses;
  const hitRate = totalHits + totalMisses > 0 
    ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(1) 
    : "0.0";
  
  console.log("📊 Island Render Cache Stats:");
  console.log(`   Analysis: ${stats.analysisSize} entries (${stats.analysisHits} hits / ${stats.analysisMisses} misses)`);
  console.log(`   Paths: ${stats.pathsSize} entries (${stats.pathHits} hits / ${stats.pathMisses} misses)`);
  console.log(`   Frameworks: ${stats.frameworksSize} entries (${stats.frameworkHits} hits / ${stats.frameworkMisses} misses)`);
  console.log(`   Overall hit rate: ${hitRate}%`);
}

/**
 * Get the raw cache instance (for testing purposes only)
 * @internal
 */
export function _getCache(): IslandRenderCache {
  return islandCache;
}

// ============================================================================
// File Watcher Integration Functions
// ============================================================================

/**
 * Normalize a file path for cache key matching
 * Handles various path formats from Vite file watcher
 * 
 * @param filePath - The file path to normalize
 * @returns Normalized path for cache key matching
 */
function normalizePathForCache(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')  // Normalize Windows paths
    .replace(/^\//, '')   // Remove leading slash
    .replace(/\?.*$/, '') // Remove query strings
    .replace(/#.*$/, ''); // Remove hash fragments
}

/**
 * Check if a file path matches any cached entry
 * Uses partial matching to handle different path formats
 * 
 * @param filePath - The file path to check
 * @param cacheKey - The cache key to match against
 * @returns True if the paths match
 */
function pathMatchesCacheKey(filePath: string, cacheKey: string): boolean {
  const normalizedFile = normalizePathForCache(filePath);
  const normalizedKey = normalizePathForCache(cacheKey);
  
  // Exact match
  if (normalizedFile === normalizedKey) return true;
  
  // Partial match (file path ends with cache key or vice versa)
  if (normalizedFile.endsWith(normalizedKey) || normalizedKey.endsWith(normalizedFile)) return true;
  
  // Filename match (for cases where full paths differ)
  const fileName = normalizedFile.split('/').pop();
  const keyFileName = normalizedKey.split('/').pop();
  if (fileName && keyFileName && fileName === keyFileName) return true;
  
  return false;
}

/**
 * Invalidate cache entries for a specific file path
 * Called when a component file changes during development
 * 
 * @param filePath - The path of the changed file
 * @returns Number of cache entries invalidated
 */
export function invalidateCacheForFile(filePath: string): number {
  let invalidatedCount = 0;
  
  // Find and remove matching entries from analysis cache
  for (const key of islandCache.analysis.keys()) {
    if (pathMatchesCacheKey(filePath, key)) {
      islandCache.analysis.delete(key);
      invalidatedCount++;
      if (isVerbose()) {
        console.log(`🗑️ [Cache] Invalidated analysis cache for: ${key}`);
      }
    }
  }
  
  // Find and remove matching entries from paths cache
  for (const key of islandCache.paths.keys()) {
    if (pathMatchesCacheKey(filePath, key)) {
      islandCache.paths.delete(key);
      invalidatedCount++;
      if (isVerbose()) {
        console.log(`🗑️ [Cache] Invalidated path cache for: ${key}`);
      }
    }
  }
  
  // Find and remove matching entries from frameworks cache
  for (const key of islandCache.frameworks.keys()) {
    if (pathMatchesCacheKey(filePath, key)) {
      islandCache.frameworks.delete(key);
      invalidatedCount++;
      if (isVerbose()) {
        console.log(`🗑️ [Cache] Invalidated framework cache for: ${key}`);
      }
    }
  }
  
  // Update stats
  islandCache.stats.analysisSize = islandCache.analysis.size;
  islandCache.stats.pathsSize = islandCache.paths.size;
  islandCache.stats.frameworksSize = islandCache.frameworks.size;
  
  return invalidatedCount;
}

/**
 * Check if a file path is an island component file
 * Used to determine if cache invalidation is needed
 * 
 * @param filePath - The file path to check
 * @returns True if the file is an island component
 */
export function isIslandComponentFile(filePath: string): boolean {
  const normalized = normalizePathForCache(filePath);
  
  // Check if it's in an islands directory
  if (normalized.includes('/islands/') || normalized.includes('\\islands\\')) {
    return true;
  }
  
  // Check for common component file extensions
  const componentExtensions = ['.tsx', '.jsx', '.vue', '.svelte', '.solid.tsx', '.lit.ts'];
  return componentExtensions.some(ext => normalized.endsWith(ext));
}

/**
 * Clear all caches when file structure changes significantly
 * Called when files are added or removed
 */
export function clearPathCacheOnStructureChange(): void {
  islandCache.paths.clear();
  islandCache.stats.pathsSize = 0;
  
  if (isVerbose()) {
    console.log('🗑️ [Cache] Cleared path cache due to file structure change');
  }
}

/**
 * Alias for clearCache - provides a more descriptive name for external use
 * Clears all island render caches
 */
export function clearIslandCache(): void {
  clearCache();
  
  if (isVerbose()) {
    console.log('🗑️ [Cache] Cleared all island render caches');
  }
}
