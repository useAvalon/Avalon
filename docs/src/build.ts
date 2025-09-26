import { walk } from '@std/fs/walk';
import { join, dirname, basename, extname } from '@std/path';
import { ensureDir } from '@std/fs/ensure-dir';
import { processMarkdown, extractCodeExamples } from './utils/markdown-processor.ts';
import { validateAllExamples, generateValidationReport } from './utils/code-validator.ts';

interface BuildOptions {
	inputDir: string;
	outputDir: string;
	baseUrl?: string;
}

interface BuildResult {
	pages: number;
	examples: number;
	validationErrors: number;
	buildTime: number;
}

/**
 * Build the documentation site
 */
export async function buildDocs(options: BuildOptions): Promise<BuildResult> {
	const startTime = Date.now();
	const { inputDir, outputDir, baseUrl = '' } = options;

	console.log('🏗️  Building Avalon documentation...');

	// Ensure output directory exists
	await ensureDir(outputDir);

	let pageCount = 0;
	let exampleCount = 0;
	let validationErrors = 0;

	// Process all markdown files
	for await (const entry of walk(inputDir, {
		exts: ['.md'],
		skip: [/node_modules/, /\.git/, /dist/],
	})) {
		if (entry.isFile) {
			await processMarkdownFile(entry.path, inputDir, outputDir, baseUrl);
			pageCount++;
		}
	}

	// Copy static assets
	await copyStaticAssets(outputDir);

	// Generate validation report
	const validationReport = await generateFullValidationReport(inputDir);
	await Deno.writeTextFile(join(outputDir, 'validation-report.md'), validationReport);

	const buildTime = Date.now() - startTime;

	console.log(`✅ Build complete!`);
	console.log(`   Pages: ${pageCount}`);
	console.log(`   Examples: ${exampleCount}`);
	console.log(`   Build time: ${buildTime}ms`);

	return {
		pages: pageCount,
		examples: exampleCount,
		validationErrors,
		buildTime,
	};
}

async function processMarkdownFile(
	filePath: string,
	inputDir: string,
	outputDir: string,
	baseUrl: string
): Promise<void> {
	const content = await Deno.readTextFile(filePath);
	const processed = await processMarkdown(content);

	// Extract and validate code examples
	const examples = extractCodeExamples(content);
	const validationResults = await validateAllExamples(examples);

	// Generate HTML
	const html = await generateHTML({
		content: processed.content,
		metadata: processed.metadata,
		filePath,
		baseUrl,
		validationResults,
	});

	// Determine output path
	const relativePath = filePath.replace(inputDir, '');
	const outputPath = join(outputDir, relativePath.replace('.md', '.html'));

	// Ensure output directory exists
	await ensureDir(dirname(outputPath));

	// Write HTML file
	await Deno.writeTextFile(outputPath, html);

	console.log(`📄 Processed: ${relativePath}`);
}

interface GenerateHTMLOptions {
	content: string;
	metadata: any;
	filePath: string;
	baseUrl: string;
	validationResults: Map<string, any>;
}

