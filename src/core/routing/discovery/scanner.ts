/**
 * File System Scanner - Handles scanning directories for route files
 */

import { relative, extname, basename, dirname, resolve } from '@std/path';
import { walk } from '@std/fs';
import type { PageFile, RouteDiscoveryOptions } from '../../../schemas/routing.ts';
import { PageFileSchema } from '../../../schemas/routing.ts';
import { RoutingErrorHandler } from '../error-handler.ts';
import { isPrivateFile, extractRouteGroup } from '../route-discovery.utils.ts';
import type { ScanCacheEntry, ScanCacheStats, OptimizedWalkOptions } from '../route-discovery.types.ts';

/**
 * File system scanner for route discovery
 */
export class FileSystemScanner {
	private scanCache = new Map<string, ScanCacheEntry>();
	private readonly SCAN_CACHE_TTL = 30000; // 30 seconds cache for file scans

	constructor(private options: RouteDiscoveryOptions, private errorHandler: RoutingErrorHandler) {}

	/**
	 * Scans the pages directory recursively to find all page files
	 */
	async scanPagesDirectory(): Promise<PageFile[]> {
		const startTime = performance.now();
		const pagesDir = this.options.pagesDirectory;

		// Check scan cache first for performance optimization
		const cacheKey = `pages:${pagesDir}`;
		const cached = this.scanCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < this.SCAN_CACHE_TTL) {
			if (this.options.developmentMode) {
				console.log(`📋 Using cached pages directory scan (${cached.files.length} files)`);
			}
			return cached.files;
		}

		const pageFiles: PageFile[] = [];

		try {
			// Check if pages directory exists
			const stat = await Deno.stat(pagesDir);
			if (!stat.isDirectory) {
				const error = this.errorHandler.createInvalidFileStructureError(
					pagesDir,
					`Expected directory but found ${stat.isFile ? 'file' : 'other'}`
				);
				this.errorHandler.handleError(error);
				return [];
			}
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				if (this.options.developmentMode) {
					const warning = this.errorHandler.createDevelopmentWarning(
						`Pages directory ${pagesDir} not found, creating it...`,
						pagesDir,
						['Create the pages directory and add your first page file (e.g., index.tsx)']
					);
					this.errorHandler.handleError(warning);
				}
				await Deno.mkdir(pagesDir, { recursive: true });
				return [];
			}

