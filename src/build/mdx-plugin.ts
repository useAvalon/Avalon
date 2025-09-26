import type { Plugin } from 'vite';

export interface MDXPluginOptions {
	remarkPlugins?: any[];
	rehypePlugins?: any[];
	development?: boolean;
	jsxImportSource?: string;
}

/**
 * Creates and configures the MDX Vite plugin
 */
export async function createMDXPlugin(options: MDXPluginOptions = {}): Promise<Plugin[]> {
	const { remarkPlugins = [], rehypePlugins = [], development = false, jsxImportSource = 'preact' } = options;

	try {
		// Load the core MDX plugin
		const { default: mdx } = await import('@mdx-js/rollup');

		// Load remark plugins for frontmatter processing
		const { default: remarkFrontmatter } = await import('remark-frontmatter');
		const { default: remarkMdxFrontmatter } = await import('remark-mdx-frontmatter');
		const { default: remarkGfm } = await import('remark-gfm');

		// Configure MDX plugin with frontmatter processing
		const mdxPlugin = mdx({
			// Plugin chains - frontmatter must come first, then export as named exports
			remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm, ...remarkPlugins],
			rehypePlugins: [...rehypePlugins],

			// JSX configuration for Preact
			jsxImportSource: jsxImportSource,

			// Development vs production optimizations
			development,

			// Ensure proper module format
			format: 'esm',
		});

		console.log('✅ MDX plugin configured with frontmatter processing and GFM support');

		return [mdxPlugin];
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('❌ Failed to configure MDX plugin:', errorMessage);
		console.warn('💡 Install missing dependencies or check import map');

		// Always return empty array to allow server to start without MDX
		console.warn('⚠️ MDX plugin disabled - .mdx files will not be processed');
		return [];
	}
}
