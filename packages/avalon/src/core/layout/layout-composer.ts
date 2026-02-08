import { resolve, relative } from 'node:path';
import process from 'node:process';
// NOTE: Using Deno.statSync instead of @std/fs for faster cold start
import { LayoutDiscovery } from './layout-discovery.ts';

// deno-lint-ignore no-explicit-any
type ComponentType<P = any> = ((props: P) => any) | (new (props: P) => any);

// NOTE: Using inline types to avoid importing heavy schemas/layout.ts (which imports zod)
interface LayoutHandler {
	component: ComponentType<LayoutProps>;
	loader?: (ctx: LayoutContext) => Promise<unknown>;
	path: string;
	priority: number;
}

interface LayoutConfig {
	skipLayouts?: string[];
	replaceLayout?: boolean;
	onlyLayouts?: string[];
	customLayout?: string;
}

interface LayoutContext {
	request: Request;
	params: Record<string, string>;
	query: URLSearchParams;
	state: Map<string, unknown>;
	middlewareContext?: unknown;
}

interface LayoutDiscoveryOptions {
	baseDirectory: string;
	filePattern?: string;
	excludeDirectories?: string[];
	enableWatching?: boolean;
	developmentMode?: boolean;
}

interface LayoutProps {
	children: unknown;
	data: Record<string, unknown>;
	frontmatter?: Record<string, unknown>;
	route: {
		path: string;
		params: Record<string, string>;
		query: URLSearchParams;
	};
}

/**
 * Page module interface with optional layout configuration
 */
interface PageModule {
	default: ComponentType<unknown>;
	layoutConfig?: LayoutConfig;
	loader?: (ctx: unknown) => Promise<unknown>;
}

/**
 * Layout file export interface
 */
interface LayoutFileExport {
	default: ComponentType<LayoutProps>;
	layoutLoader?: (ctx: LayoutContext) => Promise<unknown>;
}

