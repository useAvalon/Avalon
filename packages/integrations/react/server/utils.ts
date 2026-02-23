// Server-side utilities for React integration

import type { ComponentType } from 'react';
import type { ComponentMetadata } from '../types.ts';
import { join } from 'node:path';
import { toImportSpecifier } from '../../core/utils.ts';
import { resolveIslandPath } from '../../../avalon/src/islands/framework-detection.ts';

/**
 * Load a React component from file path
 *
 * @param src - Component source path
 * @returns React component
 */
export async function loadComponent(src: string): Promise<ComponentType<Record<string, unknown>>> {
	try {
		const resolvedSrc = await resolveIslandPath(src);

		// Resolve the component path
		// If path starts with /, it's relative to workspace root (e.g., /src/islands/Counter.tsx)
		// Otherwise, it's already an absolute path or relative to current file
		let componentPath: string;
		if (resolvedSrc.startsWith('/')) {
			// Remove leading slash and join with cwd
			componentPath = join(process.cwd(), resolvedSrc.slice(1));
		} else {
			componentPath = resolvedSrc;
		}

		// Import the component module
		const module = await import(/* @vite-ignore */ toImportSpecifier(componentPath));

		// Get the default export or named export
		const Component = module.default || module[Object.keys(module)[0]];

		if (!Component || typeof Component !== 'function') {
			throw new Error(`Invalid React component in ${src}: expected function, got ${typeof Component}`);
		}

		return Component as ComponentType<Record<string, unknown>>;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to load React component from ${src}: ${errorMessage}`, { cause: error });
	}
}

/**
 * Check if a component has "use client" directive
 *
 * @param src - Component source path
 * @returns True if component has "use client" directive
 */
export async function hasUseClientDirective(src: string): Promise<boolean> {
	try {
		const resolvedSrc = await resolveIslandPath(src);

		let componentPath: string;
		if (resolvedSrc.startsWith('/')) {
			componentPath = join(process.cwd(), resolvedSrc.slice(1));
		} else {
			componentPath = resolvedSrc;
		}

		const content = await readFile(componentPath, 'utf-8');

		// Check for "use client" directive at the top of the file
		// It should be one of the first statements (after imports/comments)
		const useClientPattern = /^['"]use client['"];?\s*$/m;
		return useClientPattern.test(content);
	} catch (error) {
		console.warn(`Failed to check "use client" directive in ${src}:`, error);
		return false;
	}
}

/**
 * Extract import statements from component file
 *
 * @param content - File content
 * @returns Array of import sources
 */
function extractImports(content: string): string[] {
	const imports: string[] = [];

	// Match ES6 imports: import ... from "source"
	const importPattern = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
	let match;

	while ((match = importPattern.exec(content)) !== null) {
		imports.push(match[1]);
	}

	return imports;
}

/**
 * Analyze component file for RSC classification
 *
 * @param filePath - Component file path
 * @returns Component metadata
 */
export async function analyzeComponent(filePath: string): Promise<ComponentMetadata> {
	try {
		const resolvedPath = await resolveIslandPath(filePath);

		let componentPath: string;
		if (resolvedPath.startsWith('/')) {
			componentPath = join(process.cwd(), resolvedPath.slice(1));
		} else {
			componentPath = resolvedPath;
		}

		const content = await readFile(componentPath, 'utf-8');

		// Check for directives
		const isClientComponent = /^['"]use client['"];?\s*$/m.test(content);
		const isServerComponent = /^['"]use server['"];?\s*$/m.test(content);

		// Check for async function components
		// Look for: export default async function, export async function, const Component = async
		const hasAsyncRender =
			/export\s+default\s+async\s+function/.test(content) ||
			/export\s+async\s+function/.test(content) ||
			/const\s+\w+\s*=\s*async\s+(?:function|\()/.test(content);

		// Extract dependencies
		const dependencies = extractImports(content);

		return {
			path: filePath,
			isClientComponent,
			isServerComponent,
			hasAsyncRender,
			dependencies,
		};
	} catch (error) {
		console.warn(`Failed to analyze component ${filePath}:`, error);
		return {
			path: filePath,
			isClientComponent: false,
			isServerComponent: false,
			hasAsyncRender: false,
			dependencies: [],
		};
	}
}

/**
 * Normalize and serialize component props
 * Removes non-serializable values like functions, symbols, etc.
 *
 * @param props - Raw props object
 * @returns Serialized props
 */
export function serializeProps(props: Record<string, unknown>): Record<string, unknown> {
	try {
		// JSON round-trip intentionally strips non-serializable values (functions, symbols)
		// structuredClone cannot handle these, so JSON.parse/stringify is used deliberately
		const json = JSON.stringify(props);
		return JSON.parse(json) as Record<string, unknown>;
	} catch (error) {
		console.warn('Failed to serialize props, returning empty object:', error);
		return {};
	}
}
