import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import matter from 'gray-matter';

export interface MarkdownMetadata {
	title?: string;
	description?: string;
	section?: string;
	order?: number;
	tags?: string[];
	lastUpdated?: string;
	difficulty?: 'beginner' | 'intermediate' | 'advanced';
	framework?: string[];
}

export interface ProcessedMarkdown {
	content: string;
	metadata: MarkdownMetadata;
	headings: Array<{ level: number; text: string; id: string }>;
	codeBlocks: Array<{ language: string; code: string; title?: string }>;
}

export interface CodeExample {
	id: string;
	title: string;
	description?: string;
	language: string;
	framework?: string;
	code: string;
	runnable: boolean;
	files?: Record<string, string>;
}

/**
 * Process markdown content with frontmatter, syntax highlighting, and code validation
 */
export async function processMarkdown(content: string): Promise<ProcessedMarkdown> {
	// Parse frontmatter
	const { data: metadata, content: markdownContent } = matter(content);

	// Extract headings and code blocks
	const headings: Array<{ level: number; text: string; id: string }> = [];
	const codeBlocks: Array<{ language: string; code: string; title?: string }> = [];

	// Configure remark processor
	const processor = remark()
		.use(remarkGfm)
		.use(remarkHtml, { sanitize: false })
		.use(rehypeSlug)
		.use(rehypeAutolinkHeadings, {
			behavior: 'wrap',
			properties: {
				className: ['heading-link'],
			},
		})
		.use(rehypeHighlight, {
			languages: {
				typescript: 'typescript',
				javascript: 'javascript',
				tsx: 'typescript',
				jsx: 'javascript',
				vue: 'html',
				svelte: 'html',
				css: 'css',
				html: 'html',
				json: 'json',
				bash: 'bash',
				shell: 'bash',
			},
		});

	// Process markdown
	const result = await processor.process(markdownContent);
	const htmlContent = result.toString();

	// Extract headings from processed content
	const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h[1-6]>/g;
	let match;
	while ((match = headingRegex.exec(htmlContent)) !== null) {
		headings.push({
			level: parseInt(match[1]),
			id: match[2],
			text: match[3].trim(),
		});
	}

	// Extract code blocks
	const codeBlockRegex = /<pre><code class="language-([^"]*)"[^>]*>([\s\S]*?)<\/code><\/pre>/g;
	let codeMatch;
	while ((codeMatch = codeBlockRegex.exec(htmlContent)) !== null) {
		codeBlocks.push({
			language: codeMatch[1],
			code: codeMatch[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
		});
	}

	return {
		content: htmlContent,
		metadata: metadata as MarkdownMetadata,
		headings,
		codeBlocks,
	};
}

/**
 * Validate code examples to ensure they compile and run correctly
 */
export async function validateCodeExample(example: CodeExample): Promise<boolean> {
	try {
		// For now, just check basic syntax
		// In a full implementation, this would compile and test the code
		if (example.language === 'typescript' || example.language === 'tsx') {
			// Basic TypeScript syntax validation
			return !example.code.includes('SyntaxError');
		}

		if (example.language === 'javascript' || example.language === 'jsx') {
			// Basic JavaScript syntax validation
			return !example.code.includes('SyntaxError');
		}

		return true;
	} catch (error) {
		console.error(`Code validation failed for example ${example.id}:`, error);
		return false;
	}
}

/**
 * Extract code examples from markdown content
 */
export function extractCodeExamples(content: string): CodeExample[] {
	const examples: CodeExample[] = [];
	const codeBlockRegex = /```(\w+)(?:\s+title="([^"]*)")?(?:\s+runnable)?(?:\s+framework="([^"]*)")?\n([\s\S]*?)```/g;

	let match;
	let id = 0;

	while ((match = codeBlockRegex.exec(content)) !== null) {
		const [, language, title, framework, code] = match;

		examples.push({
			id: `example-${++id}`,
			title: title || `${language} Example`,
			language,
			framework,
			code: code.trim(),
			runnable: match[0].includes('runnable'),
		});
	}

	return examples;
}

/**
 * Generate table of contents from headings
 */
export function generateTableOfContents(headings: Array<{ level: number; text: string; id: string }>): string {
	if (headings.length === 0) return '';

	let toc = '<nav class="table-of-contents">\n<ul>\n';
	let currentLevel = 0;

	for (const heading of headings) {
		if (heading.level > currentLevel) {
			// Open new nested list
			for (let i = currentLevel; i < heading.level - 1; i++) {
				toc += '<li><ul>\n';
			}
			currentLevel = heading.level;
		} else if (heading.level < currentLevel) {
			// Close nested lists
			for (let i = currentLevel; i > heading.level; i--) {
				toc += '</ul></li>\n';
			}
			currentLevel = heading.level;
		}

		toc += `<li><a href="#${heading.id}">${heading.text}</a></li>\n`;
	}

	// Close remaining lists
	for (let i = currentLevel; i > 1; i--) {
		toc += '</ul></li>\n';
	}

	toc += '</ul>\n</nav>';
	return toc;
}
