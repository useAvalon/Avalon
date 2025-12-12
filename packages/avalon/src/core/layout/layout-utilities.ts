/**
 * Layout System Utilities and Helpers
 *
 * This module provides comprehensive utilities for the advanced layout system including:
 * - Cache management with TTL and invalidation
 * - Debug utilities for development mode
 * - Performance monitoring and metrics collection
 * - Configuration validation and error reporting
 */

// Import all the utility classes first
import {
	LayoutCacheManager,
	defaultCacheConfig,
	layoutCache,
	type CacheEntry,
	type CacheStats,
	type CacheConfig,
} from './layout-cache-manager.ts';

import {
	LayoutDebugUtils,
	defaultDebugConfig,
	layoutDebugUtils,
	type DebugConfig,
	type DebugLogEntry,
	type LayoutDebugInfo,
} from './layout-debug-utils.ts';

import {
	LayoutPerformanceMonitor,
	defaultPerformanceThresholds,
	layoutPerformanceMonitor,
	type PerformanceMetric,
	type PerformanceSnapshot,
	type PerformanceThresholds,
	type PerformanceAlert,
} from './layout-performance-monitor.ts';

import {
	LayoutConfigValidator,
	LayoutErrorReporter,
	defaultValidationOptions,
	layoutConfigValidator,
	layoutErrorReporter,
	type ValidationError,
	type ValidationResult,
	type ValidationWarning,
	type ConfigValidationOptions,
} from './layout-config-validator.ts';

// Re-export everything
export { LayoutCacheManager, defaultCacheConfig, layoutCache, type CacheEntry, type CacheStats, type CacheConfig };

export {
	LayoutDebugUtils,
	defaultDebugConfig,
	layoutDebugUtils,
	type DebugConfig,
	type DebugLogEntry,
	type LayoutDebugInfo,
};

export {
	LayoutPerformanceMonitor,
	defaultPerformanceThresholds,
	layoutPerformanceMonitor,
	type PerformanceMetric,
	type PerformanceSnapshot,
	type PerformanceThresholds,
	type PerformanceAlert,
};

export {
	LayoutConfigValidator,
	LayoutErrorReporter,
	defaultValidationOptions,
	layoutConfigValidator,
	layoutErrorReporter,
	type ValidationError,
	type ValidationResult,
	type ValidationWarning,
	type ConfigValidationOptions,
};

/**
 * Utility function to create a complete layout utilities suite
 * with consistent configuration across all components
 */
export interface LayoutUtilitiesConfig {
	cache?: {
		defaultTtl?: number;
		maxEntries?: number;
		cleanupInterval?: number;
		enableStats?: boolean;
	};
	debug?: {
		enabled?: boolean;
		logLevel?: 'debug' | 'info' | 'warn' | 'error';
		includeStackTrace?: boolean;
		logToConsole?: boolean;
		maxLogEntries?: number;
	};
	performance?: {
		layoutDiscoveryTime?: number;
		layoutLoadTime?: number;
		totalResolutionTime?: number;
		memoryUsage?: number;
		cacheHitRate?: number;
	};
	validation?: {
		strict?: boolean;
		allowUnknownFields?: boolean;
		validatePaths?: boolean;
		checkFileExists?: boolean;
	};
}

export interface LayoutUtilitiesSuite {
	cache: LayoutCacheManager;
	debug: LayoutDebugUtils;
	performance: LayoutPerformanceMonitor;
	validator: LayoutConfigValidator;
	errorReporter: LayoutErrorReporter;
}

/**
 * Create a complete layout utilities suite with custom configuration
 */
