/**
 * @useavalon/preact
 *
 * Preact integration for Avalon framework
 * Provides server-side rendering and client-side hydration for Preact components
 */

import type { Plugin } from 'vite';
import type { Integration, IntegrationConfig } from '@useavalon/core/types';
import { render } from './server/renderer.ts';
import { getHydrationScript } from './client/hydration.ts';

/**
 * Preact integration configuration
 */
const config: IntegrationConfig = {
	name: 'preact',
	fileExtensions: ['.tsx', '.jsx'],
	jsxImportSources: ['preact'],
	detectionPatterns: {
		imports: [/^preact$/, /^preact\//, /from\s+['"]preact['"]/, /from\s+['"]preact\/[^'"]+['"]/],
		content: [
			/\buseState\b/,
			/\buseEffect\b/,
			/\buseRef\b/,
			/\buseMemo\b/,
			/\buseCallback\b/,
			/\buseContext\b/,
			/\buseReducer\b/,
			/\bh\(/,
			/\bFragment\b/,
		],
	},
};

/**
 * Preact integration object
 * Implements the Integration interface
 */
export const preactIntegration: Integration = {
	name: 'preact',
	version: '0.1.0',

	render,

	getHydrationScript,

	config(): IntegrationConfig {
		return config;
	},

	/**
	 * Provides the @preact/preset-vite Vite plugin with include/exclude patterns.
	 * Excludes .solid.tsx files to avoid conflicts with Solid integration.
	 */
	async vitePlugin(): Promise<Plugin | Plugin[]> {
		const { default: preact } = await import('@preact/preset-vite');
		const plugins = preact({
			// Exclude Solid files from Preact processing
			include: [/\.(tsx|jsx)$/],
			exclude: [/node_modules/, /\.solid\.(tsx|jsx)$/],
		});

		// Patch deprecated Vite config options (esbuild → oxc)
		// from @preact/preset-vite which hasn't fully updated for Vite 8 / Rolldown yet.
		const pluginArray = Array.isArray(plugins) ? plugins : [plugins];
		return pluginArray.map(p => {
			if (typeof p.config !== 'function') return p;
			const origConfig = p.config;
			return {
				...p,
				config(...args: Parameters<typeof origConfig>) {
					const result = (origConfig as Function).apply(this, args) as Record<string, unknown> | undefined;
					if (!result || typeof result !== 'object') return result;
					if ('esbuild' in result) {
						const { esbuild, ...rest } = result;
						// Strip jsx key — OXC uses a different config format than esbuild
						const esbuildConfig = esbuild as Record<string, unknown> | undefined;
						if (esbuildConfig && typeof esbuildConfig === 'object') {
							const { jsx, ...oxcSafe } = esbuildConfig;
							return { ...rest, oxc: oxcSafe };
						}
						return { ...rest, oxc: esbuild };
					}
					return result;
				},
			} as Plugin;
		});
	},
};

// Re-export public API
export { render, renderWithErrorBoundary } from './server/renderer.ts';
export { hydrate, getHydrationScript } from './client/hydration.ts';
export { loadComponent, isPreactComponent, normalizeProps } from './server/utils.ts';

// Re-export types
export type * from './types.ts';
export type { Integration, IntegrationConfig, RenderParams, RenderResult } from '@useavalon/core/types';
