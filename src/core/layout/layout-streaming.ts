import { ComponentType, ComponentChildren } from 'preact';
import { render as preactRenderToString } from 'preact-render-to-string';
import {
	LayoutHandler,
	LayoutProps,
	StreamingComponent,
	StreamingLayoutProps,
	ILayoutStreaming,
} from '../../types/layout.ts';

/**
 * Priority levels for streaming components
 */
export enum StreamingPriority {
	HIGH = 0,
	MEDIUM = 1,
	LOW = 2,
}

/**
 * Streaming configuration options
 */
export interface StreamingConfig {
	/**
	 * Enable streaming support
	 */
	enabled: boolean;

	/**
	 * Maximum concurrent streaming components
	 */
	maxConcurrent: number;

	/**
	 * Timeout for component loading (ms)
	 */
	timeout: number;

	/**
	 * Enable skeleton generation
	 */
	enableSkeletons: boolean;

	/**
	 * Custom skeleton templates
	 */
	skeletonTemplates?: Map<string, string>;
}

/**
 * Default streaming configuration
 */
export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
	enabled: true,
	maxConcurrent: 3,
	timeout: 5000,
	enableSkeletons: true,
};

/**
 * Streaming component state
 */
interface StreamingComponentState {
	component: StreamingComponent;
	isReady: boolean;
	isLoading: boolean;
	error?: Error;
	content?: string;
	placeholder: string;
}

/**
 * Layout Streaming implementation for progressive rendering
 */
export class LayoutStreaming implements ILayoutStreaming {
	private config: StreamingConfig;
	private componentStates = new Map<string, StreamingComponentState>();
	private loadingQueue: StreamingComponent[] = [];
	private activeLoads = new Set<string>();

