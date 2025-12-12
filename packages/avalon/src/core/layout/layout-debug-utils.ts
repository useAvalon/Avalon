import { LayoutHandler, ResolvedLayout, LayoutData, LayoutContext } from '../../types/layout.ts';
import { LayoutCacheManager } from './layout-cache-manager.ts';

export interface DebugConfig {
	enabled: boolean;
	logLevel: 'debug' | 'info' | 'warn' | 'error';
	includeStackTrace: boolean;
	logToConsole: boolean;
	logToFile: boolean;
	maxLogEntries: number;
}

export interface DebugLogEntry {
	timestamp: number;
	level: string;
	category: string;
	message: string;
	data?: any;
	stackTrace?: string;
}

export interface LayoutDebugInfo {
	route: string;
	discoveredLayouts: Array<{
		path: string;
		priority: number;
		depth: number;
		type: string;
	}>;
	appliedLayouts: Array<{
		path: string;
		hasLoader: boolean;
		loadTime?: number;
		dataSize?: number;
	}>;
	conditionalRules: Array<{
		rule: string;
		applied: boolean;
		reason: string;
	}>;
	compositionConfig?: any;
	errorBoundaries: Array<{
		path: string;
		active: boolean;
	}>;
	streamingComponents: Array<{
		component: string;
		priority: string;
		loadTime?: number;
	}>;
	totalResolutionTime: number;
	cacheHit: boolean;
	memoryUsage: number;
}

export class LayoutDebugUtils {
	private logs: DebugLogEntry[] = [];
	private debugSessions = new Map<string, LayoutDebugInfo>();

	constructor(private config: DebugConfig) {}

	// Debug session management
	startDebugSession(sessionId: string, route: string): void {
		if (!this.config.enabled) return;

		this.debugSessions.set(sessionId, {
			route,
			discoveredLayouts: [],
			appliedLayouts: [],
			conditionalRules: [],
			errorBoundaries: [],
			streamingComponents: [],
			totalResolutionTime: 0,
			cacheHit: false,
			memoryUsage: 0,
		});

		this.log('debug', 'session', `Started debug session for route: ${route}`, { sessionId });
	}

	endDebugSession(sessionId: string): LayoutDebugInfo | null {
		if (!this.config.enabled) return null;

		const debugInfo = this.debugSessions.get(sessionId);
		if (debugInfo) {
			this.debugSessions.delete(sessionId);
			this.log('debug', 'session', `Ended debug session for route: ${debugInfo.route}`, {
				sessionId,
				debugInfo,
			});
		}
		return debugInfo || null;
	}

	// Layout discovery debugging
	logLayoutDiscovery(sessionId: string, layouts: LayoutHandler[]): void {
		if (!this.config.enabled) return;

		const debugInfo = this.debugSessions.get(sessionId);
		if (!debugInfo) return;

		debugInfo.discoveredLayouts = layouts.map(layout => ({
			path: layout.path,
			priority: layout.priority,
			depth: 0, // Default depth since it's not in the schema
			type: 'unknown', // Default type since it's not in the schema
		}));

		this.log('debug', 'discovery', `Discovered ${layouts.length} layouts`, {
			sessionId,
			layouts: debugInfo.discoveredLayouts,
		});
	}

	// Layout application debugging
	logLayoutApplication(sessionId: string, layout: LayoutHandler, loadTime?: number, dataSize?: number): void {
		if (!this.config.enabled) return;

		const debugInfo = this.debugSessions.get(sessionId);
		if (!debugInfo) return;

		debugInfo.appliedLayouts.push({
			path: layout.path,
			hasLoader: !!layout.loader,
			loadTime,
			dataSize,
		});

		this.log('debug', 'application', `Applied layout: ${layout.path}`, {
			sessionId,
			layout: layout.path,
			hasLoader: !!layout.loader,
			loadTime,
			dataSize,
		});
	}

	// Conditional rendering debugging
	logConditionalRule(sessionId: string, rule: string, applied: boolean, reason: string): void {
		if (!this.config.enabled) return;

		const debugInfo = this.debugSessions.get(sessionId);
		if (!debugInfo) return;

		debugInfo.conditionalRules.push({ rule, applied, reason });

		this.log('debug', 'conditional', `Conditional rule ${applied ? 'applied' : 'skipped'}: ${rule}`, {
			sessionId,
			rule,
			applied,
			reason,
		});
	}

	// Composition config debugging
	logCompositionConfig(sessionId: string, config: any): void {
		if (!this.config.enabled) return;

		const debugInfo = this.debugSessions.get(sessionId);
		if (!debugInfo) return;

		debugInfo.compositionConfig = config;

		this.log('debug', 'composition', 'Applied composition configuration', {
			sessionId,
			config,
		});
	}

	// Error boundary debugging
	logErrorBoundary(sessionId: string, path: string, active: boolean): void {
		if (!this.config.enabled) return;

		const debugInfo = this.debugSessions.get(sessionId);
		if (!debugInfo) return;

		debugInfo.errorBoundaries.push({ path, active });

		this.log('debug', 'error-boundary', `Error boundary ${active ? 'activated' : 'registered'}: ${path}`, {
			sessionId,
			path,
			active,
		});
	}

	// Streaming component debugging
	logStreamingComponent(sessionId: string, component: string, priority: string, loadTime?: number): void {
		if (!this.config.enabled) return;

		const debugInfo = this.debugSessions.get(sessionId);
		if (!debugInfo) return;

		debugInfo.streamingComponents.push({ component, priority, loadTime });

		this.log('debug', 'streaming', `Streaming component: ${component}`, {
			sessionId,
			component,
			priority,
			loadTime,
		});
	}

