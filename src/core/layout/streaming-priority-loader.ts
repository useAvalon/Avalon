import { ComponentType } from 'preact';
import { StreamingComponent } from '../../types/layout.ts';

/**
 * Priority levels for component loading
 */
export enum LoadingPriority {
	CRITICAL = 0, // Must load immediately (above-the-fold content)
	HIGH = 1, // Important content (visible on initial viewport)
	MEDIUM = 2, // Standard content (below-the-fold but important)
	LOW = 3, // Non-critical content (lazy-loaded)
	IDLE = 4, // Load when browser is idle
}

/**
 * Component loading configuration
 */
export interface ComponentLoadConfig {
	/**
	 * Loading priority
	 */
	priority: LoadingPriority;

	/**
	 * Maximum loading time before timeout (ms)
	 */
	timeout: number;

	/**
	 * Whether to preload this component
	 */
	preload: boolean;

	/**
	 * Dependencies that must load before this component
	 */
	dependencies: string[];

	/**
	 * Custom loading condition
	 */
	loadWhen?: () => boolean | Promise<boolean>;

	/**
	 * Retry configuration
	 */
	retry: {
		attempts: number;
		delay: number;
		backoff: number;
	};
}

/**
 * Default loading configuration
 */
export const DEFAULT_LOAD_CONFIG: ComponentLoadConfig = {
	priority: LoadingPriority.MEDIUM,
	timeout: 5000,
	preload: false,
	dependencies: [],
	retry: {
		attempts: 3,
		delay: 1000,
		backoff: 1.5,
	},
};

/**
 * Component loading state
 */
export interface ComponentLoadState {
	id: string;
	component: StreamingComponent;
	config: ComponentLoadConfig;
	status: 'pending' | 'loading' | 'loaded' | 'error' | 'timeout';
	startTime?: number;
	endTime?: number;
	error?: Error;
	retryCount: number;
	dependencies: Set<string>;
	dependents: Set<string>;
}

/**
 * Loading queue entry
 */
interface LoadingQueueEntry {
	state: ComponentLoadState;
	resolve: (result: any) => void;
	reject: (error: Error) => void;
}

/**
 * Priority-based component loader for critical path optimization
 */
export class StreamingPriorityLoader {
	private components = new Map<string, ComponentLoadState>();
	private loadingQueue: LoadingQueueEntry[] = [];
	private activeLoads = new Map<string, Promise<any>>();
	private maxConcurrentLoads: number;
	private loadingStats = {
		totalComponents: 0,
		loadedComponents: 0,
		failedComponents: 0,
		averageLoadTime: 0,
		criticalPathTime: 0,
	};

	constructor(maxConcurrentLoads = 3) {
		this.maxConcurrentLoads = maxConcurrentLoads;
	}

	/**
	 * Register a component for priority loading
	 */
	registerComponent(id: string, component: StreamingComponent, config: Partial<ComponentLoadConfig> = {}): void {
		const fullConfig = { ...DEFAULT_LOAD_CONFIG, ...config };

		const state: ComponentLoadState = {
			id,
			component,
			config: fullConfig,
			status: 'pending',
			retryCount: 0,
			dependencies: new Set(fullConfig.dependencies),
			dependents: new Set(),
		};

		this.components.set(id, state);

		// Update dependent relationships
		fullConfig.dependencies.forEach(depId => {
			const depState = this.components.get(depId);
			if (depState) {
				depState.dependents.add(id);
			}
		});

		this.loadingStats.totalComponents++;
	}

	/**
	 * Load a component with priority handling
	 */
	async loadComponent(id: string): Promise<any> {
		const state = this.components.get(id);
		if (!state) {
			throw new Error(`Component ${id} not registered`);
		}

		// Check if already loading or loaded
		if (this.activeLoads.has(id)) {
			return this.activeLoads.get(id);
		}

		if (state.status === 'loaded') {
			return state.component;
		}

		// Create loading promise
		const loadingPromise = new Promise<any>((resolve, reject) => {
			this.loadingQueue.push({ state, resolve, reject });
			this.processQueue();
		});

		this.activeLoads.set(id, loadingPromise);
		return loadingPromise;
	}

