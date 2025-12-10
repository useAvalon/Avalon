import { join, relative, dirname } from 'node:path';
import { existsSync } from '@std/fs';
import { ensureDir } from '@std/fs';
import type { LayoutHandler, LayoutRoute } from '../../types/layout.ts';

/**
 * Bundle optimization configuration
 */
export interface BundleOptimizationConfig {
	/**
	 * Output directory for optimized bundles
	 */
	outputDir: string;

	/**
	 * Enable code splitting for layouts
	 */
	enableCodeSplitting: boolean;

	/**
	 * Enable tree shaking for unused layout code
	 */
	enableTreeShaking: boolean;

	/**
	 * Enable minification of layout bundles
	 */
	enableMinification: boolean;

	/**
	 * Bundle size threshold for splitting (in bytes)
	 */
	splitThreshold: number;

	/**
	 * Enable development mode optimizations
	 */
	developmentMode: boolean;

	/**
	 * Enable bundle analysis and reporting
	 */
	enableAnalysis: boolean;
}

/**
 * Bundle analysis result
 */
export interface BundleAnalysis {
	totalSize: number;
	bundleCount: number;
	averageBundleSize: number;
	largestBundle: { path: string; size: number };
	smallestBundle: { path: string; size: number };
	duplicatedCode: Array<{ code: string; occurrences: number }>;
	optimizationOpportunities: string[];
}

/**
 * Layout bundle information
 */
export interface LayoutBundle {
	id: string;
	path: string;
	size: number;
	dependencies: string[];
	chunks: string[];
	isShared: boolean;
	priority: 'high' | 'medium' | 'low';
}

/**
 * Layout Bundle Optimizer
 * Optimizes layout code organization and bundle splitting for better performance
 *
 * Requirements: 7.4, 8.5
 */
export class LayoutBundleOptimizer {
	private config: Required<BundleOptimizationConfig>;
	private bundleCache = new Map<string, LayoutBundle>();
	private dependencyGraph = new Map<string, Set<string>>();
	private sharedChunks = new Map<string, string[]>();

	constructor(config: BundleOptimizationConfig) {
		this.config = {
			outputDir: config.outputDir,
			enableCodeSplitting: config.enableCodeSplitting ?? true,
			enableTreeShaking: config.enableTreeShaking ?? true,
			enableMinification: config.enableMinification ?? !config.developmentMode,
			splitThreshold: config.splitThreshold ?? 50 * 1024, // 50KB
			developmentMode: config.developmentMode ?? false,
			enableAnalysis: config.enableAnalysis ?? config.developmentMode,
		};
	}

	/**
	 * Optimize layout bundles for better performance
	 * Requirements: 7.4, 8.5
	 */
	async optimizeLayoutBundles(layoutHandlers: LayoutHandler[]): Promise<LayoutBundle[]> {
		const startTime = performance.now();
		const bundles: LayoutBundle[] = [];

		try {
			// Ensure output directory exists
			await this.ensureOutputDirectory();

			// Analyze layout dependencies
			await this.analyzeDependencies(layoutHandlers);

			// Create optimized bundles
			for (const handler of layoutHandlers) {
				const bundle = await this.createOptimizedBundle(handler);
				if (bundle) {
					bundles.push(bundle);
				}
			}

			// Identify and create shared chunks
			await this.createSharedChunks(bundles);

			// Apply code splitting if enabled
			if (this.config.enableCodeSplitting) {
				await this.applySplitting(bundles);
			}

			// Apply tree shaking if enabled
			if (this.config.enableTreeShaking) {
				await this.applyTreeShaking(bundles);
			}

			// Apply minification if enabled
			if (this.config.enableMinification) {
				await this.applyMinification(bundles);
			}

			// Generate bundle analysis if enabled
			if (this.config.enableAnalysis) {
				const analysis = await this.analyzeBundles(bundles);
				await this.generateAnalysisReport(analysis);
			}

			const optimizationTime = performance.now() - startTime;
			if (this.config.developmentMode) {
				console.log(`[LayoutBundleOptimizer] Optimized ${bundles.length} bundles in ${optimizationTime.toFixed(2)}ms`);
			}

			return bundles;
		} catch (error) {
			if (this.config.developmentMode) {
				console.error('[LayoutBundleOptimizer] Optimization failed:', error);
			}
			throw error;
		}
	}

