import { join, resolve, relative } from 'node:path';
import { statSync } from 'node:fs';

// URLPattern is available at runtime (Node 22+, Bun, Deno) but may lack type declarations
declare const URLPattern: new (init: { pathname: string }) => {
	test(input: URL | string): boolean;
	exec(input: URL | string): unknown;
};

import type {
	ComponentType,
	LayoutRoute,
	LayoutHandler,
	LayoutDiscoveryOptions,
	LayoutContext,
	LayoutData,
	LayoutProps,
	LayoutErrorInfo,
} from './layout-types.ts';

export type { LayoutDiscoveryOptions } from './layout-types.ts';

interface LayoutFileExport {
	default: ComponentType<LayoutProps>;
	layoutLoader?: (ctx: LayoutContext) => Promise<LayoutData>;
}

/**
 * Converts an absolute file path to a valid ESM import specifier.
 * Windows absolute paths (C:\...) are converted to file:// URLs.
 */
function toImportSpecifier(filePath: string): string {
	if (/^[A-Za-z]:[\\/]/.test(filePath)) {
		return `file:///${filePath.replaceAll('\\', '/')}`;
	}
	return filePath;
}

/**
 * Checks whether a file exists at the given path using statSync.
 */
function fileExists(filePath: string): boolean {
	try {
		statSync(filePath);
		return true;
	} catch {
		return false;
	}
}

/**
 * Builds the path hierarchy for a route.
 * For "/admin/users" returns ['', '/admin', '/admin/users'].
 */
function buildPathHierarchy(routePath: string): string[] {
	const segments = routePath.split('/').filter(Boolean);
	const paths: string[] = [''];
	for (let i = 0; i < segments.length; i++) {
		paths.push('/' + segments.slice(0, i + 1).join('/'));
	}
	return paths;
}

/**
 * Simplified Layout Discovery System
 *
 * Looks for _layout.tsx files in the path hierarchy from root to the current route.
 *
 * For route /admin/users/123:
 * - Check src/layouts/_layout.tsx (root layout)
 * - Check src/layouts/admin/_layout.tsx
 * - Check src/layouts/admin/users/_layout.tsx
 */
export class LayoutDiscovery {
	private readonly layoutCache = new Map<string, LayoutHandler>();
	private readonly routeCache = new Map<string, LayoutRoute[]>();
	private readonly baseDirectory: string;
	private readonly filePattern: string;
	private readonly developmentMode: boolean;

	constructor(options: LayoutDiscoveryOptions) {
		this.baseDirectory = resolve(options.baseDirectory);
		this.filePattern = options.filePattern || '_layout.tsx';
		this.developmentMode = options.developmentMode || false;

		if (this.developmentMode) {
			console.log(`[LayoutDiscovery] baseDirectory=${this.baseDirectory}, filePattern=${this.filePattern}`);
		}
	}

	/**
	 * Discovers all layout files for a given route path by walking up the path hierarchy
	 */
	discoverLayouts(routePath: string): Promise<LayoutRoute[]> {
		const cacheKey = `layouts-${routePath}`;

		if (this.routeCache.has(cacheKey)) {
			return Promise.resolve(this.routeCache.get(cacheKey)!);
		}

		const routes: LayoutRoute[] = [];
		const pathsToCheck = buildPathHierarchy(routePath);

		for (const pathToCheck of pathsToCheck) {
			const fsPath = pathToCheck === '' ? this.baseDirectory : join(this.baseDirectory, pathToCheck);
			const layoutFilePath = join(fsPath, this.filePattern);

			if (fileExists(layoutFilePath)) {
				const depth = pathToCheck === '' ? 0 : pathToCheck.split('/').filter(Boolean).length;
				routes.push({
					pattern: new URLPattern({ pathname: depth === 0 ? '*' : `${pathToCheck}/*` }),
					layoutPath: layoutFilePath,
					priority: depth * 10,
					type: depth === 0 ? 'root' : 'nested',
					depth,
				});
			}
		}

		routes.sort((a, b) => a.priority - b.priority);
		this.routeCache.set(cacheKey, routes);
		return Promise.resolve(routes);
	}

	/**
	 * Builds a complete layout chain for a URL
	 */
	async buildLayoutChain(url: URL): Promise<LayoutHandler[]> {
		const routes = await this.discoverLayouts(url.pathname);
		const layoutChain: LayoutHandler[] = [];

		for (const route of routes) {
			try {
				const handler = await this.loadLayout(route.layoutPath);
				if (handler) {
					layoutChain.push(handler);
				}
			} catch (error) {
				if (this.developmentMode) {
					console.warn(
						`[Layout] Failed to load ${route.layoutPath}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
		}

		return layoutChain;
	}

	/**
	 * Builds layout chain with data loading
	 */
	async buildLayoutChainWithData(
		url: URL,
		context: LayoutContext,
	): Promise<{ handlers: LayoutHandler[]; data: LayoutData[]; errors: LayoutErrorInfo[] }> {
		const handlers = await this.buildLayoutChain(url);
		const data: LayoutData[] = [];
		const errors: LayoutErrorInfo[] = [];

		for (const handler of handlers) {
			if (handler.loader) {
				try {
					const layoutData = await handler.loader(context);
					data.push(layoutData);
				} catch (error) {
					if (this.developmentMode) {
						console.warn(`[Layout] Data loader error for ${handler.path}:`, error);
					}
					errors.push({ layoutPath: handler.path, errorType: 'loader', timestamp: Date.now() });
					data.push({});
				}
			} else {
				data.push({});
			}
		}

		return { handlers, data, errors };
	}

	/**
	 * Loads layout handler from file
	 */
	private async loadLayout(filePath: string): Promise<LayoutHandler | null> {
		if (this.layoutCache.has(filePath)) {
			return this.layoutCache.get(filePath)!;
		}

		try {
			const importPath = toImportSpecifier(filePath);
			const layoutModule = (await import(/* @vite-ignore */ importPath)) as LayoutFileExport;

			if (!layoutModule.default || typeof layoutModule.default !== 'function') {
				if (this.developmentMode) {
					console.warn(`[Layout] No default export in ${filePath}`);
				}
				return null;
			}

			const relativePath = relative(this.baseDirectory, filePath);
			const pathSegments = relativePath.split('/').filter(Boolean);
			const priority = Math.max(0, (pathSegments.length - 1) * 10);

			const handler: LayoutHandler = {
				component: layoutModule.default,
				loader: layoutModule.layoutLoader,
				path: filePath,
				priority,
			};

			this.layoutCache.set(filePath, handler);
			return handler;
		} catch (error) {
			if (this.developmentMode) {
				console.warn(`[Layout] Failed to load ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
			}
			return null;
		}
	}

	/** Clears all caches */
	clearCache(): void {
		this.layoutCache.clear();
		this.routeCache.clear();
	}

	/** Clears cache for a specific layout file */
	clearLayoutCache(filePath: string): void {
		this.layoutCache.delete(filePath);
		this.routeCache.clear();
	}

	/** Gets cache statistics (for debugging) */
	getCacheStats(): { layoutCount: number; routeCacheCount: number } {
		return {
			layoutCount: this.layoutCache.size,
			routeCacheCount: this.routeCache.size,
		};
	}

	/** Gets the current discovery options */
	getOptions(): LayoutDiscoveryOptions {
		return {
			baseDirectory: this.baseDirectory,
			filePattern: this.filePattern,
			developmentMode: this.developmentMode,
		};
	}
}