	/**
	 * Load all components in priority order
	 */
	async loadAllComponents(): Promise<Map<string, any>> {
		const results = new Map<string, any>();
		const loadPromises: Promise<void>[] = [];

		// Sort components by priority
		const sortedComponents = Array.from(this.components.values()).sort((a, b) => a.config.priority - b.config.priority);

		for (const state of sortedComponents) {
			const promise = this.loadComponent(state.id)
				.then(result => {
					results.set(state.id, result);
				})
				.catch(error => {
					console.error(`Failed to load component ${state.id}:`, error);
					results.set(state.id, null);
				});

			loadPromises.push(promise);

			// For critical components, wait before continuing
			if (state.config.priority === LoadingPriority.CRITICAL) {
				await promise;
			}
		}

		await Promise.allSettled(loadPromises);
		return results;
	}

	/**
	 * Preload components marked for preloading
	 */
	async preloadComponents(): Promise<void> {
		const preloadComponents = Array.from(this.components.values())
			.filter(state => state.config.preload)
			.sort((a, b) => a.config.priority - b.config.priority);

		const preloadPromises = preloadComponents.map(state =>
			this.loadComponent(state.id).catch(error => {
				console.warn(`Preload failed for component ${state.id}:`, error);
			})
		);

		await Promise.allSettled(preloadPromises);
	}

	/**
	 * Get loading statistics
	 */
	getLoadingStats(): typeof this.loadingStats {
		return { ...this.loadingStats };
	}

	/**
	 * Get component loading state
	 */
	getComponentState(id: string): ComponentLoadState | undefined {
		return this.components.get(id);
	}

	/**
	 * Get all component states
	 */
	getAllComponentStates(): ComponentLoadState[] {
		return Array.from(this.components.values());
	}

	/**
	 * Clear all registered components
	 */
	clear(): void {
		this.components.clear();
		this.loadingQueue.length = 0;
		this.activeLoads.clear();
		this.loadingStats = {
			totalComponents: 0,
			loadedComponents: 0,
			failedComponents: 0,
			averageLoadTime: 0,
			criticalPathTime: 0,
		};
	}

	/**
	 * Update maximum concurrent loads
	 */
	setMaxConcurrentLoads(max: number): void {
		this.maxConcurrentLoads = max;
	}

	// Private methods

	private async processQueue(): Promise<void> {
		// Process queue in priority order
		this.loadingQueue.sort((a, b) => a.state.config.priority - b.state.config.priority);

		while (this.loadingQueue.length > 0 && this.activeLoads.size < this.maxConcurrentLoads) {
			const entry = this.loadingQueue.shift();
			if (!entry) break;

			// Check if dependencies are met
			if (!this.areDependenciesMet(entry.state)) {
				// Put back in queue and try later
				this.loadingQueue.push(entry);
				continue;
			}

			// Start loading
			this.startComponentLoad(entry);
		}
	}

	private areDependenciesMet(state: ComponentLoadState): boolean {
		for (const depId of state.dependencies) {
			const depState = this.components.get(depId);
			if (!depState || depState.status !== 'loaded') {
				return false;
			}
		}
		return true;
	}

	private async startComponentLoad(entry: LoadingQueueEntry): Promise<void> {
		const { state, resolve, reject } = entry;

		state.status = 'loading';
		state.startTime = Date.now();

		try {
			// Check custom loading condition
			if (state.config.loadWhen) {
				const shouldLoad = await state.config.loadWhen();
				if (!shouldLoad) {
					throw new Error('Custom loading condition not met');
				}
			}

			// Load the component with timeout
			const result = await Promise.race([
				this.loadComponentWithRetry(state),
				this.createTimeoutPromise(state.config.timeout),
			]);

			state.status = 'loaded';
			state.endTime = Date.now();

			this.updateLoadingStats(state);
			resolve(result);

			// Process dependent components
			this.processDependents(state.id);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			state.status = errorMessage.includes('timeout') ? 'timeout' : 'error';
			state.error = error as Error;
			state.endTime = Date.now();

			this.loadingStats.failedComponents++;
			reject(error as Error);
		} finally {
			this.activeLoads.delete(state.id);
			// Continue processing queue
			setTimeout(() => this.processQueue(), 0);
		}
	}

