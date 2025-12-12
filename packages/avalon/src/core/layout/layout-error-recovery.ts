import { LayoutContext, LayoutErrorInfo, ErrorRecoveryStrategy } from '../../types/layout.ts';

export class LayoutErrorRecovery {
	private strategies = new Map<string, ErrorRecoveryStrategy>();
	private defaultStrategies: Map<string, ErrorRecoveryStrategy>;

	constructor() {
		this.defaultStrategies = new Map([
			[
				'component',
				{
					type: 'fallback',
					maxRetries: 3,
				},
			],
			[
				'loader',
				{
					type: 'retry',
					maxRetries: 2,
				},
			],
			[
				'rendering',
				{
					type: 'fallback',
					maxRetries: 1,
				},
			],
			[
				'island',
				{
					type: 'skip',
					maxRetries: 0,
				},
			],
		]);
	}

	/**
	 * Handle a layout error and return appropriate response
	 */
	async handleLayoutError(error: Error, context: LayoutContext, errorInfo?: LayoutErrorInfo): Promise<Response> {
		const strategy = this.determineRecoveryStrategy(error, errorInfo);

		// Log error for debugging
		this.logError(error, errorInfo, strategy);

		return await this.executeRecovery(strategy, error, context, errorInfo);
	}

	/**
	 * Register a custom error recovery strategy
	 */
	registerStrategy(errorType: string, strategy: ErrorRecoveryStrategy): void {
		this.strategies.set(errorType, strategy);
	}

	/**
	 * Get recovery strategy for an error
	 */
	getStrategy(error: Error, errorInfo?: LayoutErrorInfo): ErrorRecoveryStrategy | null {
		const errorType = errorInfo?.errorType || this.inferErrorType(error);
		return this.strategies.get(errorType) || this.defaultStrategies.get(errorType) || null;
	}

	/**
	 * Determine the appropriate recovery strategy for an error
	 */
	private determineRecoveryStrategy(error: Error, errorInfo?: LayoutErrorInfo): ErrorRecoveryStrategy {
		const errorType = errorInfo?.errorType || this.inferErrorType(error);

		// Check for custom strategy first
		const customStrategy = this.strategies.get(errorType);
		if (customStrategy) {
			return customStrategy;
		}

		// Use default strategy
		const defaultStrategy = this.defaultStrategies.get(errorType);
		if (defaultStrategy) {
			return defaultStrategy;
		}

		// Fallback strategy
		return {
			type: 'fallback',
			maxRetries: 1,
		};
	}

	/**
	 * Execute the recovery strategy
	 */
	private async executeRecovery(
		strategy: ErrorRecoveryStrategy,
		error: Error,
		context: LayoutContext,
		errorInfo?: LayoutErrorInfo
	): Promise<Response> {
		switch (strategy.type) {
			case 'retry':
				return this.handleRetryStrategy(strategy, error, context, errorInfo);

			case 'fallback':
				return this.handleFallbackStrategy(strategy, error, context, errorInfo);

			case 'skip':
				return this.handleSkipStrategy(strategy, error, context, errorInfo);

			case 'redirect':
				return this.handleRedirectStrategy(strategy, error, context, errorInfo);

			default:
				return this.handleFallbackStrategy(strategy, error, context, errorInfo);
		}
	}

	/**
	 * Handle retry recovery strategy
	 */
	private async handleRetryStrategy(
		strategy: ErrorRecoveryStrategy,
		error: Error,
		context: LayoutContext,
		errorInfo?: LayoutErrorInfo
	): Promise<Response> {
		// For retry strategy, we return a response that indicates retry should be attempted
		// The actual retry logic is handled by the error boundary component
		const retryHtml = this.generateRetryHtml(error, strategy, errorInfo);

		return new Response(retryHtml, {
			status: 500,
			headers: {
				'Content-Type': 'text/html',
				'X-Layout-Error': 'retry',
				'X-Max-Retries': strategy.maxRetries?.toString() || '3',
			},
		});
	}

