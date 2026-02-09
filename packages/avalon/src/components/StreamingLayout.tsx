import { ComponentChildren, ComponentType, Component } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { StreamingLayoutProps } from '../types/layout.ts';

/**
 * Streaming Layout Component Props
 */
export interface StreamingLayoutComponentProps extends StreamingLayoutProps {
	/**
	 * Component to render when ready
	 */
	component: ComponentType<any>;

	/**
	 * Props to pass to the component
	 */
	componentProps?: any;

	/**
	 * Function to check if component is ready
	 */
	isReady?: () => Promise<boolean>;

	/**
	 * Timeout for loading (ms)
	 */
	timeout?: number;

	/**
	 * Error boundary fallback
	 */
	onError?: (error: Error) => ComponentChildren;

	/**
	 * Loading state callback
	 */
	onLoadingChange?: (isLoading: boolean) => void;
}

/**
 * Component state for streaming
 */
interface StreamingState {
	isReady: boolean;
	isLoading: boolean;
	error: Error | null;
	hasTimedOut: boolean;
}

/**
 * Streaming Layout Component with Suspense-like behavior
 */
export function StreamingLayout(props: StreamingLayoutComponentProps): ComponentChildren {
	const {
		component: Component,
		componentProps = {},
		children,
		fallback,
		priority = 'medium',
		isReady,
		timeout = 5000,
		onError,
		onLoadingChange,
	} = props;

	// In SSR mode, render children directly without streaming behavior
	if (typeof window === 'undefined') {
		return children;
	}

	const [state, setState] = useState<StreamingState>({
		isReady: false,
		isLoading: true,
		error: null,
		hasTimedOut: false,
	});

	const timeoutRef = useRef<number>();
	const mountedRef = useRef(true);

	useEffect(() => {
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		if (!isReady) {
			// If no ready check provided, assume ready immediately
			setState(prev => ({ ...prev, isReady: true, isLoading: false }));
			onLoadingChange?.(false);
			return;
		}

		let cancelled = false;

		const checkReady = async () => {
			try {
				// Set up timeout
				if (timeout > 0) {
					timeoutRef.current = setTimeout(() => {
						if (!cancelled && mountedRef.current) {
							setState(prev => ({ ...prev, hasTimedOut: true, isLoading: false }));
							onLoadingChange?.(false);
						}
					}, timeout);
				}

				// Wait for component to be ready
				const ready = await isReady();

				if (cancelled || !mountedRef.current) return;

				// Clear timeout
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
				}

				setState(prev => ({
					...prev,
					isReady: ready,
					isLoading: false,
					hasTimedOut: false,
				}));

				onLoadingChange?.(false);
			} catch (error) {
				if (cancelled || !mountedRef.current) return;

				// Clear timeout
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
				}

				setState(prev => ({
					...prev,
					error: error as Error,
					isLoading: false,
				}));

				onLoadingChange?.(false);
			}
		};

		checkReady();

		return () => {
			cancelled = true;
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [isReady, timeout, onLoadingChange]);

	// Handle error state
	if (state.error) {
		if (onError) {
			return onError(state.error);
		}

		return (
			<div class="streaming-error" data-priority={priority}>
				<p>Failed to load component: {state.error.message}</p>
				<button
					onClick={() => {
						setState({
							isReady: false,
							isLoading: true,
							error: null,
							hasTimedOut: false,
						});
						onLoadingChange?.(true);
					}}>
					Retry
				</button>
			</div>
		);
	}

	// Handle timeout state
	if (state.hasTimedOut) {
		return (
			<div class="streaming-timeout" data-priority={priority}>
				{fallback || (
					<div class="timeout-message">
						<p>Component loading timed out</p>
						<button
							onClick={() => {
								setState({
									isReady: false,
									isLoading: true,
									error: null,
									hasTimedOut: false,
								});
								onLoadingChange?.(true);
							}}>
							Retry
						</button>
					</div>
				)}
			</div>
		);
	}

	// Handle loading state
	if (state.isLoading || !state.isReady) {
		return (
			<div class="streaming-loading" data-priority={priority}>
				{fallback || <StreamingFallback priority={priority} />}
			</div>
		);
	}

	// Render the actual component
	return (
		<div class="streaming-ready" data-priority={priority}>
			<Component {...componentProps}>{children}</Component>
		</div>
	);
}

/**
 * Default streaming fallback component
 */
function StreamingFallback({ priority }: { priority: string }) {
	const priorityClass = `skeleton-${priority}`;

	return (
		<div class={`streaming-skeleton ${priorityClass}`}>
			<div class="skeleton-content">
				<div class="skeleton-line skeleton-line-1"></div>
				<div class="skeleton-line skeleton-line-2"></div>
				<div class="skeleton-line skeleton-line-3"></div>
			</div>
			<style>{`
				.streaming-skeleton {
					padding: 1rem;
					border-radius: 0.5rem;
					background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
					background-size: 200% 100%;
					animation: skeleton-loading 1.5s infinite;
				}
				.skeleton-content {
					display: flex;
					flex-direction: column;
					gap: 0.5rem;
				}
				.skeleton-line {
					height: 1rem;
					background: rgba(255, 255, 255, 0.8);
					border-radius: 0.25rem;
				}
				.skeleton-line-1 { width: 100%; }
				.skeleton-line-2 { width: 75%; }
				.skeleton-line-3 { width: 50%; }
				.skeleton-high { border-left: 4px solid #ef4444; }
				.skeleton-medium { border-left: 4px solid #f59e0b; }
				.skeleton-low { border-left: 4px solid #10b981; }
				@keyframes skeleton-loading {
					0% { background-position: 200% 0; }
					100% { background-position: -200% 0; }
				}
			`}</style>
		</div>
	);
}

