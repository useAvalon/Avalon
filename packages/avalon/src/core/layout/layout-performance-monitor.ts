import { LayoutHandler, ResolvedLayout } from '../../types/layout.ts';

export interface PerformanceMetric {
	name: string;
	value: number;
	unit: 'ms' | 'bytes' | 'count';
	timestamp: number;
	tags?: Record<string, string>;
}

export interface PerformanceSnapshot {
	timestamp: number;
	route: string;
	metrics: PerformanceMetric[];
	summary: {
		totalTime: number;
		layoutCount: number;
		cacheHitRate: number;
		memoryUsage: number;
	};
}

export interface PerformanceThresholds {
	layoutDiscoveryTime: number;
	layoutLoadTime: number;
	totalResolutionTime: number;
	memoryUsage: number;
	cacheHitRate: number;
}

export interface PerformanceAlert {
	type: 'threshold_exceeded' | 'performance_degradation' | 'memory_leak';
	metric: string;
	value: number;
	threshold: number;
	timestamp: number;
	route: string;
	severity: 'low' | 'medium' | 'high';
	message: string;
}

export class LayoutPerformanceMonitor {
	private metrics: PerformanceMetric[] = [];
	private snapshots: PerformanceSnapshot[] = [];
	private alerts: PerformanceAlert[] = [];
	private activeTimers = new Map<string, number>();
	private routeMetrics = new Map<string, PerformanceMetric[]>();

	constructor(
		private thresholds: PerformanceThresholds,
		private maxMetrics: number = 10000,
		private maxSnapshots: number = 1000,
		private maxAlerts: number = 500
	) {}

	// Timer management
	startTimer(name: string): void {
		this.activeTimers.set(name, performance.now());
	}

	endTimer(name: string, tags?: Record<string, string>): number {
		const startTime = this.activeTimers.get(name);
		if (!startTime) {
			console.warn(`Timer '${name}' was not started`);
			return 0;
		}

		const duration = performance.now() - startTime;
		this.activeTimers.delete(name);

		this.recordMetric({
			name,
			value: duration,
			unit: 'ms',
			timestamp: Date.now(),
			tags,
		});

		this.checkThreshold(name, duration, tags?.route);
		return duration;
	}

	// Metric recording
	recordMetric(metric: PerformanceMetric): void {
		this.metrics.push(metric);

		// Store route-specific metrics
		if (metric.tags?.route) {
			const routeMetrics = this.routeMetrics.get(metric.tags.route) || [];
			routeMetrics.push(metric);
			this.routeMetrics.set(metric.tags.route, routeMetrics);
		}

		// Enforce max metrics limit
		if (this.metrics.length > this.maxMetrics) {
			this.metrics.shift();
		}
	}

	recordCount(name: string, count: number, tags?: Record<string, string>): void {
		this.recordMetric({
			name,
			value: count,
			unit: 'count',
			timestamp: Date.now(),
			tags,
		});
	}

	recordMemoryUsage(name: string, bytes: number, tags?: Record<string, string>): void {
		this.recordMetric({
			name,
			value: bytes,
			unit: 'bytes',
			timestamp: Date.now(),
			tags,
		});

		this.checkThreshold(name, bytes, tags?.route);
	}

	// Layout-specific monitoring
	monitorLayoutDiscovery(route: string, layoutCount: number, discoveryTime: number): void {
		this.recordMetric({
			name: 'layout_discovery_time',
			value: discoveryTime,
			unit: 'ms',
			timestamp: Date.now(),
			tags: { route, phase: 'discovery' },
		});

		this.recordCount('layouts_discovered', layoutCount, { route });

		if (discoveryTime > this.thresholds.layoutDiscoveryTime) {
			this.createAlert({
				type: 'threshold_exceeded',
				metric: 'layout_discovery_time',
				value: discoveryTime,
				threshold: this.thresholds.layoutDiscoveryTime,
				timestamp: Date.now(),
				route,
				severity: discoveryTime > this.thresholds.layoutDiscoveryTime * 2 ? 'high' : 'medium',
				message: `Layout discovery took ${discoveryTime.toFixed(2)}ms, exceeding threshold of ${
					this.thresholds.layoutDiscoveryTime
				}ms`,
			});
		}
	}

	monitorLayoutLoading(route: string, layoutPath: string, loadTime: number, dataSize?: number): void {
		this.recordMetric({
			name: 'layout_load_time',
			value: loadTime,
			unit: 'ms',
			timestamp: Date.now(),
			tags: { route, layout: layoutPath, phase: 'loading' },
		});

		if (dataSize !== undefined) {
			this.recordMemoryUsage('layout_data_size', dataSize, { route, layout: layoutPath });
		}

		if (loadTime > this.thresholds.layoutLoadTime) {
			this.createAlert({
				type: 'threshold_exceeded',
				metric: 'layout_load_time',
				value: loadTime,
				threshold: this.thresholds.layoutLoadTime,
				timestamp: Date.now(),
				route,
				severity: loadTime > this.thresholds.layoutLoadTime * 2 ? 'high' : 'medium',
				message: `Layout ${layoutPath} took ${loadTime.toFixed(2)}ms to load, exceeding threshold of ${
					this.thresholds.layoutLoadTime
				}ms`,
			});
		}
	}

