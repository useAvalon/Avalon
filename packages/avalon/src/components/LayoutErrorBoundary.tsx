/** @jsxImportSource preact */
import { Component, type ComponentChildren } from "preact";
import type { LayoutData, LayoutErrorInfo } from "../schemas/layout.ts";

/**
 * Props for {@link LayoutErrorBoundary}.
 *
 * @example Basic usage
 * ```tsx
 * <LayoutErrorBoundary onError={(err) => logToSentry(err)}>
 *   <DashboardLayout />
 * </LayoutErrorBoundary>
 * ```
 *
 * @example Custom fallback with retry
 * ```tsx
 * <LayoutErrorBoundary
 *   fallback={(err, retry) => (
 *     <div>
 *       <p>Layout crashed: {err.message}</p>
 *       <button onClick={retry}>Retry</button>
 *     </div>
 *   )}
 * >
 *   <DashboardLayout />
 * </LayoutErrorBoundary>
 * ```
 *
 * @example Data loading with async retry and cached fallback
 * ```tsx
 * <LayoutErrorBoundary
 *   retryLoader={() => fetch('/api/blog').then(r => r.json())}
 *   fallbackData={{ posts: [] }}
 * >
 *   <BlogLayout />
 * </LayoutErrorBoundary>
 * ```
 */
export interface LayoutErrorBoundaryProps {
	/** The layout tree to protect. */
	children: ComponentChildren;
	/** Custom fallback UI. Receives the error and a retry callback. */
	fallback?: (error: Error, retry: () => void) => ComponentChildren;
	/** Called when the layout throws. */
	onError?: (error: Error, errorInfo: LayoutErrorInfo) => void;
	/** Categorises the error for structured logging. Defaults to `'component'`. */
	errorType?: "component" | "loader" | "rendering" | "island";
	/** Async function to re-attempt data loading. Enables the async retry button (up to 3 attempts). */
	retryLoader?: () => Promise<LayoutData>;
	/** Static data to offer as a "Use Cached Data" option when the loader fails. */
	fallbackData?: LayoutData;
}

interface LayoutErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: LayoutErrorInfo | null;
	retryCount: number;
	isRetrying: boolean;
	fallbackData: LayoutData | null;
}

/**
 * Error boundary for Avalon layouts.
 *
 * Catches render and data-loading errors in the wrapped layout tree.
 * Shows a default error card with up to 3 retries, or your custom
 * `fallback`. When `retryLoader` is provided, retry is async. When
 * `fallbackData` is provided, a "Use Cached Data" button appears.
 *
 * @example
 * ```tsx
 * <LayoutErrorBoundary
 *   retryLoader={() => fetchDashboardData()}
 *   fallbackData={{ widgets: [] }}
 *   onError={(err) => logToSentry(err)}
 * >
 *   <DashboardLayout />
 * </LayoutErrorBoundary>
 * ```
 */
export class LayoutErrorBoundary extends Component<
	LayoutErrorBoundaryProps,
	LayoutErrorBoundaryState
> {
	private readonly maxRetries = 3;

	constructor(props: LayoutErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
			retryCount: 0,
			isRetrying: false,
			fallbackData: props.fallbackData ?? null,
		};
	}

	static override getDerivedStateFromError(error: Error): Partial<LayoutErrorBoundaryState> {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: { componentStack?: string }): void {
		const layoutErrorInfo: LayoutErrorInfo = {
			errorType: this.props.errorType ?? "component",
			timestamp: Date.now(),
			componentStack: errorInfo.componentStack,
			errorBoundary: "LayoutErrorBoundary",
			layoutPath: undefined,
		};
		this.setState({ errorInfo: layoutErrorInfo });
		this.props.onError?.(error, layoutErrorInfo);
	}

	private readonly handleRetry = async (): Promise<void> => {
		if (this.state.retryCount >= this.maxRetries) return;

		if (this.props.retryLoader) {
			this.setState({ isRetrying: true });
			try {
				const data = await this.props.retryLoader();
				this.setState((prev) => ({
					hasError: false,
					error: null,
					errorInfo: null,
					retryCount: prev.retryCount + 1,
					isRetrying: false,
					fallbackData: data,
				}));
			} catch (retryError) {
				this.setState((prev) => ({
					retryCount: prev.retryCount + 1,
					isRetrying: false,
					error: retryError instanceof Error ? retryError : new Error(String(retryError)),
				}));
			}
		} else {
			this.setState((prev) => ({
				hasError: false,
				error: null,
				errorInfo: null,
				retryCount: prev.retryCount + 1,
			}));
		}
	};

	private readonly handleUseFallback = (): void => {
		if (this.state.fallbackData) this.setState({ hasError: false, error: null, errorInfo: null });
	};

	render() {
		if (!this.state.hasError) return this.props.children;
		const { error, retryCount, isRetrying, fallbackData } = this.state;
		if (this.props.fallback && error) return this.props.fallback(error, this.handleRetry);

		const canRetry = retryCount < this.maxRetries;
		const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

		return (
			<div className="layout-error-boundary">
				<div className="error-container">
					<h2>Something went wrong</h2>
					<p>An error occurred while rendering this layout.</p>
					<div className="error-actions">
						{canRetry && (
							<button
								type="button"
								onClick={this.handleRetry}
								disabled={isRetrying}
								className="retry-button"
							>
								{isRetrying ? "Retrying..." : `Try Again (${this.maxRetries - retryCount} left)`}
							</button>
						)}
						{fallbackData !== null && (
							<button type="button" onClick={this.handleUseFallback} className="fallback-button">
								Use Cached Data
							</button>
						)}
					</div>
					{isDev && error && (
						<details className="error-details">
							<summary>Error Details (Development)</summary>
							<p>
								<strong>Error:</strong> {error.message}
							</p>
							{this.state.errorInfo && (
								<p>
									<strong>Error Type:</strong> {this.state.errorInfo.errorType}
								</p>
							)}
							<pre className="error-stack">{error.stack}</pre>
						</details>
					)}
				</div>
			</div>
		);
	}
}
