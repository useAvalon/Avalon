import type { Plugin } from 'vite';
import type { Pluggable } from 'unified';

export interface MDXPluginOptions {
	remarkPlugins?: Pluggable[];
	rehypePlugins?: Pluggable[];
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

		// Load remark plugins for frontmatter processing and GFM support
		const { default: remarkFrontmatter } = await import('remark-frontmatter');
		const { default: remarkMdxFrontmatter } = await import('remark-mdx-frontmatter');
		const { default: remarkGfm } = await import('remark-gfm');

		// Load rehype plugin for syntax highlighting
		const { default: rehypeHighlight } = await import('rehype-highlight');

		// Configure MDX plugin with frontmatter processing, GFM support, and syntax highlighting
		const mdxPlugin = mdx({
			// Plugin chains - frontmatter must come first, then export as named exports
			remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm, ...remarkPlugins],
			rehypePlugins: [rehypeHighlight, ...rehypePlugins],

			// JSX configuration for Preact
			jsxImportSource: jsxImportSource,

			// Development vs production optimizations
			development,

			// Ensure proper module format
			format: 'mdx',
		});

		console.log('✅ MDX plugin configured with frontmatter processing, GFM support, and syntax highlighting');

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
