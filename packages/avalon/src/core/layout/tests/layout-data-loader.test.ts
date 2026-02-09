import { assertEquals, assertThrows, assert } from '@std/assert';
import { describe, it, beforeEach } from '@std/testing/bdd';
import {
	LayoutDataLoader,
	LayoutDataLoadingError,
	createLayoutDataLoader,
	loadSingleLayoutData,
	mergeLayoutData,
	getParentLayoutData,
} from '../layout-data-loader.ts';
import type { LayoutContext, LayoutData, LayoutHandler, LayoutLoader } from '../../../schemas/layout.ts';

// Mock layout handlers for testing
function createMockLayoutHandler(path: string, loader?: LayoutLoader, priority: number = 0): LayoutHandler {
	return {
		component: () => null,
		loader,
		path,
		priority,
	};
}

// Mock layout context for testing
function createMockLayoutContext(): LayoutContext {
	return {
		request: new Request('http://localhost/test'),
		params: { id: '123' },
		query: new URLSearchParams('?test=value'),
		state: new Map(),
	};
}

describe('LayoutDataLoader', () => {
	let loader: LayoutDataLoader;
	let mockContext: LayoutContext;

	beforeEach(() => {
		loader = new LayoutDataLoader({
			developmentMode: true,
			timeout: 1000,
		});
		mockContext = createMockLayoutContext();
	});

	describe('loadLayoutData', () => {
		it('should return empty array when no handlers have loaders', async () => {
			const handlers = [createMockLayoutHandler('/layout1'), createMockLayoutHandler('/layout2')];

			const results = await loader.loadLayoutData(handlers, mockContext);
			assertEquals(results.length, 0);
		});

		it('should load data from single layout loader', async () => {
			const testData = { message: 'Hello from layout' };
			const mockLoader: LayoutLoader = async () => testData;
			const handlers = [createMockLayoutHandler('/layout1', mockLoader)];

			const results = await loader.loadLayoutData(handlers, mockContext);

			assertEquals(results.length, 1);
			assertEquals(results[0].success, true);
			assertEquals(results[0].data, testData);
			assertEquals(results[0].layoutPath, '/layout1');
			assert(results[0].loadingTime >= 0);
		});

		it('should load data from multiple layout loaders in parallel', async () => {
			const testData1 = { layout1: 'data1' };
			const testData2 = { layout2: 'data2' };

			const mockLoader1: LayoutLoader = async () => {
				await new Promise(resolve => setTimeout(resolve, 100));
				return testData1;
			};
			const mockLoader2: LayoutLoader = async () => {
				await new Promise(resolve => setTimeout(resolve, 50));
				return testData2;
			};

			const handlers = [
				createMockLayoutHandler('/layout1', mockLoader1),
				createMockLayoutHandler('/layout2', mockLoader2),
			];

			const startTime = performance.now();
			const results = await loader.loadLayoutData(handlers, mockContext);
			const totalTime = performance.now() - startTime;

			assertEquals(results.length, 2);
			assertEquals(results[0].success, true);
			assertEquals(results[0].data, testData1);
			assertEquals(results[1].success, true);
			assertEquals(results[1].data, testData2);

			// Should complete in parallel (less than sequential time)
			assert(totalTime < 140); // Should be closer to 100ms than 150ms
		});

		it('should handle loader errors gracefully when continueOnError is true', async () => {
			const testData = { layout2: 'success' };
			const errorLoader: LayoutLoader = async () => {
				throw new Error('Loader failed');
			};
			const successLoader: LayoutLoader = async () => testData;

			const handlers = [
				createMockLayoutHandler('/layout1', errorLoader),
				createMockLayoutHandler('/layout2', successLoader),
			];

			const results = await loader.loadLayoutData(handlers, mockContext);

			assertEquals(results.length, 2);
			assertEquals(results[0].success, false);
			assert(results[0].error instanceof LayoutDataLoadingError);
			assertEquals(results[0].layoutPath, '/layout1');
			assertEquals(results[1].success, true);
			assertEquals(results[1].data, testData);
		});

		it('should fail fast when continueOnError is false', async () => {
			const loaderWithError = new LayoutDataLoader({
				continueOnError: false,
				enableParallelLoading: false,
			});

			const errorLoader: LayoutLoader = async () => {
				throw new Error('First loader failed');
			};
			const successLoader: LayoutLoader = async () => ({ success: true });

			const handlers = [
				createMockLayoutHandler('/layout1', errorLoader),
				createMockLayoutHandler('/layout2', successLoader),
			];

			const results = await loaderWithError.loadLayoutData(handlers, mockContext);

			assertEquals(results.length, 1);
			assertEquals(results[0].success, false);
		});

		it('should handle timeout errors', async () => {
			const timeoutLoader = new LayoutDataLoader({
				timeout: 100,
			});

			const slowLoader: LayoutLoader = async () => {
				await new Promise(resolve => setTimeout(resolve, 200));
				return { data: 'slow' };
			};

			const handlers = [createMockLayoutHandler('/slow-layout', slowLoader)];
			const results = await timeoutLoader.loadLayoutData(handlers, mockContext);

			assertEquals(results.length, 1);
			assertEquals(results[0].success, false);
			assert(results[0].error?.message.includes('timed out'));
		});

		it('should retry failed loaders', async () => {
			let attemptCount = 0;
			const retryLoader: LayoutLoader = async () => {
				attemptCount++;
				if (attemptCount < 3) {
					throw new Error(`Attempt ${attemptCount} failed`);
				}
				return { attempt: attemptCount };
			};

			const retryingLoader = new LayoutDataLoader({
				maxRetries: 2,
				retryDelay: 10,
			});

			const handlers = [createMockLayoutHandler('/retry-layout', retryLoader)];
			const results = await retryingLoader.loadLayoutData(handlers, mockContext);

			assertEquals(results.length, 1);
			assertEquals(results[0].success, true);
			assertEquals(results[0].data.attempt, 3);
			assertEquals(attemptCount, 3);
		});

		it('should load data sequentially when parallel loading is disabled', async () => {
			const sequentialLoader = new LayoutDataLoader({
				enableParallelLoading: false,
			});

			let executionOrder: string[] = [];

			const loader1: LayoutLoader = async () => {
				await new Promise(resolve => setTimeout(resolve, 50));
				executionOrder.push('loader1');
				return { order: 1 };
			};

			const loader2: LayoutLoader = async () => {
				await new Promise(resolve => setTimeout(resolve, 30));
				executionOrder.push('loader2');
				return { order: 2 };
			};

			const handlers = [createMockLayoutHandler('/layout1', loader1), createMockLayoutHandler('/layout2', loader2)];

			const results = await sequentialLoader.loadLayoutData(handlers, mockContext);

			assertEquals(results.length, 2);
			assertEquals(executionOrder, ['loader1', 'loader2']);
			assertEquals(results[0].data.order, 1);
			assertEquals(results[1].data.order, 2);
		});
	});

	describe('processLoadingResults', () => {
		it('should process successful loading results correctly', () => {
			const handlers = [createMockLayoutHandler('/layout1'), createMockLayoutHandler('/layout2')];

			const results = [
				{
					success: true,
					data: { layout1: 'data1' },
					loadingTime: 100,
					layoutPath: '/layout1',
				},
				{
					success: true,
					data: { layout2: 'data2' },
					loadingTime: 150,
					layoutPath: '/layout2',
				},
			];

			const { data, errors } = loader.processLoadingResults(results, handlers);

			assertEquals(data.length, 2);
			assertEquals(data[0], { layout1: 'data1' });
			assertEquals(data[1], { layout2: 'data2' });
			assertEquals(errors.length, 0);
		});

		it('should handle failed loading results with fallback data', () => {
			const handlers = [createMockLayoutHandler('/layout1'), createMockLayoutHandler('/layout2')];

			const results = [
				{
					success: true,
					data: { layout1: 'data1' },
					loadingTime: 100,
					layoutPath: '/layout1',
				},
				{
					success: false,
					data: {},
					error: new LayoutDataLoadingError('Failed to load', '/layout2'),
					loadingTime: 0,
					layoutPath: '/layout2',
				},
			];

			const { data, errors } = loader.processLoadingResults(results, handlers);

			assertEquals(data.length, 2);
			assertEquals(data[0], { layout1: 'data1' });
			assertEquals(data[1], {});
			assertEquals(errors.length, 1);
			assertEquals(errors[0].layoutPath, '/layout2');
			assertEquals(errors[0].errorType, 'loader');
		});

		it('should handle handlers without loaders', () => {
			const handlers = [
				createMockLayoutHandler('/layout1'),
				createMockLayoutHandler('/layout2'),
				createMockLayoutHandler('/layout3'),
			];

			const results = [
				{
					success: true,
					data: { layout2: 'data2' },
					loadingTime: 100,
					layoutPath: '/layout2',
				},
			];

			const { data, errors } = loader.processLoadingResults(results, handlers);

			assertEquals(data.length, 3);
			assertEquals(data[0], {}); // No loader for layout1
			assertEquals(data[1], { layout2: 'data2' });
			assertEquals(data[2], {}); // No loader for layout3
			assertEquals(errors.length, 0);
		});
	});

	describe('createEnhancedContext', () => {
		it('should create enhanced context with parent data', () => {
			const parentData = [{ parent1: 'data1' }, { parent2: 'data2' }];

			const enhancedContext = loader.createEnhancedContext(mockContext, parentData);

			assertEquals(enhancedContext.request, mockContext.request);
			assertEquals(enhancedContext.params, mockContext.params);
			assertEquals(enhancedContext.query, mockContext.query);
			assertEquals(enhancedContext.state.get('parentLayoutData'), parentData);
		});

		it('should not modify original context', () => {
			const originalState = new Map(mockContext.state);
			const parentData = [{ parent: 'data' }];

			loader.createEnhancedContext(mockContext, parentData);

			assertEquals(mockContext.state, originalState);
			assertEquals(mockContext.state.has('parentLayoutData'), false);
		});
	});

	describe('createFallbackData', () => {
		it('should create fallback data for failed loaders', () => {
			const error = new LayoutDataLoadingError('Test error', '/test-layout');
			const fallbackData = loader.createFallbackData('/test-layout', error);

			assertEquals(fallbackData.__layoutError, true);
			assertEquals(fallbackData.__layoutPath, '/test-layout');
			assertEquals(fallbackData.__errorMessage, 'Test error');
			assertEquals(fallbackData.__errorType, 'data-loading');
			assert(typeof fallbackData.__timestamp === 'number');
		});
	});

	describe('validateLayoutData', () => {
		it('should validate correct layout data', () => {
			const validData = { key: 'value', number: 42 };
			const result = loader.validateLayoutData(validData, '/test');
			assertEquals(result, validData);
		});

		it('should handle null and undefined data', () => {
			assertEquals(loader.validateLayoutData(null, '/test'), {});
			assertEquals(loader.validateLayoutData(undefined, '/test'), {});
		});

		it('should reject non-object data', () => {
			assertThrows(
				() => loader.validateLayoutData('string', '/test'),
				LayoutDataLoadingError,
				'Layout loader must return an object, got string'
			);

			assertThrows(
				() => loader.validateLayoutData(42, '/test'),
				LayoutDataLoadingError,
				'Layout loader must return an object, got number'
			);
		});

		it('should reject array data', () => {
			assertThrows(
				() => loader.validateLayoutData(['array'], '/test'),
				LayoutDataLoadingError,
				'Layout loader must return an object, not an array'
			);
		});
	});
});