	/**
	 * Handle fallback recovery strategy
	 */
	private async handleFallbackStrategy(
		strategy: ErrorRecoveryStrategy,
		error: Error,
		context: LayoutContext,
		errorInfo?: LayoutErrorInfo
	): Promise<Response> {
		let fallbackHtml: string;

		if (strategy.fallbackComponent) {
			// Render custom fallback component
			try {
				// This would need to be implemented with the actual rendering system
				fallbackHtml = await this.renderFallbackComponent(strategy.fallbackComponent, error, context);
			} catch (fallbackError) {
				fallbackHtml = this.generateDefaultFallbackHtml(error, errorInfo);
			}
		} else {
			fallbackHtml = this.generateDefaultFallbackHtml(error, errorInfo);
		}

		return new Response(fallbackHtml, {
			status: 500,
			headers: {
				'Content-Type': 'text/html',
				'X-Layout-Error': 'fallback',
			},
		});
	}

	/**
	 * Handle skip recovery strategy
	 */
	private async handleSkipStrategy(
		strategy: ErrorRecoveryStrategy,
		error: Error,
		context: LayoutContext,
		errorInfo?: LayoutErrorInfo
	): Promise<Response> {
		// For skip strategy, we continue with parent layout or minimal rendering
		const skipHtml = this.generateSkipHtml(error, errorInfo);

		return new Response(skipHtml, {
			status: 200, // Continue with degraded functionality
			headers: {
				'Content-Type': 'text/html',
				'X-Layout-Error': 'skip',
				'X-Layout-Skipped': errorInfo?.layoutPath || 'unknown',
			},
		});
	}

	/**
	 * Handle redirect recovery strategy
	 */
	private async handleRedirectStrategy(
		strategy: ErrorRecoveryStrategy,
		error: Error,
		context: LayoutContext,
		errorInfo?: LayoutErrorInfo
	): Promise<Response> {
		const redirectUrl = strategy.redirectUrl || '/error';

		return new Response(null, {
			status: 302,
			headers: {
				Location: redirectUrl,
				'X-Layout-Error': 'redirect',
				'X-Original-Error': error.message,
			},
		});
	}

	/**
	 * Infer error type from error object
	 */
	private inferErrorType(error: Error): string {
		const message = error.message.toLowerCase();
		const stack = error.stack?.toLowerCase() || '';

		if (message.includes('loader') || message.includes('data')) {
			return 'loader';
		}

		if (message.includes('render') || stack.includes('render')) {
			return 'rendering';
		}

		if (message.includes('island') || stack.includes('island')) {
			return 'island';
		}

		return 'component';
	}

	/**
	 * Log error for debugging
	 */
	private logError(error: Error, errorInfo?: LayoutErrorInfo, strategy?: ErrorRecoveryStrategy): void {
		if (typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development') {
			console.error('Layout Error Recovery:', {
				error: error.message,
				stack: error.stack,
				errorInfo,
				strategy,
				timestamp: new Date().toISOString(),
			});
		}
	}

