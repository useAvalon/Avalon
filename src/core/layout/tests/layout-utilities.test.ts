import { assertEquals, assertExists, assert } from '@std/assert';
import { LayoutCacheManager, defaultCacheConfig, type CacheConfig } from '../layout-cache-manager.ts';
import { LayoutDebugUtils, defaultDebugConfig, type DebugConfig } from '../layout-debug-utils.ts';
import { LayoutPerformanceMonitor, defaultPerformanceThresholds } from '../layout-performance-monitor.ts';
import { LayoutConfigValidator, LayoutErrorReporter, defaultValidationOptions } from '../layout-config-validator.ts';
import { LayoutHandler, ResolvedLayout, LayoutData } from '../../../types/layout.ts';

// Mock data
const mockLayoutHandler: LayoutHandler = {
	component: () => null,
	path: '/test/_layout.tsx',
	priority: 10,
};

const mockResolvedLayout: ResolvedLayout = {
	handlers: [mockLayoutHandler],
	dataLoaders: [],
	errorBoundaries: [],
	streamingComponents: [],
	metadata: {
		totalLayouts: 1,
		resolutionTime: 50,
		cacheHit: false,
	},
};

const mockLayoutData: LayoutData = {
	title: 'Test Page',
	user: { id: 1, name: 'Test User' },
};