	private async loadComponentWithRetry(state: ComponentLoadState): Promise<any> {
		let lastError: Error;

		for (let attempt = 0; attempt <= state.config.retry.attempts; attempt++) {
			try {
				// Wait for component to be ready
				const isReady = await state.component.isReady();
				if (!isReady) {
					throw new Error('Component not ready');
				}

				return state.component;
			} catch (error) {
				lastError = error as Error;
				state.retryCount++;

				if (attempt < state.config.retry.attempts) {
					// Calculate delay with backoff
					const delay = state.config.retry.delay * Math.pow(state.config.retry.backoff, attempt);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}
		}

		throw lastError!;
	}

	private createTimeoutPromise(timeout: number): Promise<never> {
		return new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`Component loading timeout after ${timeout}ms`)), timeout);
		});
	}

	private updateLoadingStats(state: ComponentLoadState): void {
		this.loadingStats.loadedComponents++;

		if (state.startTime && state.endTime) {
			const loadTime = state.endTime - state.startTime;
			const totalLoadTime = this.loadingStats.averageLoadTime * (this.loadingStats.loadedComponents - 1) + loadTime;
			this.loadingStats.averageLoadTime = totalLoadTime / this.loadingStats.loadedComponents;

			// Update critical path time
			if (state.config.priority === LoadingPriority.CRITICAL) {
				this.loadingStats.criticalPathTime = Math.max(this.loadingStats.criticalPathTime, loadTime);
			}
		}
	}

	private processDependents(loadedComponentId: string): void {
		const loadedState = this.components.get(loadedComponentId);
		if (!loadedState) return;

		// Check if any dependent components can now be loaded
		for (const dependentId of loadedState.dependents) {
			const dependentState = this.components.get(dependentId);
			if (dependentState && dependentState.status === 'pending') {
				// Try to process the queue again
				setTimeout(() => this.processQueue(), 0);
				break;
			}
		}
	}
}

/**
 * Default priority loader instance
 */
export const streamingPriorityLoader = new StreamingPriorityLoader();

/**
 * Utility functions for priority loading
 */
export const PriorityLoadingUtils = {
	/**
	 * Create a critical component configuration
	 */
	createCriticalConfig: (overrides: Partial<ComponentLoadConfig> = {}): ComponentLoadConfig => ({
		...DEFAULT_LOAD_CONFIG,
		priority: LoadingPriority.CRITICAL,
		timeout: 2000,
		preload: true,
		...overrides,
	}),

	/**
	 * Create a high priority component configuration
	 */
	createHighPriorityConfig: (overrides: Partial<ComponentLoadConfig> = {}): ComponentLoadConfig => ({
		...DEFAULT_LOAD_CONFIG,
		priority: LoadingPriority.HIGH,
		timeout: 3000,
		preload: true,
		...overrides,
	}),

	/**
	 * Create a low priority component configuration
	 */
	createLowPriorityConfig: (overrides: Partial<ComponentLoadConfig> = {}): ComponentLoadConfig => ({
		...DEFAULT_LOAD_CONFIG,
		priority: LoadingPriority.LOW,
		timeout: 10000,
		preload: false,
		...overrides,
	}),

	/**
	 * Create an idle priority component configuration
	 */
	createIdlePriorityConfig: (overrides: Partial<ComponentLoadConfig> = {}): ComponentLoadConfig => ({
		...DEFAULT_LOAD_CONFIG,
		priority: LoadingPriority.IDLE,
		timeout: 15000,
		preload: false,
		loadWhen: () =>
			'requestIdleCallback' in window
				? new Promise(resolve => requestIdleCallback(() => resolve(true)))
				: Promise.resolve(true),
		...overrides,
	}),

	/**
	 * Create a dependency-based loading condition
	 */
	createDependencyCondition: (dependencies: string[]) => () => {
		return dependencies.every(depId => {
			const state = streamingPriorityLoader.getComponentState(depId);
			return state?.status === 'loaded';
		});
	},

	/**
	 * Create a viewport-based loading condition
	 */
	createViewportCondition: (selector: string) => () => {
		if (typeof window === 'undefined') return true;

		const element = document.querySelector(selector);
		if (!element) return false;

		const rect = element.getBoundingClientRect();
		const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

		return rect.top < viewportHeight && rect.bottom > 0;
	},

	/**
	 * Create a media query-based loading condition
	 */
	createMediaQueryCondition: (query: string) => () => {
		if (typeof window === 'undefined') return true;
		return window.matchMedia(query).matches;
	},
};
