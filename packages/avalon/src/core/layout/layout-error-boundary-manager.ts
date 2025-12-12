import { ComponentType } from 'preact';
import { LayoutErrorInfo, ErrorRecoveryStrategy, LayoutContext } from '../../types/layout.ts';
import { LayoutErrorRecovery } from './layout-error-recovery.ts';
import { layoutErrorLogger, LayoutErrorDebugger } from './layout-error-logger.ts';

export interface ErrorBoundaryConfig {
	component: 'layout' | 'data' | 'island' | 'streaming';
	strategy: ErrorRecoveryStrategy;
	fallbackComponent?: ComponentType<any>;
	isolateError?: boolean;
	maxRetries?: number;
}

export interface ErrorBoundaryRegistration {
	id: string;
	config: ErrorBoundaryConfig;
	layoutPath: string;
	isActive: boolean;
	errorCount: number;
	lastError?: Date;
}

/**
 * Manages error boundaries across the layout system
 * Provides centralized configuration and monitoring of error handling
 */
export class LayoutErrorBoundaryManager {
	private registrations = new Map<string, ErrorBoundaryRegistration>();
	private errorRecovery = new LayoutErrorRecovery();
	private debugger = new LayoutErrorDebugger();
	private globalErrorHandler?: (error: Error, errorInfo: LayoutErrorInfo) => void;

	/**
	 * Register an error boundary
	 */
	registerErrorBoundary(id: string, layoutPath: string, config: ErrorBoundaryConfig): void {
		const registration: ErrorBoundaryRegistration = {
			id,
			config,
			layoutPath,
			isActive: true,
			errorCount: 0,
		};

		this.registrations.set(id, registration);

		// Register strategy with error recovery system
		this.errorRecovery.registerStrategy(`${config.component}:${layoutPath}`, config.strategy);
	}

	/**
	 * Unregister an error boundary
	 */
	unregisterErrorBoundary(id: string): void {
		this.registrations.delete(id);
	}

	/**
	 * Handle error from any error boundary
	 */
	handleError(boundaryId: string, error: Error, errorInfo: LayoutErrorInfo, context?: LayoutContext): void {
		const registration = this.registrations.get(boundaryId);
		if (!registration) {
			console.warn(`Unknown error boundary: ${boundaryId}`);
			return;
		}

		// Update registration
		registration.errorCount++;
		registration.lastError = new Date();

		// Log the error
		const errorId = layoutErrorLogger.logError(
			error,
			errorInfo,
			registration.config.strategy,
			context
				? {
						url: context.request.url,
						userAgent: context.request.headers.get('user-agent') || undefined,
						referer: context.request.headers.get('referer') || undefined,
				  }
				: undefined
		);

		// Call global error handler if set
		if (this.globalErrorHandler) {
			this.globalErrorHandler(error, errorInfo);
		}

		// Check if boundary should be deactivated due to too many errors
		this.checkBoundaryHealth(registration);
	}

	/**
	 * Set global error handler
	 */
	setGlobalErrorHandler(handler: (error: Error, errorInfo: LayoutErrorInfo) => void): void {
		this.globalErrorHandler = handler;
	}

	/**
	 * Get error boundary configuration
	 */
	getBoundaryConfig(id: string): ErrorBoundaryConfig | null {
		const registration = this.registrations.get(id);
		return registration ? registration.config : null;
	}

	/**
	 * Update error boundary configuration
	 */
	updateBoundaryConfig(id: string, config: Partial<ErrorBoundaryConfig>): void {
		const registration = this.registrations.get(id);
		if (registration) {
			registration.config = { ...registration.config, ...config };
		}
	}

	/**
	 * Get all registered error boundaries
	 */
	getRegistrations(): ErrorBoundaryRegistration[] {
		return Array.from(this.registrations.values());
	}

	/**
	 * Get error boundaries for a specific layout path
	 */
	getBoundariesForLayout(layoutPath: string): ErrorBoundaryRegistration[] {
		return Array.from(this.registrations.values()).filter(reg => reg.layoutPath === layoutPath);
	}

	/**
	 * Deactivate error boundary
	 */
	deactivateBoundary(id: string): void {
		const registration = this.registrations.get(id);
		if (registration) {
			registration.isActive = false;
		}
	}

	/**
	 * Reactivate error boundary
	 */
	reactivateBoundary(id: string): void {
		const registration = this.registrations.get(id);
		if (registration) {
			registration.isActive = true;
			registration.errorCount = 0;
			registration.lastError = undefined;
		}
	}