Deno.test('Layout Cache Manager', async t => {
	const caches: LayoutCacheManager[] = [];

	// Cleanup function to destroy all caches
	const cleanup = () => {
		caches.forEach(cache => cache.destroy());
		caches.length = 0;
	};

	await t.step('should create cache with default config', () => {
		const cache = new LayoutCacheManager(defaultCacheConfig);
		caches.push(cache);
		assertExists(cache);
	});

	await t.step('should store and retrieve resolved layouts', () => {
		const cache = new LayoutCacheManager(defaultCacheConfig);
		caches.push(cache);
		const key = '/test/route';

		cache.setResolvedLayout(key, mockResolvedLayout);
		const retrieved = cache.getResolvedLayout(key);

		assertEquals(retrieved, mockResolvedLayout);
	});

	await t.step('should store and retrieve layout handlers', () => {
		const cache = new LayoutCacheManager(defaultCacheConfig);
		caches.push(cache);
		const key = '/test/_layout.tsx';

		cache.setLayoutHandler(key, mockLayoutHandler);
		const retrieved = cache.getLayoutHandler(key);

		assertEquals(retrieved, mockLayoutHandler);
	});

	await t.step('should store and retrieve layout data', () => {
		const cache = new LayoutCacheManager(defaultCacheConfig);
		caches.push(cache);
		const key = '/test/data';

		cache.setLayoutData(key, mockLayoutData);
		const retrieved = cache.getLayoutData(key);

		assertEquals(retrieved, mockLayoutData);
	});

	await t.step('should handle TTL expiration', async () => {
		const shortTtlConfig: CacheConfig = {
			...defaultCacheConfig,
			defaultTtl: 10, // 10ms
		};
		const cache = new LayoutCacheManager(shortTtlConfig);
		caches.push(cache);
		const key = '/test/expire';

		cache.setResolvedLayout(key, mockResolvedLayout);

		// Wait for expiration
		await new Promise(resolve => setTimeout(resolve, 20));

		const retrieved = cache.getResolvedLayout(key);
		assertEquals(retrieved, null);
	});

	await t.step('should invalidate by pattern', () => {
		const cache = new LayoutCacheManager(defaultCacheConfig);
		caches.push(cache);

		cache.setResolvedLayout('/test/route1', mockResolvedLayout);
		cache.setResolvedLayout('/test/route2', mockResolvedLayout);
		cache.setResolvedLayout('/other/route', mockResolvedLayout);

		const invalidated = cache.invalidateByPattern(/^\/test\//);
		assertEquals(invalidated, 2);

		assertEquals(cache.getResolvedLayout('/test/route1'), null);
		assertEquals(cache.getResolvedLayout('/test/route2'), null);
		assertExists(cache.getResolvedLayout('/other/route'));
	});

	await t.step('should track cache statistics', () => {
		const cache = new LayoutCacheManager(defaultCacheConfig);
		caches.push(cache);

		cache.setResolvedLayout('/test1', mockResolvedLayout);
		cache.setResolvedLayout('/test2', mockResolvedLayout);

		// Generate hits and misses
		cache.getResolvedLayout('/test1'); // hit
		cache.getResolvedLayout('/test2'); // hit
		cache.getResolvedLayout('/nonexistent'); // miss

		const stats = cache.getStats();
		assertEquals(stats.hits, 2);
		assertEquals(stats.misses, 1);
		assert(stats.totalEntries >= 2);
	});

	await t.step('should calculate hit rate', () => {
		const cache = new LayoutCacheManager(defaultCacheConfig);
		caches.push(cache);

		cache.setResolvedLayout('/test', mockResolvedLayout);

		cache.getResolvedLayout('/test'); // hit
		cache.getResolvedLayout('/nonexistent'); // miss

		const hitRate = cache.getHitRate();
		assertEquals(hitRate, 0.5);
	});

	// Clean up all caches
	cleanup();
});

Deno.test('Layout Debug Utils', async t => {
	await t.step('should create debug utils with default config', () => {
		const debugUtils = new LayoutDebugUtils(defaultDebugConfig);
		assertExists(debugUtils);
	});

	await t.step('should manage debug sessions', () => {
		const debugConfig: DebugConfig = { ...defaultDebugConfig, enabled: true };
		const debugUtils = new LayoutDebugUtils(debugConfig);
		const sessionId = 'test-session';
		const route = '/test/route';

		debugUtils.startDebugSession(sessionId, route);
		const debugInfo = debugUtils.endDebugSession(sessionId);

		assertExists(debugInfo);
		assertEquals(debugInfo!.route, route);
	});

	await t.step('should log layout discovery', () => {
		const debugConfig: DebugConfig = { ...defaultDebugConfig, enabled: true };
		const debugUtils = new LayoutDebugUtils(debugConfig);
		const sessionId = 'test-session';

		debugUtils.startDebugSession(sessionId, '/test');
		debugUtils.logLayoutDiscovery(sessionId, [mockLayoutHandler]);

		const debugInfo = debugUtils.endDebugSession(sessionId);
		assertEquals(debugInfo!.discoveredLayouts.length, 1);
		assertEquals(debugInfo!.discoveredLayouts[0].path, mockLayoutHandler.path);
	});

	await t.step('should log layout application', () => {
		const debugConfig: DebugConfig = { ...defaultDebugConfig, enabled: true };
		const debugUtils = new LayoutDebugUtils(debugConfig);
		const sessionId = 'test-session';

		debugUtils.startDebugSession(sessionId, '/test');
		debugUtils.logLayoutApplication(sessionId, mockLayoutHandler, 50, 1024);

		const debugInfo = debugUtils.endDebugSession(sessionId);
		assertEquals(debugInfo!.appliedLayouts.length, 1);
		assertEquals(debugInfo!.appliedLayouts[0].loadTime, 50);
		assertEquals(debugInfo!.appliedLayouts[0].dataSize, 1024);
	});

	await t.step('should generate layout tree visualization', () => {
		const debugConfig: DebugConfig = { ...defaultDebugConfig, enabled: true };
		const debugUtils = new LayoutDebugUtils(debugConfig);

		const layouts = [
			{ ...mockLayoutHandler, priority: 0 },
			{ ...mockLayoutHandler, priority: 10, path: '/test/nested/_layout.tsx' },
		];

		const tree = debugUtils.generateLayoutTree(layouts);
		assert(tree.includes('Layout Tree:'));
		assert(tree.includes(mockLayoutHandler.path));
	});

	await t.step('should analyze performance', () => {
		const debugConfig: DebugConfig = { ...defaultDebugConfig, enabled: true };
		const debugUtils = new LayoutDebugUtils(debugConfig);
		const sessionId = 'test-session';

		debugUtils.startDebugSession(sessionId, '/test');
		debugUtils.logLayoutApplication(sessionId, mockLayoutHandler, 150); // Slow layout
		debugUtils.logResolutionTime(sessionId, 600); // Slow resolution

		const debugInfo = debugUtils.endDebugSession(sessionId)!;
		const analysis = debugUtils.analyzePerformance(debugInfo);

		assertEquals(analysis.slowLayouts.length, 1);
		assert(analysis.recommendations.length > 0);
	});

	await t.step('should manage logs', () => {
		const debugConfig: DebugConfig = { ...defaultDebugConfig, enabled: true, logToConsole: false };
		const debugUtils = new LayoutDebugUtils(debugConfig);

		debugUtils.logError('test', new Error('Test error'));

		const logs = debugUtils.getLogs('test');
		assertEquals(logs.length, 1);
		assertEquals(logs[0].level, 'error');

		debugUtils.clearLogs();
		assertEquals(debugUtils.getLogs().length, 0);
	});
});

Deno.test('Layout Performance Monitor', async t => {
	await t.step('should create performance monitor', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);
		assertExists(monitor);
	});

	await t.step('should track timer metrics', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		monitor.startTimer('test-operation');
		// Simulate some work
		const duration = monitor.endTimer('test-operation', { route: '/test' });

		assert(duration >= 0);

		const average = monitor.getAverageMetric('test-operation');
		assert(average >= 0);
	});

	await t.step('should record count metrics', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		monitor.recordCount('layouts_discovered', 5, { route: '/test' });

		const average = monitor.getAverageMetric('layouts_discovered', '/test');
		assertEquals(average, 5);
	});

	await t.step('should record memory usage', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		monitor.recordMemoryUsage('layout_memory', 1024, { route: '/test' });

		const average = monitor.getAverageMetric('layout_memory', '/test');
		assertEquals(average, 1024);
	});

	await t.step('should monitor layout discovery', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		monitor.monitorLayoutDiscovery('/test', 3, 25);

		const discoveryTime = monitor.getAverageMetric('layout_discovery_time', '/test');
		assertEquals(discoveryTime, 25);

		const layoutCount = monitor.getAverageMetric('layouts_discovered', '/test');
		assertEquals(layoutCount, 3);
	});

	await t.step('should monitor layout loading', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		monitor.monitorLayoutLoading('/test', '/test/_layout.tsx', 75, 2048);

		const loadTime = monitor.getAverageMetric('layout_load_time', '/test');
		assertEquals(loadTime, 75);

		const dataSize = monitor.getAverageMetric('layout_data_size', '/test');
		assertEquals(dataSize, 2048);
	});

	await t.step('should create performance snapshots', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		monitor.monitorLayoutResolution('/test', 150, true, 4096);

		const snapshot = monitor.createSnapshot('/test', [mockLayoutHandler], 0.8, 4096);

		assertEquals(snapshot.route, '/test');
		assertEquals(snapshot.summary.layoutCount, 1);
		assertEquals(snapshot.summary.cacheHitRate, 0.8);
		assertEquals(snapshot.summary.memoryUsage, 4096);
	});

	await t.step('should calculate percentiles', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		// Record multiple values
		for (let i = 1; i <= 10; i++) {
			monitor.recordMetric({
				name: 'test_metric',
				value: i * 10,
				unit: 'ms',
				timestamp: Date.now(),
				tags: { route: '/test' },
			});
		}

		const p50 = monitor.getPercentile('test_metric', 50, '/test');
		const p95 = monitor.getPercentile('test_metric', 95, '/test');

		assert(p50 > 0);
		assert(p95 > p50);
	});

	await t.step('should identify slowest routes', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		monitor.monitorLayoutResolution('/fast', 50, true, 1024);
		monitor.monitorLayoutResolution('/slow', 200, false, 2048);
		monitor.monitorLayoutResolution('/medium', 100, true, 1536);

		const slowestRoutes = monitor.getSlowestRoutes(2);

		assertEquals(slowestRoutes.length, 2);
		assertEquals(slowestRoutes[0].route, '/slow');
		assertEquals(slowestRoutes[1].route, '/medium');
	});

	await t.step('should calculate cache hit rate', () => {
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		monitor.recordCount('cache_hits', 1, { route: '/test' });
		monitor.recordCount('cache_hits', 1, { route: '/test' });
		monitor.recordCount('cache_hits', 0, { route: '/test' });

		const hitRate = monitor.getCacheHitRate('/test');
		assertEquals(hitRate, 2 / 3);
	});

	await t.step('should generate alerts for threshold violations', () => {
		const lowThresholds = {
			...defaultPerformanceThresholds,
			layoutDiscoveryTime: 10, // Very low threshold
		};
		const monitor = new LayoutPerformanceMonitor(lowThresholds);

		monitor.monitorLayoutDiscovery('/test', 3, 50); // Exceeds threshold

		const alerts = monitor.getAlerts();
		assert(alerts.length > 0);
		assertEquals(alerts[0].type, 'threshold_exceeded');
		assertEquals(alerts[0].metric, 'layout_discovery_time');
	});
});

