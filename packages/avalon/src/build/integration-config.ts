/**
 * Integration configuration for build system
 * Defines how each integration should be bundled and optimized
 */

export interface IntegrationBuildConfig {
	/** Framework name */
	name: string;
	/** File extensions this integration handles */
	extensions: string[];
	/** NPM packages that should be optimized for this integration */
	optimizeDeps: string[];
	/** NPM packages that should be external in SSR builds */
	ssrExternal: string[];
	/** NPM packages that should NOT be external in SSR builds */
	ssrNoExternal: string[];
	/** Whether this integration requires a Vite plugin */
	requiresPlugin: boolean;
	/** Plugin package name (if requiresPlugin is true) */
	pluginPackage?: string;
}

/**
 * Build configuration for all supported integrations
 */
export const INTEGRATION_BUILD_CONFIGS: Record<string, IntegrationBuildConfig> = {
	preact: {
		name: 'preact',
		extensions: ['.tsx', '.jsx'],
		optimizeDeps: [
			'preact',
			'preact/hooks',
			'preact/jsx-runtime',
			'preact/jsx-dev-runtime',
		],
		ssrExternal: [],
		ssrNoExternal: ['preact', 'preact-render-to-string'],
		requiresPlugin: false,
	},

	vue: {
		name: 'vue',
		extensions: ['.vue'],
		optimizeDeps: ['vue'],
		ssrExternal: [],
		ssrNoExternal: ['vue', '@vue/server-renderer', '@vue/shared'],
		requiresPlugin: true,
		pluginPackage: '@vitejs/plugin-vue',
	},

	solid: {
		name: 'solid',
		extensions: ['.tsx', '.jsx'],
		optimizeDeps: [
			'solid-js',
			'solid-js/web',
			'solid-js/store',
		],
		ssrExternal: [],
		ssrNoExternal: ['solid-js', 'solid-js/web', 'solid-js/store'],
		requiresPlugin: true,
		pluginPackage: 'vite-plugin-solid',
	},

	svelte: {
		name: 'svelte',
		extensions: ['.svelte'],
		optimizeDeps: [
			'svelte',
			'svelte/internal',
			'svelte/store',
			'svelte/animate',
			'svelte/easing',
			'svelte/motion',
			'svelte/transition',
		],
		ssrExternal: [],
		ssrNoExternal: ['svelte', 'svelte/server', 'svelte/internal', 'svelte/store'],
		requiresPlugin: true,
		pluginPackage: '@sveltejs/vite-plugin-svelte',
	},

	react: {
		name: 'react',
		extensions: ['.jsx', '.tsx'],
		optimizeDeps: [
			'react',
			'react/jsx-runtime',
			'react/jsx-dev-runtime',
			'react-dom',
			'react-dom/client',
		],
		ssrExternal: [],
		ssrNoExternal: ['react', 'react-dom', 'react-dom/server'],
		requiresPlugin: true,
		pluginPackage: '@vitejs/plugin-react',
	},

	lit: {
		name: 'lit',
		extensions: ['.ts', '.js'],
		optimizeDeps: [
			'lit',
			'lit/decorators.js',
			'lit/directives/class-map.js',
			'lit/directives/style-map.js',
			'@lit/reactive-element',
		],
		ssrExternal: [],
		ssrNoExternal: ['lit', '@lit-labs/ssr', '@lit/reactive-element', 'lit-html'],
		requiresPlugin: false,
	},
};

/**
 * Get build configuration for a specific integration
 */
export function getIntegrationBuildConfig(framework: string) {
	return INTEGRATION_BUILD_CONFIGS[framework];
}

/**
 * Get all optimize deps for given integrations
 */
export function getOptimizeDepsForIntegrations(integrations: string[]) {
	const deps = new Set<string>();
	
	for (const integration of integrations) {
		const config = INTEGRATION_BUILD_CONFIGS[integration];
		if (config) {
			config.optimizeDeps.forEach(dep => deps.add(dep));
		}
	}
	
	return Array.from(deps);
}

/**
 * Get SSR noExternal packages for given integrations
 */
export function getSSRNoExternalForIntegrations(integrations: string[]) {
	const packages = new Set<string>();
	
	for (const integration of integrations) {
		const config = INTEGRATION_BUILD_CONFIGS[integration];
		if (config) {
			config.ssrNoExternal.forEach(pkg => packages.add(pkg));
		}
	}
	
	return Array.from(packages);
}

/**
 * Check if an integration requires a Vite plugin
 */
export function integrationRequiresPlugin(framework: string) {
	const config = INTEGRATION_BUILD_CONFIGS[framework];
	return config?.requiresPlugin ?? false;
}

/**
 * Get plugin package name for an integration
 */
export function getIntegrationPluginPackage(framework: string) {
	const config = INTEGRATION_BUILD_CONFIGS[framework];
	return config?.pluginPackage;
}