	/**
	 * Get error boundary health status
	 */
	getBoundaryHealth(): Array<{
		id: string;
		layoutPath: string;
		status: 'healthy' | 'warning' | 'critical' | 'inactive';
		errorCount: number;
		lastError?: Date;
	}> {
		return Array.from(this.registrations.values()).map(reg => {
			let status: 'healthy' | 'warning' | 'critical' | 'inactive';

			if (!reg.isActive) {
				status = 'inactive';
			} else if (reg.errorCount === 0) {
				status = 'healthy';
			} else if (reg.errorCount < 5) {
				status = 'warning';
			} else {
				status = 'critical';
			}

			return {
				id: reg.id,
				layoutPath: reg.layoutPath,
				status,
				errorCount: reg.errorCount,
				lastError: reg.lastError,
			};
		});
	}

	/**
	 * Generate error boundary report
	 */
	generateReport(): string {
		const health = this.getBoundaryHealth();
		const stats = layoutErrorLogger.getErrorStats();
		const suggestions = this.debugger.suggestFixes();

		let report = '# Error Boundary Manager Report\n\n';
		report += `Generated: ${new Date().toISOString()}\n\n`;

		report += '## Error Boundary Health\n';
		for (const boundary of health) {
			report += `- **${boundary.id}** (${boundary.layoutPath}): ${boundary.status.toUpperCase()}`;
			if (boundary.errorCount > 0) {
				report += ` - ${boundary.errorCount} errors`;
				if (boundary.lastError) {
					report += ` (last: ${boundary.lastError.toISOString()})`;
				}
			}
			report += '\n';
		}
		report += '\n';

		report += '## Overall Error Statistics\n';
		report += `- Total Errors: ${stats.total}\n`;
		report += `- Resolved: ${stats.resolved}\n`;
		report += `- Unresolved: ${stats.unresolved}\n`;
		report += `- Average Retries: ${stats.averageRetries.toFixed(2)}\n\n`;

		report += '## Recommendations\n';
		for (const suggestion of suggestions) {
			report += `- **${suggestion.priority.toUpperCase()}**: ${suggestion.issue}\n`;
			report += `  - ${suggestion.suggestion}\n\n`;
		}

		return report;
	}

	/**
	 * Reset all error boundaries
	 */
	resetAllBoundaries(): void {
		for (const registration of this.registrations.values()) {
			registration.errorCount = 0;
			registration.lastError = undefined;
			registration.isActive = true;
		}
		layoutErrorLogger.clearLogs();
	}

	/**
	 * Check boundary health and deactivate if necessary
	 */
	private checkBoundaryHealth(registration: ErrorBoundaryRegistration): void {
		const maxErrors = 10;
		const timeWindow = 5 * 60 * 1000; // 5 minutes

		if (registration.errorCount >= maxErrors) {
			const recentErrors = layoutErrorLogger.getErrorLogs({
				layoutPath: registration.layoutPath,
				since: Date.now() - timeWindow,
			});

			if (recentErrors.length >= maxErrors) {
				console.warn(
					`Deactivating error boundary ${registration.id} due to too many errors (${registration.errorCount})`
				);
				registration.isActive = false;
			}
		}
	}
}

// Global error boundary manager instance
export const layoutErrorBoundaryManager = new LayoutErrorBoundaryManager();

/**
 * Utility functions for error boundary management
 */
export const ErrorBoundaryUtils = {
	/**
	 * Create a standard error boundary configuration
	 */
	createStandardConfig(
		component: ErrorBoundaryConfig['component'],
		options?: Partial<ErrorBoundaryConfig>
	): ErrorBoundaryConfig {
		const defaultStrategies: Record<ErrorBoundaryConfig['component'], ErrorRecoveryStrategy> = {
			layout: { type: 'fallback', maxRetries: 2 },
			data: { type: 'retry', maxRetries: 3 },
			island: { type: 'skip', maxRetries: 0 },
			streaming: { type: 'fallback', maxRetries: 1 },
		};

		return {
			component,
			strategy: defaultStrategies[component],
			isolateError: component === 'island',
			maxRetries: defaultStrategies[component].maxRetries,
			...options,
		};
	},

	/**
	 * Generate unique boundary ID
	 */
	generateBoundaryId(component: string, layoutPath: string): string {
		return `${component}_${layoutPath.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${Math.random()
			.toString(36)
			.substr(2, 9)}`;
	},

	/**
	 * Check if error should be isolated
	 */
	shouldIsolateError(errorInfo: LayoutErrorInfo): boolean {
		return errorInfo.errorType === 'island' || errorInfo.layoutPath.startsWith('island:');
	},

	/**
	 * Get recommended strategy for error type
	 */
	getRecommendedStrategy(errorType: LayoutErrorInfo['errorType']): ErrorRecoveryStrategy {
		const strategies: Record<LayoutErrorInfo['errorType'], ErrorRecoveryStrategy> = {
			component: { type: 'fallback', maxRetries: 2 },
			loader: { type: 'retry', maxRetries: 3 },
			rendering: { type: 'fallback', maxRetries: 1 },
			island: { type: 'skip', maxRetries: 0 },
		};

		return strategies[errorType];
	},
};
