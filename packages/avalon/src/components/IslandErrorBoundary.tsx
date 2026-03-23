/** @jsxImportSource preact */
import { Component, type ComponentChildren, type ComponentType } from "preact";
import type { LayoutErrorInfo } from "../schemas/layout.ts";

/**
 * Props for {@link IslandErrorBoundary}.
 *
 * @example
 * ```tsx
 * <IslandErrorBoundary
 *   islandId="counter"
 *   isolateError
 *   onError={(err, info) => console.error(info.errorBoundary, err)}
 *   fallback={(err, id) => <p>Island "{id}" failed: {err.message}</p>}
 * >
 *   <Counter />
 * </IslandErrorBoundary>
 * ```
 */
export interface IslandErrorBoundaryProps {
	/** The content to render inside the error boundary. */
	children: ComponentChildren;
	/** Unique identifier for the island — used in error reports and DOM attributes. */
	islandId: string;
	/** Called when the island throws. Receives the error and structured error info. */
	onError?: (error: Error, errorInfo: LayoutErrorInfo) => void;
	/** Custom fallback UI. When omitted a default error card is shown. */
	fallback?: (error: Error, islandId: string) => ComponentChildren;
	/** When `true` (default for HOC), the error is caught and isolated. When `false`, it re-throws to parent boundaries. */
	isolateError?: boolean;
}

interface IslandErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	errorInfo: LayoutErrorInfo | null;
}

/**
 * Error boundary that wraps individual islands to prevent one broken island
 * from taking down the entire page.
 *
 * Renders a default error card with "Reload" / "Remove" actions, or your
 * custom `fallback` if provided. In development mode, a stack trace is shown.
 *
 * @example
 * ```tsx
 * <IslandErrorBoundary islandId="cart" isolateError>
 *   <CartIsland />
 * </IslandErrorBoundary>
 * ```
 */
export class IslandErrorBoundary extends Component<
	IslandErrorBoundaryProps,
	IslandErrorBoundaryState
> {
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
			errorType: "island",
			timestamp: Date.now(),
			componentStack: errorInfo.componentStack,
			errorBoundary: "IslandErrorBoundary",
		};
		this.setState({ errorInfo: layoutErrorInfo });
		this.props.onError?.(error, layoutErrorInfo);
		if (!this.props.isolateError) throw error;
	}

	private readonly handleRemoveIsland = (): void => {
		document.querySelector(`[data-island-id="${this.props.islandId}"]`)?.remove();
	};

	private readonly handleReloadIsland = (): void => {
		this.setState({ hasError: false, error: null, errorInfo: null });
	};

	render() {
		if (!this.state.hasError) return this.props.children;
		const { error } = this.state;
		const { fallback, islandId } = this.props;
		if (fallback && error) return fallback(error, islandId);

		const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";
		return (
			<div className="island-error-boundary" data-island-error={islandId}>
				<div className="island-error-container">
					<div className="island-error-header">
						<span className="island-error-icon">⚠️</span>
						<span className="island-error-title">Island Error</span>
					</div>
					<p className="island-error-message">An error occurred in island "{islandId}".</p>
					<div className="island-error-actions">
						<button
							type="button"
							onClick={this.handleReloadIsland}
							className="island-reload-button"
						>
							Reload Island
						</button>
						<button
							type="button"
							onClick={this.handleRemoveIsland}
							className="island-remove-button"
						>
							Remove Island
						</button>
					</div>
					{isDev && error && (
						<details className="island-error-details">
							<summary>Error Details (Development)</summary>
							<p>
								<strong>Island ID:</strong> {islandId}
							</p>
							<p>
								<strong>Error:</strong> {error.message}
							</p>
							<pre className="island-error-stack">{error.stack}</pre>
						</details>
					)}
				</div>
			</div>
		);
	}
}

/**
 * HOC that wraps a component with {@link IslandErrorBoundary}.
 *
 * @example
 * ```tsx
 * const SafeCounter = withIslandErrorBoundary(Counter, 'counter', {
 *   isolateError: true,
 *   fallback: (err) => <p>Oops: {err.message}</p>,
 * });
 * ```
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
				onError={options?.onError}
			>
				<WrappedComponent {...props} />
			</IslandErrorBoundary>
		);
	};
}
