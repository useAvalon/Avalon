import type {
	LayoutContext,
	LayoutData,
	LayoutHandler,
	LayoutLoader,
	LayoutErrorInfo,
} from './layout-types.ts';

/**
 * Layout data loading error with context information
 */
export class LayoutDataLoadingError extends Error {
	constructor(message: string, public readonly layoutPath: string, public readonly originalError?: Error) {
		super(message);
		this.name = 'LayoutDataLoadingError';
	}
}

/**
 * Result of a layout data loading operation
 */
export interface LayoutDataLoadingResult {
	success: boolean;
	data: LayoutData;
	error?: LayoutDataLoadingError;
	loadingTime: number;
	layoutPath: string;
}

/**
 * Options for layout data loading
 */
export interface LayoutDataLoadingOptions {
	/**
	 * Maximum time to wait for data loading (in milliseconds)
	 */
	timeout?: number;

	/**
	 * Whether to enable parallel loading of multiple loaders
	 */
	enableParallelLoading?: boolean;

	/**
	 * Whether to continue loading other loaders if one fails
	 */
	continueOnError?: boolean;

	/**
	 * Development mode flag for enhanced error reporting
	 */
	developmentMode?: boolean;

	/**
	 * Maximum number of retry attempts for failed loaders
	 */
	maxRetries?: number;

	/**
	 * Delay between retry attempts (in milliseconds)
	 */
	retryDelay?: number;
}

