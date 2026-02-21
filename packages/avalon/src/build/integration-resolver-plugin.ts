import type { Plugin } from 'vite';
import { resolve } from 'node:path';

/**
 * Vite plugin to resolve integration package imports
 * Handles both @avalon/integration-* imports and relative imports within integrations
 */
export function integrationResolverPlugin(): Plugin {
	const cwd = process.cwd();
	
	return {
		name: 'avalon:integration-resolver',
		enforce: 'pre',

		resolveId(id: string, importer?: string) {
			// Handle @avalon/integration-* imports
			if (id.startsWith('@avalon/integration-')) {
				const parts = id.split('/');
				const framework = parts[1].replace('integration-', '');
				const subpath = parts.slice(2).join('/');
				
				// Map to actual file paths
				if (!subpath || subpath === '') {
					// Main export: @avalon/integration-preact -> packages/integrations/preact/mod.ts
					return resolve(cwd, `packages/integrations/${framework}/mod.ts`);
				} else if (subpath === 'server') {
					// Server export: @avalon/integration-preact/server -> packages/integrations/preact/server/renderer.ts
					return resolve(cwd, `packages/integrations/${framework}/server/renderer.ts`);
				} else if (subpath === 'client') {
					// Client export: @avalon/integration-preact/client -> packages/integrations/preact/client/index.ts
					return resolve(cwd, `packages/integrations/${framework}/client/index.ts`);
				} else if (subpath === 'types') {
					// Types export: @avalon/integration-preact/types -> packages/integrations/preact/types.ts
					return resolve(cwd, `packages/integrations/${framework}/types.ts`);
				}
			}
			
			// Handle @avalon/shared imports (used by integrations)
			if (id === '@avalon/shared' || id === '@avalon/shared/types') {
				return resolve(cwd, 'packages/integrations/shared/types.ts');
			}
			
			// Handle relative imports within integrations
			if (importer && importer.includes('/integrations/')) {
				if (id.startsWith('../shared/')) {
					const sharedPath = id.replace('../shared/', '');
					return resolve(cwd, `packages/integrations/shared/${sharedPath}`);
				}
			}
			
			return null;
		},

		load(id: string) {
			// Handle virtual modules if needed
			return null;
		},
	};
}

/**
 * Create alias configuration for integration imports
 */
export function createIntegrationAliases(): Record<string, string> {
	const cwd = process.cwd();
	
	return {
		'@avalon/integration-preact': resolve(cwd, 'packages/integrations/preact/mod.ts'),
		'@avalon/integration-preact/server': resolve(cwd, 'packages/integrations/preact/server/renderer.ts'),
		'@avalon/integration-preact/client': resolve(cwd, 'packages/integrations/preact/client/index.ts'),
		'@avalon/integration-vue': resolve(cwd, 'packages/integrations/vue/mod.ts'),
		'@avalon/integration-vue/server': resolve(cwd, 'packages/integrations/vue/server/renderer.ts'),
		'@avalon/integration-vue/client': resolve(cwd, 'packages/integrations/vue/client/index.ts'),
		'@avalon/integration-solid': resolve(cwd, 'packages/integrations/solid/mod.ts'),
		'@avalon/integration-solid/server': resolve(cwd, 'packages/integrations/solid/server/renderer.ts'),
		'@avalon/integration-solid/client': resolve(cwd, 'packages/integrations/solid/client/index.ts'),
		'@avalon/integration-svelte': resolve(cwd, 'packages/integrations/svelte/mod.ts'),
		'@avalon/integration-svelte/server': resolve(cwd, 'packages/integrations/svelte/server/renderer.ts'),
		'@avalon/integration-svelte/client': resolve(cwd, 'packages/integrations/svelte/client/index.ts'),
		'@avalon/integration-react': resolve(cwd, 'packages/integrations/react/mod.ts'),
		'@avalon/integration-react/server': resolve(cwd, 'packages/integrations/react/server/renderer.ts'),
		'@avalon/integration-react/client': resolve(cwd, 'packages/integrations/react/client/index.ts'),
		'@avalon/integration-react/types': resolve(cwd, 'packages/integrations/react/types.ts'),
		'@avalon/integration-lit': resolve(cwd, 'packages/integrations/lit/mod.ts'),
		'@avalon/integration-lit/server': resolve(cwd, 'packages/integrations/lit/server/renderer.ts'),
		'@avalon/integration-lit/client': resolve(cwd, 'packages/integrations/lit/client/index.ts'),
		'@avalon/integration-lit/types': resolve(cwd, 'packages/integrations/lit/types.ts'),
		'@avalon/shared': resolve(cwd, 'packages/integrations/shared/types.ts'),
	};
}
