import type {
	MiddlewareContext,
	MiddlewareResponse,
	MiddlewareHandler,
	MiddlewareExecutionResult,
	MiddlewareConfig,
	MiddlewareErrorHandler,
} from '../../schemas/middleware.ts';
import {
	createDefaultErrorHandler,
	withErrorHandling,
	MiddlewareError,
	MiddlewareErrorType,
} from './middleware-error-handler.ts';

/**
 * MiddlewareExecutor class handles middleware chain execution
 * Requirements: 4.4, 4.5, 7.1, 7.2, 7.3
 */
export class MiddlewareExecutor {
	private config: MiddlewareConfig;
	private errorHandler: MiddlewareErrorHandler;

	constructor(config: MiddlewareConfig = {}) {
		this.config = {
			developmentMode: false,
			enableLogging: false,
			maxExecutionTime: 30000, // 30 seconds default
			...config,
		};
		this.errorHandler = config.errorHandler || createDefaultErrorHandler(this.config.developmentMode || false);
	}

	/**
	 * Execute a middleware chain with the given context
	 * Requirements: 4.4, 4.5 (context passing and early termination)
	 */
	async execute(middlewareChain: MiddlewareHandler[], context: MiddlewareContext): Promise<MiddlewareExecutionResult> {
		const startTime = Date.now();
		let middlewareExecuted = 0;
		let earlyTermination = false;
		let finalResponse: Response | undefined;
		let executionError: Error | undefined;
		let timeoutId: number | undefined;

		if (this.config.enableLogging) {
			console.log(`Executing middleware chain with ${middlewareChain.length} middleware`);
		}

		try {
			// Create execution timeout if configured
			const timeoutPromise = this.config.maxExecutionTime
				? new Promise<never>((_, reject) => {
						timeoutId = setTimeout(
							() => reject(new Error('Middleware execution timeout')),
							this.config.maxExecutionTime
						);
				  })
				: null;

			// Execute middleware chain
			const executionPromise = this.executeChain(middlewareChain, context, executed => {
				middlewareExecuted = executed;
			});

			// Race between execution and timeout
			const result = timeoutPromise ? await Promise.race([executionPromise, timeoutPromise]) : await executionPromise;

			// Clear timeout if it was set
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}

			finalResponse = result.response;
			earlyTermination = result.earlyTermination;
		} catch (error) {
			// Clear timeout if it was set
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}

			executionError = error as Error;

			// Handle chain-level errors
			const mockChain = {
				global: middlewareChain,
				scoped: [],
				route: context.url.pathname,
				totalMiddleware: middlewareChain.length,
			};
			finalResponse = this.errorHandler.handleChainError(error as Error, mockChain);
		}

		const executionTime = Date.now() - startTime;

		return {
			response: finalResponse,
			context,
			metadata: {
				middlewareExecuted,
				executionTime,
				earlyTermination,
				error: executionError,
			},
		};
	}

	/**
	 * Execute the middleware chain iteratively
	 * Requirements: 7.1, 7.2, 7.3 (sync/async support)
	 */
	private async executeChain(
		middlewareChain: MiddlewareHandler[],
		context: MiddlewareContext,
		onProgress: (executed: number) => void
	) {
		if (middlewareChain.length === 0) {
			return { earlyTermination: false };
		}

		let executedCount = 0;

		// Build the chain from the end backwards
		const buildChain = (index: number): (() => Promise<MiddlewareResponse>) => {
			if (index >= middlewareChain.length) {
				// End of chain - return continue: true
				return () => Promise.resolve({ continue: true });
			}

			const currentMiddleware = middlewareChain[index];
			const nextFunction = buildChain(index + 1);

			return async () => {
				if (this.config.enableLogging) {
					console.log(`Executing middleware ${index + 1}/${middlewareChain.length}`);
				}

				const result = await withErrorHandling(
					() => this.executeMiddleware(currentMiddleware, context, nextFunction),
					this.errorHandler,
					`middleware-${index}`,
					context
				);

				executedCount++;
				onProgress(executedCount);

				// If error handling returned a Response, treat it as early termination
				if (result instanceof Response) {
					return {
						response: result,
						continue: false,
					};
				}

				return result as MiddlewareResponse;
			};
		};

		// Start execution from the first middleware
		const firstMiddleware = buildChain(0);
		const result = await firstMiddleware();

		return {
			response: result.response,
			earlyTermination: !!result.response || !result.continue,
		};
	}

	/**
	 * Execute a single middleware with proper error handling
	 * Requirements: 7.1, 7.2 (async/sync support)
	 */
	private async executeMiddleware(
		middleware: MiddlewareHandler,
		context: MiddlewareContext,
		next: () => Promise<MiddlewareResponse>
	) {
		// Ensure middleware is a function
		if (typeof middleware !== 'function') {
			throw new MiddlewareError('Middleware must be a function', MiddlewareErrorType.VALIDATION_ERROR);
		}

		// Execute middleware - it can be sync or async
		const result = await middleware(context, next);

		// Validate the result
		if (!result || typeof result !== 'object') {
			throw new MiddlewareError(
				'Middleware must return a MiddlewareResponse object',
				MiddlewareErrorType.VALIDATION_ERROR
			);
		}

		if (typeof result.continue !== 'boolean') {
			throw new MiddlewareError(
				'Middleware response must include a boolean "continue" property',
				MiddlewareErrorType.VALIDATION_ERROR
			);
		}

		// If middleware returns a response, validate it
		if (result.response && !(result.response instanceof Response)) {
			throw new MiddlewareError('Middleware response must be a Response object', MiddlewareErrorType.VALIDATION_ERROR);
		}

		return result;
	}

	/**
	 * Create a default middleware context
	 * Requirements: 4.1, 4.2 (context creation)
	 */
	static createContext(request: Request): MiddlewareContext {
		const url = new URL(request.url);

		return {
			request,
			url,
			params: {},
			query: Object.fromEntries(url.searchParams),
			state: new Map(),
			locals: {},
		};
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<MiddlewareConfig>) {
		this.config = { ...this.config, ...config };
		if (config.errorHandler) {
			this.errorHandler = config.errorHandler;
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig() {
		return { ...this.config };
	}
}
