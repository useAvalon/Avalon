import type { MiddlewareErrorHandler, MiddlewareContext, MiddlewareChain } from '../../schemas/middleware.ts';

/**
 * Middleware error types for categorization
 */
export enum MiddlewareErrorType {
	DISCOVERY_ERROR = 'DISCOVERY_ERROR',
	EXECUTION_ERROR = 'EXECUTION_ERROR',
	CHAIN_ERROR = 'CHAIN_ERROR',
	TIMEOUT_ERROR = 'TIMEOUT_ERROR',
	VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Enhanced error class for middleware-specific errors
 */
export class MiddlewareError extends Error {
	public readonly type: MiddlewareErrorType;
	public readonly middlewarePath?: string;
	public readonly context?: MiddlewareContext;
	public readonly timestamp: Date;

	constructor(
		message: string,
		type: MiddlewareErrorType,
		middlewarePath?: string,
		context?: MiddlewareContext,
		cause?: Error
	) {
		super(message);
		this.name = 'MiddlewareError';
		this.type = type;
		this.middlewarePath = middlewarePath;
		this.context = context;
		this.timestamp = new Date();
		this.cause = cause;
	}
}

/**
 * Configuration for middleware error handling
 */
export interface MiddlewareErrorHandlerConfig {
	/** Enable development mode with detailed error messages */
	developmentMode: boolean;
	/** Enable detailed logging */
	enableLogging: boolean;
	/** Custom logger function */
	logger?: (level: 'error' | 'warn' | 'info', message: string, data?: unknown) => void;
	/** Maximum stack trace depth to include in errors */
	maxStackDepth?: number;
}

/**
 * Default middleware error handler implementation
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export class DefaultMiddlewareErrorHandler implements MiddlewareErrorHandler {
	private config: MiddlewareErrorHandlerConfig;

	constructor(config: MiddlewareErrorHandlerConfig) {
		this.config = config;
	}

	/**
	 * Handle discovery errors (file system access issues, invalid middleware files)
	 * Requirements: 6.1, 6.4
	 */
	handleDiscoveryError(error: Error, filePath: string): void {
		const middlewareError = new MiddlewareError(
			`Failed to discover middleware at ${filePath}: ${error.message}`,
			MiddlewareErrorType.DISCOVERY_ERROR,
			filePath,
			undefined,
			error
		);

		this.logError('error', 'Middleware discovery failed', {
			filePath,
			error: error.message,
			stack: this.config.developmentMode ? error.stack : undefined,
		});

		if (this.config.developmentMode) {
			// In development, throw the error to stop the server
			throw middlewareError;
		} else {
			// In production, log the error but continue without the middleware
			this.logError('warn', 'Skipping middleware due to discovery error', { filePath });
		}
	}

	/**
	 * Handle execution errors (runtime errors in middleware functions)
	 * Requirements: 6.1, 6.2, 6.3
	 */
	handleExecutionError(error: Error, middleware: string, context: MiddlewareContext): Response {
		const middlewareError = new MiddlewareError(
			`Middleware execution failed in ${middleware}: ${error.message}`,
			MiddlewareErrorType.EXECUTION_ERROR,
			middleware,
			context,
			error
		);

		this.logError('error', 'Middleware execution error', {
			middleware,
			url: context.url.pathname,
			method: context.request.method,
			error: error.message,
			stack: this.config.developmentMode ? error.stack : undefined,
		});

		if (this.config.developmentMode) {
			// Development mode: return detailed error response
			return this.createDevelopmentErrorResponse(middlewareError);
		} else {
			// Production mode: return generic error response
			return this.createProductionErrorResponse(middlewareError);
		}
	}

	/**
	 * Handle chain errors (broken middleware chains, infinite loops)
	 * Requirements: 6.1, 6.2, 6.3
	 */
	handleChainError(error: Error, chain: MiddlewareChain): Response {
		const middlewareError = new MiddlewareError(
			`Middleware chain error for route ${chain.route}: ${error.message}`,
			MiddlewareErrorType.CHAIN_ERROR,
			undefined,
			undefined,
			error
		);

		this.logError('error', 'Middleware chain error', {
			route: chain.route,
			totalMiddleware: chain.totalMiddleware,
			globalCount: chain.global.length,
			scopedCount: chain.scoped.length,
			error: error.message,
			stack: this.config.developmentMode ? error.stack : undefined,
		});

		if (this.config.developmentMode) {
			return this.createDevelopmentErrorResponse(middlewareError);
		} else {
			return this.createProductionErrorResponse(middlewareError);
		}
	}