			const routingError = this.errorHandler.createInvalidFileStructureError(
				pagesDir,
				`Failed to access pages directory: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
			this.errorHandler.handleError(routingError);
			return [];
		}

		// Walk through the pages directory
		for await (const entry of walk(pagesDir, {
			includeDirs: false,
			followSymlinks: false,
			exts: this.options.extensions,
		})) {
			if (!entry.isFile) continue;

			const filePath = entry.path;
			const relativePath = relative(pagesDir, filePath);
			const extension = extname(filePath);

			// Skip files in excluded directories
			if (this.options.excludeDirectories.some(dir => relativePath.includes(dir))) {
				continue;
			}

			// Determine if file is private (in folder starting with _)
			const isPrivate = isPrivateFile(relativePath);

			// Extract route group if applicable
			const routeGroup = extractRouteGroup(relativePath);

			// Get file modification time for caching
			let mtime: number | undefined;
			try {
				const stat = await Deno.stat(filePath);
				mtime = stat.mtime?.getTime();
			} catch {
				// Ignore stat errors
			}

			const pageFile: PageFile = {
				filePath,
				relativePath,
				extension,
				isPrivate,
				routeGroup,
				mtime,
			};

			// Validate the page file
			const validationResult = PageFileSchema.safeParse(pageFile);
			if (validationResult.success) {
				pageFiles.push(pageFile);
			} else {
				const error = this.errorHandler.createInvalidFileStructureError(
					filePath,
					`Page file validation failed: ${validationResult.error.message}`
				);
				this.errorHandler.handleError(error);
			}
		}

		const scanTime = performance.now() - startTime;

		// Cache the results for performance optimization
		this.scanCache.set(cacheKey, {
			files: pageFiles,
			timestamp: Date.now(),
		});

		if (this.options.developmentMode) {
			console.log(`🔍 Scanned pages directory in ${scanTime.toFixed(2)}ms, found ${pageFiles.length} files`);
		}

		return pageFiles;
	}

	/**
	 * Scans the API directory recursively to find all API route files
	 */
	async scanApiDirectory(): Promise<PageFile[]> {
		const startTime = performance.now();
		const apiDir = this.options.apiDirectory;

		// Check scan cache first for performance optimization
		const cacheKey = `api:${apiDir}`;
		const cached = this.scanCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < this.SCAN_CACHE_TTL) {
			if (this.options.developmentMode) {
				console.log(`📋 Using cached API directory scan (${cached.files.length} files)`);
			}
			return cached.files;
		}

		const apiFiles: PageFile[] = [];

		try {
			// Check if API directory exists
			const stat = await Deno.stat(apiDir);
			if (!stat.isDirectory) {
				const error = this.errorHandler.createInvalidFileStructureError(
					apiDir,
					`Expected directory but found ${stat.isFile ? 'file' : 'other'}`
				);
				this.errorHandler.handleError(error);
				return [];
			}
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				if (this.options.developmentMode) {
					const warning = this.errorHandler.createDevelopmentWarning(
						`API directory ${apiDir} not found, creating it...`,
						apiDir,
						['Create the API directory manually if you plan to use API routes']
					);
					this.errorHandler.handleError(warning);
				}
				await Deno.mkdir(apiDir, { recursive: true });
				return [];
			}

			const routingError = this.errorHandler.createInvalidFileStructureError(
				apiDir,
				`Failed to access API directory: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error : undefined
			);
			this.errorHandler.handleError(routingError);
			return [];
		}

		// Walk through the API directory
		for await (const entry of walk(apiDir, {
			includeDirs: false,
			followSymlinks: false,
			exts: this.options.extensions,
		})) {
			if (!entry.isFile) continue;

			const filePath = entry.path;
			const relativePath = relative(apiDir, filePath);
			const extension = extname(filePath);

			// Skip files in excluded directories
			if (this.options.excludeDirectories.some(dir => relativePath.includes(dir))) {
				continue;
			}

			// Determine if file is private (in folder starting with _)
			const isPrivate = isPrivateFile(relativePath);

			// Extract route group if applicable (though less common for API routes)
			const routeGroup = extractRouteGroup(relativePath);

			// Get file modification time for caching
			let mtime: number | undefined;
			try {
				const stat = await Deno.stat(filePath);
				mtime = stat.mtime?.getTime();
			} catch {
				// Ignore stat errors
			}

			const apiFile: PageFile = {
				filePath,
				relativePath,
				extension,
				isPrivate,
				routeGroup,
				mtime,
			};

			// Validate the API file
			const validationResult = PageFileSchema.safeParse(apiFile);
			if (validationResult.success) {
				apiFiles.push(apiFile);
			} else {
				const error = this.errorHandler.createInvalidFileStructureError(
					filePath,
					`API file validation failed: ${validationResult.error.message}`
				);
				this.errorHandler.handleError(error);
			}
		}

		const scanTime = performance.now() - startTime;

		// Cache the results for performance optimization
		this.scanCache.set(cacheKey, {
			files: apiFiles,
			timestamp: Date.now(),
		});

		if (this.options.developmentMode) {
			console.log(`🔍 Scanned API directory in ${scanTime.toFixed(2)}ms, found ${apiFiles.length} files`);
		}

		return apiFiles;
	}

	/**
	 * Clear scan cache for performance optimization
	 */
	clearScanCache(): void {
		this.scanCache.clear();
		if (this.options.developmentMode) {
			console.log('🧹 Cleared route discovery scan cache');
		}
	}

	/**
	 * Invalidate scan cache for specific directory
	 */
	invalidateScanCache(directory: string): void {
		const keysToDelete: string[] = [];
		for (const [key] of this.scanCache) {
			if (key.includes(directory)) {
				keysToDelete.push(key);
			}
		}

		for (const key of keysToDelete) {
			this.scanCache.delete(key);
		}

		if (this.options.developmentMode && keysToDelete.length > 0) {
			console.log(`🔄 Invalidated ${keysToDelete.length} scan cache entries for ${directory}`);
		}
	}

	/**
	 * Get scan cache statistics
	 */
	getScanCacheStats(): ScanCacheStats {
		const entries = Array.from(this.scanCache.values());
		const totalFiles = entries.reduce((sum, entry) => sum + entry.files.length, 0);
		const timestamps = entries.map(e => e.timestamp);

		return {
			totalEntries: this.scanCache.size,
			totalFiles,
			oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
			newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
		};
	}
}
