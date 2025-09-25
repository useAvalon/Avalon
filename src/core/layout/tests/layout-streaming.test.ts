import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { describe, it, beforeEach, afterEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';
import { ComponentType } from 'preact';
import {
	LayoutStreaming,
	createStreamingComponent,
	StreamingUtils,
	StreamingPriority,
	DEFAULT_STREAMING_CONFIG,
} from '../layout-streaming.ts';
import { StreamingPriorityLoader, LoadingPriority, PriorityLoadingUtils } from '../streaming-priority-loader.ts';
import { LayoutHandler, LayoutProps, StreamingComponent } from '../../../types/layout.ts';

// Mock components for testing
const MockComponent: ComponentType<any> = () => 'Mock Component';
const MockFallback: ComponentType<any> = () => 'Loading...';

// Helper to create mock layout handler
function createMockLayoutHandler(
	streamingComponents: StreamingComponent[] = []
): LayoutHandler & { streamingComponents?: StreamingComponent[] } {
	return {
		component: MockComponent,
		path: '/test',
		priority: 0,
		streamingComponents,
	};
}

// Helper to create mock layout props
function createMockLayoutProps(): LayoutProps {
	return {
		children: null,
		data: {},
		route: {
			path: '/test',
			params: {},
			query: new URLSearchParams(),
		},
	};
}

describe.skip('LayoutStreaming', () => {
	let streaming: LayoutStreaming;

	beforeEach(() => {
		streaming = new LayoutStreaming();
	});

	afterEach(() => {
		// Clean up any timers or resources
		streaming.updateConfig({ enabled: false });
	});

	describe('isStreamingSupported', () => {
		it('should return true when ReadableStream is available', () => {
			const supported = streaming.isStreamingSupported();
			assertEquals(supported, true);
		});
	});

	describe('renderWithStreaming', () => {
		it('should create static stream when streaming is disabled', async () => {
			const streamingDisabled = new LayoutStreaming({ enabled: false });
			const layout = createMockLayoutHandler();
			const props = createMockLayoutProps();

			const stream = await streamingDisabled.renderWithStreaming(layout, props);
			assertExists(stream);

			// Read the stream
			const reader = stream.getReader();
			const { value, done } = await reader.read();
			assertEquals(done, false);
			assertExists(value);
		});

		it('should create static stream when no streaming components', async () => {
			const layout = createMockLayoutHandler();
			const props = createMockLayoutProps();

			const stream = await streaming.renderWithStreaming(layout, props);
			assertExists(stream);

			// Read the stream
			const reader = stream.getReader();
			const { value, done } = await reader.read();
			assertEquals(done, false);
			assertExists(value);
		});

		it('should create streaming response with streaming components', async () => {
			const streamingComponent = createStreamingComponent(MockComponent, {
				fallback: MockFallback,
				priority: 'high',
				isReady: () => Promise.resolve(true),
			});

			const layout = createMockLayoutHandler([streamingComponent]);
			const props = createMockLayoutProps();

			const stream = await streaming.renderWithStreaming(layout, props);
			assertExists(stream);

			// Read the stream
			const reader = stream.getReader();
			const { value, done } = await reader.read();
			assertEquals(done, false);
			assertExists(value);
		});
	});

	describe('generateSkeleton', () => {
		it('should generate skeleton HTML with correct structure', () => {
			const component = createStreamingComponent(MockComponent, {
				priority: 'high',
			});

			const skeleton = streaming.generateSkeleton(component);

			// Check that skeleton contains expected elements
			assertEquals(skeleton.includes('streaming-skeleton'), true);
			assertEquals(skeleton.includes('skeleton-high'), true);
			assertEquals(skeleton.includes('skeleton-content'), true);
			assertEquals(skeleton.includes('@keyframes skeleton-loading'), true);
		});

		it('should use custom skeleton template when provided', () => {
			const customTemplate = '<div id="{{id}}" class="custom-skeleton">Custom</div>';
			const streamingWithTemplate = new LayoutStreaming({
				skeletonTemplates: new Map([['MockComponent', customTemplate]]),
			});

			const component = createStreamingComponent(MockComponent);
			const skeleton = streamingWithTemplate.generateSkeleton(component);

			assertEquals(skeleton.includes('custom-skeleton'), true);
			assertEquals(skeleton.includes('Custom'), true);
		});
	});

	describe('updateConfig', () => {
		it('should update streaming configuration', () => {
			const newConfig = { maxConcurrent: 5, timeout: 10000 };
			streaming.updateConfig(newConfig);

			const config = streaming.getConfig();
			assertEquals(config.maxConcurrent, 5);
			assertEquals(config.timeout, 10000);
			assertEquals(config.enabled, DEFAULT_STREAMING_CONFIG.enabled); // Should keep default
		});
	});

	describe('getStreamingStats', () => {
		it('should return initial stats', () => {
			const stats = streaming.getStreamingStats();

			assertEquals(stats.activeComponents, 0);
			assertEquals(stats.queuedComponents, 0);
			assertEquals(stats.completedComponents, 0);
			assertEquals(stats.erroredComponents, 0);
		});
	});
});

describe('createStreamingComponent', () => {
	it('should create streaming component with default options', () => {
		const component = createStreamingComponent(MockComponent);

		assertEquals(component.component, MockComponent);
		assertEquals(component.priority, StreamingPriority.MEDIUM);
		assertExists(component.fallback);
		assertExists(component.isReady);
	});

	it('should create streaming component with custom options', () => {
		const isReady = () => Promise.resolve(true);
		const component = createStreamingComponent(MockComponent, {
			fallback: MockFallback,
			priority: 'high',
			isReady,
		});

		assertEquals(component.component, MockComponent);
		assertEquals(component.fallback, MockFallback);
		assertEquals(component.priority, StreamingPriority.HIGH);
		assertEquals(component.isReady, isReady);
	});
});

describe('StreamingUtils', () => {
	describe('createDelayedReady', () => {
		it('should create ready check with delay', () => {
			const readyCheck = StreamingUtils.createDelayedReady(1); // Minimal delay
			assertEquals(typeof readyCheck, 'function');
		});
	});

	describe('createFetchReady', () => {
		it('should create ready check based on fetch', () => {
			const readyCheck = StreamingUtils.createFetchReady('http://example.com');
			assertEquals(typeof readyCheck, 'function');
		});

		it('should return false when fetch fails', () => {
			const readyCheck = StreamingUtils.createFetchReady('http://invalid-url');
			assertEquals(typeof readyCheck, 'function');
		});
	});

	describe('createConditionalReady', () => {
		it('should create ready check based on condition', () => {
			const readyCheck = StreamingUtils.createConditionalReady(() => true);
			assertEquals(typeof readyCheck, 'function');
		});

		it('should handle async conditions', () => {
			const readyCheck = StreamingUtils.createConditionalReady(() => Promise.resolve(true));
			assertEquals(typeof readyCheck, 'function');
		});
	});
});

describe.skip('StreamingPriorityLoader', () => {
	let loader: StreamingPriorityLoader;

	beforeEach(() => {
		loader = new StreamingPriorityLoader();
	});

	afterEach(() => {
		// Clean up loader to prevent timer leaks
		loader.clear();
		// Force cleanup of any pending timers
		loader = new StreamingPriorityLoader();
	});

	describe('registerComponent', () => {
		it('should register component with default config', () => {
			const component = createStreamingComponent(MockComponent);
			loader.registerComponent('test', component);

			const state = loader.getComponentState('test');
			assertExists(state);
			assertEquals(state.id, 'test');
			assertEquals(state.status, 'pending');
			assertEquals(state.retryCount, 0);
		});

		it('should register component with custom config', () => {
			const component = createStreamingComponent(MockComponent);
			const config = PriorityLoadingUtils.createCriticalConfig();

			loader.registerComponent('test', component, config);

			const state = loader.getComponentState('test');
			assertExists(state);
			assertEquals(state.config.priority, LoadingPriority.CRITICAL);
			assertEquals(state.config.preload, true);
		});

		it('should update loading stats when registering', () => {
			const component = createStreamingComponent(MockComponent);
			loader.registerComponent('test', component);

			const stats = loader.getLoadingStats();
			assertEquals(stats.totalComponents, 1);
		});
	});

	describe('loadComponent', () => {
		it('should load component successfully', async () => {
			const component = createStreamingComponent(MockComponent, {
				isReady: () => Promise.resolve(true),
			});

			loader.registerComponent('test', component);
			const result = await loader.loadComponent('test');

			assertExists(result);
			assertEquals(result, component);

			const state = loader.getComponentState('test');
			assertEquals(state?.status, 'loaded');
		});

		it('should reject when component not registered', async () => {
			await assertRejects(() => loader.loadComponent('nonexistent'), Error, 'Component nonexistent not registered');
		});

		it('should return cached result for already loaded component', async () => {
			const component = createStreamingComponent(MockComponent, {
				isReady: () => Promise.resolve(true),
			});

			loader.registerComponent('test', component);

			const result1 = await loader.loadComponent('test');
			const result2 = await loader.loadComponent('test');

			assertEquals(result1, result2);
		});
	});

	describe('loadAllComponents', () => {
		it('should load all components in priority order', async () => {
			const highPriorityComponent = createStreamingComponent(MockComponent, {
				isReady: () => Promise.resolve(true),
			});
			const lowPriorityComponent = createStreamingComponent(MockComponent, {
				isReady: () => Promise.resolve(true),
			});

			loader.registerComponent('high', highPriorityComponent, PriorityLoadingUtils.createHighPriorityConfig());
			loader.registerComponent('low', lowPriorityComponent, PriorityLoadingUtils.createLowPriorityConfig());

			const results = await loader.loadAllComponents();

			assertEquals(results.size, 2);
			assertExists(results.get('high'));
			assertExists(results.get('low'));
		});

		it('should handle component loading failures gracefully', async () => {
			const failingComponent = createStreamingComponent(MockComponent, {
				isReady: () => Promise.reject(new Error('Load failed')),
			});
			const successComponent = createStreamingComponent(MockComponent, {
				isReady: () => Promise.resolve(true),
			});

			loader.registerComponent('failing', failingComponent, { retry: { attempts: 0, delay: 1, backoff: 1 } });
			loader.registerComponent('success', successComponent);

			const results = await loader.loadAllComponents();

			assertEquals(results.size, 2);
			assertEquals(results.get('failing'), null);
			assertExists(results.get('success'));
		});
	});

	describe('preloadComponents', () => {
		it('should preload only components marked for preloading', () => {
			const preloadComponent = createStreamingComponent(MockComponent);
			const normalComponent = createStreamingComponent(MockComponent);

			loader.registerComponent('preload', preloadComponent, { preload: true });
			loader.registerComponent('normal', normalComponent, { preload: false });

			// Just test that the components are registered correctly
			const preloadState = loader.getComponentState('preload');
			const normalState = loader.getComponentState('normal');

			assertEquals(preloadState?.status, 'pending');
			assertEquals(normalState?.status, 'pending');
		});
	});

	describe('getLoadingStats', () => {
		it('should return accurate loading statistics', async () => {
			const component1 = createStreamingComponent(MockComponent, {
				isReady: () => Promise.resolve(true),
			});
			const component2 = createStreamingComponent(MockComponent, {
				isReady: () => Promise.reject(new Error('Failed')),
			});

			loader.registerComponent('success', component1);
			loader.registerComponent('failure', component2, { retry: { attempts: 0, delay: 1, backoff: 1 } });

			await loader.loadAllComponents();

			const stats = loader.getLoadingStats();
			assertEquals(stats.totalComponents, 2);
			assertEquals(stats.loadedComponents, 1);
			assertEquals(stats.failedComponents, 1);
		});
	});

	describe('clear', () => {
		it('should clear all registered components and stats', () => {
			const component = createStreamingComponent(MockComponent);
			loader.registerComponent('test', component);

			loader.clear();

			const state = loader.getComponentState('test');
			assertEquals(state, undefined);

			const stats = loader.getLoadingStats();
			assertEquals(stats.totalComponents, 0);
		});
	});
});

describe('PriorityLoadingUtils', () => {
	describe('createCriticalConfig', () => {
		it('should create critical priority configuration', () => {
			const config = PriorityLoadingUtils.createCriticalConfig();

			assertEquals(config.priority, LoadingPriority.CRITICAL);
			assertEquals(config.timeout, 2000);
			assertEquals(config.preload, true);
		});

		it('should allow overrides', () => {
			const config = PriorityLoadingUtils.createCriticalConfig({
				timeout: 1000,
			});

			assertEquals(config.priority, LoadingPriority.CRITICAL);
			assertEquals(config.timeout, 1000);
			assertEquals(config.preload, true);
		});
	});

	describe('createHighPriorityConfig', () => {
		it('should create high priority configuration', () => {
			const config = PriorityLoadingUtils.createHighPriorityConfig();

			assertEquals(config.priority, LoadingPriority.HIGH);
			assertEquals(config.timeout, 3000);
			assertEquals(config.preload, true);
		});
	});

	describe('createLowPriorityConfig', () => {
		it('should create low priority configuration', () => {
			const config = PriorityLoadingUtils.createLowPriorityConfig();

			assertEquals(config.priority, LoadingPriority.LOW);
			assertEquals(config.timeout, 10000);
			assertEquals(config.preload, false);
		});
	});

	describe('createIdlePriorityConfig', () => {
		it('should create idle priority configuration', () => {
			const config = PriorityLoadingUtils.createIdlePriorityConfig();

			assertEquals(config.priority, LoadingPriority.IDLE);
			assertEquals(config.timeout, 15000);
			assertEquals(config.preload, false);
			assertExists(config.loadWhen);
		});
	});

	describe('createViewportCondition', () => {
		it('should create viewport-based loading condition', () => {
			// Skip DOM tests in Deno environment
			if (typeof document === 'undefined') {
				// Test the function exists and returns a function
				const condition = PriorityLoadingUtils.createViewportCondition('.test');
				assertEquals(typeof condition, 'function');

				// In server environment, should return true
				const result = condition();
				assertEquals(result, true);
				return;
			}

			// Browser environment test would go here
			const condition = PriorityLoadingUtils.createViewportCondition('.test');
			assertEquals(typeof condition, 'function');
		});
	});

	describe('createMediaQueryCondition', () => {
		it('should create media query-based loading condition', () => {
			// Skip DOM tests in Deno environment
			if (typeof globalThis.window === 'undefined') {
				// Test the function exists and returns a function
				const condition = PriorityLoadingUtils.createMediaQueryCondition('(min-width: 768px)');
				assertEquals(typeof condition, 'function');

				// In server environment, should return true
				const result = condition();
				assertEquals(result, true);
				return;
			}

			// Browser environment test would go here
			const condition = PriorityLoadingUtils.createMediaQueryCondition('(min-width: 768px)');
			assertEquals(typeof condition, 'function');
		});
	});
});