	constructor(config: Partial<StreamingConfig> = {}) {
		this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };
	}

	/**
	 * Check if streaming is supported in current environment
	 */
	isStreamingSupported(): boolean {
		// Check if ReadableStream is available
		if (typeof ReadableStream === 'undefined') {
			return false;
		}

		// Check if we're in a browser environment that supports streaming
		if (typeof window !== 'undefined') {
			return 'ReadableStream' in window;
		}

		// Server-side streaming support
		return true;
	}

	/**
	 * Render layout with streaming support
	 */
	async renderWithStreaming(layout: LayoutHandler, props: LayoutProps): Promise<ReadableStream> {
		if (!this.config.enabled || !this.isStreamingSupported()) {
			// Fallback to regular rendering
			const content = preactRenderToString(layout.component(props));
			return this.createStaticStream(content);
		}

		// Extract streaming components from layout
		const streamingComponents = this.extractStreamingComponents(layout, props);

		if (streamingComponents.length === 0) {
			// No streaming components, render normally
			const content = preactRenderToString(layout.component(props));
			return this.createStaticStream(content);
		}

		// Create streaming response
		return this.createStreamingResponse(streamingComponents);
	}

	/**
	 * Create streaming response for multiple components
	 */
	createStreamingResponse(components: StreamingComponent[]): ReadableStream {
		const encoder = new TextEncoder();
		let isFirstChunk = true;

		return new ReadableStream({
			start: controller => {
				// Initialize component states
				components.forEach((component, index) => {
					const id = this.getComponentId(component, index);
					const placeholder = this.generateSkeleton(component);

					this.componentStates.set(id, {
						component,
						isReady: false,
						isLoading: false,
						error: undefined,
						content: undefined,
						placeholder,
					});
				});

				// Sort components by priority
				const sortedComponents = [...components].sort((a, b) => a.priority - b.priority);

				// Start loading components
				this.startComponentLoading(sortedComponents, controller, encoder);

				// Send initial HTML with skeletons
				if (isFirstChunk) {
					const initialHtml = this.generateInitialHtml(components);
					controller.enqueue(encoder.encode(initialHtml));
					isFirstChunk = false;
				}
			},

			cancel: () => {
				// Clean up any ongoing loads
				this.activeLoads.clear();
				this.componentStates.clear();
			},
		});
	}

	/**
	 * Generate skeleton placeholder for a component
	 */
	generateSkeleton(component: StreamingComponent): string {
		const componentName = component.component.name || 'Component';
		const id = `streaming-${componentName.toLowerCase()}-${Date.now()}`;

		// Check for custom skeleton template
		if (this.config.skeletonTemplates?.has(componentName)) {
			return this.config.skeletonTemplates.get(componentName)!.replace('{{id}}', id);
		}

		// Generate default skeleton based on priority
		const skeletonClass = this.getSkeletonClass(component.priority);

		return `
			<div id="${id}" class="streaming-skeleton ${skeletonClass}" data-component="${componentName}">
				<div class="skeleton-content">
					<div class="skeleton-line skeleton-line-1"></div>
					<div class="skeleton-line skeleton-line-2"></div>
					<div class="skeleton-line skeleton-line-3"></div>
				</div>
				<style>
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
				</style>
			</div>
		`;
	}

	/**
	 * Update streaming configuration
	 */
	updateConfig(config: Partial<StreamingConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get current streaming configuration
	 */
	getConfig(): StreamingConfig {
		return { ...this.config };
	}

	/**
	 * Get streaming statistics
	 */
	getStreamingStats(): {
		activeComponents: number;
		queuedComponents: number;
		completedComponents: number;
		erroredComponents: number;
	} {
		const states = Array.from(this.componentStates.values());

		return {
			activeComponents: this.activeLoads.size,
			queuedComponents: this.loadingQueue.length,
			completedComponents: states.filter(s => s.isReady && !s.error).length,
			erroredComponents: states.filter(s => s.error).length,
		};
	}

	// Private helper methods

	private createStaticStream(content: string): ReadableStream {
		const encoder = new TextEncoder();

		return new ReadableStream({
			start(controller) {
				controller.enqueue(encoder.encode(content));
				controller.close();
			},
		});
	}

	private extractStreamingComponents(layout: LayoutHandler, props: LayoutProps): StreamingComponent[] {
		// This is a simplified extraction - in a real implementation,
		// you would analyze the layout component tree to find streaming components
		const components: StreamingComponent[] = [];

		// For now, we'll check if the layout component has streaming metadata
		if ('streamingComponents' in layout && Array.isArray(layout.streamingComponents)) {
			components.push(...layout.streamingComponents);
		}

		return components;
	}

	private getComponentId(component: StreamingComponent, index: number): string {
		const name = component.component.name || `Component${index}`;
		return `${name}-${index}-${Date.now()}`;
	}

	private getSkeletonClass(priority: number): string {
		switch (priority) {
			case StreamingPriority.HIGH:
				return 'skeleton-high';
			case StreamingPriority.MEDIUM:
				return 'skeleton-medium';
			case StreamingPriority.LOW:
				return 'skeleton-low';
			default:
				return 'skeleton-medium';
		}
	}

	private generateInitialHtml(components: StreamingComponent[]): string {
		const skeletons = components
			.map((component, index) => {
				const id = this.getComponentId(component, index);
				const state = this.componentStates.get(id);
				return state?.placeholder || '';
			})
			.join('\n');

		return `
			<div class="streaming-layout">
				${skeletons}
			</div>
		`;
	}

	private async startComponentLoading(
		components: StreamingComponent[],
		controller: ReadableStreamDefaultController,
		encoder: TextEncoder
	): Promise<void> {
		// Process components in priority order with concurrency control
		const processingPromises: Promise<void>[] = [];

		for (const component of components) {
			// Wait if we've reached max concurrent loads
			while (this.activeLoads.size >= this.config.maxConcurrent) {
				await new Promise(resolve => setTimeout(resolve, 10));
			}

			const promise = this.loadComponent(component, controller, encoder);
			processingPromises.push(promise);
		}

		// Wait for all components to complete
		await Promise.allSettled(processingPromises);

		// Close the stream
		controller.close();
	}

	private async loadComponent(
		component: StreamingComponent,
		controller: ReadableStreamDefaultController,
		encoder: TextEncoder
	): Promise<void> {
		const id = this.getComponentId(component, 0);
		const state = this.componentStates.get(id);

		if (!state) return;

		this.activeLoads.add(id);
		state.isLoading = true;

		try {
			// Wait for component to be ready with timeout
			const isReady = await Promise.race([
				component.isReady(),
				new Promise<boolean>(resolve => setTimeout(() => resolve(false), this.config.timeout)),
			]);

			if (!isReady) {
				throw new Error(`Component loading timeout after ${this.config.timeout}ms`);
			}

			// Render the component
			const content = preactRenderToString(component.component({}));
			state.content = content;
			state.isReady = true;

			// Send replacement HTML
			const replacementHtml = this.generateReplacementHtml(id, content);
			controller.enqueue(encoder.encode(replacementHtml));
		} catch (error) {
			state.error = error as Error;

			// Render fallback component
			const fallbackContent = preactRenderToString(component.fallback({}));
			const replacementHtml = this.generateReplacementHtml(id, fallbackContent);
			controller.enqueue(encoder.encode(replacementHtml));
		} finally {
			state.isLoading = false;
			this.activeLoads.delete(id);
		}
	}

	private generateReplacementHtml(id: string, content: string): string {
		return `
			<script>
				(function() {
					const element = document.getElementById('${id}');
					if (element) {
						element.outerHTML = \`${content.replace(/`/g, '\\`')}\`;
					}
				})();
			</script>
		`;
	}
}

/**
 * Default layout streaming instance
 */
export const layoutStreaming = new LayoutStreaming();

/**
 * Create a streaming component wrapper
 */
export function createStreamingComponent(
	component: ComponentType<any>,
	options: {
		fallback?: ComponentType<any>;
		priority?: 'high' | 'medium' | 'low';
		isReady?: () => Promise<boolean>;
	} = {}
): StreamingComponent {
	const priorityMap = {
		high: StreamingPriority.HIGH,
		medium: StreamingPriority.MEDIUM,
		low: StreamingPriority.LOW,
	};

	return {
		component,
		fallback: options.fallback || (() => null),
		priority: priorityMap[options.priority || 'medium'],
		isReady: options.isReady || (() => Promise.resolve(true)),
	};
}

/**
 * Streaming component utilities
 */
export const StreamingUtils = {
	/**
	 * Create a delay-based ready check
	 */
	createDelayedReady: (delay: number) => () => new Promise<boolean>(resolve => setTimeout(() => resolve(true), delay)),

	/**
	 * Create a fetch-based ready check
	 */
	createFetchReady: (url: string) => async () => {
		try {
			const response = await fetch(url);
			return response.ok;
		} catch {
			return false;
		}
	},

	/**
	 * Create a condition-based ready check
	 */
	createConditionalReady: (condition: () => boolean | Promise<boolean>) => async () => {
		const result = condition();
		return result instanceof Promise ? await result : result;
	},
};
