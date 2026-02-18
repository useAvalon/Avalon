import { join, resolve, relative } from 'node:path';
import { statSync } from 'node:fs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentType<P = any> = ((props: P) => any) | (new (props: P) => any);

// Inline type definitions to avoid importing heavy schemas/layout.ts (which imports zod)
interface LayoutRoute {
	pattern: URLPattern;
	layoutPath: string;
	priority: number;
	type: 'root' | 'nested';
	depth: number;
}

interface LayoutHandler {
	component: ComponentType<LayoutProps>;
	loader?: (ctx: LayoutContext) => Promise<LayoutData>;
	path: string;
	priority: number;
}

interface LayoutDiscoveryOptions {
	baseDirectory: string;
	filePattern?: string;
	excludeDirectories?: string[];
	enableWatching?: boolean;
	developmentMode?: boolean;
}

interface LayoutContext {
	request: Request;
	params: Record<string, string>;
	query: URLSearchParams;
	state: Map<string, unknown>;
	middlewareContext?: unknown;
}

type LayoutData = Record<string, unknown>;

interface LayoutProps {
	children: unknown;
	data: LayoutData;
	frontmatter?: Record<string, unknown>;
	route: {
		path: string;
		params: Record<string, string>;
		query: URLSearchParams;
	};
}

interface LayoutErrorInfo {
	layoutPath: string;
	errorType: 'component' | 'loader' | 'rendering' | 'island';
	timestamp: number;
	componentStack?: string;
	errorBoundary?: string;
}

/**
 * Layout file export interface
 */
interface LayoutFileExport {
	default: ComponentType<LayoutProps>;
	layoutLoader?: (ctx: LayoutContext) => Promise<LayoutData>;
}

/**
 * Simplified Layout Discovery System
 * 
 * Instead of scanning directories recursively, this simply looks for _layout.tsx
 * files in the path hierarchy from root to the current route.
 * 
 * For route /admin/users/123:
 * - Check /src/pages/_layout.tsx (root layout)
 * - Check /src/pages/admin/_layout.tsx
 * - Check /src/pages/admin/users/_layout.tsx
 */
export class LayoutDiscovery {
	private layoutCache = new Map<string, LayoutHandler>();
	private routeCache = new Map<string, LayoutRoute[]>();
	private baseDirectory: string;
	private filePattern: string;
	private developmentMode: boolean;

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

		// Build path hierarchy: ['', '/admin', '/admin/users']
		const pathSegments = routePath.split('/').filter(Boolean);
		const pathsToCheck: string[] = [''];

		for (let i = 0; i < pathSegments.length; i++) {
			pathsToCheck.push('/' + pathSegments.slice(0, i + 1).join('/'));
		}

		// Check each path level for a layout file
		for (const pathToCheck of pathsToCheck) {
			const fsPath = pathToCheck === '' ? this.baseDirectory : join(this.baseDirectory, pathToCheck);
			const layoutFilePath = join(fsPath, this.filePattern);

			let layoutExists = false;
			try {
				statSync(layoutFilePath);
				layoutExists = true;
			} catch {
				// File doesn't exist
			}
			if (layoutExists) {
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

		// Sort by priority (root layouts first)
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
					console.warn(`[Layout] Failed to load ${route.layoutPath}: ${error instanceof Error ? error.message : String(error)}`);
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
		context: LayoutContext
	): Promise<{ handlers: LayoutHandler[]; data: LayoutData[]; errors: LayoutErrorInfo[] }> {
		const handlers = await this.buildLayoutChain(url);
		const data: LayoutData[] = [];
		const errors: LayoutErrorInfo[] = [];

		// Load data for each layout
		for (const handler of handlers) {
			if (handler.loader) {
				try {
					const layoutData = await handler.loader(context);
					data.push(layoutData);
				} catch (_error) {
					errors.push({
						layoutPath: handler.path,
						errorType: 'loader',
						timestamp: Date.now(),
					});
					data.push({}); // Push empty data on error
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
		// Check cache first
		if (this.layoutCache.has(filePath)) {
			return this.layoutCache.get(filePath)!;
		}

		try {
			const layoutModule = (await import(/* @vite-ignore */ filePath)) as LayoutFileExport;

			if (!layoutModule.default || typeof layoutModule.default !== 'function') {
				if (this.developmentMode) {
					console.warn(`[Layout] No default export in ${filePath}`);
				}
				return null;
			}

			// Calculate priority based on path depth
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

	/**
	 * Clears all caches
	 */
	clearCache(): void {
		this.layoutCache.clear();
		this.routeCache.clear();
	}

	/**
	 * Clears cache for a specific layout file
	 */
	clearLayoutCache(filePath: string): void {
		this.layoutCache.delete(filePath);
		this.routeCache.clear();
	}

	/**
	 * Gets cache statistics (for debugging)
	 */
	getCacheStats(): { layoutCount: number; routeCacheCount: number } {
		return {
			layoutCount: this.layoutCache.size,
			routeCacheCount: this.routeCache.size,
		};
	}

	/**
	 * Gets the current discovery options
	 */
	getOptions(): LayoutDiscoveryOptions {
		return {
			baseDirectory: this.baseDirectory,
			filePattern: this.filePattern,
			developmentMode: this.developmentMode,
		};
	}
}
