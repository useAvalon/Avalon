import type { Plugin } from 'vite';
import { resolve } from 'node:path';
import { getOptimizeDepsForIntegrations, getSSRNoExternalForIntegrations } from './integration-config.ts';

export interface IntegrationBundlerOptions {
	/** Integrations to include in the build */
	integrations: string[];
	/** Whether to bundle for SSR */
	ssr?: boolean;
}

/**
 * Vite plugin to bundle integration packages
 * Ensures integration server and client code is properly bundled
 */
export function integrationBundlerPlugin(options: IntegrationBundlerOptions): Plugin {
	const { integrations, ssr = false } = options;
	const cwd = process.cwd();

	return {
		name: 'avalon:integration-bundler',
		enforce: 'post',

		config(config) {
			// Add integration entry points to the build
			const entries: Record<string, string> = {};
			
			for (const framework of integrations) {
				if (ssr) {
					// SSR build: include server-side integration code
					entries[`integrations/${framework}/server`] = resolve(
						cwd,
						`packages/integrations/${framework}/server/renderer.ts`
					);
				} else {
					// Client build: include client-side integration code
					entries[`integrations/${framework}/client`] = resolve(
						cwd,
						`packages/integrations/${framework}/client/index.ts`
					);
				}
			}

			// Merge with existing rolldown input
			const existingInput = config.build?.rolldownOptions?.input || {};
			const mergedInput = typeof existingInput === 'string' 
				? { main: existingInput, ...entries }
				: { ...existingInput, ...entries };

			return {
				build: {
					rolldownOptions: {
						input: mergedInput,
					},
				},
			};
		},


	};
}

/**
 * Get external dependencies for integration bundling
 * These should not be bundled but loaded from node_modules
 */
export function getIntegrationExternals(framework: string, ssr: boolean) {
	const externals: string[] = [];

	// Framework-specific externals
	switch (framework) {
		case 'preact':
			if (!ssr) {
				// Client-side: preact should be bundled for hydration
				return [];
			}
			// SSR: keep preact external if needed
			externals.push('preact', 'preact/hooks', 'preact-render-to-string');
			break;

		case 'vue':
			if (ssr) {
				// SSR: Vue server renderer should be external
				externals.push('vue', 'vue/server-renderer', '@vue/server-renderer', '@vue/shared');
			}
			break;

		case 'solid':
			if (ssr) {
				externals.push('solid-js', 'solid-js/web');
			}
			break;

		case 'svelte':
			if (ssr) {
				externals.push('svelte', 'svelte/server', 'svelte/compiler', 'svelte/internal');
			}
			break;
	}

	return externals;
}

/**
 * Configure optimization for integration dependencies
 */
export function getIntegrationOptimizeDeps(integrations: string[]) {
	return getOptimizeDepsForIntegrations(integrations);
}

/**
 * Get SSR noExternal packages for integrations
 */
export function getIntegrationSSRNoExternal(integrations: string[]) {
	return getSSRNoExternalForIntegrations(integrations);
}
