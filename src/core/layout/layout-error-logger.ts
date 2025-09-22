import { LayoutErrorInfo, ErrorRecoveryStrategy } from '../../types/layout.ts';

export interface ErrorLogEntry {
	id: string;
	timestamp: number;
	error: Error;
	errorInfo?: LayoutErrorInfo;
	strategy?: ErrorRecoveryStrategy;
	context: {
		url: string;
		userAgent?: string;
		referer?: string;
	};
	resolved: boolean;
	retryCount: number;
}

export class LayoutErrorLogger {
	private logs: ErrorLogEntry[] = [];
	private maxLogs = 1000;
	private isDevelopment: boolean;

	constructor() {
		this.isDevelopment = typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development';
	}

	/**
	 * Log a layout error
	 */
	logError(
		error: Error,
		errorInfo?: LayoutErrorInfo,
		strategy?: ErrorRecoveryStrategy,
		context?: {
			url: string;
			userAgent?: string;
			referer?: string;
		}
	): string {
		const id = this.generateErrorId();
		const entry: ErrorLogEntry = {
			id,
			timestamp: Date.now(),
			error,
			errorInfo,
			strategy,
			context: context || { url: 'unknown' },
			resolved: false,
			retryCount: 0,
		};

		this.logs.push(entry);
		this.trimLogs();

		// Log to console in development
		if (this.isDevelopment) {
			this.logToConsole(entry);
		}

		// Log to external service in production (placeholder)
		if (!this.isDevelopment) {
			this.logToExternalService(entry);
		}

		return id;
	}

	/**
	 * Mark an error as resolved
	 */
	markResolved(errorId: string): void {
		const entry = this.logs.find(log => log.id === errorId);
		if (entry) {
			entry.resolved = true;
		}
	}

	/**
	 * Increment retry count for an error
	 */
	incrementRetryCount(errorId: string): void {
		const entry = this.logs.find(log => log.id === errorId);
		if (entry) {
			entry.retryCount++;
		}
	}

	/**
	 * Get error logs for debugging
	 */
	getErrorLogs(filter?: {
		resolved?: boolean;
		errorType?: string;
		layoutPath?: string;
		since?: number;
	}): ErrorLogEntry[] {
		let filteredLogs = [...this.logs];

		if (filter) {
			if (filter.resolved !== undefined) {
				filteredLogs = filteredLogs.filter(log => log.resolved === filter.resolved);
			}

			if (filter.errorType) {
				filteredLogs = filteredLogs.filter(log => log.errorInfo?.errorType === filter.errorType);
			}

			if (filter.layoutPath) {
				filteredLogs = filteredLogs.filter(log => log.errorInfo?.layoutPath === filter.layoutPath);
			}

			if (filter.since) {
				filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.since!);
			}
		}

		return filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
	}

	/**
	 * Get error statistics
	 */
	getErrorStats(): {
		total: number;
		resolved: number;
		unresolved: number;
		byType: Record<string, number>;
		byLayout: Record<string, number>;
		averageRetries: number;
	} {
		const total = this.logs.length;
		const resolved = this.logs.filter(log => log.resolved).length;
		const unresolved = total - resolved;

		const byType: Record<string, number> = {};
		const byLayout: Record<string, number> = {};
		let totalRetries = 0;

		for (const log of this.logs) {
			if (log.errorInfo?.errorType) {
				byType[log.errorInfo.errorType] = (byType[log.errorInfo.errorType] || 0) + 1;
			}

			if (log.errorInfo?.layoutPath) {
				byLayout[log.errorInfo.layoutPath] = (byLayout[log.errorInfo.layoutPath] || 0) + 1;
			}

			totalRetries += log.retryCount;
		}

		return {
			total,
			resolved,
			unresolved,
			byType,
			byLayout,
			averageRetries: total > 0 ? totalRetries / total : 0,
		};
	}

	/**
	 * Clear all logs
	 */
	clearLogs(): void {
		this.logs = [];
	}

	/**
	 * Export logs for external analysis
	 */
	exportLogs(): string {
		const serializedLogs = this.logs.map(log => ({
			...log,
			error: {
				message: log.error.message,
				stack: log.error.stack,
				name: log.error.name,
			},
		}));
		return JSON.stringify(serializedLogs, null, 2);
	}

	/**
	 * Generate unique error ID
	 */
	private generateErrorId(): string {
		return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Trim logs to maximum size
	 */
	private trimLogs(): void {
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}
	}

	/**
	 * Log to console in development
	 */
	private logToConsole(entry: ErrorLogEntry): void {
		console.group(`🚨 Layout Error [${entry.id}]`);
		console.error('Error:', entry.error.message);
		console.error('Stack:', entry.error.stack);

		if (entry.errorInfo) {
			console.log('Layout Path:', entry.errorInfo.layoutPath);
			console.log('Error Type:', entry.errorInfo.errorType);
			console.log('Timestamp:', new Date(entry.errorInfo.timestamp).toISOString());
		}

		if (entry.strategy) {
			console.log('Recovery Strategy:', entry.strategy.type);
			console.log('Max Retries:', entry.strategy.maxRetries);
		}

		console.log('Context:', entry.context);
		console.groupEnd();
	}

	/**
	 * Log to external service (placeholder)
	 */
	private logToExternalService(entry: ErrorLogEntry): void {
		// In a real implementation, this would send logs to an external service
		// like Sentry, LogRocket, or a custom logging endpoint

		// Example structure for external logging:
		const logData = {
			level: 'error',
			message: entry.error.message,
			extra: {
				errorId: entry.id,
				layoutPath: entry.errorInfo?.layoutPath,
				errorType: entry.errorInfo?.errorType,
				strategy: entry.strategy?.type,
				context: entry.context,
			},
			tags: {
				component: 'layout-system',
				errorType: entry.errorInfo?.errorType || 'unknown',
			},
		};

		// Placeholder for external service call
		// await externalLogger.log(logData);
	}
}