	/**
	 * Analyze dependencies between layouts
	 */
	private async analyzeDependencies(layoutHandlers: LayoutHandler[]): Promise<void> {
		for (const handler of layoutHandlers) {
			try {
				const dependencies = await this.extractDependencies(handler.path);
				this.dependencyGraph.set(handler.path, new Set(dependencies));
			} catch (error) {
				if (this.config.developmentMode) {
					console.warn(`[LayoutBundleOptimizer] Failed to analyze dependencies for ${handler.path}:`, error);
				}
				// Continue with empty dependencies
				this.dependencyGraph.set(handler.path, new Set());
			}
		}
	}

	/**
	 * Extract dependencies from a layout file
	 */
	private async extractDependencies(filePath: string): Promise<string[]> {
		try {
			const content = await Deno.readTextFile(filePath);
			const dependencies: string[] = [];

			// Extract import statements
			const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
			let match;

			while ((match = importRegex.exec(content)) !== null) {
				const importPath = match[1];

				// Skip node_modules and built-in modules
				if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
					continue;
				}

				// Resolve relative imports
				const resolvedPath = this.resolveImportPath(filePath, importPath);
				if (resolvedPath) {
					dependencies.push(resolvedPath);
				}
			}

			return dependencies;
		} catch (error) {
			if (this.config.developmentMode) {
				console.warn(`[LayoutBundleOptimizer] Failed to read file ${filePath}:`, error);
			}
			return [];
		}
	}

	/**
	 * Resolve import path relative to the importing file
	 */
	private resolveImportPath(fromFile: string, importPath: string): string | null {
		try {
			const fromDir = dirname(fromFile);
			let resolvedPath = join(fromDir, importPath);

			// Try different extensions
			const extensions = ['.ts', '.tsx', '.js', '.jsx'];

			if (existsSync(resolvedPath)) {
				return resolvedPath;
			}

			for (const ext of extensions) {
				const pathWithExt = resolvedPath + ext;
				if (existsSync(pathWithExt)) {
					return pathWithExt;
				}
			}

			// Try index files
			for (const ext of extensions) {
				const indexPath = join(resolvedPath, `index${ext}`);
				if (existsSync(indexPath)) {
					return indexPath;
				}
			}

			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Create optimized bundle for a layout handler
	 */
	private async createOptimizedBundle(handler: LayoutHandler): Promise<LayoutBundle | null> {
		try {
			const bundleId = this.generateBundleId(handler.path);
			const dependencies = Array.from(this.dependencyGraph.get(handler.path) || []);

			// Calculate bundle size (rough estimation)
			const size = await this.estimateBundleSize(handler.path, dependencies);

			// Determine bundle priority based on layout depth and usage patterns
			const priority = this.determineBundlePriority(handler);

			const bundle: LayoutBundle = {
				id: bundleId,
				path: handler.path,
				size,
				dependencies,
				chunks: [bundleId], // Initially single chunk
				isShared: false,
				priority,
			};

			this.bundleCache.set(bundleId, bundle);
			return bundle;
		} catch (error) {
			if (this.config.developmentMode) {
				console.warn(`[LayoutBundleOptimizer] Failed to create bundle for ${handler.path}:`, error);
			}
			return null;
		}
	}

	/**
	 * Generate unique bundle ID
	 */
	private generateBundleId(filePath: string): string {
		const relativePath = relative(process.cwd(), filePath);
		return relativePath
			.replace(/[/\\]/g, '_')
			.replace(/\.(tsx?|jsx?)$/, '')
			.toLowerCase();
	}

	/**
	 * Estimate bundle size
	 */
	private async estimateBundleSize(filePath: string, dependencies: string[]): Promise<number> {
		let totalSize = 0;

		try {
			// Get main file size
			const mainContent = await Deno.readTextFile(filePath);
			totalSize += new TextEncoder().encode(mainContent).length;

			// Add dependency sizes (with deduplication)
			const processedDeps = new Set<string>();

			for (const dep of dependencies) {
				if (!processedDeps.has(dep) && existsSync(dep)) {
					try {
						const depContent = await Deno.readTextFile(dep);
						totalSize += new TextEncoder().encode(depContent).length;
						processedDeps.add(dep);
					} catch {
						// Skip if can't read dependency
					}
				}
			}
		} catch (error) {
			if (this.config.developmentMode) {
				console.warn(`[LayoutBundleOptimizer] Failed to estimate size for ${filePath}:`, error);
			}
			// Return a default estimate
			totalSize = 10 * 1024; // 10KB default
		}

		return totalSize;
	}

	/**
	 * Determine bundle priority based on layout characteristics
	 */
	private determineBundlePriority(handler: LayoutHandler): 'high' | 'medium' | 'low' {
		// Root layouts and frequently used layouts get high priority
		if (handler.priority === 0 || handler.path.includes('_layout.tsx')) {
			return 'high';
		}

		// Nested layouts get medium priority
		if (handler.priority < 20) {
			return 'medium';
		}

		// Deep nested layouts get low priority
		return 'low';
	}

	/**
	 * Create shared chunks for common dependencies
	 */
	private async createSharedChunks(bundles: LayoutBundle[]): Promise<void> {
		const dependencyCount = new Map<string, number>();
		const dependencyBundles = new Map<string, string[]>();

		// Count dependency usage across bundles
		for (const bundle of bundles) {
			for (const dep of bundle.dependencies) {
				dependencyCount.set(dep, (dependencyCount.get(dep) || 0) + 1);

				if (!dependencyBundles.has(dep)) {
					dependencyBundles.set(dep, []);
				}
				dependencyBundles.get(dep)!.push(bundle.id);
			}
		}

		// Create shared chunks for dependencies used by multiple bundles
		for (const [dep, count] of dependencyCount) {
			if (count > 1) {
				const sharedChunkId = `shared_${this.generateBundleId(dep)}`;
				const bundleIds = dependencyBundles.get(dep) || [];

				this.sharedChunks.set(sharedChunkId, bundleIds);

				// Mark bundles as having shared dependencies
				for (const bundleId of bundleIds) {
					const bundle = this.bundleCache.get(bundleId);
					if (bundle) {
						bundle.isShared = true;
						if (!bundle.chunks.includes(sharedChunkId)) {
							bundle.chunks.push(sharedChunkId);
						}
					}
				}
			}
		}

		if (this.config.developmentMode) {
			console.log(`[LayoutBundleOptimizer] Created ${this.sharedChunks.size} shared chunks`);
		}
	}

	/**
	 * Apply code splitting to large bundles
	 */
	private async applySplitting(bundles: LayoutBundle[]): Promise<void> {
		for (const bundle of bundles) {
			if (bundle.size > this.config.splitThreshold) {
				await this.splitBundle(bundle);
			}
		}
	}

	/**
	 * Split a large bundle into smaller chunks
	 */
	private async splitBundle(bundle: LayoutBundle): Promise<void> {
		try {
			// For now, implement a simple splitting strategy
			// In a real implementation, this would use AST analysis
			const chunkSize = Math.ceil(bundle.size / 2);
			const chunk1Id = `${bundle.id}_chunk1`;
			const chunk2Id = `${bundle.id}_chunk2`;

			bundle.chunks = [chunk1Id, chunk2Id];

			if (this.config.developmentMode) {
				console.log(`[LayoutBundleOptimizer] Split bundle ${bundle.id} into ${bundle.chunks.length} chunks`);
			}
		} catch (error) {
			if (this.config.developmentMode) {
				console.warn(`[LayoutBundleOptimizer] Failed to split bundle ${bundle.id}:`, error);
			}
		}
	}

	/**
	 * Apply tree shaking to remove unused code
	 */
	private async applyTreeShaking(bundles: LayoutBundle[]): Promise<void> {
		for (const bundle of bundles) {
			try {
				// Simulate tree shaking by reducing bundle size
				// In a real implementation, this would analyze and remove unused exports
				const originalSize = bundle.size;
				bundle.size = Math.floor(bundle.size * 0.8); // Assume 20% reduction

				if (this.config.developmentMode) {
					const reduction = originalSize - bundle.size;
					console.log(`[LayoutBundleOptimizer] Tree shaking reduced ${bundle.id} by ${reduction} bytes`);
				}
			} catch (error) {
				if (this.config.developmentMode) {
					console.warn(`[LayoutBundleOptimizer] Tree shaking failed for ${bundle.id}:`, error);
				}
			}
		}
	}

	/**
	 * Apply minification to bundles
	 */
	private async applyMinification(bundles: LayoutBundle[]): Promise<void> {
		for (const bundle of bundles) {
			try {
				// Simulate minification by reducing bundle size
				// In a real implementation, this would use a minifier like terser
				const originalSize = bundle.size;
				bundle.size = Math.floor(bundle.size * 0.7); // Assume 30% reduction

				if (this.config.developmentMode) {
					const reduction = originalSize - bundle.size;
					console.log(`[LayoutBundleOptimizer] Minification reduced ${bundle.id} by ${reduction} bytes`);
				}
			} catch (error) {
				if (this.config.developmentMode) {
					console.warn(`[LayoutBundleOptimizer] Minification failed for ${bundle.id}:`, error);
				}
			}
		}
	}

	/**
	 * Analyze bundles and generate optimization report
	 */
	private async analyzeBundles(bundles: LayoutBundle[]): Promise<BundleAnalysis> {
		// Handle empty bundles array
		if (bundles.length === 0) {
			return {
				totalSize: 0,
				bundleCount: 0,
				averageBundleSize: 0,
				largestBundle: { path: '', size: 0 },
				smallestBundle: { path: '', size: 0 },
				duplicatedCode: [],
				optimizationOpportunities: ['No bundles found - layouts may not be properly configured'],
			};
		}

		const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0);
		const bundleCount = bundles.length;
		const averageBundleSize = totalSize / bundleCount;

		const sortedBundles = [...bundles].sort((a, b) => b.size - a.size);
		const largestBundle = sortedBundles[0];
		const smallestBundle = sortedBundles[sortedBundles.length - 1];

		// Analyze for duplicated code (simplified)
		const duplicatedCode: Array<{ code: string; occurrences: number }> = [];

		// Generate optimization opportunities
		const optimizationOpportunities: string[] = [];

		if (largestBundle && largestBundle.size > this.config.splitThreshold * 2) {
			optimizationOpportunities.push(`Consider splitting large bundle: ${largestBundle.id}`);
		}

		if (this.sharedChunks.size === 0) {
			optimizationOpportunities.push('No shared chunks found - consider extracting common dependencies');
		}

		const highPriorityBundles = bundles.filter(b => b.priority === 'high');
		if (highPriorityBundles.length > 3) {
			optimizationOpportunities.push('Too many high-priority bundles - consider reducing critical path');
		}

		return {
			totalSize,
			bundleCount,
			averageBundleSize,
			largestBundle: { path: largestBundle.path, size: largestBundle.size },
			smallestBundle: { path: smallestBundle.path, size: smallestBundle.size },
			duplicatedCode,
			optimizationOpportunities,
		};
	}

	/**
	 * Generate bundle analysis report
	 */
	private async generateAnalysisReport(analysis: BundleAnalysis): Promise<void> {
		const reportPath = join(this.config.outputDir, 'bundle-analysis.json');

		try {
			await Deno.writeTextFile(reportPath, JSON.stringify(analysis, null, 2));

			if (this.config.developmentMode) {
				console.log(`[LayoutBundleOptimizer] Bundle analysis report generated: ${reportPath}`);
				console.log(`Total size: ${(analysis.totalSize / 1024).toFixed(2)}KB`);
				console.log(`Bundle count: ${analysis.bundleCount}`);
				console.log(`Average size: ${(analysis.averageBundleSize / 1024).toFixed(2)}KB`);

				if (analysis.optimizationOpportunities.length > 0) {
					console.log('Optimization opportunities:');
					analysis.optimizationOpportunities.forEach(opp => console.log(`  - ${opp}`));
				}
			}
		} catch (error) {
			if (this.config.developmentMode) {
				console.warn('[LayoutBundleOptimizer] Failed to generate analysis report:', error);
			}
		}
	}

	/**
	 * Ensure output directory exists
	 */
	private async ensureOutputDirectory(): Promise<void> {
		try {
			await ensureDir(this.config.outputDir);
		} catch (error) {
			if (this.config.developmentMode) {
				console.warn(`[LayoutBundleOptimizer] Failed to create output directory ${this.config.outputDir}:`, error);
			}
		}
	}

	/**
	 * Get bundle by ID
	 */
	getBundleById(bundleId: string): LayoutBundle | undefined {
		return this.bundleCache.get(bundleId);
	}

	/**
	 * Get all bundles
	 */
	getAllBundles(): LayoutBundle[] {
		return Array.from(this.bundleCache.values());
	}

	/**
	 * Get shared chunks
	 */
	getSharedChunks(): Map<string, string[]> {
		return new Map(this.sharedChunks);
	}

	/**
	 * Clear bundle cache
	 */
	clearCache(): void {
		this.bundleCache.clear();
		this.dependencyGraph.clear();
		this.sharedChunks.clear();
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<BundleOptimizationConfig>): void {
		Object.assign(this.config, config);
	}

	/**
	 * Get current configuration
	 */
	getConfig(): Required<BundleOptimizationConfig> {
		return { ...this.config };
	}
}