Deno.test('Layout Config Validator', async t => {
	await t.step('should create validator with default options', () => {
		const validator = new LayoutConfigValidator(defaultValidationOptions);
		assertExists(validator);
	});

	await t.step('should validate valid layout config', () => {
		const validator = new LayoutConfigValidator(defaultValidationOptions);
		const config = {
			skipLayouts: ['/admin/_layout.tsx'],
			replaceLayout: false,
		};

		const result = validator.validateLayoutConfig(config);
		assertEquals(result.valid, true);
		assertEquals(result.errors.length, 0);
	});

	await t.step('should detect invalid layout config', () => {
		const validator = new LayoutConfigValidator(defaultValidationOptions);
		const config = {
			skipLayouts: 'not-an-array', // Invalid type
			replaceLayout: 'not-a-boolean', // Invalid type
		};

		const result = validator.validateLayoutConfig(config);
		assertEquals(result.valid, false);
		assert(result.errors.length > 0);
	});

	await t.step('should detect conflicting config options', () => {
		const validator = new LayoutConfigValidator(defaultValidationOptions);
		const config = {
			skipLayouts: ['/test/_layout.tsx'],
			onlyLayouts: ['/test/_layout.tsx'], // Conflict: can't skip and include same layout
		};

		const result = validator.validateLayoutConfig(config);
		assertEquals(result.valid, false);
		assert(result.errors.some(err => err.code === 'CONFLICTING_CONFIG'));
	});

	await t.step('should validate layout handler', () => {
		const validator = new LayoutConfigValidator(defaultValidationOptions);

		const validResult = validator.validateLayoutHandler(mockLayoutHandler);
		assertEquals(validResult.valid, true);

		const invalidHandler = {
			...mockLayoutHandler,
			component: null, // Missing component
			priority: -10, // Negative priority (warning)
		};

		const invalidResult = validator.validateLayoutHandler(invalidHandler);
		assertEquals(invalidResult.valid, false);
		assert(invalidResult.warnings.length > 0);
	});

	await t.step('should validate layout chain', () => {
		const validator = new LayoutConfigValidator(defaultValidationOptions);

		const validChain = [
			{ ...mockLayoutHandler, priority: 0, path: '/root/_layout.tsx' },
			{ ...mockLayoutHandler, priority: 10, path: '/nested/_layout.tsx' },
		];

		const validResult = validator.validateLayoutChain(validChain);
		assertEquals(validResult.valid, true);

		const invalidChain = [
			mockLayoutHandler,
			mockLayoutHandler, // Duplicate path
		];

		const invalidResult = validator.validateLayoutChain(invalidChain);
		assertEquals(invalidResult.valid, false);
		assert(invalidResult.errors.some(err => err.code === 'DUPLICATE_PATHS'));
	});

	await t.step('should validate layout context', () => {
		const validator = new LayoutConfigValidator(defaultValidationOptions);
		const context = {
			request: { method: 'GET' },
			params: { id: '123' },
			query: new URLSearchParams('?test=value'),
			state: new Map([['key', 'value']]),
		};

		const result = validator.validateLayoutContext(context);
		assertEquals(result.valid, true);
	});
});

