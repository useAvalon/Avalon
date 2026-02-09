import { Component, ComponentChildren } from 'preact';
import type { LayoutErrorInfo, ErrorRecoveryStrategy } from '../types/layout.ts';

export interface LayoutErrorBoundaryProps {
	children: ComponentChildren;
	fallback?: (error: Error, retry: () => void) => ComponentChildren;
	onError?: (error: Error, errorInfo: LayoutErrorInfo) => void;
	recoveryStrategy?: ErrorRecoveryStrategy;
	layoutPath?: string;
	errorType?: 'component' | 'loader' | 'rendering' | 'island';
}

export interface LayoutErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: LayoutErrorInfo | null;
	retryCount: number;
}

export class LayoutErrorBoundary extends Component<LayoutErrorBoundaryProps, LayoutErrorBoundaryState> {
	private maxRetries = 3;

	constructor(props: LayoutErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			retryCount: 0,
		};
	}

	static override getDerivedStateFromError(error: Error): Partial<LayoutErrorBoundaryState> {
		return {
			hasError: true,
			error,
		};
	}

	override componentDidCatch(error: Error, errorInfo: any): void {
		const layoutErrorInfo: LayoutErrorInfo = {
			layoutPath: this.props.layoutPath || 'unknown',
			errorType: this.props.errorType || 'component',
			timestamp: Date.now(),
			componentStack: errorInfo.componentStack,
			errorBoundary: this.constructor.name,
		};

		this.setState({
			errorInfo: layoutErrorInfo,
		});

		// Call onError callback if provided
		if (this.props.onError) {
			this.props.onError(error, layoutErrorInfo);
		}

		// Log error in development mode
		if (typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development') {
			console.error('Layout Error Boundary caught an error:', error);
			console.error('Error Info:', layoutErrorInfo);
			console.error('Component Stack:', errorInfo.componentStack);
		}
	}

	private handleRetry = (): void => {
		if (this.state.retryCount < this.maxRetries) {
			this.setState({
				hasError: false,
				error: null,
				errorInfo: null,
				retryCount: this.state.retryCount + 1,
			});
		}
	};

	private renderFallback(): ComponentChildren {
		const { error } = this.state;
		const { fallback } = this.props;

		if (fallback && error) {
			return fallback(error, this.handleRetry);
		}

		// Default fallback UI
		return (
			<div class="layout-error-boundary">
				<div class="error-container">
					<h2>Something went wrong</h2>
					<p>An error occurred while rendering this layout.</p>
					{this.state.retryCount < this.maxRetries && (
						<button onClick={this.handleRetry} class="retry-button">
							Try Again ({this.maxRetries - this.state.retryCount} attempts left)
						</button>
					)}
					{typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development' && (
						<details class="error-details">
							<summary>Error Details (Development)</summary>
							<pre>{error?.stack}</pre>
							{this.state.errorInfo && (
								<div>
									<p>
										<strong>Layout Path:</strong> {this.state.errorInfo.layoutPath}
									</p>
									<p>
										<strong>Error Type:</strong> {this.state.errorInfo.errorType}
									</p>
									<p>
										<strong>Timestamp:</strong> {new Date(this.state.errorInfo.timestamp).toISOString()}
									</p>
								</div>
							)}
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
