import type { Plugin } from 'vite';
import { resolve } from 'node:path';

/**
 * Vite plugin to resolve integration package imports
 * Handles both @useavalon/integration-* imports and relative imports within integrations
 */
export function integrationResolverPlugin(): Plugin {
	const cwd = process.cwd();
	
	return {
		name: 'avalon:integration-resolver',
		enforce: 'pre',

		resolveId(id: string, importer?: string) {
			// Handle @useavalon/integration-* imports
			if (id.startsWith('@useavalon/integration-')) {
				const parts = id.split('/');
				const framework = parts[1].replace('integration-', '');
				const subpath = parts.slice(2).join('/');
				
				// Map to actual file paths
				if (!subpath || subpath === '') {
					// Main export: @useavalon/integration-preact -> packages/integrations/preact/mod.ts
					return resolve(cwd, `packages/integrations/${framework}/mod.ts`);
				} else if (subpath === 'server') {
					// Server export: @useavalon/integration-preact/server -> packages/integrations/preact/server/renderer.ts
					return resolve(cwd, `packages/integrations/${framework}/server/renderer.ts`);
				} else if (subpath === 'client') {
					// Client export: @useavalon/integration-preact/client -> packages/integrations/preact/client/index.ts
					return resolve(cwd, `packages/integrations/${framework}/client/index.ts`);
				} else if (subpath === 'types') {
					// Types export: @useavalon/integration-preact/types -> packages/integrations/preact/types.ts
					return resolve(cwd, `packages/integrations/${framework}/types.ts`);
				}
			}
			
			// Handle @useavalon/shared imports (used by integrations)
			if (id === '@useavalon/shared' || id === '@useavalon/shared/types') {
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
		'@useavalon/integration-preact': resolve(cwd, 'packages/integrations/preact/mod.ts'),
		'@useavalon/integration-preact/server': resolve(cwd, 'packages/integrations/preact/server/renderer.ts'),
		'@useavalon/integration-preact/client': resolve(cwd, 'packages/integrations/preact/client/index.ts'),
		'@useavalon/integration-vue': resolve(cwd, 'packages/integrations/vue/mod.ts'),
		'@useavalon/integration-vue/server': resolve(cwd, 'packages/integrations/vue/server/renderer.ts'),
		'@useavalon/integration-vue/client': resolve(cwd, 'packages/integrations/vue/client/index.ts'),
		'@useavalon/integration-solid': resolve(cwd, 'packages/integrations/solid/mod.ts'),
		'@useavalon/integration-solid/server': resolve(cwd, 'packages/integrations/solid/server/renderer.ts'),
		'@useavalon/integration-solid/client': resolve(cwd, 'packages/integrations/solid/client/index.ts'),
		'@useavalon/integration-svelte': resolve(cwd, 'packages/integrations/svelte/mod.ts'),
		'@useavalon/integration-svelte/server': resolve(cwd, 'packages/integrations/svelte/server/renderer.ts'),
		'@useavalon/integration-svelte/client': resolve(cwd, 'packages/integrations/svelte/client/index.ts'),
		'@useavalon/integration-react': resolve(cwd, 'packages/integrations/react/mod.ts'),
		'@useavalon/integration-react/server': resolve(cwd, 'packages/integrations/react/server/renderer.ts'),
		'@useavalon/integration-react/client': resolve(cwd, 'packages/integrations/react/client/index.ts'),
		'@useavalon/integration-react/types': resolve(cwd, 'packages/integrations/react/types.ts'),
		'@useavalon/integration-lit': resolve(cwd, 'packages/integrations/lit/mod.ts'),
		'@useavalon/integration-lit/server': resolve(cwd, 'packages/integrations/lit/server/renderer.ts'),
		'@useavalon/integration-lit/client': resolve(cwd, 'packages/integrations/lit/client/index.ts'),
		'@useavalon/integration-lit/types': resolve(cwd, 'packages/integrations/lit/types.ts'),
		'@useavalon/shared': resolve(cwd, 'packages/integrations/shared/types.ts'),
	};
}