Deno.test('Layout Error Reporter', async t => {
	await t.step('should create error reporter', () => {
		const reporter = new LayoutErrorReporter();
		assertExists(reporter);
	});

	await t.step('should report validation errors', () => {
		const reporter = new LayoutErrorReporter();
		const validationResult = {
			valid: false,
			errors: [
				{
					field: 'test',
					message: 'Test error',
					code: 'TEST_ERROR',
				},
			],
			warnings: [
				{
					field: 'test',
					message: 'Test warning',
					severity: 'high' as const,
				},
			],
		};

		reporter.reportValidationError(validationResult, { route: '/test' });

		const errors = reporter.getErrors();
		assert(errors.length >= 2); // Error + high-severity warning
	});

	await t.step('should report runtime errors', () => {
		const reporter = new LayoutErrorReporter();
		const error = new Error('Runtime error');

		reporter.reportRuntimeError(error, 'layout_error', { route: '/test' });

		const errors = reporter.getErrors('layout_error');
		assertEquals(errors.length, 1);
		assertEquals(errors[0].message, 'Runtime error');
	});

	await t.step('should filter errors by type and time', () => {
		const reporter = new LayoutErrorReporter();

		reporter.reportRuntimeError(new Error('Error 1'), 'type1');
		reporter.reportRuntimeError(new Error('Error 2'), 'type2');

		const type1Errors = reporter.getErrors('type1');
		assertEquals(type1Errors.length, 1);

		const recentErrors = reporter.getErrors(undefined, Date.now() - 1000);
		assertEquals(recentErrors.length, 2);
	});

	await t.step('should generate error report', () => {
		const reporter = new LayoutErrorReporter();

		reporter.reportRuntimeError(new Error('Test error'), 'test_type');

		const report = reporter.generateReport();
		const parsed = JSON.parse(report);

		assertExists(parsed.timestamp);
		assertExists(parsed.summary);
		assert(parsed.summary.totalErrors > 0);
	});

	await t.step('should clear old errors', () => {
		const reporter = new LayoutErrorReporter();

		reporter.reportRuntimeError(new Error('Error 1'), 'test');
		reporter.reportRuntimeError(new Error('Error 2'), 'test');

		const cleared = reporter.clearErrors();
		assertEquals(cleared, 2);
		assertEquals(reporter.getErrors().length, 0);
	});
});