describe('Utility Functions', () => {
	describe('createLayoutDataLoader', () => {
		it('should create loader with custom options', () => {
			const customLoader = createLayoutDataLoader({
				timeout: 2000,
				enableParallelLoading: false,
			});

			const options = customLoader.getOptions();
			assertEquals(options.timeout, 2000);
			assertEquals(options.enableParallelLoading, false);
		});
	});

	describe('loadSingleLayoutData', () => {
		it('should load data for single layout handler', async () => {
			const testData = { single: 'data' };
			const mockLoader: LayoutLoader = async () => testData;
			const handler = createMockLayoutHandler('/single-layout', mockLoader);
			const context = createMockLayoutContext();

			const result = await loadSingleLayoutData(handler, context);

			assertEquals(result.success, true);
			assertEquals(result.data, testData);
			assertEquals(result.layoutPath, '/single-layout');
		});

		it('should handle handler without loader', async () => {
			const handler = createMockLayoutHandler('/no-loader');
			const context = createMockLayoutContext();

			const result = await loadSingleLayoutData(handler, context);

			assertEquals(result.success, true);
			assertEquals(result.data, {});
			assertEquals(result.layoutPath, '/no-loader');
		});
	});

	describe('mergeLayoutData', () => {
		it('should merge multiple layout data objects', () => {
			const data1 = { key1: 'value1', shared: 'from1' };
			const data2 = { key2: 'value2', shared: 'from2' };
			const data3 = { key3: 'value3' };

			const merged = mergeLayoutData(data1, data2, data3);

			assertEquals(merged, {
				key1: 'value1',
				key2: 'value2',
				key3: 'value3',
				shared: 'from2', // Later values override earlier ones
			});
		});

		it('should handle empty and invalid data sources', () => {
			const validData = { key: 'value' };
			const merged = mergeLayoutData(validData, null as any, undefined as any, [] as any, 'string' as any);

			assertEquals(merged, { key: 'value' });
		});
	});

	describe('getParentLayoutData', () => {
		it('should extract parent data from context', () => {
			const parentData = [{ parent1: 'data1' }, { parent2: 'data2' }];
			const context = createMockLayoutContext();
			context.state.set('parentLayoutData', parentData);

			const extracted = getParentLayoutData(context);
			assertEquals(extracted, parentData);
		});

		it('should return empty array when no parent data exists', () => {
			const context = createMockLayoutContext();
			const extracted = getParentLayoutData(context);
			assertEquals(extracted, []);
		});

		it('should return empty array when parent data is not an array', () => {
			const context = createMockLayoutContext();
			context.state.set('parentLayoutData', 'not-an-array');

			const extracted = getParentLayoutData(context);
			assertEquals(extracted, []);
		});
	});
});

describe('LayoutDataLoadingError', () => {
	it('should create error with layout path and original error', () => {
		const originalError = new Error('Original error');
		const layoutError = new LayoutDataLoadingError('Layout loading failed', '/test-layout', originalError);

		assertEquals(layoutError.message, 'Layout loading failed');
		assertEquals(layoutError.layoutPath, '/test-layout');
		assertEquals(layoutError.originalError, originalError);
		assertEquals(layoutError.name, 'LayoutDataLoadingError');
	});

	it('should create error without original error', () => {
		const layoutError = new LayoutDataLoadingError('Layout loading failed', '/test-layout');

		assertEquals(layoutError.message, 'Layout loading failed');
		assertEquals(layoutError.layoutPath, '/test-layout');
		assertEquals(layoutError.originalError, undefined);
	});
});
