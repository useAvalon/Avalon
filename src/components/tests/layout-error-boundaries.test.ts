import { assertEquals, assertExists, assertThrows } from 'jsr:@std/assert';
import { describe, it, beforeEach, afterEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';
import { LayoutErrorRecovery } from '../../core/layout/layout-error-recovery.ts';
import { LayoutErrorLogger, layoutErrorLogger } from '../../core/layout/layout-error-logger.ts';
import {
	LayoutErrorBoundaryManager,
	layoutErrorBoundaryManager,
	ErrorBoundaryUtils,
} from '../../core/layout/layout-error-boundary-manager.ts';
import { LayoutContext, LayoutErrorInfo, ErrorRecoveryStrategy } from '../../types/layout.ts';

describe('Layout Error Recovery', () => {
	let errorRecovery: LayoutErrorRecovery;
	let mockContext: LayoutContext;

	beforeEach(() => {
		errorRecovery = new LayoutErrorRecovery();
		mockContext = {
			request: new Request('https://example.com/test'),
			params: {},
			query: new URLSearchParams(),
			state: new Map(),
		};
	});

	it('should handle retry strategy', async () => {
		const error = new Error('Test loader error');
		const errorInfo: LayoutErrorInfo = {
			layoutPath: '/test/_layout.tsx',
			errorType: 'loader',
			timestamp: Date.now(),
		};

		const response = await errorRecovery.handleLayoutError(error, mockContext, errorInfo);

		assertEquals(response.status, 500);
		assertEquals(response.headers.get('X-Layout-Error'), 'retry');
		assertExists(response.headers.get('X-Max-Retries'));
	});

	it('should handle fallback strategy', async () => {
		const error = new Error('Test component error');
		const errorInfo: LayoutErrorInfo = {
			layoutPath: '/test/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		};

		const response = await errorRecovery.handleLayoutError(error, mockContext, errorInfo);

		assertEquals(response.status, 500);
		assertEquals(response.headers.get('X-Layout-Error'), 'fallback');
	});

	it('should handle skip strategy', async () => {
		const error = new Error('Test island error');
		const errorInfo: LayoutErrorInfo = {
			layoutPath: 'island:test-island',
			errorType: 'island',
			timestamp: Date.now(),
		};

		const response = await errorRecovery.handleLayoutError(error, mockContext, errorInfo);

		assertEquals(response.status, 200);
		assertEquals(response.headers.get('X-Layout-Error'), 'skip');
	});

	it('should handle redirect strategy', async () => {
		const strategy: ErrorRecoveryStrategy = {
			type: 'redirect',
			redirectUrl: '/error-page',
		};

		errorRecovery.registerStrategy('component', strategy);

		const error = new Error('Test error');
		const errorInfo: LayoutErrorInfo = {
			layoutPath: '/test/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		};

		const response = await errorRecovery.handleLayoutError(error, mockContext, errorInfo);

		assertEquals(response.status, 302);
		assertEquals(response.headers.get('Location'), '/error-page');
	});

	it('should register and use custom strategies', () => {
		const customStrategy: ErrorRecoveryStrategy = {
			type: 'fallback',
			maxRetries: 5,
		};

		errorRecovery.registerStrategy('custom', customStrategy);
		const retrievedStrategy = errorRecovery.getStrategy(new Error('test'));

		// Should use default strategy since error type doesn't match
		assertExists(retrievedStrategy);
	});

	it('should infer error types correctly', () => {
		const loaderError = new Error('Failed to load data');
		const renderError = new Error('Render failed');
		const islandError = new Error('Island component crashed');

		const loaderStrategy = errorRecovery.getStrategy(loaderError);
		const renderStrategy = errorRecovery.getStrategy(renderError);
		const islandStrategy = errorRecovery.getStrategy(islandError);

		assertExists(loaderStrategy);
		assertExists(renderStrategy);
		assertExists(islandStrategy);
	});
});

describe('Layout Error Logger', () => {
	let logger: LayoutErrorLogger;

	beforeEach(() => {
		logger = new LayoutErrorLogger();
	});

	afterEach(() => {
		logger.clearLogs();
	});

	it('should log errors with proper structure', () => {
		const error = new Error('Test error');
		const errorInfo: LayoutErrorInfo = {
			layoutPath: '/test/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		};

		const errorId = logger.logError(error, errorInfo);

		assertExists(errorId);
		assertEquals(typeof errorId, 'string');

		const logs = logger.getErrorLogs();
		assertEquals(logs.length, 1);
		assertEquals(logs[0].error.message, 'Test error');
		assertEquals(logs[0].errorInfo?.layoutPath, '/test/_layout.tsx');
	});

	it('should mark errors as resolved', () => {
		const error = new Error('Test error');
		const errorId = logger.logError(error);

		logger.markResolved(errorId);

		const logs = logger.getErrorLogs();
		assertEquals(logs[0].resolved, true);
	});

	it('should increment retry counts', () => {
		const error = new Error('Test error');
		const errorId = logger.logError(error);

		logger.incrementRetryCount(errorId);
		logger.incrementRetryCount(errorId);

		const logs = logger.getErrorLogs();
		assertEquals(logs[0].retryCount, 2);
	});

	it('should filter logs correctly', () => {
		const error1 = new Error('Error 1');
		const error2 = new Error('Error 2');

		const errorInfo1: LayoutErrorInfo = {
			layoutPath: '/layout1/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		};

		const errorInfo2: LayoutErrorInfo = {
			layoutPath: '/layout2/_layout.tsx',
			errorType: 'loader',
			timestamp: Date.now(),
		};

		logger.logError(error1, errorInfo1);
		logger.logError(error2, errorInfo2);

		const componentErrors = logger.getErrorLogs({ errorType: 'component' });
		const loaderErrors = logger.getErrorLogs({ errorType: 'loader' });
		const layout1Errors = logger.getErrorLogs({ layoutPath: '/layout1/_layout.tsx' });

		assertEquals(componentErrors.length, 1);
		assertEquals(loaderErrors.length, 1);
		assertEquals(layout1Errors.length, 1);
	});

	it('should generate error statistics', () => {
		const error1 = new Error('Error 1');
		const error2 = new Error('Error 2');

		const errorId1 = logger.logError(error1, {
			layoutPath: '/layout1/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		});

		logger.logError(error2, {
			layoutPath: '/layout1/_layout.tsx',
			errorType: 'loader',
			timestamp: Date.now(),
		});

		logger.markResolved(errorId1);
		logger.incrementRetryCount(errorId1);

		const stats = logger.getErrorStats();

		assertEquals(stats.total, 2);
		assertEquals(stats.resolved, 1);
		assertEquals(stats.unresolved, 1);
		assertEquals(stats.byType.component, 1);
		assertEquals(stats.byType.loader, 1);
		assertEquals(stats.byLayout['/layout1/_layout.tsx'], 2);
		assertEquals(stats.averageRetries, 0.5);
	});

	it('should export logs as JSON', () => {
		const error = new Error('Test error');
		logger.logError(error);

		const exported = logger.exportLogs();
		const parsed = JSON.parse(exported);

		assertEquals(Array.isArray(parsed), true);
		assertEquals(parsed.length, 1);
		assertEquals(parsed[0].error.message, 'Test error');
	});
});

describe('Layout Error Boundary Manager', () => {
	let manager: LayoutErrorBoundaryManager;

	beforeEach(() => {
		manager = new LayoutErrorBoundaryManager();
	});

	afterEach(() => {
		manager.resetAllBoundaries();
	});

	it('should register error boundaries', () => {
		const config = ErrorBoundaryUtils.createStandardConfig('layout');
		const boundaryId = ErrorBoundaryUtils.generateBoundaryId('layout', '/test/_layout.tsx');

		manager.registerErrorBoundary(boundaryId, '/test/_layout.tsx', config);

		const registrations = manager.getRegistrations();
		assertEquals(registrations.length, 1);
		assertEquals(registrations[0].id, boundaryId);
		assertEquals(registrations[0].layoutPath, '/test/_layout.tsx');
	});

	it('should handle errors from boundaries', () => {
		const config = ErrorBoundaryUtils.createStandardConfig('layout');
		const boundaryId = ErrorBoundaryUtils.generateBoundaryId('layout', '/test/_layout.tsx');

		manager.registerErrorBoundary(boundaryId, '/test/_layout.tsx', config);

		const error = new Error('Test error');
		const errorInfo: LayoutErrorInfo = {
			layoutPath: '/test/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		};

		manager.handleError(boundaryId, error, errorInfo);

		const registrations = manager.getRegistrations();
		assertEquals(registrations[0].errorCount, 1);
		assertExists(registrations[0].lastError);
	});

	it('should get boundaries for specific layout', () => {
		const config1 = ErrorBoundaryUtils.createStandardConfig('layout');
		const config2 = ErrorBoundaryUtils.createStandardConfig('data');

		const boundaryId1 = ErrorBoundaryUtils.generateBoundaryId('layout', '/test/_layout.tsx');
		const boundaryId2 = ErrorBoundaryUtils.generateBoundaryId('data', '/test/_layout.tsx');
		const boundaryId3 = ErrorBoundaryUtils.generateBoundaryId('layout', '/other/_layout.tsx');

		manager.registerErrorBoundary(boundaryId1, '/test/_layout.tsx', config1);
		manager.registerErrorBoundary(boundaryId2, '/test/_layout.tsx', config2);
		manager.registerErrorBoundary(boundaryId3, '/other/_layout.tsx', config1);

		const testBoundaries = manager.getBoundariesForLayout('/test/_layout.tsx');
		assertEquals(testBoundaries.length, 2);
	});

	it('should track boundary health', () => {
		const config = ErrorBoundaryUtils.createStandardConfig('layout');
		const boundaryId = ErrorBoundaryUtils.generateBoundaryId('layout', '/test/_layout.tsx');

		manager.registerErrorBoundary(boundaryId, '/test/_layout.tsx', config);

		// Initially healthy
		let health = manager.getBoundaryHealth();
		assertEquals(health[0].status, 'healthy');

		// Add some errors
		const error = new Error('Test error');
		const errorInfo: LayoutErrorInfo = {
			layoutPath: '/test/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		};

		for (let i = 0; i < 3; i++) {
			manager.handleError(boundaryId, error, errorInfo);
		}

		health = manager.getBoundaryHealth();
		assertEquals(health[0].status, 'warning');

		// Add more errors
		for (let i = 0; i < 5; i++) {
			manager.handleError(boundaryId, error, errorInfo);
		}

		health = manager.getBoundaryHealth();
		assertEquals(health[0].status, 'critical');
	});

	it('should deactivate and reactivate boundaries', () => {
		const config = ErrorBoundaryUtils.createStandardConfig('layout');
		const boundaryId = ErrorBoundaryUtils.generateBoundaryId('layout', '/test/_layout.tsx');

		manager.registerErrorBoundary(boundaryId, '/test/_layout.tsx', config);

		manager.deactivateBoundary(boundaryId);
		let health = manager.getBoundaryHealth();
		assertEquals(health[0].status, 'inactive');

		manager.reactivateBoundary(boundaryId);
		health = manager.getBoundaryHealth();
		assertEquals(health[0].status, 'healthy');
	});

	it('should generate comprehensive reports', () => {
		const config = ErrorBoundaryUtils.createStandardConfig('layout');
		const boundaryId = ErrorBoundaryUtils.generateBoundaryId('layout', '/test/_layout.tsx');

		manager.registerErrorBoundary(boundaryId, '/test/_layout.tsx', config);

		const error = new Error('Test error');
		const errorInfo: LayoutErrorInfo = {
			layoutPath: '/test/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		};

		manager.handleError(boundaryId, error, errorInfo);

		const report = manager.generateReport();

		assertEquals(typeof report, 'string');
		assertEquals(report.includes('Error Boundary Manager Report'), true);
		assertEquals(report.includes('Error Boundary Health'), true);
		assertEquals(report.includes('Overall Error Statistics'), true);
		assertEquals(report.includes('Recommendations'), true);
	});

	it('should set and use global error handler', () => {
		let handlerCalled = false;
		let handledError: Error | unknown = null;

		manager.setGlobalErrorHandler((error, errorInfo) => {
			handlerCalled = true;
			handledError = error;
		});

		const config = ErrorBoundaryUtils.createStandardConfig('layout');
		const boundaryId = ErrorBoundaryUtils.generateBoundaryId('layout', '/test/_layout.tsx');

		manager.registerErrorBoundary(boundaryId, '/test/_layout.tsx', config);

		const error = new Error('Test error');
		const errorInfo: LayoutErrorInfo = {
			layoutPath: '/test/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		};

		manager.handleError(boundaryId, error, errorInfo);

		assertEquals(handlerCalled, true);
		assertEquals((handledError as Error)?.message, 'Test error');
	});
});

describe('Error Boundary Utils', () => {
	it('should create standard configurations', () => {
		const layoutConfig = ErrorBoundaryUtils.createStandardConfig('layout');
		const dataConfig = ErrorBoundaryUtils.createStandardConfig('data');
		const islandConfig = ErrorBoundaryUtils.createStandardConfig('island');
		const streamingConfig = ErrorBoundaryUtils.createStandardConfig('streaming');

		assertEquals(layoutConfig.component, 'layout');
		assertEquals(layoutConfig.strategy.type, 'fallback');
		assertEquals(layoutConfig.strategy.maxRetries, 2);

		assertEquals(dataConfig.component, 'data');
		assertEquals(dataConfig.strategy.type, 'retry');
		assertEquals(dataConfig.strategy.maxRetries, 3);

		assertEquals(islandConfig.component, 'island');
		assertEquals(islandConfig.strategy.type, 'skip');
		assertEquals(islandConfig.strategy.maxRetries, 0);
		assertEquals(islandConfig.isolateError, true);

		assertEquals(streamingConfig.component, 'streaming');
		assertEquals(streamingConfig.strategy.type, 'fallback');
		assertEquals(streamingConfig.strategy.maxRetries, 1);
	});

	it('should generate unique boundary IDs', () => {
		const id1 = ErrorBoundaryUtils.generateBoundaryId('layout', '/test/_layout.tsx');
		const id2 = ErrorBoundaryUtils.generateBoundaryId('layout', '/test/_layout.tsx');
		const id3 = ErrorBoundaryUtils.generateBoundaryId('data', '/other/_layout.tsx');

		assertEquals(typeof id1, 'string');
		assertEquals(typeof id2, 'string');
		assertEquals(typeof id3, 'string');

		// IDs should be unique
		assertEquals(id1 === id2, false);
		assertEquals(id1 === id3, false);

		// IDs should contain component and path info
		assertEquals(id1.includes('layout'), true);
		assertEquals(id1.includes('test'), true);
		assertEquals(id3.includes('data'), true);
		assertEquals(id3.includes('other'), true);
	});

	it('should determine error isolation correctly', () => {
		const islandError: LayoutErrorInfo = {
			layoutPath: 'island:test-island',
			errorType: 'island',
			timestamp: Date.now(),
		};

		const layoutError: LayoutErrorInfo = {
			layoutPath: '/test/_layout.tsx',
			errorType: 'component',
			timestamp: Date.now(),
		};

		assertEquals(ErrorBoundaryUtils.shouldIsolateError(islandError), true);
		assertEquals(ErrorBoundaryUtils.shouldIsolateError(layoutError), false);
	});

	it('should provide recommended strategies', () => {
		const componentStrategy = ErrorBoundaryUtils.getRecommendedStrategy('component');
		const loaderStrategy = ErrorBoundaryUtils.getRecommendedStrategy('loader');
		const renderingStrategy = ErrorBoundaryUtils.getRecommendedStrategy('rendering');
		const islandStrategy = ErrorBoundaryUtils.getRecommendedStrategy('island');

		assertEquals(componentStrategy.type, 'fallback');
		assertEquals(componentStrategy.maxRetries, 2);

		assertEquals(loaderStrategy.type, 'retry');
		assertEquals(loaderStrategy.maxRetries, 3);

		assertEquals(renderingStrategy.type, 'fallback');
		assertEquals(renderingStrategy.maxRetries, 1);

		assertEquals(islandStrategy.type, 'skip');
		assertEquals(islandStrategy.maxRetries, 0);
	});
});