Deno.test('Integration: All utilities working together', async t => {
	await t.step('should integrate cache, debug, and performance monitoring', () => {
		const cache = new LayoutCacheManager(defaultCacheConfig);
		const debugConfig: DebugConfig = { ...defaultDebugConfig, enabled: true, logToConsole: false };
		const debugUtils = new LayoutDebugUtils(debugConfig);
		const monitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);

		const sessionId = 'integration-test';
		const route = '/test/integration';

		// Start monitoring
		monitor.startTimer('layout_resolution');
		debugUtils.startDebugSession(sessionId, route);

		// Simulate layout discovery
		debugUtils.logLayoutDiscovery(sessionId, [mockLayoutHandler]);
		monitor.monitorLayoutDiscovery(route, 1, 25);

		// Simulate cache miss and layout loading
		const cachedLayout = cache.getResolvedLayout(route);
		assertEquals(cachedLayout, null); // Cache miss

		debugUtils.logCacheHit(sessionId, false);
		debugUtils.logLayoutApplication(sessionId, mockLayoutHandler, 50, 1024);
		monitor.monitorLayoutLoading(route, mockLayoutHandler.path, 50, 1024);

		// Store in cache
		cache.setResolvedLayout(route, mockResolvedLayout);

		// End monitoring
		const totalTime = monitor.endTimer('layout_resolution', { route });
		debugUtils.logResolutionTime(sessionId, totalTime);
		monitor.monitorLayoutResolution(route, totalTime, false, 1024);

		const debugInfo = debugUtils.endDebugSession(sessionId);
		const snapshot = monitor.createSnapshot(route, [mockLayoutHandler], 0, 1024);

		// Verify integration
		assertExists(debugInfo);
		assertExists(snapshot);
		assertEquals(debugInfo.route, route);
		assertEquals(snapshot.route, route);
		assert(totalTime >= 0);

		// Verify cache now has the layout
		const cachedLayoutAfter = cache.getResolvedLayout(route);
		assertEquals(cachedLayoutAfter, mockResolvedLayout);

		// Clean up
		cache.destroy();
	});
});