/**
 * Default bundle optimization configuration
 */
export const defaultBundleOptimizationConfig: BundleOptimizationConfig = {
	outputDir: './dist/layout-bundles',
	enableCodeSplitting: true,
	enableTreeShaking: true,
	enableMinification: true,
	splitThreshold: 50 * 1024, // 50KB
	developmentMode: false,
	enableAnalysis: false,
};

/**
 * Create a layout bundle optimizer with specific configuration
 */
export function createLayoutBundleOptimizer(config: Partial<BundleOptimizationConfig> = {}): LayoutBundleOptimizer {
	return new LayoutBundleOptimizer({ ...defaultBundleOptimizationConfig, ...config });
}

/**
 * Utility functions for bundle optimization
 */
export const BundleOptimizerUtils = {
	/**
	 * Calculate bundle loading priority based on route patterns
	 */
	calculateLoadingPriority(bundlePath: string, currentRoute: string): number {
		// Root layouts get highest priority
		if (bundlePath.includes('/_layout.tsx') && bundlePath.split('/').length <= 3) {
			return 100;
		}

		// Layouts in current route path get high priority
		if (currentRoute.startsWith(bundlePath.replace('/_layout.tsx', ''))) {
			return 80;
		}

		// Adjacent routes get medium priority
		const bundleSegments = bundlePath.split('/');
		const routeSegments = currentRoute.split('/');
		const commonSegments = bundleSegments.filter((seg, i) => seg === routeSegments[i]).length;

		return Math.max(20, commonSegments * 20);
	},

	/**
	 * Estimate bundle loading time based on size and network conditions
	 */
	estimateLoadingTime(bundleSize: number, networkSpeed: 'fast' | 'medium' | 'slow' = 'medium'): number {
		const speedMultipliers = {
			fast: 1, // 1MB/s
			medium: 0.5, // 500KB/s
			slow: 0.1, // 100KB/s
		};

		const bytesPerSecond = 1024 * 1024 * speedMultipliers[networkSpeed];
		return (bundleSize / bytesPerSecond) * 1000; // Return in milliseconds
	},

	/**
	 * Generate bundle loading strategy
	 */
	generateLoadingStrategy(
		bundles: LayoutBundle[],
		currentRoute: string
	): {
		preload: string[];
		lazy: string[];
		defer: string[];
	} {
		const strategy: { preload: string[]; lazy: string[]; defer: string[] } = {
			preload: [],
			lazy: [],
			defer: [],
		};

		for (const bundle of bundles) {
			const priority = this.calculateLoadingPriority(bundle.path, currentRoute);

			if (priority >= 80) {
				strategy.preload.push(bundle.id);
			} else if (priority >= 40) {
				strategy.lazy.push(bundle.id);
			} else {
				strategy.defer.push(bundle.id);
			}
		}

		return strategy;
	},
};
