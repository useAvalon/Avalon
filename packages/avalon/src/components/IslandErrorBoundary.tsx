import { Component, ComponentChildren, ComponentType } from 'preact';
import type { LayoutErrorInfo } from '../types/layout.ts';

export interface IslandErrorBoundaryProps {
	children: ComponentChildren;
	islandId: string;
	onError?: (error: Error, errorInfo: LayoutErrorInfo) => void;
	fallback?: (error: Error, islandId: string) => ComponentChildren;
	isolateError?: boolean;
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
	constructor(props: IslandErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null, errorInfo: null };
	}

	static override getDerivedStateFromError(error: Error): Partial<IslandErrorBoundaryState> {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: { componentStack?: string }): void {
		const layoutErrorInfo: LayoutErrorInfo = {
			layoutPath: `island:${this.props.islandId}`,
			errorType: 'island',
			timestamp: Date.now(),
			componentStack: errorInfo.componentStack,
			errorBoundary: 'IslandErrorBoundary',
		};

		this.setState({ errorInfo: layoutErrorInfo });

		if (this.props.onError) {
			this.props.onError(error, layoutErrorInfo);
		}

		const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
		if (isDevelopment) {
			console.error(`Island Error [${this.props.islandId}]:`, error);
		}

		if (!this.props.isolateError) {
			throw error;
		}
	}

	private handleRemoveIsland = (): void => {
		const islandElement = document.querySelector(`[data-island-id="${this.props.islandId}"]`);
		if (islandElement) {
			islandElement.remove();
		}
	};

	private handleReloadIsland = (): void => {
		this.setState({ hasError: false, error: null, errorInfo: null });
	};

	private renderFallback(): ComponentChildren {
		const { error } = this.state;
		const { fallback, islandId } = this.props;

		if (fallback && error) {
			return fallback(error, islandId);
		}

		const isDevelopment = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

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
	},
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
