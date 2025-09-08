import type { ImportConfig } from '../types/types.ts';

/**
 * Generates import statements based on the provided configuration.
 *
 * @param {ImportConfig[]} [imports=[]] - An array of import configurations. Each configuration
 *     specifies the names to import and the source module or file path.
 *     - `names`: An array of strings representing the named exports to import.
 *     - `from`: A string representing the source module or file path. If the path starts with
 *       "http", it is treated as an external module. Otherwise, it is treated as a local file path.
 *
 * @returns {string} A string containing the generated import statements, each on a new line.
 *     - If the `from` path starts with "http", the import statement will use the provided URL.
 *     - For local paths, leading slashes are removed, and the path is adjusted to ensure proper
 *       folder structure. If the path does not include a folder, it is assumed to be in its own folder.
 *
 * @example
 * // Example usage:
 * const imports = [
 *   { names: ['ComponentA', 'ComponentB'], from: 'http://example.com/library' },
 *   { names: ['Helper'], from: '/utils/helper.ts' },
 * ];
 * const result = createImportStatements(imports);
 * console.log(result);
 * // Output:
 * // import { ComponentA, ComponentB } from "http://example.com/library";
 * // import { Helper } from "/src/utils/helper/helper";
 */
export const createImportStatements = (imports: ImportConfig[] = []): string => {
	return imports
		.map(({ names, from }) => {
			if (from.startsWith('http')) {
				return `import { ${names.join(', ')} } from "${from}";`;
			}
			// Remove any leading / but preserve folder structure
			const cleanPath = from.replace(/^\//, '');
			// If it's not a full path with a folder, assume it's in its own folder
			const fullPath = cleanPath.includes('/') ? cleanPath : `${cleanPath.replace('.ts', '')}/${cleanPath}`;

			return `import { ${names.join(', ')} } from "/src/${fullPath}";`;
		})
		.join('\n');
};
