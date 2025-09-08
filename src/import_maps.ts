import type { ImportMap } from './schemas/core.ts';

/**
 * Creates an HTML script tag containing import maps for external dependencies.
 * Use this to specify which external packages (like lodash, d3, etc.) your application needs.
 * Returns an empty string if no imports are provided.
 * 
 * @param importMap - Standard import map object
 * @returns HTML script tag with import map, or empty string if no imports specified
 */
export function generateImportMapScript(importMap?: ImportMap): string {
	// Skip generating script tag if no import map provided
	if (!importMap || (!importMap.imports && !importMap.scopes)) {
		return '';
	}

	// Skip if imports object is empty
	if (importMap.imports && Object.keys(importMap.imports).length === 0) {
		return '';
	}

	return `<script type="importmap">
    ${JSON.stringify(importMap, null, 2)}
  </script>`;
}

export type { ImportMap };