	/**
	 * Handle timeout errors during middleware execution
	 */
	handleTimeoutError(middleware: string, context: MiddlewareContext, timeoutMs: number): Response {
		const middlewareError = new MiddlewareError(
			`Middleware ${middleware} timed out after ${timeoutMs}ms`,
			MiddlewareErrorType.TIMEOUT_ERROR,
			middleware,
			context
		);

		this.logError('error', 'Middleware timeout', {
			middleware,
			url: context.url.pathname,
			timeoutMs,
		});

		if (this.config.developmentMode) {
			return this.createDevelopmentErrorResponse(middlewareError);
		} else {
			return this.createProductionErrorResponse(middlewareError);
		}
	}

	/**
	 * Handle validation errors in middleware context or responses
	 */
	handleValidationError(error: Error, middleware: string, context: MiddlewareContext): Response {
		const middlewareError = new MiddlewareError(
			`Validation error in middleware ${middleware}: ${error.message}`,
			MiddlewareErrorType.VALIDATION_ERROR,
			middleware,
			context,
			error
		);

		this.logError('error', 'Middleware validation error', {
			middleware,
			url: context.url.pathname,
			error: error.message,
		});

		if (this.config.developmentMode) {
			return this.createDevelopmentErrorResponse(middlewareError);
		} else {
			return this.createProductionErrorResponse(middlewareError);
		}
	}

	/**
	 * Create detailed error response for development mode
	 * Requirements: 6.3
	 */
	private createDevelopmentErrorResponse(error: MiddlewareError): Response {
		const errorDetails = {
			error: 'Middleware Error',
			type: error.type,
			message: error.message,
			middleware: error.middlewarePath,
			timestamp: error.timestamp.toISOString(),
			stack: error.stack,
			cause:
				error.cause && error.cause instanceof Error
					? {
							message: error.cause.message,
							stack: error.cause.stack,
					  }
					: undefined,
			context: error.context
				? {
						url: error.context.url.pathname,
						method: error.context.request.method,
						params: error.context.params,
						query: error.context.query,
				  }
				: undefined,
		};

		return new Response(JSON.stringify(errorDetails, null, 2), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
				'X-Middleware-Error': error.type,
			},
		});
	}

	/**
	 * Create generic error response for production mode
	 * Requirements: 6.2
	 */
	private createProductionErrorResponse(_error: MiddlewareError): Response {
		// For backward compatibility, return simple text response
		return new Response('Internal Server Error', { status: 500 });
	}

	/**
	 * Log error with appropriate level and details
	 * Requirements: 6.4
	 */
	private logError(level: 'error' | 'warn' | 'info', message: string, data?: unknown): void {
		if (!this.config.enableLogging) {
			return;
		}

		if (this.config.logger) {
			this.config.logger(level, message, data);
		} else {
			// Default console logging
			const logData = data ? ` - ${JSON.stringify(data)}` : '';
			console[level](`[Middleware ${level.toUpperCase()}] ${message}${logData}`);
		}
	}

	/**
	 * Generate unique error ID for tracking
	 */
	private generateErrorId(error: MiddlewareError): string {
		const timestamp = error.timestamp.getTime().toString(36);
		const hash = this.simpleHash(error.message + (error.middlewarePath || ''));
		return `mw-${timestamp}-${hash}`;
	}

	/**
	 * Simple hash function for error ID generation
	 */
	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}
}

/**
 * Create default middleware error handler with sensible defaults
 */
export function createDefaultErrorHandler(developmentMode = false): DefaultMiddlewareErrorHandler {
	return new DefaultMiddlewareErrorHandler({
		developmentMode,
		enableLogging: true,
		maxStackDepth: 10,
	});
}

/**
 * Utility function to wrap middleware execution with error handling
 */
export async function withErrorHandling<T>(
	operation: () => Promise<T>,
	errorHandler: MiddlewareErrorHandler,
	middleware: string,
	context?: MiddlewareContext
): Promise<T | Response> {
	try {
		return await operation();
	} catch (error) {
		if (error instanceof Error) {
			if (context) {
				return errorHandler.handleExecutionError(error, middleware, context);
			} else {
				// Discovery error
				errorHandler.handleDiscoveryError(error, middleware);
				throw error;
			}
		}
		throw error;
	}
}
