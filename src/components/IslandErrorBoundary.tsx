import { Component, ComponentChildren, ComponentType } from 'preact';
import { LayoutErrorInfo } from '../types/layout.ts';
import { layoutErrorLogger } from '../core/layout/layout-error-logger.ts';

export interface IslandErrorBoundaryProps {
	children: ComponentChildren;
	islandId: string;
	onError?: (error: Error, errorInfo: LayoutErrorInfo) => void;
	fallback?: (error: Error, islandId: string) => ComponentChildren;
	isolateError?: boolean; // If true, error won't propagate to parent
}

export interface IslandErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: LayoutErrorInfo | null;
}

/**
 * Specialized error boundary for island components
 * Provides error isolation to prevent island errors from affecting the main layout
 */
export class IslandErrorBoundary extends Component<IslandErrorBoundaryProps, IslandErrorBoundaryState> {
	private errorId: string | null = null;

	constructor(props: IslandErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static override getDerivedStateFromError(error: Error): Partial<IslandErrorBoundaryState> {
		return {
			hasError: true,
			error,
		};
	}

	override componentDidCatch(error: Error, errorInfo: any): void {
		const layoutErrorInfo: LayoutErrorInfo = {
			layoutPath: `island:${this.props.islandId}`,
			errorType: 'island',
			timestamp: Date.now(),
			componentStack: errorInfo.componentStack,
			errorBoundary: 'IslandErrorBoundary',
		};

		this.setState({
			errorInfo: layoutErrorInfo,
		});

		// Log the error
		this.errorId = layoutErrorLogger.logError(
			error,
			layoutErrorInfo,
			{ type: 'skip', maxRetries: 0 }, // Islands typically use skip strategy
			{
				url: window.location.href,
				userAgent: navigator.userAgent,
				referer: document.referrer,
			}
		);

		// Call onError callback if provided
		if (this.props.onError) {
			this.props.onError(error, layoutErrorInfo);
		}

		// Log to console in development
		if (typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development') {
			console.error(`Island Error [${this.props.islandId}]:`, error);
			console.error('Error Info:', layoutErrorInfo);
		}

		// If isolateError is false, re-throw to propagate to parent
		if (!this.props.isolateError) {
			throw error;
		}
	}

	private handleRemoveIsland = (): void => {
		// Mark error as resolved by removing the island
		if (this.errorId) {
			layoutErrorLogger.markResolved(this.errorId);
		}

		// Remove the island from DOM
		const islandElement = document.querySelector(`[data-island-id="${this.props.islandId}"]`);
		if (islandElement) {
			islandElement.remove();
		}
	};

	private handleReloadIsland = (): void => {
		// Attempt to reload the island by resetting state
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});

		// Mark as resolved
		if (this.errorId) {
			layoutErrorLogger.markResolved(this.errorId);
		}
	};

	private renderFallback(): ComponentChildren {
		const { error } = this.state;
		const { fallback, islandId } = this.props;

		if (fallback && error) {
			return fallback(error, islandId);
		}

		// Default island error UI
		const isDevelopment = typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development';

		return (
			<div class="island-error-boundary" data-island-error={islandId}>
				<div class="island-error-container">
					<div class="island-error-header">
						<span class="island-error-icon">⚠️</span>
						<span class="island-error-title">Island Error</span>
					</div>

					<p class="island-error-message">
						An error occurred in island "{islandId}". The rest of the page should work normally.
					</p>

					<div class="island-error-actions">
						<button onClick={this.handleReloadIsland} class="island-reload-button">
							Reload Island
						</button>
						<button onClick={this.handleRemoveIsland} class="island-remove-button">
							Remove Island
						</button>
					</div>

					{isDevelopment && error && (
						<details class="island-error-details">
							<summary>Error Details (Development)</summary>
							<div class="island-error-info">
								<p>
									<strong>Island ID:</strong> {islandId}
								</p>
								<p>
									<strong>Error:</strong> {error.message}
								</p>
								{this.errorId && (
									<p>
										<strong>Error ID:</strong> {this.errorId}
									</p>
								)}
							</div>
							<pre class="island-error-stack">{error.stack}</pre>
						</details>
					)}
				</div>
			</div>
		);
	}

	render() {
		if (this.state.hasError) {
			return this.renderFallback();
		}

		return this.props.children;
	}
}

/**
 * Higher-order component to wrap islands with error boundaries
 */
export function withIslandErrorBoundary<P extends object>(
	WrappedComponent: ComponentType<P>,
	islandId: string,
	options?: {
		fallback?: (error: Error, islandId: string) => ComponentChildren;
		isolateError?: boolean;
		onError?: (error: Error, errorInfo: LayoutErrorInfo) => void;
	}
) {
	return function IslandWithErrorBoundary(props: P) {
		return (
			<IslandErrorBoundary
				islandId={islandId}
				fallback={options?.fallback}
				isolateError={options?.isolateError ?? true}
				onError={options?.onError}>
				<WrappedComponent {...props} />
			</IslandErrorBoundary>
		);
	};
}
