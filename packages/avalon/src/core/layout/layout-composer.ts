import { statSync } from "node:fs";
import { relative, resolve } from "node:path";
import process from "node:process";
import { LayoutDiscovery } from "./layout-discovery.ts";
import type {
	ComponentType,
	LayoutConfig,
	LayoutContext,
	LayoutData,
	LayoutDiscoveryOptions,
	LayoutHandler,
	LayoutProps,
	PageModule,
} from "./layout-types.ts";

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
		return `file:///${filePath.replaceAll("\\", "/")}`;
	}
	return filePath;
}

/**
 * Checks whether a file exists at the given path using statSync.
 */
function fileExists(path: string): boolean {
	try {
		statSync(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Converts a glob-style pattern (with *) to a RegExp.
 */
function globToRegex(pattern: string): RegExp {
	return new RegExp(pattern.replaceAll("*", ".*"));
}

/**
 * Layout composition control system that handles page-level layout customization.
 * Provides support for skipLayouts, replaceLayout, onlyLayouts, and customLayout configurations.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
export class LayoutComposer {
	private readonly layoutDiscovery: LayoutDiscovery;
	private readonly customLayoutCache = new Map<string, LayoutHandler>();
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
			const layoutConfig = pageModule.layoutConfig;

			if (!layoutConfig) {
				return await this.layoutDiscovery.buildLayoutChain(new URL(`http://localhost${routePath}`));
			}

			if (layoutConfig.replaceLayout) {
				if (this.developmentMode) {
					console.log(`[LayoutComposer] Replacing all layouts for route: ${routePath}`);
				}
				return await this.handleReplaceLayout(routePath, layoutConfig);
			}

			const standardLayouts = await this.layoutDiscovery.buildLayoutChain(
				new URL(`http://localhost${routePath}`),
			);
			return await this.applyConfiguration(standardLayouts, layoutConfig);
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[LayoutComposer] Error resolving layouts for ${routePath}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
			return await this.layoutDiscovery.buildLayoutChain(new URL(`http://localhost${routePath}`));
		}
	}

	/**
	 * Applies layout configuration to a layout chain
	 * Requirements: 5.2, 5.3, 5.4, 5.5
	 */
	async applyConfiguration(
		layouts: LayoutHandler[],
		config: LayoutConfig,
	): Promise<LayoutHandler[]> {
		let resultLayouts = [...layouts];

		if (config.onlyLayouts && config.onlyLayouts.length > 0) {
			resultLayouts = await this.applyOnlyLayouts(resultLayouts, config.onlyLayouts);
		}

		if (config.skipLayouts && config.skipLayouts.length > 0) {
			resultLayouts = this.applySkipLayouts(resultLayouts, config.skipLayouts);
		}

		if (config.customLayout) {
			resultLayouts = await this.addCustomLayout(resultLayouts, config.customLayout);
		}

		return resultLayouts;
	}

	/** Handles replaceLayout: returns only custom layout or empty array */
	private async handleReplaceLayout(
		_routePath: string,
		config: LayoutConfig,
	): Promise<LayoutHandler[]> {
		if (config.customLayout) {
			const customHandler = await this.loadCustomLayout(config.customLayout);
			return customHandler ? [customHandler] : [];
		}
		return [];
	}

	/** Checks if a layout matches a glob or exact path pattern */
	private matchesLayoutPattern(layout: LayoutHandler, pattern: string): boolean {
		if (pattern.includes("*")) {
			const regex = globToRegex(pattern);
			return regex.test(layout.path) || regex.test(relative(process.cwd(), layout.path));
		}
		return (
			layout.path === pattern ||
			layout.path.endsWith(pattern) ||
			relative(process.cwd(), layout.path) === pattern ||
			relative(process.cwd(), layout.path).endsWith(pattern)
		);
	}

	/** Removes layouts matching skipLayouts patterns */
	private applySkipLayouts(layouts: LayoutHandler[], skipLayouts: string[]): LayoutHandler[] {
		return layouts.filter((layout) => {
			const shouldSkip = skipLayouts.some((pattern) => this.matchesLayoutPattern(layout, pattern));

			if (shouldSkip && this.developmentMode) {
				console.log(`[LayoutComposer] Skipping layout: ${relative(process.cwd(), layout.path)}`);
			}

			return !shouldSkip;
		});
	}

	/** Keeps only layouts matching onlyLayouts patterns */
	private async applyOnlyLayouts(
		layouts: LayoutHandler[],
		onlyLayouts: string[],
	): Promise<LayoutHandler[]> {
		const filteredLayouts: LayoutHandler[] = [];

		for (const onlyPattern of onlyLayouts) {
			const matchingLayouts = layouts.filter((layout) =>
				this.matchesLayoutPattern(layout, onlyPattern),
			);

			if (matchingLayouts.length > 0) {
				filteredLayouts.push(...matchingLayouts);
				if (this.developmentMode) {
					console.log(
						`[LayoutComposer] Kept layouts from onlyLayouts: ${matchingLayouts
							.map((l) => relative(process.cwd(), l.path))
							.join(", ")}`,
					);
				}
			} else {
				// Not in standard chain — try loading as custom layout
				const customHandler = await this.loadCustomLayout(onlyPattern);
				if (customHandler) {
					filteredLayouts.push(customHandler);
					if (this.developmentMode) {
						console.log(`[LayoutComposer] Added custom layout from onlyLayouts: ${onlyPattern}`);
					}
				}
			}
		}

		filteredLayouts.sort((a, b) => a.priority - b.priority);
		return filteredLayouts;
	}

	/** Adds a custom layout to the layout chain */
	private async addCustomLayout(
		layouts: LayoutHandler[],
		customLayoutPath: string,
	): Promise<LayoutHandler[]> {
		try {
			const customHandler = await this.loadCustomLayout(customLayoutPath);
			if (!customHandler) {
				if (this.developmentMode) {
					console.warn(`[LayoutComposer] Failed to load custom layout: ${customLayoutPath}`);
				}
				return layouts;
			}

			const customLayoutWithPriority: LayoutHandler = {
				...customHandler,
				priority: Math.max(...layouts.map((l) => l.priority), 0) + 10,
			};

			const resultLayouts = [...layouts, customLayoutWithPriority];
			resultLayouts.sort((a, b) => a.priority - b.priority);

			if (this.developmentMode) {
				console.log(
					`[LayoutComposer] Added custom layout: ${relative(process.cwd(), customLayoutPath)}`,
				);
			}

			return resultLayouts;
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[LayoutComposer] Error adding custom layout ${customLayoutPath}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
			return layouts;
		}
	}

	/**
	 * Resolves a layout path to an absolute path, trying multiple resolution strategies.
	 */
	private resolveLayoutPath(layoutPath: string): string {
		if (
			layoutPath.startsWith("/") ||
			layoutPath.startsWith("file://") ||
			/^[A-Za-z]:[\\/]/.test(layoutPath)
		) {
			return layoutPath;
		}

		const baseDir = this.layoutDiscovery.getOptions().baseDirectory;
		const candidates = [
			resolve(layoutPath),
			resolve("src", layoutPath),
			resolve("src/pages", layoutPath),
			resolve("src/layouts", layoutPath),
			resolve(baseDir, "..", layoutPath),
			resolve(baseDir, layoutPath),
		];

		return candidates.find((p) => fileExists(p)) || layoutPath;
	}

	/** Loads a custom layout from a file path */
	private async loadCustomLayout(layoutPath: string): Promise<LayoutHandler | null> {
		if (this.customLayoutCache.has(layoutPath)) {
			return this.customLayoutCache.get(layoutPath)!;
		}

		try {
			const resolvedPath = this.resolveLayoutPath(layoutPath);

			if (!fileExists(resolvedPath)) {
				if (this.developmentMode) {
					console.warn(`[LayoutComposer] Custom layout file not found: ${resolvedPath}`);
				}
				return null;
			}

			const importPath = toImportSpecifier(resolvedPath);
			const layoutModule = (await import(/* @vite-ignore */ importPath)) as LayoutFileExport;

			if (!layoutModule.default || typeof layoutModule.default !== "function") {
				if (this.developmentMode) {
					console.warn(
						`[LayoutComposer] Custom layout file does not export a default component: ${resolvedPath}`,
					);
				}
				return null;
			}

			const handler: LayoutHandler = {
				component: layoutModule.default,
				loader: layoutModule.layoutLoader,
				path: resolvedPath,
				priority: 1000,
			};

			this.customLayoutCache.set(layoutPath, handler);
			return handler;
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[LayoutComposer] Failed to load custom layout ${layoutPath}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
			return null;
		}
	}

	/** Validates layout configuration */
	validateLayoutConfig(config: LayoutConfig): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (config.replaceLayout && config.onlyLayouts && config.onlyLayouts.length > 0) {
			errors.push("replaceLayout and onlyLayouts cannot be used together");
		}

		if (config.replaceLayout && config.skipLayouts && config.skipLayouts.length > 0) {
			errors.push("replaceLayout and skipLayouts cannot be used together");
		}

		if (config.skipLayouts && !Array.isArray(config.skipLayouts)) {
			errors.push("skipLayouts must be an array of strings");
		}

		if (config.onlyLayouts && !Array.isArray(config.onlyLayouts)) {
			errors.push("onlyLayouts must be an array of strings");
		}

		if (config.customLayout && typeof config.customLayout !== "string") {
			errors.push("customLayout must be a string path");
		}

		return { valid: errors.length === 0, errors };
	}

	/** Gets composition statistics for debugging */
	getCompositionStats(): {
		customLayoutCacheSize: number;
		discoveryStats: { layoutCount: number; routeCacheCount: number };
	} {
		return {
			customLayoutCacheSize: this.customLayoutCache.size,
			discoveryStats: this.layoutDiscovery.getCacheStats(),
		};
	}

	/** Clears all caches */
	clearCache(): void {
		this.customLayoutCache.clear();
		this.layoutDiscovery.clearCache();
	}

	/** Clears custom layout cache */
	clearCustomLayoutCache(): void {
		this.customLayoutCache.clear();
	}

	/** Gets the underlying layout discovery instance */
	getLayoutDiscovery(): LayoutDiscovery {
		return this.layoutDiscovery;
	}

	/** Sets development mode */
	setDevelopmentMode(enabled: boolean): void {
		this.developmentMode = enabled;
	}

	/** Gets development mode status */
	isDevelopmentMode(): boolean {
		return this.developmentMode;
	}
}
