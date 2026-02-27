/**
 * CSS HMR Handler
 *
 * Handles Hot Module Replacement for CSS files including:
 * - Global CSS files
 * - CSS modules
 * - Component-scoped styles (Svelte, Vue)
 */

/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import type { Update } from './hmr-coordinator.ts';

/**
 * CSS update types
 */
export type CSSUpdateType = 'global' | 'module' | 'scoped';

/**
 * CSS update information
 */
export interface CSSUpdateInfo {
	type: CSSUpdateType;
	path: string;
	timestamp: number;
	affectedComponents?: string[];
}

/**
 * CSS HMR Handler class
 * Manages CSS hot updates without page reload
 */
export class CSSHMRHandler {
	private cssModuleMap: Map<string, Set<HTMLElement>> = new Map();
	private styleElementMap: Map<string, HTMLStyleElement> = new Map();

	/**
	 * Handle CSS update from Vite HMR
	 */
	handleCSSUpdate(update: Update): void {
		const updateInfo = this.classifyCSSUpdate(update);

		switch (updateInfo.type) {
			case 'global':
				this.handleGlobalCSSUpdate(updateInfo);
				break;
			case 'module':
				this.handleCSSModuleUpdate(updateInfo);
				break;
			case 'scoped':
				this.handleScopedCSSUpdate(updateInfo);
				break;
		}
	}

	/**
	 * Classify the type of CSS update
	 */
	private classifyCSSUpdate(update: Update): CSSUpdateInfo {
		const path = update.path || update.acceptedPath;

		// Check if it's a CSS module
		if (path.includes('.module.css') || path.includes('.module.scss')) {
			return {
				type: 'module',
				path,
				timestamp: update.timestamp,
			};
		}

		// Check if it's a scoped style (Svelte or Vue)
		if (path.includes('.svelte') || path.includes('.vue')) {
			return {
				type: 'scoped',
				path,
				timestamp: update.timestamp,
			};
		}

		// Default to global CSS
		return {
			type: 'global',
			path,
			timestamp: update.timestamp,
		};
	}

	/**
	 * Handle global CSS file update
	 * Injects updated styles without page reload
	 */
	private handleGlobalCSSUpdate(info: CSSUpdateInfo): void {
		try {
			// Find existing style element for this CSS file
			const existingStyle = this.styleElementMap.get(info.path);

			if (existingStyle) {
				// Remove old style element
				existingStyle.remove();
				this.styleElementMap.delete(info.path);
			}

			// Vite automatically injects the updated CSS via its HMR mechanism
			// We just need to ensure old styles are removed
			// The new styles will be injected by Vite's CSS handling

			// Find the newly injected style element
			// Vite adds a data-vite-dev-id attribute to style elements
			const newStyle = document.querySelector<HTMLStyleElement>(
				`style[data-vite-dev-id*="${this.getFileId(info.path)}"]`,
			);

			if (newStyle) {
				this.styleElementMap.set(info.path, newStyle);
			}

			// Dispatch event for feedback
			this.dispatchCSSUpdateEvent(info, true);
		} catch (error) {
			console.error(`Failed to update global CSS: ${info.path}`, error);
			this.dispatchCSSUpdateEvent(info, false, error as Error);
			throw error;
		}
	}

	/**
	 * Handle CSS module update
	 * Re-renders components using the updated CSS module
	 */
	private handleCSSModuleUpdate(info: CSSUpdateInfo): void {
		try {
			const affectedIslands = this.findIslandsUsingCSSModule(info.path);

			if (affectedIslands.length === 0) {
				return;
			}

			for (const island of affectedIslands) {
				this.triggerIslandRerender(island, info);
			}

			this.dispatchCSSUpdateEvent(info, true);
		} catch (error) {
			console.error(`[HMR] Failed to update CSS module: ${info.path}`, error);
			this.dispatchCSSUpdateEvent(info, false, error as Error);
			throw error;
		}
	}

	/**
	 * Handle scoped CSS update (Svelte/Vue)
	 * Updates only the affected component's styles
	 */
	private handleScopedCSSUpdate(info: CSSUpdateInfo): void {
		try {
			const affectedIslands = this.findIslandsUsingComponent(info.path);

			if (affectedIslands.length === 0) {
				return;
			}

			this.dispatchCSSUpdateEvent(info, true);
		} catch (error) {
			console.error(`[HMR] Failed to update scoped CSS: ${info.path}`, error);
			this.dispatchCSSUpdateEvent(info, false, error as Error);
			throw error;
		}
	}