// Global error logger instance
export const layoutErrorLogger = new LayoutErrorLogger();

/**
 * Debug utilities for layout errors
 */
export class LayoutErrorDebugger {
	private logger: LayoutErrorLogger;

	constructor(logger: LayoutErrorLogger = layoutErrorLogger) {
		this.logger = logger;
	}

	/**
	 * Generate debug report
	 */
	generateDebugReport(): string {
		const stats = this.logger.getErrorStats();
		const recentErrors = this.logger.getErrorLogs({ since: Date.now() - 24 * 60 * 60 * 1000 }); // Last 24 hours

		let report = '# Layout Error Debug Report\n\n';
		report += `Generated: ${new Date().toISOString()}\n\n`;

		report += '## Error Statistics\n';
		report += `- Total Errors: ${stats.total}\n`;
		report += `- Resolved: ${stats.resolved}\n`;
		report += `- Unresolved: ${stats.unresolved}\n`;
		report += `- Average Retries: ${stats.averageRetries.toFixed(2)}\n\n`;

		report += '## Errors by Type\n';
		for (const [type, count] of Object.entries(stats.byType)) {
			report += `- ${type}: ${count}\n`;
		}
		report += '\n';

		report += '## Errors by Layout\n';
		for (const [layout, count] of Object.entries(stats.byLayout)) {
			report += `- ${layout}: ${count}\n`;
		}
		report += '\n';

		report += '## Recent Errors (Last 24 Hours)\n';
		for (const error of recentErrors.slice(0, 10)) {
			report += `### Error ${error.id}\n`;
			report += `- Time: ${new Date(error.timestamp).toISOString()}\n`;
			report += `- Message: ${error.error.message}\n`;
			report += `- Layout: ${error.errorInfo?.layoutPath || 'unknown'}\n`;
			report += `- Type: ${error.errorInfo?.errorType || 'unknown'}\n`;
			report += `- Strategy: ${error.strategy?.type || 'none'}\n`;
			report += `- Retries: ${error.retryCount}\n`;
			report += `- Resolved: ${error.resolved ? 'Yes' : 'No'}\n\n`;
		}

		return report;
	}

	/**
	 * Get problematic layouts
	 */
	getProblematicLayouts(threshold = 5): Array<{
		layoutPath: string;
		errorCount: number;
		errorTypes: string[];
		averageRetries: number;
	}> {
		const stats = this.logger.getErrorStats();
		const problematicLayouts: Array<{
			layoutPath: string;
			errorCount: number;
			errorTypes: string[];
			averageRetries: number;
		}> = [];

		for (const [layoutPath, errorCount] of Object.entries(stats.byLayout)) {
			if (errorCount >= threshold) {
				const layoutErrors = this.logger.getErrorLogs({ layoutPath });
				const errorTypes = [
					...new Set(layoutErrors.map(error => error.errorInfo?.errorType).filter(Boolean) as string[]),
				];
				const averageRetries = layoutErrors.reduce((sum, error) => sum + error.retryCount, 0) / layoutErrors.length;

				problematicLayouts.push({
					layoutPath,
					errorCount,
					errorTypes,
					averageRetries,
				});
			}
		}

		return problematicLayouts.sort((a, b) => b.errorCount - a.errorCount);
	}

	/**
	 * Suggest fixes for common errors
	 */
	suggestFixes(): Array<{
		issue: string;
		suggestion: string;
		priority: 'high' | 'medium' | 'low';
	}> {
		const suggestions: Array<{
			issue: string;
			suggestion: string;
			priority: 'high' | 'medium' | 'low';
		}> = [];

		const stats = this.logger.getErrorStats();
		const problematicLayouts = this.getProblematicLayouts(3);

		// High error count suggestions
		if (stats.unresolved > stats.resolved) {
			suggestions.push({
				issue: 'High number of unresolved errors',
				suggestion: 'Review error recovery strategies and consider implementing better fallbacks',
				priority: 'high',
			});
		}

		// Problematic layouts
		for (const layout of problematicLayouts.slice(0, 3)) {
			suggestions.push({
				issue: `Layout ${layout.layoutPath} has ${layout.errorCount} errors`,
				suggestion: `Review layout implementation and consider adding error boundaries or improving error handling`,
				priority: layout.errorCount > 10 ? 'high' : 'medium',
			});
		}

		// High retry count
		if (stats.averageRetries > 2) {
			suggestions.push({
				issue: 'High average retry count',
				suggestion: 'Consider improving error detection and reducing retry attempts for non-recoverable errors',
				priority: 'medium',
			});
		}

		// Specific error type suggestions
		if (stats.byType.loader > stats.byType.component) {
			suggestions.push({
				issue: 'Many loader errors detected',
				suggestion: 'Review data loading logic and add proper error handling for network failures',
				priority: 'medium',
			});
		}

		return suggestions;
	}
}

// Global debugger instance
export const layoutErrorDebugger = new LayoutErrorDebugger();