	monitorLayoutResolution(route: string, totalTime: number, cacheHit: boolean, memoryUsage: number): void {
		this.recordMetric({
			name: 'layout_resolution_time',
			value: totalTime,
			unit: 'ms',
			timestamp: Date.now(),
			tags: { route, cache_hit: cacheHit.toString(), phase: 'resolution' },
		});

		this.recordMemoryUsage('layout_memory_usage', memoryUsage, { route });
		this.recordCount('cache_hits', cacheHit ? 1 : 0, { route });

		// Check thresholds
		if (totalTime > this.thresholds.totalResolutionTime) {
			this.createAlert({
				type: 'threshold_exceeded',
				metric: 'layout_resolution_time',
				value: totalTime,
				threshold: this.thresholds.totalResolutionTime,
				timestamp: Date.now(),
				route,
				severity: totalTime > this.thresholds.totalResolutionTime * 2 ? 'high' : 'medium',
				message: `Layout resolution took ${totalTime.toFixed(2)}ms, exceeding threshold of ${
					this.thresholds.totalResolutionTime
				}ms`,
			});
		}

		if (memoryUsage > this.thresholds.memoryUsage) {
			this.createAlert({
				type: 'threshold_exceeded',
				metric: 'layout_memory_usage',
				value: memoryUsage,
				threshold: this.thresholds.memoryUsage,
				timestamp: Date.now(),
				route,
				severity: memoryUsage > this.thresholds.memoryUsage * 2 ? 'high' : 'medium',
				message: `Layout memory usage is ${(memoryUsage / 1024).toFixed(2)} KB, exceeding threshold of ${(
					this.thresholds.memoryUsage / 1024
				).toFixed(2)} KB`,
			});
		}
	}

	// Performance snapshots
	createSnapshot(
		route: string,
		layouts: LayoutHandler[],
		cacheHitRate: number,
		memoryUsage: number
	): PerformanceSnapshot {
		const routeMetrics = this.getMetricsForRoute(route, Date.now() - 60000); // Last minute
		const totalTime = this.calculateTotalTime(routeMetrics);

		const snapshot: PerformanceSnapshot = {
			timestamp: Date.now(),
			route,
			metrics: routeMetrics,
			summary: {
				totalTime,
				layoutCount: layouts.length,
				cacheHitRate,
				memoryUsage,
			},
		};

		this.snapshots.push(snapshot);

		// Enforce max snapshots limit
		if (this.snapshots.length > this.maxSnapshots) {
			this.snapshots.shift();
		}

		return snapshot;
	}

	// Analytics and reporting
	getMetricsForRoute(route: string, since?: number): PerformanceMetric[] {
		const routeMetrics = this.routeMetrics.get(route) || [];

		if (since) {
			return routeMetrics.filter(metric => metric.timestamp >= since);
		}

		return routeMetrics;
	}

	getAverageMetric(name: string, route?: string, timeWindow?: number): number {
		let metrics = this.metrics.filter(m => m.name === name);

		if (route) {
			metrics = metrics.filter(m => m.tags?.route === route);
		}

		if (timeWindow) {
			const cutoff = Date.now() - timeWindow;
			metrics = metrics.filter(m => m.timestamp >= cutoff);
		}

		if (metrics.length === 0) return 0;

		return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
	}

	getPercentile(name: string, percentile: number, route?: string, timeWindow?: number): number {
		let metrics = this.metrics.filter(m => m.name === name);

		if (route) {
			metrics = metrics.filter(m => m.tags?.route === route);
		}

		if (timeWindow) {
			const cutoff = Date.now() - timeWindow;
			metrics = metrics.filter(m => m.timestamp >= cutoff);
		}

		if (metrics.length === 0) return 0;

		const values = metrics.map(m => m.value).sort((a, b) => a - b);
		const index = Math.ceil((percentile / 100) * values.length) - 1;

		return values[Math.max(0, index)];
	}

	getSlowestRoutes(limit: number = 10): Array<{ route: string; averageTime: number; count: number }> {
		const routeStats = new Map<string, { totalTime: number; count: number }>();

		this.metrics
			.filter(m => m.name === 'layout_resolution_time')
			.forEach(metric => {
				const route = metric.tags?.route || 'unknown';
				const stats = routeStats.get(route) || { totalTime: 0, count: 0 };
				stats.totalTime += metric.value;
				stats.count += 1;
				routeStats.set(route, stats);
			});

		return Array.from(routeStats.entries())
			.map(([route, stats]) => ({
				route,
				averageTime: stats.totalTime / stats.count,
				count: stats.count,
			}))
			.sort((a, b) => b.averageTime - a.averageTime)
			.slice(0, limit);
	}