	/**
	 * Find islands that use a specific CSS module
	 */
	private findIslandsUsingCSSModule(cssPath: string): HTMLElement[] {
		const islands: HTMLElement[] = [];
		const normalizedPath = this.normalizePath(cssPath);

		// Check cached mapping first
		const cached = this.cssModuleMap.get(normalizedPath);
		if (cached) {
			return Array.from(cached);
		}

		// Find all islands
		const allIslands = document.querySelectorAll<HTMLElement>('[data-src]');

		for (const island of allIslands) {
			const src = island.getAttribute('data-src');
			if (!src) continue;

			// Check if the island's component likely imports this CSS module
			// This is a heuristic - we look for islands in the same directory
			const componentDir = this.getDirectory(src);
			const cssDir = this.getDirectory(cssPath);

			if (componentDir === cssDir) {
				islands.push(island);
			}
		}

		// Cache the mapping
		if (islands.length > 0) {
			this.cssModuleMap.set(normalizedPath, new Set(islands));
		}

		return islands;
	}

	/**
	 * Find islands using a specific component file
	 */
	private findIslandsUsingComponent(componentPath: string): HTMLElement[] {
		const islands: HTMLElement[] = [];
		const normalizedPath = this.normalizePath(componentPath);

		const allIslands = document.querySelectorAll<HTMLElement>('[data-src]');

		for (const island of allIslands) {
			const src = island.getAttribute('data-src');
			if (!src) continue;

			const normalizedSrc = this.normalizePath(src);

			if (normalizedSrc === normalizedPath || normalizedSrc.includes(normalizedPath)) {
				islands.push(island);
			}
		}

		return islands;
	}

	/**
	 * Trigger re-render of an island to apply new CSS module classes
	 */
	private triggerIslandRerender(island: HTMLElement, info: CSSUpdateInfo): void {
		// Dispatch event to trigger island re-render
		// The HMR coordinator will handle the actual re-render
		island.dispatchEvent(
			new CustomEvent('css-module-update', {
				detail: {
					cssPath: info.path,
					timestamp: info.timestamp,
				},
				bubbles: true,
			}),
		);

		// Also trigger a standard HMR update event
		// This will be picked up by the HMR coordinator
		const src = island.getAttribute('data-src');
		if (src) {
			island.dispatchEvent(
				new CustomEvent('hmr-update-required', {
					detail: {
						src,
						reason: 'css-module-update',
						cssPath: info.path,
					},
					bubbles: true,
				}),
			);
		}
	}

	/**
	 * Dispatch CSS update event for feedback
	 */
	private dispatchCSSUpdateEvent(info: CSSUpdateInfo, success: boolean, error?: Error): void {
		const event = new CustomEvent('css-hmr-update', {
			detail: {
				type: info.type,
				path: info.path,
				timestamp: info.timestamp,
				success,
				error: error?.message,
			},
			bubbles: true,
		});

		document.dispatchEvent(event);
	}

	/**
	 * Normalize a file path for comparison
	 */
	private normalizePath(path: string): string {
		return path.replace(/\\/g, '/').replace(/^\//, '').replace(/\?.*$/, '').replace(/#.*$/, '');
	}

	/**
	 * Get directory from a file path
	 */
	private getDirectory(path: string): string {
		const normalized = this.normalizePath(path);
		const lastSlash = normalized.lastIndexOf('/');
		return lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
	}

	/**
	 * Get file ID from path (for Vite's data-vite-dev-id)
	 */
	private getFileId(path: string): string {
		const normalized = this.normalizePath(path);
		// Vite uses the file path as the ID
		return normalized;
	}

	/**
	 * Clear cached mappings
	 */
	clearCache(): void {
		this.cssModuleMap.clear();
		this.styleElementMap.clear();
	}

	/**
	 * Register an island as using a CSS module
	 * Useful for explicit tracking
	 */
	registerCSSModuleUsage(cssPath: string, island: HTMLElement): void {
		const normalized = this.normalizePath(cssPath);

		if (!this.cssModuleMap.has(normalized)) {
			this.cssModuleMap.set(normalized, new Set());
		}

		this.cssModuleMap.get(normalized)!.add(island);
	}
}

/**
 * Global CSS HMR handler instance
 */
let cssHandlerInstance: CSSHMRHandler | null = null;

/**
 * Get or create the global CSS HMR handler instance
 */
export function getCSSHMRHandler(): CSSHMRHandler {
	if (!cssHandlerInstance) {
		cssHandlerInstance = new CSSHMRHandler();
	}
	return cssHandlerInstance;
}