async function generateHTML(options: GenerateHTMLOptions): Promise<string> {
	const { content, metadata, filePath, baseUrl } = options;

	// Generate breadcrumbs
	const breadcrumbs = generateBreadcrumbs(filePath, baseUrl);

	// Generate table of contents if needed
	const tocRegex = /\[TOC\]/g;
	let processedContent = content;
	if (tocRegex.test(content)) {
		// Extract headings and generate TOC
		const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>([^<]*)<\/h[1-6]>/g;
		const headings = [];
		let match;
		while ((match = headingRegex.exec(content)) !== null) {
			headings.push({
				level: parseInt(match[1]),
				id: match[2],
				text: match[3].trim(),
			});
		}

		const toc = generateTableOfContents(headings);
		processedContent = content.replace(/\[TOC\]/g, toc);
	}

	return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${metadata.title ? `${metadata.title} | Avalon Documentation` : 'Avalon Documentation'}</title>
        ${metadata.description ? `<meta name="description" content="${metadata.description}" />` : ''}
        
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" 
          rel="stylesheet" 
        />
        
        <link rel="stylesheet" href="${baseUrl}/styles/main.css" />
        <link rel="stylesheet" href="${baseUrl}/styles/navigation.css" />
        <link rel="stylesheet" href="${baseUrl}/styles/syntax-highlighting.css" />
        
        <meta property="og:title" content="${metadata.title || 'Avalon Documentation'}" />
        <meta property="og:description" content="${
					metadata.description || 'Comprehensive documentation for the Avalon framework'
				}" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Avalon Framework" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${metadata.title || 'Avalon Documentation'}" />
        <meta name="twitter:description" content="${
					metadata.description || 'Comprehensive documentation for the Avalon framework'
				}" />
      </head>
      <body>
        <div class="docs-container">
          <nav class="documentation-nav" role="navigation" aria-label="Documentation navigation">
            <!-- Navigation will be populated by JavaScript -->
          </nav>
          
          <main class="docs-main">
            <div class="docs-content">
              ${breadcrumbs}
              ${processedContent}
            </div>
            
            <footer class="docs-footer">
              <div class="footer-content">
                <p>&copy; 2024 Avalon Framework. Built with Avalon.</p>
                <div class="footer-links">
                  <a href="https://github.com/avalon-framework/avalon" target="_blank" rel="noopener noreferrer">
                    GitHub
                  </a>
                  <a href="${baseUrl}/docs/06-migration/decision-guides/community-resources">
                    Community
                  </a>
                  <a href="${baseUrl}/docs/CONTRIBUTING">
                    Contributing
                  </a>
                </div>
              </div>
            </footer>
          </main>
        </div>
        
        <script src="${baseUrl}/scripts/main.js" defer></script>
      </body>
    </html>
  `;
}

function generateBreadcrumbs(filePath: string, baseUrl: string): string {
	const parts = filePath.split('/').filter(Boolean);
	const breadcrumbs = ['<nav class="breadcrumbs" aria-label="Breadcrumb">'];

	let currentPath = baseUrl;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		currentPath += '/' + part;

		// Clean up part name
		const name = part
			.replace(/^\d+-/, '') // Remove number prefix
			.replace(/-/g, ' ') // Replace dashes with spaces
			.replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words

		breadcrumbs.push(`<a href="${currentPath}">${name}</a>`);
		if (i < parts.length - 2) {
			breadcrumbs.push('<span class="breadcrumb-separator">/</span>');
		}
	}

	breadcrumbs.push('</nav>');
	return breadcrumbs.join('');
}

function generateTableOfContents(headings: Array<{ level: number; text: string; id: string }>): string {
	if (headings.length === 0) return '';

	let toc = '<nav class="table-of-contents">\n<h3>Table of Contents</h3>\n<ul>\n';

	for (const heading of headings) {
		const indent = '  '.repeat(heading.level - 1);
		toc += `${indent}<li><a href="#${heading.id}">${heading.text}</a></li>\n`;
	}

	toc += '</ul>\n</nav>';
	return toc;
}

async function copyStaticAssets(outputDir: string): Promise<void> {
	const assetsDir = join(Deno.cwd(), 'docs', 'src');

	// Copy styles
	const stylesInput = join(assetsDir, 'styles');
	const stylesOutput = join(outputDir, 'styles');
	await ensureDir(stylesOutput);

	for await (const entry of walk(stylesInput, { exts: ['.css'] })) {
		if (entry.isFile) {
			const relativePath = entry.path.replace(stylesInput, '');
			const outputPath = join(stylesOutput, relativePath);
			await ensureDir(dirname(outputPath));
			await Deno.copyFile(entry.path, outputPath);
		}
	}

	// Copy scripts (if they exist)
	const scriptsInput = join(assetsDir, 'scripts');
	try {
		const scriptsOutput = join(outputDir, 'scripts');
		await ensureDir(scriptsOutput);

		for await (const entry of walk(scriptsInput, { exts: ['.js'] })) {
			if (entry.isFile) {
				const relativePath = entry.path.replace(scriptsInput, '');
				const outputPath = join(scriptsOutput, relativePath);
				await ensureDir(dirname(outputPath));
				await Deno.copyFile(entry.path, outputPath);
			}
		}
	} catch {
		// Scripts directory doesn't exist, skip
	}

	console.log('📁 Copied static assets');
}

async function generateFullValidationReport(inputDir: string): Promise<string> {
	const allResults = new Map();

	for await (const entry of walk(inputDir, { exts: ['.md'] })) {
		if (entry.isFile) {
			const content = await Deno.readTextFile(entry.path);
			const examples = extractCodeExamples(content);
			const results = await validateAllExamples(examples);

			for (const [id, result] of results) {
				allResults.set(`${entry.path}:${id}`, result);
			}
		}
	}

	return generateValidationReport(allResults);
}

// CLI interface
if (import.meta.main) {
	const inputDir = join(Deno.cwd(), 'docs');
	const outputDir = join(Deno.cwd(), 'docs', 'dist');

	try {
		await buildDocs({ inputDir, outputDir });
	} catch (error) {
		console.error('❌ Build failed:', error);
		Deno.exit(1);
	}
}