/**
 * Layout composition control system that handles page-level layout customization.
 * Provides support for skipLayouts, replaceLayout, onlyLayouts, and customLayout configurations.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export class LayoutComposer {
	private layoutDiscovery: LayoutDiscovery;
	private customLayoutCache = new Map<string, LayoutHandler>();
	private developmentMode: boolean;

	constructor(options: LayoutDiscoveryOptions) {
		this.layoutDiscovery = new LayoutDiscovery(options);
		this.developmentMode = options.developmentMode || false;
	}

	/**
	 * Resolves layouts for a route with page-level configuration applied
	 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
	 */
	async resolveLayouts(routePath: string, pageModule: PageModule): Promise<LayoutHandler[]> {
		try {
			// Get the page's layout configuration
			const layoutConfig = pageModule.layoutConfig;

			// If no layout configuration, use standard layout discovery
			if (!layoutConfig) {
				return await this.layoutDiscovery.buildLayoutChain(new URL(`http://localhost${routePath}`));
			}

			// Handle replaceLayout configuration - skip all parent layouts
			if (layoutConfig.replaceLayout) {
				if (this.developmentMode) {
					console.log(`[LayoutComposer] Replacing all layouts for route: ${routePath}`);
				}
				return await this.handleReplaceLayout(routePath, layoutConfig);
			}

			// Get the standard layout chain first
			const standardLayouts = await this.layoutDiscovery.buildLayoutChain(new URL(`http://localhost${routePath}`));

			// Apply layout configuration to the standard chain
			return await this.applyConfiguration(standardLayouts, layoutConfig);
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[LayoutComposer] Error resolving layouts for ${routePath}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
			// Fallback to standard layout discovery on error
			return await this.layoutDiscovery.buildLayoutChain(new URL(`http://localhost${routePath}`));
		}
	}

	/**
	 * Applies layout configuration to a layout chain
	 * Requirements: 5.2, 5.3, 5.4, 5.5
	 */
	async applyConfiguration(layouts: LayoutHandler[], config: LayoutConfig): Promise<LayoutHandler[]> {
		let resultLayouts = [...layouts];

		// Apply onlyLayouts first (most restrictive)
		if (config.onlyLayouts && config.onlyLayouts.length > 0) {
			resultLayouts = await this.applyOnlyLayouts(resultLayouts, config.onlyLayouts);
		}

		// Apply skipLayouts (removes specific layouts)
		if (config.skipLayouts && config.skipLayouts.length > 0) {
			resultLayouts = this.applySkipLayouts(resultLayouts, config.skipLayouts);
		}

		// Add custom layout if specified
		if (config.customLayout) {
			resultLayouts = await this.addCustomLayout(resultLayouts, config.customLayout);
		}

		return resultLayouts;
	}

	/**
	 * Handles replaceLayout configuration by returning only custom layout or empty array
	 * Requirements: 5.1
	 */
	private async handleReplaceLayout(_routePath: string, config: LayoutConfig): Promise<LayoutHandler[]> {
		// If customLayout is specified with replaceLayout, use only the custom layout
		if (config.customLayout) {
			const customHandler = await this.loadCustomLayout(config.customLayout);
			return customHandler ? [customHandler] : [];
		}

		// If replaceLayout is true but no customLayout, return empty array (no layouts)
		return [];
	}

	/**
	 * Applies skipLayouts configuration by removing specified layouts
	 * Requirements: 5.2
	 */
	private applySkipLayouts(layouts: LayoutHandler[], skipLayouts: string[]): LayoutHandler[] {
		const filteredLayouts = layouts.filter(layout => {
			// Check if this layout should be skipped
			const shouldSkip = skipLayouts.some(skipPattern => {
				// Support both exact path matching and pattern matching
				if (skipPattern.includes('*')) {
					// Simple glob pattern matching
					const regex = new RegExp(skipPattern.replace(/\*/g, '.*'));
					return regex.test(layout.path) || regex.test(relative(process.cwd(), layout.path));
				} else {
					// Exact path matching (support both absolute and relative paths)
					return (
						layout.path === skipPattern ||
						layout.path.endsWith(skipPattern) ||
						relative(process.cwd(), layout.path) === skipPattern ||
						relative(process.cwd(), layout.path).endsWith(skipPattern)
					);
				}
			});

			if (shouldSkip && this.developmentMode) {
				console.log(`[LayoutComposer] Skipping layout: ${relative(process.cwd(), layout.path)}`);
			}

			return !shouldSkip;
		});

		return filteredLayouts;
	}

	/**
	 * Applies onlyLayouts configuration by keeping only specified layouts
	 * Requirements: 5.3
	 */
	private async applyOnlyLayouts(layouts: LayoutHandler[], onlyLayouts: string[]): Promise<LayoutHandler[]> {
		const filteredLayouts: LayoutHandler[] = [];

		// Process each onlyLayout pattern
		for (const onlyPattern of onlyLayouts) {
			// Check if it's a custom layout path (not in the standard chain)
			if (!layouts.some(layout => this.matchesLayoutPattern(layout, onlyPattern))) {
				// Try to load as custom layout
				const customHandler = await this.loadCustomLayout(onlyPattern);
				if (customHandler) {
					filteredLayouts.push(customHandler);
					if (this.developmentMode) {
						console.log(`[LayoutComposer] Added custom layout from onlyLayouts: ${onlyPattern}`);
					}
				}
			} else {
				// Find matching layouts in the standard chain
				const matchingLayouts = layouts.filter(layout => this.matchesLayoutPattern(layout, onlyPattern));
				filteredLayouts.push(...matchingLayouts);

				if (this.developmentMode && matchingLayouts.length > 0) {
					console.log(
						`[LayoutComposer] Kept layouts from onlyLayouts: ${matchingLayouts
							.map(l => relative(process.cwd(), l.path))
							.join(', ')}`
					);
				}
			}
		}

		// Sort by priority to maintain proper order
		filteredLayouts.sort((a, b) => a.priority - b.priority);

		return filteredLayouts;
	}

	/**
	 * Adds a custom layout to the layout chain
	 * Requirements: 5.4
	 */
	private async addCustomLayout(layouts: LayoutHandler[], customLayoutPath: string): Promise<LayoutHandler[]> {
		try {
			const customHandler = await this.loadCustomLayout(customLayoutPath);
			if (!customHandler) {
				if (this.developmentMode) {
					console.warn(`[LayoutComposer] Failed to load custom layout: ${customLayoutPath}`);
				}
				return layouts;
			}

			// Add custom layout with appropriate priority
			// Custom layouts get a high priority to ensure they're applied last
			const customLayoutWithPriority: LayoutHandler = {
				...customHandler,
				priority: Math.max(...layouts.map(l => l.priority), 0) + 10,
			};

			const resultLayouts = [...layouts, customLayoutWithPriority];

			// Sort by priority
			resultLayouts.sort((a, b) => a.priority - b.priority);

			if (this.developmentMode) {
				console.log(`[LayoutComposer] Added custom layout: ${relative(process.cwd(), customLayoutPath)}`);
			}

			return resultLayouts;
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[LayoutComposer] Error adding custom layout ${customLayoutPath}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
			return layouts;
		}
	}

	/**
	 * Loads a custom layout from a file path
	 * Requirements: 5.4
	 */
	private async loadCustomLayout(layoutPath: string): Promise<LayoutHandler | null> {
		try {
			// Check cache first
			if (this.customLayoutCache.has(layoutPath)) {
				return this.customLayoutCache.get(layoutPath)!;
			}

			// Resolve the layout path
			let resolvedPath = layoutPath;

			// If it's not an absolute path, try to resolve it relative to the current working directory
			if (!layoutPath.startsWith('/') && !layoutPath.startsWith('file://')) {
				// Try different resolution strategies
				const possiblePaths = [
					resolve(layoutPath),
					resolve('src', layoutPath),
					resolve('src/pages', layoutPath),
					resolve('src/layouts', layoutPath),
					// Also try relative to the base directory
					resolve(this.layoutDiscovery.getOptions().baseDirectory, '..', layoutPath),
					resolve(this.layoutDiscovery.getOptions().baseDirectory, layoutPath),
				];

				// Find the first existing path using Deno.statSync
				resolvedPath = possiblePaths.find(path => {
					try {
						Deno.statSync(path);
						return true;
					} catch {
						return false;
					}
				}) || layoutPath;
			}

			// Check if file exists using Deno.statSync
			let fileExists = false;
			try {
				Deno.statSync(resolvedPath);
				fileExists = true;
			} catch {
				// File doesn't exist
			}
			if (!fileExists) {
				if (this.developmentMode) {
					console.warn(`[LayoutComposer] Custom layout file not found: ${resolvedPath}`);
				}
				return null;
			}

			// Dynamic import the layout file
			const layoutModule = (await import(/* @vite-ignore */ resolvedPath)) as LayoutFileExport;

			if (!layoutModule.default || typeof layoutModule.default !== 'function') {
				if (this.developmentMode) {
					console.warn(`[LayoutComposer] Custom layout file does not export a default component: ${resolvedPath}`);
				}
				return null;
			}

			// Create layout handler
			const handler: LayoutHandler = {
				component: layoutModule.default,
				loader: layoutModule.layoutLoader,
				path: resolvedPath,
				priority: 1000, // High priority for custom layouts
			};

			// Cache the handler
			this.customLayoutCache.set(layoutPath, handler);

			return handler;
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[LayoutComposer] Failed to load custom layout ${layoutPath}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
			return null;
		}
	}

	/**
	 * Checks if a layout matches a pattern
	 * Requirements: 5.2, 5.3
	 */
	private matchesLayoutPattern(layout: LayoutHandler, pattern: string): boolean {
		// Support both exact path matching and pattern matching
		if (pattern.includes('*')) {
			// Simple glob pattern matching
			const regex = new RegExp(pattern.replace(/\*/g, '.*'));
			return regex.test(layout.path) || regex.test(relative(process.cwd(), layout.path));
		} else {
			// Exact path matching (support both absolute and relative paths)
			return (
				layout.path === pattern ||
				layout.path.endsWith(pattern) ||
				relative(process.cwd(), layout.path) === pattern ||
				relative(process.cwd(), layout.path).endsWith(pattern)
			);
		}
	}

	/**
	 * Validates layout configuration
	 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
	 */
	validateLayoutConfig(config: LayoutConfig): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Check for conflicting configurations
		if (config.replaceLayout && config.onlyLayouts && config.onlyLayouts.length > 0) {
			errors.push('replaceLayout and onlyLayouts cannot be used together');
		}

		if (config.replaceLayout && config.skipLayouts && config.skipLayouts.length > 0) {
			errors.push('replaceLayout and skipLayouts cannot be used together');
		}

		// Validate array configurations
		if (config.skipLayouts && !Array.isArray(config.skipLayouts)) {
			errors.push('skipLayouts must be an array of strings');
		}

		if (config.onlyLayouts && !Array.isArray(config.onlyLayouts)) {
			errors.push('onlyLayouts must be an array of strings');
		}

		// Validate customLayout
		if (config.customLayout && typeof config.customLayout !== 'string') {
			errors.push('customLayout must be a string path');
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Gets composition statistics for debugging
	 */
	getCompositionStats(): {
		customLayoutCacheSize: number;
		discoveryStats: { layoutCount: number; routeCacheCount: number };
	} {
		return {
			customLayoutCacheSize: this.customLayoutCache.size,
			discoveryStats: this.layoutDiscovery.getCacheStats(),
		};
	}

	/**
	 * Clears all caches
	 */
	clearCache(): void {
		this.customLayoutCache.clear();
		this.layoutDiscovery.clearCache();
	}

	/**
	 * Clears custom layout cache
	 */
	clearCustomLayoutCache(): void {
		this.customLayoutCache.clear();
	}

	/**
	 * Gets the underlying layout discovery instance
	 */
	getLayoutDiscovery(): LayoutDiscovery {
		return this.layoutDiscovery;
	}

	/**
	 * Sets development mode
	 */
	setDevelopmentMode(enabled: boolean): void {
		this.developmentMode = enabled;
	}

	/**
	 * Gets development mode status
	 */
	isDevelopmentMode(): boolean {
		return this.developmentMode;
	}
}