	/**
	 * Generate retry HTML
	 */
	private generateRetryHtml(error: Error, strategy: ErrorRecoveryStrategy, errorInfo?: LayoutErrorInfo): string {
		const maxRetries = strategy.maxRetries || 3;
		const isDevelopment = typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development';

		return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Layout Error - Retry Available</title>
          <style>
            .error-container { 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px; 
              font-family: system-ui, sans-serif;
              border: 1px solid #e1e5e9;
              border-radius: 8px;
            }
            .retry-button { 
              background: #0066cc; 
              color: white; 
              border: none; 
              padding: 10px 20px; 
              border-radius: 4px; 
              cursor: pointer; 
              margin: 10px 0;
            }
            .retry-button:hover { background: #0052a3; }
            .error-details { margin-top: 20px; }
            .error-details summary { cursor: pointer; margin-bottom: 10px; }
            .error-details pre { 
              background: #f6f8fa; 
              padding: 10px; 
              border-radius: 4px; 
              overflow-x: auto; 
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h2>Layout Error Occurred</h2>
            <p>An error occurred while loading the layout. You can try again.</p>
            <button class="retry-button" onclick="window.location.reload()">
              Retry (${maxRetries} attempts available)
            </button>
            ${
							isDevelopment
								? `
              <details class="error-details">
                <summary>Error Details (Development)</summary>
                <p><strong>Error:</strong> ${error.message}</p>
                ${
									errorInfo
										? `
                  <p><strong>Layout Path:</strong> ${errorInfo.layoutPath}</p>
                  <p><strong>Error Type:</strong> ${errorInfo.errorType}</p>
                  <p><strong>Timestamp:</strong> ${new Date(errorInfo.timestamp).toISOString()}</p>
                `
										: ''
								}
                <pre>${error.stack || 'No stack trace available'}</pre>
              </details>
            `
								: ''
						}
          </div>
        </body>
      </html>
    `;
	}

	/**
	 * Generate default fallback HTML
	 */
	private generateDefaultFallbackHtml(error: Error, errorInfo?: LayoutErrorInfo): string {
		const isDevelopment = typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development';

		return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Layout Error</title>
          <style>
            .error-container { 
              max-width: 600px; 
              margin: 50px auto; 
              padding: 20px; 
              font-family: system-ui, sans-serif;
              border: 1px solid #e1e5e9;
              border-radius: 8px;
            }
            .error-details { margin-top: 20px; }
            .error-details summary { cursor: pointer; margin-bottom: 10px; }
            .error-details pre { 
              background: #f6f8fa; 
              padding: 10px; 
              border-radius: 4px; 
              overflow-x: auto; 
              font-size: 12px;
            }
            .back-button {
              background: #6c757d;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              margin: 10px 0;
              text-decoration: none;
              display: inline-block;
            }
            .back-button:hover { background: #5a6268; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h2>Something went wrong</h2>
            <p>An error occurred while rendering this layout. Please try refreshing the page or go back.</p>
            <a href="javascript:history.back()" class="back-button">Go Back</a>
            <button class="back-button" onclick="window.location.reload()">Refresh Page</button>
            ${
							isDevelopment
								? `
              <details class="error-details">
                <summary>Error Details (Development)</summary>
                <p><strong>Error:</strong> ${error.message}</p>
                ${
									errorInfo
										? `
                  <p><strong>Layout Path:</strong> ${errorInfo.layoutPath}</p>
                  <p><strong>Error Type:</strong> ${errorInfo.errorType}</p>
                  <p><strong>Timestamp:</strong> ${new Date(errorInfo.timestamp).toISOString()}</p>
                `
										: ''
								}
                <pre>${error.stack || 'No stack trace available'}</pre>
              </details>
            `
								: ''
						}
          </div>
        </body>
      </html>
    `;
	}

	/**
	 * Generate skip HTML (minimal content)
	 */
	private generateSkipHtml(error: Error, errorInfo?: LayoutErrorInfo): string {
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Layout Partially Loaded</title>
          <style>
            .skip-notice { 
              background: #fff3cd; 
              border: 1px solid #ffeaa7; 
              color: #856404; 
              padding: 10px; 
              margin: 10px 0; 
              border-radius: 4px;
              font-family: system-ui, sans-serif;
            }
          </style>
        </head>
        <body>
          <div class="skip-notice">
            <strong>Notice:</strong> Some layout components could not be loaded, but the page is still functional.
          </div>
          <!-- Main content would be rendered here -->
        </body>
      </html>
    `;
	}

	/**
	 * Render fallback component (placeholder implementation)
	 */
	private async renderFallbackComponent(fallbackComponent: any, error: Error, context: LayoutContext): Promise<string> {
		// This would need to integrate with the actual rendering system
		// For now, return a placeholder
		return `
      <div class="fallback-component">
        <h3>Custom Error Fallback</h3>
        <p>A custom fallback component would be rendered here.</p>
        <p>Error: ${error.message}</p>
      </div>
    `;
	}
}