/**
 * Layout data loader execution system
 * Handles parallel data loading for multiple layout loaders in the chain
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export class LayoutDataLoader {
	private readonly options: Required<LayoutDataLoadingOptions>;

	constructor(options: LayoutDataLoadingOptions = {}) {
		this.options = {
			timeout: options.timeout ?? 5000,
			enableParallelLoading: options.enableParallelLoading ?? true,
			continueOnError: options.continueOnError ?? true,
			developmentMode: options.developmentMode ?? false,
			maxRetries: options.maxRetries ?? 2,
			retryDelay: options.retryDelay ?? 1000,
		};
	}

	/**
	 * Loads data for all layout handlers in the chain
	 * Requirements: 2.1, 2.2, 2.3, 2.4
	 */
	async loadLayoutData(layoutHandlers: LayoutHandler[], context: LayoutContext): Promise<LayoutDataLoadingResult[]> {
		const handlersWithLoaders = layoutHandlers.filter(handler => handler.loader);

		if (handlersWithLoaders.length === 0) {
			return [];
		}

		if (this.options.enableParallelLoading) {
			return await this.loadDataInParallel(handlersWithLoaders, context);
		} else {
			return await this.loadDataSequentially(handlersWithLoaders, context);
		}
	}

	/**
	 * Loads data for multiple loaders in parallel with optimized batching
	 * Requirements: 2.2, 2.3, 2.4
	 */
	private async loadDataInParallel(
		handlers: LayoutHandler[],
		context: LayoutContext
	): Promise<LayoutDataLoadingResult[]> {
		// Optimize parallel loading with batching for better performance
		const batchSize = Math.min(handlers.length, 5); // Process max 5 loaders concurrently
		const results: LayoutDataLoadingResult[] = [];

		// Process handlers in batches
		for (let i = 0; i < handlers.length; i += batchSize) {
			const batch = handlers.slice(i, i + batchSize);
			const batchPromises = batch.map(handler => this.loadSingleLayoutData(handler, context));

			if (this.options.continueOnError) {
				// Use Promise.allSettled to continue even if some loaders fail
				const batchResults = await Promise.allSettled(batchPromises);
				const processedResults = batchResults.map((result, batchIndex) => {
					if (result.status === 'fulfilled') {
						return result.value;
					} else {
						// Create error result for rejected promises
						const handler = batch[batchIndex];
						const error = new LayoutDataLoadingError(
							`Layout data loading failed: ${result.reason}`,
							handler.path,
							result.reason instanceof Error ? result.reason : new Error(String(result.reason))
						);

						return {
							success: false,
							data: {},
							error,
							loadingTime: 0,
							layoutPath: handler.path,
						};
					}
				});
				results.push(...processedResults);
			} else {
				// Use Promise.all to fail fast if any loader fails
				try {
					const batchResults = await Promise.all(batchPromises);
					results.push(...batchResults);
				} catch (error) {
					// If any loader in the batch fails and continueOnError is false, stop processing
					throw error;
				}
			}
		}

		return results;
	}

	/**
	 * Loads data for multiple loaders sequentially
	 * Requirements: 2.2, 2.3, 2.4
	 */
	private async loadDataSequentially(
		handlers: LayoutHandler[],
		context: LayoutContext
	): Promise<LayoutDataLoadingResult[]> {
		const results: LayoutDataLoadingResult[] = [];

		for (const handler of handlers) {
			try {
				const result = await this.loadSingleLayoutData(handler, context);
				results.push(result);

				// If continueOnError is false and this loader failed, stop processing
				if (!this.options.continueOnError && !result.success) {
					break;
				}
			} catch (error) {
				const loadingError = new LayoutDataLoadingError(
					`Layout data loading failed: ${error instanceof Error ? error.message : String(error)}`,
					handler.path,
					error instanceof Error ? error : new Error(String(error))
				);

				const result: LayoutDataLoadingResult = {
					success: false,
					data: {},
					error: loadingError,
					loadingTime: 0,
					layoutPath: handler.path,
				};

				results.push(result);

				// If continueOnError is false, stop processing
				if (!this.options.continueOnError) {
					break;
				}
			}
		}

		return results;
	}

	/**
	 * Loads data for a single layout handler with retry logic
	 * Requirements: 2.1, 2.2, 2.5, 2.6
	 */
	private async loadSingleLayoutData(handler: LayoutHandler, context: LayoutContext): Promise<LayoutDataLoadingResult> {
		if (!handler.loader) {
			return {
				success: true,
				data: {},
				loadingTime: 0,
				layoutPath: handler.path,
			};
		}

		let lastError: Error | undefined;
		let attempt = 0;

		while (attempt <= this.options.maxRetries) {
			const startTime = performance.now();

			try {
				const data = await this.executeLoaderWithTimeout(handler.loader, context);
				const loadingTime = performance.now() - startTime;

				if (this.options.developmentMode) {
					console.log(`[Layout] Loaded data for ${handler.path} in ${loadingTime.toFixed(2)}ms`);
				}

				return {
					success: true,
					data,
					loadingTime,
					layoutPath: handler.path,
				};
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				attempt++;

				if (this.options.developmentMode) {
					console.warn(`[Layout] Data loading attempt ${attempt} failed for ${handler.path}: ${lastError.message}`);
				}

				// If this wasn't the last attempt, wait before retrying
				if (attempt <= this.options.maxRetries) {
					await this.delay(this.options.retryDelay);
				}
			}
		}

		// All attempts failed
		const loadingError = new LayoutDataLoadingError(
			`Layout data loading failed after ${this.options.maxRetries + 1} attempts: ${lastError?.message}`,
			handler.path,
			lastError
		);

		return {
			success: false,
			data: {},
			error: loadingError,
			loadingTime: 0,
			layoutPath: handler.path,
		};
	}

	/**
	 * Executes a layout loader with timeout protection
	 * Requirements: 2.1, 2.5
	 */
	private executeLoaderWithTimeout(loader: LayoutLoader, context: LayoutContext): Promise<LayoutData> {
		return new Promise<LayoutData>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error(`Layout data loading timed out after ${this.options.timeout}ms`));
			}, this.options.timeout);

			Promise.resolve(loader(context))
				.then(data => {
					clearTimeout(timeoutId);
					resolve(data);
				})
				.catch(error => {
					clearTimeout(timeoutId);
					reject(error);
				});
		});
	}

	/**
	 * Creates enhanced layout context with parent data
	 * Requirements: 2.4, 2.6
	 */
	createEnhancedContext(baseContext: LayoutContext, parentData: LayoutData[]): LayoutContext {
		// Create a new context with parent data available
		const enhancedContext: LayoutContext = {
			...baseContext,
			state: new Map(baseContext.state),
		};

		// Add parent layout data to the context state
		enhancedContext.state.set('parentLayoutData', parentData);

		return enhancedContext;
	}

	/**
	 * Processes layout data loading results and creates data array for components
	 * Requirements: 2.3, 2.4, 2.6
	 */
	processLoadingResults(
		results: LayoutDataLoadingResult[],
		layoutHandlers: LayoutHandler[]
	): { data: LayoutData[]; errors: LayoutErrorInfo[] } {
		const data: LayoutData[] = [];
		const errors: LayoutErrorInfo[] = [];

		// Create a map of layout path to result for quick lookup
		const resultMap = new Map<string, LayoutDataLoadingResult>();
		results.forEach(result => {
			resultMap.set(result.layoutPath, result);
		});

		// Process each layout handler in order
		layoutHandlers.forEach(handler => {
			const result = resultMap.get(handler.path);

			if (result) {
				if (result.success) {
					data.push(result.data);
				} else {
					// Add empty data for failed loaders to maintain array alignment
					data.push({});

					// Record the error
					if (result.error) {
						errors.push({
							layoutPath: handler.path,
							errorType: 'loader',
							timestamp: Date.now(),
						});

						if (this.options.developmentMode) {
							console.error(`[Layout] Data loading error for ${handler.path}:`, result.error);
						}
					}
				}
			} else {
				// No loader for this handler, add empty data
				data.push({});
			}
		});

		return { data, errors };
	}

	/**
	 * Creates fallback data for failed loaders
	 * Requirements: 2.5, 2.6
	 */
	createFallbackData(layoutPath: string, error: LayoutDataLoadingError): LayoutData {
		return {
			__layoutError: true,
			__layoutPath: layoutPath,
			__errorMessage: error.message,
			__errorType: 'data-loading',
			__timestamp: Date.now(),
		};
	}

	/**
	 * Validates layout data structure
	 * Requirements: 2.1, 2.3
	 */
	validateLayoutData(data: unknown, layoutPath: string): LayoutData {
		if (data === null || data === undefined) {
			return {};
		}

		if (typeof data !== 'object') {
			throw new LayoutDataLoadingError(`Layout loader must return an object, got ${typeof data}`, layoutPath);
		}

		// Ensure it's a plain object
		if (Array.isArray(data)) {
			throw new LayoutDataLoadingError('Layout loader must return an object, not an array', layoutPath);
		}

		return data as LayoutData;
	}

	/**
	 * Utility method to create a delay
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Preload data for layouts that are likely to be needed soon
	 * Requirements: 2.1, 2.2
	 */
	async preloadLayoutData(
		layoutHandlers: LayoutHandler[],
		context: LayoutContext,
		priority: 'high' | 'medium' | 'low' = 'medium'
	): Promise<void> {
		// Only preload if we have loaders
		const handlersWithLoaders = layoutHandlers.filter(handler => handler.loader);
		if (handlersWithLoaders.length === 0) return;

		// Adjust timeout based on priority
		const originalTimeout = this.options.timeout;
		switch (priority) {
			case 'high':
				this.options.timeout = originalTimeout * 0.5; // Faster timeout for high priority
				break;
			case 'low':
				this.options.timeout = originalTimeout * 2; // Longer timeout for low priority
				break;
			// medium uses default timeout
		}

		try {
			// Load data in background without blocking
			const results = await this.loadDataInParallel(handlersWithLoaders, context);

			if (this.options.developmentMode) {
				const successCount = results.filter(r => r.success).length;
				console.log(`[LayoutDataLoader] Preloaded ${successCount}/${results.length} layouts (priority: ${priority})`);
			}
		} catch (error) {
			if (this.options.developmentMode) {
				console.warn('[LayoutDataLoader] Preload failed:', error);
			}
		} finally {
			// Restore original timeout
			this.options.timeout = originalTimeout;
		}
	}

	/**
	 * Gets current loading options
	 */
	getOptions(): Required<LayoutDataLoadingOptions> {
		return { ...this.options };
	}

	/**
	 * Updates loading options
	 */
	updateOptions(options: Partial<LayoutDataLoadingOptions>): void {
		Object.assign(this.options, options);
	}
}