	// Performance debugging
	logResolutionTime(sessionId: string, totalTime: number): void {
		if (!this.config.enabled) return;

		const debugInfo = this.debugSessions.get(sessionId);
		if (!debugInfo) return;

		debugInfo.totalResolutionTime = totalTime;

		this.log('info', 'performance', `Layout resolution completed in ${totalTime}ms`, {
			sessionId,
			totalTime,
		});
	}

	logCacheHit(sessionId: string, cacheHit: boolean): void {
		if (!this.config.enabled) return;

		const debugInfo = this.debugSessions.get(sessionId);
		if (!debugInfo) return;

		debugInfo.cacheHit = cacheHit;

		this.log('debug', 'cache', `Cache ${cacheHit ? 'hit' : 'miss'}`, {
			sessionId,
			cacheHit,
		});
	}

	logMemoryUsage(sessionId: string, memoryUsage: number): void {
		if (!this.config.enabled) return;

		const debugInfo = this.debugSessions.get(sessionId);
		if (!debugInfo) return;

		debugInfo.memoryUsage = memoryUsage;

		this.log('debug', 'memory', `Memory usage: ${(memoryUsage / 1024).toFixed(2)} KB`, {
			sessionId,
			memoryUsage,
		});
	}

	// Cache debugging
	logCacheStats(cache: LayoutCacheManager): void {
		if (!this.config.enabled) return;

		const stats = cache.getStats();
		const hitRate = cache.getHitRate();

		this.log('info', 'cache', 'Cache statistics', {
			stats,
			hitRate: `${(hitRate * 100).toFixed(2)}%`,
		});
	}

	// Error debugging
	logError(category: string, error: Error, context?: any): void {
		this.log('error', category, error.message, {
			error: {
				name: error.name,
				message: error.message,
				stack: this.config.includeStackTrace ? error.stack : undefined,
			},
			context,
		});
	}

	// Layout tree visualization
	generateLayoutTree(layouts: LayoutHandler[]): string {
		if (!this.config.enabled) return '';

		const sortedLayouts = [...layouts].sort((a, b) => a.priority - b.priority);
		let tree = 'Layout Tree:\n';

		for (let i = 0; i < sortedLayouts.length; i++) {
			const layout = sortedLayouts[i];
			const isLast = i === sortedLayouts.length - 1;
			const prefix = isLast ? '└── ' : '├── ';
			const indent = '    '.repeat(0); // Default depth since it's not in the schema

			tree += `${indent}${prefix}${layout.path} (priority: ${layout.priority})`;
			if (layout.loader) tree += ' [has loader]';
			tree += '\n';
		}

		return tree;
	}

	// Performance analysis
	analyzePerformance(debugInfo: LayoutDebugInfo): {
		slowLayouts: Array<{ path: string; loadTime: number }>;
		recommendations: string[];
	} {
		const slowLayouts = debugInfo.appliedLayouts
			.filter(layout => layout.loadTime && layout.loadTime > 100)
			.map(layout => ({ path: layout.path, loadTime: layout.loadTime! }))
			.sort((a, b) => b.loadTime - a.loadTime);

		const recommendations: string[] = [];

		if (slowLayouts.length > 0) {
			recommendations.push(`Consider optimizing ${slowLayouts.length} slow layout(s)`);
		}

		if (debugInfo.totalResolutionTime > 500) {
			recommendations.push('Layout resolution is slow, consider caching');
		}

		if (!debugInfo.cacheHit && debugInfo.appliedLayouts.length > 3) {
			recommendations.push('Enable caching for complex layout chains');
		}

		if (debugInfo.memoryUsage > 1024 * 1024) {
			// 1MB
			recommendations.push('High memory usage detected, review layout data size');
		}

		return { slowLayouts, recommendations };
	}

	// Log management
	private log(level: string, category: string, message: string, data?: any): void {
		if (!this.config.enabled) return;

		const entry: DebugLogEntry = {
			timestamp: Date.now(),
			level,
			category,
			message,
			data,
		};

		if (this.config.includeStackTrace && level === 'error') {
			entry.stackTrace = new Error().stack;
		}

		this.logs.push(entry);

		// Enforce max log entries
		if (this.logs.length > this.config.maxLogEntries) {
			this.logs.shift();
		}

		// Console logging
		if (this.config.logToConsole) {
			const logMethod =
				level === 'error'
					? console.error
					: level === 'warn'
					? console.warn
					: level === 'info'
					? console.info
					: console.log;

			logMethod(`[Layout ${category.toUpperCase()}] ${message}`, data || '');
		}
	}

	// Get logs
	getLogs(category?: string, level?: string): DebugLogEntry[] {
		let filteredLogs = [...this.logs];

		if (category) {
			filteredLogs = filteredLogs.filter(log => log.category === category);
		}

		if (level) {
			filteredLogs = filteredLogs.filter(log => log.level === level);
		}

		return filteredLogs;
	}

	// Clear logs
	clearLogs(): void {
		this.logs = [];
	}

	// Export debug report
	exportDebugReport(sessionId?: string): string {
		const report = {
			timestamp: new Date().toISOString(),
			config: this.config,
			logs: this.getLogs(),
			activeSessions: sessionId
				? { [sessionId]: this.debugSessions.get(sessionId) }
				: Object.fromEntries(this.debugSessions),
		};

		return JSON.stringify(report, null, 2);
	}
}

// Default debug configuration
export const defaultDebugConfig: DebugConfig = {
	enabled: Deno.env.get('DENO_ENV') === 'development',
	logLevel: 'debug',
	includeStackTrace: true,
	logToConsole: true,
	logToFile: false,
	maxLogEntries: 1000,
};

// Global debug utils instance
export const layoutDebugUtils = new LayoutDebugUtils(defaultDebugConfig);