/**
 * Suspense-like boundary for streaming components
 */
export interface StreamingSuspenseProps {
	/**
	 * Fallback to show while loading
	 */
	fallback?: ComponentChildren;

	/**
	 * Children components
	 */
	children: ComponentChildren;

	/**
	 * Priority for this suspense boundary
	 */
	priority?: 'high' | 'medium' | 'low';

	/**
	 * Timeout for all children (ms)
	 */
	timeout?: number;

	/**
	 * Error boundary for failed components
	 */
	onError?: (error: Error) => ComponentChildren;
}

/**
 * Streaming Suspense Boundary Component
 */
export function StreamingSuspense(props: StreamingSuspenseProps): ComponentChildren {
	const { fallback, children, priority = 'medium', timeout = 5000, onError } = props;

	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const [hasTimedOut, setHasTimedOut] = useState(false);
	const timeoutRef = useRef<number>();
	const mountedRef = useRef(true);

	useEffect(() => {
		return () => {
			mountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		// Set up timeout for the entire suspense boundary
		if (timeout > 0) {
			timeoutRef.current = setTimeout(() => {
				if (mountedRef.current && isLoading) {
					setHasTimedOut(true);
					setIsLoading(false);
				}
			}, timeout);
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [timeout, isLoading]);

	// Handle child errors
	const handleError = (childError: Error) => {
		setError(childError);
		setIsLoading(false);
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
	};

	// Handle error state
	if (error) {
		if (onError) {
			return onError(error);
		}

		return (
			<div class="streaming-suspense-error" data-priority={priority}>
				<p>Suspense boundary error: {error.message}</p>
				<button
					onClick={() => {
						setError(null);
						setIsLoading(true);
						setHasTimedOut(false);
					}}>
					Retry
				</button>
			</div>
		);
	}

	// Handle timeout state
	if (hasTimedOut) {
		return (
			<div class="streaming-suspense-timeout" data-priority={priority}>
				{fallback || (
					<div class="suspense-timeout-message">
						<p>Suspense boundary timed out</p>
						<button
							onClick={() => {
								setHasTimedOut(false);
								setIsLoading(true);
							}}>
							Retry
						</button>
					</div>
				)}
			</div>
		);
	}

	// Handle loading state
	if (isLoading) {
		return (
			<div class="streaming-suspense-loading" data-priority={priority}>
				{fallback || <StreamingFallback priority={priority} />}
			</div>
		);
	}

	// Render children with error boundary
	return (
		<div class="streaming-suspense-ready" data-priority={priority}>
			<StreamingErrorBoundary onError={handleError}>{children}</StreamingErrorBoundary>
		</div>
	);
}

/**
 * Error boundary for streaming components
 */
interface StreamingErrorBoundaryProps {
	children: ComponentChildren;
	onError?: (error: Error) => void;
}

interface StreamingErrorBoundaryState {
	hasError: boolean;
	error?: Error;
}

class StreamingErrorBoundary extends Component<StreamingErrorBoundaryProps, StreamingErrorBoundaryState> {
	constructor(props: StreamingErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static override getDerivedStateFromError(error: Error): StreamingErrorBoundaryState {
		return { hasError: true, error };
	}

	override componentDidCatch(error: Error, errorInfo: any) {
		console.error('StreamingErrorBoundary caught an error:', error, errorInfo);
		this.props.onError?.(error);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div class="streaming-error-boundary">
					<p>Something went wrong in streaming component.</p>
					<button onClick={() => this.setState({ hasError: false, error: undefined })}>Retry</button>
				</div>
			);
		}

		return this.props.children;
	}
}

/**
 * Higher-order component to add streaming capabilities
 */
export function withStreaming<P extends object>(
	WrappedComponent: ComponentType<P>,
	streamingOptions: {
		fallback?: ComponentChildren;
		priority?: 'high' | 'medium' | 'low';
		isReady?: () => Promise<boolean>;
		timeout?: number;
	} = {}
) {
	return function StreamingWrapper(props: P) {
		const finalOptions = {
			priority: 'medium' as const,
			...streamingOptions,
		};

		return <StreamingLayout component={WrappedComponent} componentProps={props} {...finalOptions} />;
	};
}

/**
 * Hook for streaming component state
 */
export function useStreamingState(isReady?: () => Promise<boolean>, timeout = 5000) {
	const [state, setState] = useState<StreamingState>({
		isReady: false,
		isLoading: true,
		error: null,
		hasTimedOut: false,
	});

	useEffect(() => {
		if (!isReady) {
			setState(prev => ({ ...prev, isReady: true, isLoading: false }));
			return;
		}

		let cancelled = false;
		let timeoutId: number;

		const checkReady = async () => {
			try {
				if (timeout > 0) {
					timeoutId = setTimeout(() => {
						if (!cancelled) {
							setState(prev => ({ ...prev, hasTimedOut: true, isLoading: false }));
						}
					}, timeout);
				}

				const ready = await isReady();

				if (cancelled) return;

				if (timeoutId) clearTimeout(timeoutId);

				setState(prev => ({
					...prev,
					isReady: ready,
					isLoading: false,
					hasTimedOut: false,
				}));
			} catch (error) {
				if (cancelled) return;

				if (timeoutId) clearTimeout(timeoutId);

				setState(prev => ({
					...prev,
					error: error as Error,
					isLoading: false,
				}));
			}
		};

		checkReady();

		return () => {
			cancelled = true;
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [isReady, timeout]);

	const retry = () => {
		setState({
			isReady: false,
			isLoading: true,
			error: null,
			hasTimedOut: false,
		});
	};

	return { ...state, retry };
}
