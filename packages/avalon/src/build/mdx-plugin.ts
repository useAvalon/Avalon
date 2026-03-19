import type { Plugin } from 'vite';
import type { Pluggable } from 'unified';

export interface MDXPluginOptions {
	remarkPlugins?: Pluggable[];
	rehypePlugins?: Pluggable[];
	development?: boolean;
	jsxImportSource?: string;
	/** Enable syntax highlighting via rehype-highlight (default: true) */
	syntaxHighlighting?: boolean;
}

/**
 * Creates and configures the MDX Vite plugin
 *
 * This function sets up the MDX plugin with:
 * - Frontmatter processing (remark-frontmatter, remark-mdx-frontmatter)
 * - GitHub Flavored Markdown support (remark-gfm)
 * - Syntax highlighting (rehype-highlight) - enabled by default
 * - Custom remark/rehype plugins
 * - JSX runtime configuration
 *
 * @param options - MDX plugin configuration options
 * @returns Array of Vite plugins (empty if MDX dependencies are not available)
 *
 * @example
 * ```ts
 * // Basic usage with defaults
 * const plugins = await createMDXPlugin();
 *
 * // With React JSX runtime
 * const plugins = await createMDXPlugin({ jsxImportSource: 'react' });
 *
 * // Disable syntax highlighting
 * const plugins = await createMDXPlugin({ syntaxHighlighting: false });
 * ```
 */
export async function createMDXPlugin(options: MDXPluginOptions = {}): Promise<Plugin[]> {
	const {
		remarkPlugins = [],
		rehypePlugins = [],
		development = false,
		jsxImportSource = 'preact',
		syntaxHighlighting = true,
	} = options;

	try {
		// Load the core MDX plugin
		const { default: mdx } = await import('@mdx-js/rollup');

		// Load remark plugins for frontmatter processing and GFM support
		const { default: remarkFrontmatter } = await import('remark-frontmatter');
		const { default: remarkMdxFrontmatter } = await import('remark-mdx-frontmatter');
		const { default: remarkGfm } = await import('remark-gfm');

		// Build rehype plugins array based on options
		const finalRehypePlugins: Pluggable[] = [];

		// Add syntax highlighting if enabled
		if (syntaxHighlighting) {
			try {
				const { default: rehypeHighlight } = await import('rehype-highlight');
				finalRehypePlugins.push(rehypeHighlight);
			} catch {
				console.warn(
					'[avalon:mdx] rehype-highlight not installed, syntax highlighting disabled. Install it with: npm install rehype-highlight',
				);
			}
		}

		// Add user-provided rehype plugins
		finalRehypePlugins.push(...rehypePlugins);

		// Configure MDX plugin with frontmatter processing, GFM support, and optional syntax highlighting
		const mdxPlugin = mdx({
			remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm, ...remarkPlugins],
			rehypePlugins: finalRehypePlugins,
			jsxImportSource: jsxImportSource,
			development,
			format: 'mdx',
		}) as Plugin;

		// Ensure the MDX plugin is shared across all Vite build environments
		// (client, ssr, nitro). Without this, the Nitro server build can't
		// process .mdx files imported by the virtual page-loader module.
		mdxPlugin.sharedDuringBuild = true;

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