	getCacheHitRate(route?: string, timeWindow?: number): number {
		let cacheMetrics = this.metrics.filter(m => m.name === 'cache_hits');

		if (route) {
			cacheMetrics = cacheMetrics.filter(m => m.tags?.route === route);
		}

		if (timeWindow) {
			const cutoff = Date.now() - timeWindow;
			cacheMetrics = cacheMetrics.filter(m => m.timestamp >= cutoff);
		}

		if (cacheMetrics.length === 0) return 0;

		const hits = cacheMetrics.filter(m => m.value === 1).length;
		return hits / cacheMetrics.length;
	}

	// Alert management
	private createAlert(alert: PerformanceAlert): void {
		this.alerts.push(alert);

		// Enforce max alerts limit
		if (this.alerts.length > this.maxAlerts) {
			this.alerts.shift();
		}

		// Log alert
		console.warn(`[Layout Performance Alert] ${alert.message}`, {
			type: alert.type,
			metric: alert.metric,
			value: alert.value,
			threshold: alert.threshold,
			route: alert.route,
			severity: alert.severity,
		});
	}

	private checkThreshold(metricName: string, value: number, route?: string): void {
		const thresholdMap: Record<string, keyof PerformanceThresholds> = {
			layout_discovery_time: 'layoutDiscoveryTime',
			layout_load_time: 'layoutLoadTime',
			layout_resolution_time: 'totalResolutionTime',
			layout_memory_usage: 'memoryUsage',
		};

		const thresholdKey = thresholdMap[metricName];
		if (!thresholdKey) return;

		const threshold = this.thresholds[thresholdKey];
		if (value > threshold) {
			this.createAlert({
				type: 'threshold_exceeded',
				metric: metricName,
				value,
				threshold,
				timestamp: Date.now(),
				route: route || 'unknown',
				severity: value > threshold * 2 ? 'high' : 'medium',
				message: `${metricName} (${value}) exceeded threshold (${threshold})`,
			});
		}
	}

	private calculateTotalTime(metrics: PerformanceMetric[]): number {
		return metrics.filter(m => m.name.includes('time') && m.unit === 'ms').reduce((sum, m) => sum + m.value, 0);
	}

	// Data export and cleanup
	getAlerts(severity?: 'low' | 'medium' | 'high', since?: number): PerformanceAlert[] {
		let alerts = [...this.alerts];

		if (severity) {
			alerts = alerts.filter(a => a.severity === severity);
		}

		if (since) {
			alerts = alerts.filter(a => a.timestamp >= since);
		}

		return alerts;
	}

	exportMetrics(format: 'json' | 'csv' = 'json'): string {
		if (format === 'csv') {
			const headers = ['timestamp', 'name', 'value', 'unit', 'route', 'tags'];
			const rows = this.metrics.map(m => [
				new Date(m.timestamp).toISOString(),
				m.name,
				m.value.toString(),
				m.unit,
				m.tags?.route || '',
				JSON.stringify(m.tags || {}),
			]);

			return [headers, ...rows].map(row => row.join(',')).join('\n');
		}

		return JSON.stringify(
			{
				metrics: this.metrics,
				snapshots: this.snapshots,
				alerts: this.alerts,
				summary: {
					totalMetrics: this.metrics.length,
					totalSnapshots: this.snapshots.length,
					totalAlerts: this.alerts.length,
					timeRange: {
						start: this.metrics.length > 0 ? Math.min(...this.metrics.map(m => m.timestamp)) : null,
						end: this.metrics.length > 0 ? Math.max(...this.metrics.map(m => m.timestamp)) : null,
					},
				},
			},
			null,
			2
		);
	}

	clearMetrics(olderThan?: number): number {
		const initialCount = this.metrics.length;

		if (olderThan) {
			this.metrics = this.metrics.filter(m => m.timestamp >= olderThan);
			this.snapshots = this.snapshots.filter(s => s.timestamp >= olderThan);
			this.alerts = this.alerts.filter(a => a.timestamp >= olderThan);

			// Clear route metrics
			for (const [route, metrics] of this.routeMetrics) {
				const filteredMetrics = metrics.filter(m => m.timestamp >= olderThan);
				if (filteredMetrics.length === 0) {
					this.routeMetrics.delete(route);
				} else {
					this.routeMetrics.set(route, filteredMetrics);
				}
			}
		} else {
			this.metrics = [];
			this.snapshots = [];
			this.alerts = [];
			this.routeMetrics.clear();
		}

		return initialCount - this.metrics.length;
	}
}

// Default performance thresholds
export const defaultPerformanceThresholds: PerformanceThresholds = {
	layoutDiscoveryTime: 50, // 50ms
	layoutLoadTime: 100, // 100ms
	totalResolutionTime: 200, // 200ms
	memoryUsage: 1024 * 1024, // 1MB
	cacheHitRate: 0.8, // 80%
};

// Global performance monitor instance
export const layoutPerformanceMonitor = new LayoutPerformanceMonitor(defaultPerformanceThresholds);
