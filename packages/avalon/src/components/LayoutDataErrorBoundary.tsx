import { Component, ComponentChildren } from 'preact';
import type { LayoutErrorInfo, LayoutContext, LayoutData } from '../types/layout.ts';

export interface LayoutDataErrorBoundaryProps {
	children: ComponentChildren;
	layoutPath: string;
	context: LayoutContext;
	onError?: (error: Error, errorInfo: LayoutErrorInfo) => void;
	fallbackData?: LayoutData;
	retryLoader?: () => Promise<LayoutData>;
}

export interface LayoutDataErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: LayoutErrorInfo | null;
	retryCount: number;
	isRetrying: boolean;
	fallbackData: LayoutData | null;
}

/**
 * Specialized error boundary for layout data loading errors
 * Provides specific handling for data loader failures with retry and fallback mechanisms
 */
export class LayoutDataErrorBoundary extends Component<LayoutDataErrorBoundaryProps, LayoutDataErrorBoundaryState> {
	private maxRetries = 3;

	constructor(props: LayoutDataErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			retryCount: 0,
			isRetrying: false,
			fallbackData: props.fallbackData || null,
		};
	}

	static override getDerivedStateFromError(error: Error): Partial<LayoutDataErrorBoundaryState> {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: { componentStack?: string }): void {
		const layoutErrorInfo: LayoutErrorInfo = {
			layoutPath: this.props.layoutPath,
			errorType: 'loader',
			timestamp: Date.now(),
			componentStack: errorInfo.componentStack,
			errorBoundary: 'LayoutDataErrorBoundary',
		};

		this.setState({ errorInfo: layoutErrorInfo });

		if (this.props.onError) {
			this.props.onError(error, layoutErrorInfo);
		}
	}

	private handleRetry = async (): Promise<void> => {
		if (this.state.retryCount >= this.maxRetries || !this.props.retryLoader) {
			return;
		}

		this.setState({ isRetrying: true });

		try {
			const data = await this.props.retryLoader();
			this.setState({
				hasError: false,
				error: null,
				errorInfo: null,
				retryCount: this.state.retryCount + 1,
				isRetrying: false,
				fallbackData: data,
			});
		} catch (retryError) {
			this.setState({
				retryCount: this.state.retryCount + 1,
				isRetrying: false,
				error: retryError instanceof Error ? retryError : new Error(String(retryError)),
			});
		}
	};

	private handleUseFallback = (): void => {
		if (this.state.fallbackData) {
			this.setState({ hasError: false, error: null, errorInfo: null });
		}
	};

	private renderErrorUI(): ComponentChildren {
		const { error, retryCount, isRetrying, fallbackData } = this.state;
		const canRetry = retryCount < this.maxRetries && this.props.retryLoader;
		const hasFallback = fallbackData !== null;
		const isDevelopment = typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development';

		return (
			<div class="layout-data-error-boundary">
				<div class="error-container">
					<h3>Data Loading Error</h3>
					<p>Failed to load data for layout: {this.props.layoutPath}</p>

					<div class="error-actions">
						{canRetry && (
							<button onClick={this.handleRetry} disabled={isRetrying} class="retry-button">
								{isRetrying ? 'Retrying...' : `Retry (${this.maxRetries - retryCount} left)`}
							</button>
						)}

						{hasFallback && (
							<button onClick={this.handleUseFallback} class="fallback-button">
								Use Cached Data
							</button>
						)}
					</div>

					{isDevelopment && error && (
						<details class="error-details">
							<summary>Error Details (Development)</summary>
							<div class="error-info">
								<p><strong>Error:</strong> {error.message}</p>
								<p><strong>Layout:</strong> {this.props.layoutPath}</p>
								<p><strong>Retry Count:</strong> {retryCount}</p>
							</div>
							<pre class="error-stack">{error.stack}</pre>
						</details>
					)}
				</div>
			</div>
		);
	}

	render() {
		if (this.state.hasError) {
			return this.renderErrorUI();
		}
		return this.props.children;
	}
}
