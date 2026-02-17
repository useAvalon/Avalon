/**
 * StreamingErrorBoundary - Error boundary component for streaming contexts
 * 
 * This component provides error isolation for Suspense boundaries in streaming SSR.
 * It ensures that errors in one component don't break the entire page.
 */

import { Component, type ComponentChildren } from 'preact';

export interface StreamingErrorBoundaryProps {
	children: ComponentChildren;
	fallback?: (error: Error, retry: () => void) => ComponentChildren;
	onError?: (error: Error, errorInfo: any) => void;
	componentId?: string;
	isolateError?: boolean; // If true, error won't propagate to parent
}

export interface StreamingErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: any;
}

/**
 * Error boundary component for streaming contexts
 * 
 * Wraps Suspense boundaries to provide error isolation and recovery.
 * Prevents errors in one component from breaking the entire page.
 */
export class StreamingErrorBoundary extends Component<
	StreamingErrorBoundaryProps,
	StreamingErrorBoundaryState
> {
	constructor(props: StreamingErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static override getDerivedStateFromError(error: Error): Partial<StreamingErrorBoundaryState> {
		return {
			hasError: true,
			error,
		};
	}

	override componentDidCatch(error: Error, errorInfo: any): void {
		this.setState({
			errorInfo,
		});

		// Log the error
		console.error('[StreamingErrorBoundary] Caught error:', {
			componentId: this.props.componentId,
			error: error.message,
			stack: error.stack,
			componentStack: errorInfo.componentStack,
		});

		// Call onError callback if provided
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		}

		// If isolateError is false, re-throw to propagate to parent
		if (!this.props.isolateError) {
			throw error;
		}
	}

	private handleRetry = (): void => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
	};

	private renderFallback(): ComponentChildren {
		const { error } = this.state;
		const { fallback, componentId } = this.props;

		if (fallback && error) {
			return fallback(error, this.handleRetry);
		}

		// Default fallback UI
		const isDevelopment = typeof Deno !== 'undefined' && Deno.env.get('DENO_ENV') !== 'production';

		return (
			<div
				class="streaming-error-boundary"
				data-error-boundary="true"
				data-component-id={componentId}
				style={{
					background: '#fff3cd',
					border: '2px solid #ffc107',
					borderRadius: '8px',
					padding: '20px',
					margin: '20px 0',
					fontFamily: 'system-ui, -apple-system, sans-serif',
				}}
			>
				<div
					class="error-boundary-header"
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '10px',
						marginBottom: '10px',
					}}
				>
					<span style={{ fontSize: '24px' }}>⚠️</span>
					<h3 style={{ margin: 0, color: '#856404' }}>Component Error</h3>
				</div>

				<p style={{ margin: '10px 0', color: '#856404' }}>
					An error occurred while rendering this component. The rest of the page should work normally.
				</p>

				<button
					onClick={this.handleRetry}
					style={{
						background: '#ffc107',
						border: 'none',
						borderRadius: '4px',
						padding: '8px 16px',
						cursor: 'pointer',
						fontWeight: 'bold',
						color: '#856404',
						marginTop: '10px',
					}}
				>
					Retry
				</button>

				{isDevelopment && error && (
					<details style={{ marginTop: '15px' }}>
						<summary
							style={{
								cursor: 'pointer',
								color: '#856404',
								fontWeight: 'bold',
							}}
						>
							Error Details (Development Mode)
						</summary>
						<div style={{ marginTop: '10px' }}>
							{componentId && (
								<p>
									<strong>Component ID:</strong> {componentId}
								</p>
							)}
							<p>
								<strong>Error:</strong> {error.message}
							</p>
							{error.stack && (
								<pre
									style={{
										background: '#f5f5f5',
										padding: '10px',
										borderRadius: '4px',
										overflowX: 'auto',
										fontSize: '12px',
										marginTop: '10px',
									}}
								>
									{error.stack}
								</pre>
							)}
							{this.state.errorInfo?.componentStack && (
								<div>
									<p>
										<strong>Component Stack:</strong>
									</p>
									<pre
										style={{
											background: '#f5f5f5',
											padding: '10px',
											borderRadius: '4px',
											overflowX: 'auto',
											fontSize: '12px',
											marginTop: '10px',
										}}
									>
										{this.state.errorInfo.componentStack}
									</pre>
								</div>
							)}
						</div>
					</details>
				)}
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
 * Higher-order component to wrap components with streaming error boundaries
 */
export function withStreamingErrorBoundary<P extends object>(
	WrappedComponent: (props: P) => ComponentChildren,
	options?: {
		fallback?: (error: Error, retry: () => void) => ComponentChildren;
		componentId?: string;
		isolateError?: boolean;
		onError?: (error: Error, errorInfo: any) => void;
	}
) {
	return function ComponentWithErrorBoundary(props: P) {
		return (
			<StreamingErrorBoundary
				componentId={options?.componentId}
				fallback={options?.fallback}
				isolateError={options?.isolateError ?? true}
				onError={options?.onError}
			>
				<WrappedComponent {...props} />
			</StreamingErrorBoundary>
		);
	};
}