export function createLayoutUtilities(config: LayoutUtilitiesConfig = {}): LayoutUtilitiesSuite {
	const cacheConfig = {
		defaultTtl: config.cache?.defaultTtl ?? 5 * 60 * 1000, // 5 minutes
		maxEntries: config.cache?.maxEntries ?? 1000,
		cleanupInterval: config.cache?.cleanupInterval ?? 60 * 1000, // 1 minute
		enableStats: config.cache?.enableStats ?? true,
	};

	const debugConfig = {
		enabled: config.debug?.enabled ?? Deno.env.get('DENO_ENV') === 'development',
		logLevel: config.debug?.logLevel ?? ('debug' as const),
		includeStackTrace: config.debug?.includeStackTrace ?? true,
		logToConsole: config.debug?.logToConsole ?? true,
		logToFile: false, // Not implemented yet
		maxLogEntries: config.debug?.maxLogEntries ?? 1000,
	};

	const performanceThresholds = {
		layoutDiscoveryTime: config.performance?.layoutDiscoveryTime ?? 50, // 50ms
		layoutLoadTime: config.performance?.layoutLoadTime ?? 100, // 100ms
		totalResolutionTime: config.performance?.totalResolutionTime ?? 200, // 200ms
		memoryUsage: config.performance?.memoryUsage ?? 1024 * 1024, // 1MB
		cacheHitRate: config.performance?.cacheHitRate ?? 0.8, // 80%
	};

	const validationOptions = {
		strict: config.validation?.strict ?? true,
		allowUnknownFields: config.validation?.allowUnknownFields ?? false,
		validatePaths: config.validation?.validatePaths ?? true,
		checkFileExists: config.validation?.checkFileExists ?? false,
	};

	return {
		cache: new LayoutCacheManager(cacheConfig),
		debug: new LayoutDebugUtils(debugConfig),
		performance: new LayoutPerformanceMonitor(performanceThresholds),
		validator: new LayoutConfigValidator(validationOptions),
		errorReporter: new LayoutErrorReporter(),
	};
}

/**
 * Default layout utilities suite using default configurations
 */
export const defaultLayoutUtilities = createLayoutUtilities();

/**
 * Utility function to integrate all utilities for a layout resolution session
 */
export async function withLayoutUtilities<T>(
	sessionId: string,
	route: string,
	operation: (utilities: LayoutUtilitiesSuite) => Promise<T>,
	utilities: LayoutUtilitiesSuite = defaultLayoutUtilities
): Promise<T> {
	const { cache, debug, performance, validator, errorReporter } = utilities;

	// Start monitoring
	performance.startTimer('layout_resolution');
	debug.startDebugSession(sessionId, route);

	try {
		const result = await operation(utilities);

		// End monitoring
		const totalTime = performance.endTimer('layout_resolution', { route });
		debug.logResolutionTime(sessionId, totalTime);

		const debugInfo = debug.endDebugSession(sessionId);
		if (debugInfo) {
			const analysis = debug.analyzePerformance(debugInfo);
			if (analysis.recommendations.length > 0) {
				console.info(`[Layout Utilities] Performance recommendations for ${route}:`, analysis.recommendations);
			}
		}

		return result;
	} catch (error) {
		// Log error
		debug.logError('operation', error as Error, { sessionId, route });
		errorReporter.reportRuntimeError(error as Error, 'layout_operation', { sessionId, route });

		// End monitoring with error
		performance.endTimer('layout_resolution', { route, error: 'true' });
		debug.endDebugSession(sessionId);

		throw error;
	}
}

/**
 * Utility function to validate and monitor a layout configuration
 */
export function validateLayoutConfiguration(
	config: any,
	utilities: LayoutUtilitiesSuite = defaultLayoutUtilities
): ValidationResult {
	const { validator, errorReporter } = utilities;

	const result = validator.validateLayoutConfig(config);

	if (!result.valid || result.warnings.some((w: ValidationWarning) => w.severity === 'high')) {
		errorReporter.reportValidationError(result, { config });
	}

	return result;
}

/**
 * Utility function to get comprehensive layout system health report
 */
export function getLayoutSystemHealthReport(utilities: LayoutUtilitiesSuite = defaultLayoutUtilities): {
	cache: {
		stats: any;
		hitRate: number;
	};
	performance: {
		alerts: any[];
		slowestRoutes: any[];
	};
	errors: {
		recent: any[];
		summary: any;
	};
	timestamp: string;
} {
	const { cache, performance, errorReporter } = utilities;

	return {
		cache: {
			stats: cache.getStats(),
			hitRate: cache.getHitRate(),
		},
		performance: {
			alerts: performance.getAlerts('high'),
			slowestRoutes: performance.getSlowestRoutes(5),
		},
		errors: {
			recent: errorReporter.getErrors(undefined, Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
			summary: JSON.parse(errorReporter.generateReport()),
		},
		timestamp: new Date().toISOString(),
	};
}