/**
 * Default layout data loader instance
 */
export const defaultLayoutDataLoader = new LayoutDataLoader();

/**
 * Utility function to create a layout data loader with specific options
 */
export function createLayoutDataLoader(options: LayoutDataLoadingOptions = {}): LayoutDataLoader {
	return new LayoutDataLoader(options);
}

/**
 * Utility function to load data for a single layout
 * Requirements: 2.1, 2.2
 */
export async function loadSingleLayoutData(
	handler: LayoutHandler,
	context: LayoutContext,
	options: LayoutDataLoadingOptions = {}
): Promise<LayoutDataLoadingResult> {
	const loader = new LayoutDataLoader(options);
	const results = await loader.loadLayoutData([handler], context);
	return (
		results[0] || {
			success: true,
			data: {},
			loadingTime: 0,
			layoutPath: handler.path,
		}
	);
}

/**
 * Utility function to merge layout data from multiple sources
 * Requirements: 2.4, 2.6
 */
export function mergeLayoutData(...dataSources: LayoutData[]): LayoutData {
	const merged: LayoutData = {};

	for (const data of dataSources) {
		if (data && typeof data === 'object' && !Array.isArray(data)) {
			Object.assign(merged, data);
		}
	}

	return merged;
}

/**
 * Utility function to extract parent data from context
 * Requirements: 2.4, 2.6
 */
export function getParentLayoutData(context: LayoutContext): LayoutData[] {
	const parentData = context.state.get('parentLayoutData');
	return Array.isArray(parentData) ? parentData : [];
}
