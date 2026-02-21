import type { Plugin } from 'vite';
import { resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';

export interface IntegrationDetectionResult {
	preact: boolean;
	vue: boolean;
	solid: boolean;
	svelte: boolean;
}

/**
 * Vite plugin to detect which framework integrations are used in the project
 * This enables tree-shaking of unused integrations
 */
export function integrationDetectionPlugin(): Plugin {
	let detectedIntegrations: IntegrationDetectionResult | null = null;

	return {
		name: 'avalon:integration-detection',
		enforce: 'pre',

		async buildStart() {
			// Detect integrations during build start
			detectedIntegrations = await detectUsedIntegrations();
		},

		resolveId(id: string) {
			// Handle integration imports
			if (id.startsWith('@avalon/integration-')) {
				const framework = id.replace('@avalon/integration-', '').split('/')[0];
				
				// Check if this integration is used
				if (detectedIntegrations && !detectedIntegrations[framework as keyof IntegrationDetectionResult]) {
					console.warn(`⚠️ Integration ${framework} is imported but not detected in project files`);
				}
				
				// Resolve to the actual integration path
				const integrationPath = resolve(process.cwd(), `packages/integrations/${framework}/mod.ts`);
				return integrationPath;
			}
			
			return null;
		},

		transform(_code: string, id: string) {
			// Track integration usage in island files
			if (id.includes('/islands/') || id.includes('/components/')) {
				// This helps with dynamic detection during development
				return null;
			}
			
			return null;
		},
	};
}

/**
 * Detect which framework integrations are actually used in the project
 */
export async function detectUsedIntegrations() {
	const result: IntegrationDetectionResult = {
		preact: false,
		vue: false,
		solid: false,
		svelte: false,
	};

	const searchDirs = ['islands', 'components', 'src/islands', 'src/components'];
	const cwd = process.cwd();

	for (const dir of searchDirs) {
		try {
			const dirPath = resolve(cwd, dir);
			const entries = await readdir(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				if (!entry.isFile()) continue;

				// Check file extensions
				if (entry.name.endsWith('.vue')) {
					result.vue = true;
				} else if (entry.name.endsWith('.svelte')) {
					result.svelte = true;
				} else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
					// Read file content to detect framework
					const filePath = resolve(dirPath, entry.name);
					const content = await readFile(filePath, 'utf-8');
					
					if (content.includes('solid-js')) {
						result.solid = true;
					} else {
						// Default to Preact for JSX/TSX files
						result.preact = true;
					}
				}
			}
		} catch {
			// Directory doesn't exist, continue
		}
	}

	return result;
}

/**
 * Get list of integration packages that should be included in the build
 */
export function getRequiredIntegrations(detected: IntegrationDetectionResult) {
	const integrations: string[] = [];
	
	if (detected.preact) integrations.push('preact');
	if (detected.vue) integrations.push('vue');
	if (detected.solid) integrations.push('solid');
	if (detected.svelte) integrations.push('svelte');
	
	return integrations;
}
