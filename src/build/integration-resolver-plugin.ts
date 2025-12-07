import type { Plugin } from 'vite';
import { resolve } from '@std/path';

/**
 * Vite plugin to resolve integration package imports
 * Handles both @avalon/integration-* imports and relative imports within integrations
 */
export function integrationResolverPlugin(): Plugin {
	const cwd = Deno.cwd();
	
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
					// Main export: @avalon/integration-preact -> src/integrations/preact/mod.ts
					return resolve(cwd, `src/integrations/${framework}/mod.ts`);
				} else if (subpath === 'server') {
					// Server export: @avalon/integration-preact/server -> src/integrations/preact/server/renderer.ts
					return resolve(cwd, `src/integrations/${framework}/server/renderer.ts`);
				} else if (subpath === 'client') {
					// Client export: @avalon/integration-preact/client -> src/integrations/preact/client/index.ts
					return resolve(cwd, `src/integrations/${framework}/client/index.ts`);
				} else if (subpath === 'types') {
					// Types export: @avalon/integration-preact/types -> src/integrations/preact/types.ts
					return resolve(cwd, `src/integrations/${framework}/types.ts`);
				}
			}
			
			// Handle @avalon/shared imports (used by integrations)
			if (id === '@avalon/shared' || id === '@avalon/shared/types') {
				return resolve(cwd, 'src/integrations/shared/types.ts');
			}
			
			// Handle relative imports within integrations
			if (importer && importer.includes('/integrations/')) {
				if (id.startsWith('../shared/')) {
					const sharedPath = id.replace('../shared/', '');
					return resolve(cwd, `src/integrations/shared/${sharedPath}`);
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
	const cwd = Deno.cwd();
	
	return {
		'@avalon/integration-preact': resolve(cwd, 'src/integrations/preact/mod.ts'),
		'@avalon/integration-preact/server': resolve(cwd, 'src/integrations/preact/server/renderer.ts'),
		'@avalon/integration-preact/client': resolve(cwd, 'src/integrations/preact/client/index.ts'),
		'@avalon/integration-vue': resolve(cwd, 'src/integrations/vue/mod.ts'),
		'@avalon/integration-vue/server': resolve(cwd, 'src/integrations/vue/server/renderer.ts'),
		'@avalon/integration-vue/client': resolve(cwd, 'src/integrations/vue/client/index.ts'),
		'@avalon/integration-solid': resolve(cwd, 'src/integrations/solid/mod.ts'),
		'@avalon/integration-solid/server': resolve(cwd, 'src/integrations/solid/server/renderer.ts'),
		'@avalon/integration-solid/client': resolve(cwd, 'src/integrations/solid/client/index.ts'),
		'@avalon/integration-svelte': resolve(cwd, 'src/integrations/svelte/mod.ts'),
		'@avalon/integration-svelte/server': resolve(cwd, 'src/integrations/svelte/server/renderer.ts'),
		'@avalon/integration-svelte/client': resolve(cwd, 'src/integrations/svelte/client/index.ts'),
		'@avalon/shared': resolve(cwd, 'src/integrations/shared/types.ts'),
	};
}
