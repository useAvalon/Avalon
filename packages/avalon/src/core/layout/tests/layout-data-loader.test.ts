import { describe, it, expect, beforeEach } from 'vitest';
import {
	LayoutDataLoader,
	LayoutDataLoadingError,
	createLayoutDataLoader,
	loadSingleLayoutData,
	mergeLayoutData,
	getParentLayoutData,
} from '../layout-data-loader.ts';
import type { LayoutContext, LayoutData, LayoutHandler, LayoutLoader } from '../../../schemas/layout.ts';

function createMockLayoutHandler(path: string, loader?: LayoutLoader, priority: number = 0): LayoutHandler {
	return {
		component: () => null,
		loader,
		path,
		priority,
	};
}

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
			expect(results.length).toEqual(0);
		});

		it('should load data from single layout loader', async () => {
			const testData = { message: 'Hello from layout' };
			const mockLoader: LayoutLoader = async () => testData;
			const handlers = [createMockLayoutHandler('/layout1', mockLoader)];

			const results = await loader.loadLayoutData(handlers, mockContext);

			expect(results.length).toEqual(1);
			expect(results[0].success).toEqual(true);
			expect(results[0].data).toEqual(testData);
			expect(results[0].layoutPath).toEqual('/layout1');
			expect(results[0].loadingTime >= 0).toEqual(true);
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

			expect(results.length).toEqual(2);
			expect(results[0].success).toEqual(true);
			expect(results[0].data).toEqual(testData1);
			expect(results[1].success).toEqual(true);
			expect(results[1].data).toEqual(testData2);

			expect(totalTime < 140).toEqual(true);
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

			expect(results.length).toEqual(2);
			expect(results[0].success).toEqual(false);
			expect(results[0].error).toBeInstanceOf(LayoutDataLoadingError);
			expect(results[0].layoutPath).toEqual('/layout1');
			expect(results[1].success).toEqual(true);
			expect(results[1].data).toEqual(testData);
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

			expect(results.length).toEqual(1);
			expect(results[0].success).toEqual(false);
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

			expect(results.length).toEqual(1);
			expect(results[0].success).toEqual(false);
			expect(results[0].error?.message).toContain('timed out');
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

			expect(results.length).toEqual(1);
			expect(results[0].success).toEqual(true);
			expect(results[0].data.attempt).toEqual(3);
			expect(attemptCount).toEqual(3);
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

			expect(results.length).toEqual(2);
			expect(executionOrder).toEqual(['loader1', 'loader2']);
			expect(results[0].data.order).toEqual(1);
			expect(results[1].data.order).toEqual(2);
		});
	});

	describe('processLoadingResults', () => {
		it('should process successful loading results correctly', () => {
			const handlers = [createMockLayoutHandler('/layout1'), createMockLayoutHandler('/layout2')];
			const results = [
				{ success: true, data: { layout1: 'data1' }, loadingTime: 100, layoutPath: '/layout1' },
				{ success: true, data: { layout2: 'data2' }, loadingTime: 150, layoutPath: '/layout2' },
			];

			const { data, errors } = loader.processLoadingResults(results, handlers);

			expect(data.length).toEqual(2);
			expect(data[0]).toEqual({ layout1: 'data1' });
			expect(data[1]).toEqual({ layout2: 'data2' });
			expect(errors.length).toEqual(0);
		});

		it('should handle failed loading results with fallback data', () => {
			const handlers = [createMockLayoutHandler('/layout1'), createMockLayoutHandler('/layout2')];
			const results = [
				{ success: true, data: { layout1: 'data1' }, loadingTime: 100, layoutPath: '/layout1' },
				{
					success: false,
					data: {},
					error: new LayoutDataLoadingError('Failed to load', '/layout2'),
					loadingTime: 0,
					layoutPath: '/layout2',
				},
			];

			const { data, errors } = loader.processLoadingResults(results, handlers);

			expect(data.length).toEqual(2);
			expect(data[0]).toEqual({ layout1: 'data1' });
			expect(data[1]).toEqual({});
			expect(errors.length).toEqual(1);
			expect(errors[0].layoutPath).toEqual('/layout2');
			expect(errors[0].errorType).toEqual('loader');
		});

		it('should handle handlers without loaders', () => {
			const handlers = [
				createMockLayoutHandler('/layout1'),
				createMockLayoutHandler('/layout2'),
				createMockLayoutHandler('/layout3'),
			];

			const results = [
				{ success: true, data: { layout2: 'data2' }, loadingTime: 100, layoutPath: '/layout2' },
			];

			const { data, errors } = loader.processLoadingResults(results, handlers);

			expect(data.length).toEqual(3);
			expect(data[0]).toEqual({});
			expect(data[1]).toEqual({ layout2: 'data2' });
			expect(data[2]).toEqual({});
			expect(errors.length).toEqual(0);
		});
	});

	describe('createEnhancedContext', () => {
		it('should create enhanced context with parent data', () => {
			const parentData = [{ parent1: 'data1' }, { parent2: 'data2' }];

			const enhancedContext = loader.createEnhancedContext(mockContext, parentData);

			expect(enhancedContext.request).toEqual(mockContext.request);
			expect(enhancedContext.params).toEqual(mockContext.params);
			expect(enhancedContext.query).toEqual(mockContext.query);
			expect(enhancedContext.state.get('parentLayoutData')).toEqual(parentData);
		});

		it('should not modify original context', () => {
			const originalState = new Map(mockContext.state);
			const parentData = [{ parent: 'data' }];

			loader.createEnhancedContext(mockContext, parentData);

			expect(mockContext.state).toEqual(originalState);
			expect(mockContext.state.has('parentLayoutData')).toEqual(false);
		});
	});

	describe('createFallbackData', () => {
		it('should create fallback data for failed loaders', () => {
			const error = new LayoutDataLoadingError('Test error', '/test-layout');
			const fallbackData = loader.createFallbackData('/test-layout', error);

			expect(fallbackData.__layoutError).toEqual(true);
			expect(fallbackData.__layoutPath).toEqual('/test-layout');
			expect(fallbackData.__errorMessage).toEqual('Test error');
			expect(fallbackData.__errorType).toEqual('data-loading');
			expect(typeof fallbackData.__timestamp).toEqual('number');
		});
	});

	describe('validateLayoutData', () => {
		it('should validate correct layout data', () => {
			const validData = { key: 'value', number: 42 };
			const result = loader.validateLayoutData(validData, '/test');
			expect(result).toEqual(validData);
		});

		it('should handle null and undefined data', () => {
			expect(loader.validateLayoutData(null, '/test')).toEqual({});
			expect(loader.validateLayoutData(undefined, '/test')).toEqual({});
		});

		it('should reject non-object data', () => {
			expect(() => loader.validateLayoutData('string', '/test')).toThrow(
				'Layout loader must return an object, got string'
			);

			expect(() => loader.validateLayoutData(42, '/test')).toThrow(
				'Layout loader must return an object, got number'
			);
		});

		it('should reject array data', () => {
			expect(() => loader.validateLayoutData(['array'], '/test')).toThrow(
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
			expect(options.timeout).toEqual(2000);
			expect(options.enableParallelLoading).toEqual(false);
		});
	});

	describe('loadSingleLayoutData', () => {
		it('should load data for single layout handler', async () => {
			const testData = { single: 'data' };
			const mockLoader: LayoutLoader = async () => testData;
			const handler = createMockLayoutHandler('/single-layout', mockLoader);
			const context = createMockLayoutContext();

			const result = await loadSingleLayoutData(handler, context);

			expect(result.success).toEqual(true);
			expect(result.data).toEqual(testData);
			expect(result.layoutPath).toEqual('/single-layout');
		});

		it('should handle handler without loader', async () => {
			const handler = createMockLayoutHandler('/no-loader');
			const context = createMockLayoutContext();

			const result = await loadSingleLayoutData(handler, context);

			expect(result.success).toEqual(true);
			expect(result.data).toEqual({});
			expect(result.layoutPath).toEqual('/no-loader');
		});
	});

	describe('mergeLayoutData', () => {
		it('should merge multiple layout data objects', () => {
			const data1 = { key1: 'value1', shared: 'from1' };
			const data2 = { key2: 'value2', shared: 'from2' };
			const data3 = { key3: 'value3' };

			const merged = mergeLayoutData(data1, data2, data3);

			expect(merged).toEqual({
				key1: 'value1',
				key2: 'value2',
				key3: 'value3',
				shared: 'from2',
			});
		});

		it('should handle empty and invalid data sources', () => {
			const validData = { key: 'value' };
			const merged = mergeLayoutData(validData, null as any, undefined as any, [] as any, 'string' as any);

			expect(merged).toEqual({ key: 'value' });
		});
	});

	describe('getParentLayoutData', () => {
		it('should extract parent data from context', () => {
			const parentData = [{ parent1: 'data1' }, { parent2: 'data2' }];
			const context = createMockLayoutContext();
			context.state.set('parentLayoutData', parentData);

			const extracted = getParentLayoutData(context);
			expect(extracted).toEqual(parentData);
		});

		it('should return empty array when no parent data exists', () => {
			const context = createMockLayoutContext();
			const extracted = getParentLayoutData(context);
			expect(extracted).toEqual([]);
		});

		it('should return empty array when parent data is not an array', () => {
			const context = createMockLayoutContext();
			context.state.set('parentLayoutData', 'not-an-array');

			const extracted = getParentLayoutData(context);
			expect(extracted).toEqual([]);
		});
	});
});

describe('LayoutDataLoadingError', () => {
	it('should create error with layout path and original error', () => {
		const originalError = new Error('Original error');
		const layoutError = new LayoutDataLoadingError('Layout loading failed', '/test-layout', originalError);

		expect(layoutError.message).toEqual('Layout loading failed');
		expect(layoutError.layoutPath).toEqual('/test-layout');
		expect(layoutError.originalError).toEqual(originalError);
		expect(layoutError.name).toEqual('LayoutDataLoadingError');
	});

	it('should create error without original error', () => {
		const layoutError = new LayoutDataLoadingError('Layout loading failed', '/test-layout');

		expect(layoutError.message).toEqual('Layout loading failed');
		expect(layoutError.layoutPath).toEqual('/test-layout');
		expect(layoutError.originalError).toEqual(undefined);
	});
});
