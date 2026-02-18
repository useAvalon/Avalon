import { extname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { h } from 'preact';
import { marked } from 'marked';
import type { RoutePageModule } from '../../schemas/routing.ts';

/**
 * Server-side MDX processor for handling MDX files in the routing system
 */
export class MDXProcessor {
	/**
	 * Process an MDX file and return a valid page module
	 */
	async processMDXFile(filePath: string): Promise<RoutePageModule> {
		try {
			// Read the MDX file content
			const content = await readFile(filePath, 'utf-8');

			// Process markdown content using marked library
			const component = () => {
				const htmlContent = marked(content);
				return h('div', {
					dangerouslySetInnerHTML: { __html: htmlContent },
				});
			};

			// Return a module-like object that matches RoutePageModule interface
			return {
				default: component,
				// Add any other required exports
			};
		} catch (error) {
			throw new Error(
				`Failed to process MDX file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Check if a file is an MDX file
	 */
	static isMDXFile(filePath: string): boolean {
		const ext = extname(filePath);
		return ext === '.mdx' || ext === '.md';
	}
}
