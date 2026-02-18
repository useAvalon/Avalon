import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { processMarkdown, extractCodeExamples } from './utils/markdown-processor';
import { validateAllExamples } from './utils/code-validator';

const PORT = 3001;

// MIME type mapping for static files
const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
};

function getMimeType(filePath: string): string {
	const ext = extname(filePath).toLowerCase();
	return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Serve static files from a directory
 */
async function serveStaticFile(filePath: string): Promise<Response | null> {
	try {
		const file = Bun.file(filePath);
		if (!(await file.exists())) return null;
		const mimeType = getMimeType(filePath);
		return new Response(file, {
			headers: { 'Content-Type': mimeType },
		});
	} catch {
		return null;
	}
}

/**
 * Handle documentation page requests
 */
async function handleDocsPage(pathname: string): Promise<Response> {
	try {
		// Map URL to markdown file
		let markdownPath = pathname.replace('/docs', '');
		if (markdownPath === '' || markdownPath === '/') {
			markdownPath = '/README.md';
		} else if (!markdownPath.endsWith('.md')) {
			markdownPath += '.md';
		}

		const filePath = join(process.cwd(), 'docs', markdownPath);

		// Read and process markdown file
		let content: string;
		try {
			content = await readFile(filePath, 'utf-8');
		} catch {
			// Try index.md if direct file doesn't exist
			const indexPath = join(process.cwd(), 'docs', markdownPath.replace('.md', '/README.md'));
			try {
				content = await readFile(indexPath, 'utf-8');
			} catch {
				return new Response('Page not found', { status: 404 });
			}
		}

		// Process markdown
		const processed = await processMarkdown(content);

		// Extract and validate code examples
		const examples = extractCodeExamples(content);
		const validationResults = await validateAllExamples(examples);

		// Render page with layout
		const html = await renderDocsPage({
			content: processed.content,
			metadata: processed.metadata,
			currentPath: pathname,
			validationResults,
		});

		return new Response(html, {
			headers: { 'Content-Type': 'text/html; charset=utf-8' },
		});
	} catch (error) {
		console.error('Error handling docs page:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}

/**
 * Handle validation API requests
 */
async function handleValidateAPI(request: Request): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method not allowed', { status: 405 });
	}

	try {
		const { code, language, framework } = await request.json();
		const { validateCode } = await import('./utils/code-validator');

		const result = await validateCode(code, language, {
			checkSyntax: true,
			checkImports: true,
			checkTypes: language.includes('typescript'),
			framework,
		});

		return new Response(JSON.stringify(result), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

interface RenderDocsPageOptions {
	content: string;
	metadata: any;
	currentPath: string;
	validationResults: Map<string, any>;
}

async function renderDocsPage(options: RenderDocsPageOptions): Promise<string> {
	const { content, metadata, currentPath } = options;

	// Create a simple HTML structure for now
	// In a full implementation, this would use a proper JSX renderer
	const html = `
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
        
        <link rel="stylesheet" href="/styles/main.css" />
        <link rel="stylesheet" href="/styles/navigation.css" />
        <link rel="stylesheet" href="/styles/syntax-highlighting.css" />
      </head>
      <body>
        <div class="docs-container">
          <nav class="documentation-nav" role="navigation" aria-label="Documentation navigation">
            <div class="nav-menu">
              <div class="nav-header">
                <h2 class="nav-title">Documentation</h2>
              </div>
              <ul class="nav-list">
                <li class="nav-item">
                  <div class="nav-link-container ${currentPath.startsWith('/docs/01-getting-started') ? 'active' : ''}">
                    <a href="/docs/01-getting-started" class="nav-link">
                      <span class="nav-icon">🚀</span>
                      <span class="nav-text">Getting Started</span>
                    </a>
                  </div>
                </li>
                <li class="nav-item">
                  <div class="nav-link-container ${currentPath.startsWith('/docs/02-core-concepts') ? 'active' : ''}">
                    <a href="/docs/02-core-concepts" class="nav-link">
                      <span class="nav-icon">🏗️</span>
                      <span class="nav-text">Core Concepts</span>
                    </a>
                  </div>
                </li>
                <li class="nav-item">
                  <div class="nav-link-container ${currentPath.startsWith('/docs/03-features') ? 'active' : ''}">
                    <a href="/docs/03-features" class="nav-link">
                      <span class="nav-icon">⚡</span>
                      <span class="nav-text">Features</span>
                    </a>
                  </div>
                </li>
                <li class="nav-item">
                  <div class="nav-link-container ${currentPath.startsWith('/docs/04-api-reference') ? 'active' : ''}">
                    <a href="/docs/04-api-reference" class="nav-link">
                      <span class="nav-icon">📚</span>
                      <span class="nav-text">API Reference</span>
                    </a>
                  </div>
                </li>
                <li class="nav-item">
                  <div class="nav-link-container ${currentPath.startsWith('/docs/05-guides') ? 'active' : ''}">
                    <a href="/docs/05-guides" class="nav-link">
                      <span class="nav-icon">🎯</span>
                      <span class="nav-text">Guides</span>
                    </a>
                  </div>
                </li>
                <li class="nav-item">
                  <div class="nav-link-container ${currentPath.startsWith('/docs/06-migration') ? 'active' : ''}">
                    <a href="/docs/06-migration" class="nav-link">
                      <span class="nav-icon">🔄</span>
                      <span class="nav-text">Migration</span>
                    </a>
                  </div>
                </li>
              </ul>
            </div>
          </nav>
          
          <main class="docs-main">
            <div class="docs-content">
              ${content}
            </div>
            
            <footer class="docs-footer">
              <div class="footer-content">
                <p>&copy; 2024 Avalon Framework. Built with Avalon.</p>
                <div class="footer-links">
                  <a href="https://github.com/avalon-framework/avalon" target="_blank" rel="noopener noreferrer">
                    GitHub
                  </a>
                  <a href="/docs/06-migration/decision-guides/community-resources">
                    Community
                  </a>
                  <a href="/docs/CONTRIBUTING">
                    Contributing
                  </a>
                </div>
              </div>
            </footer>
          </main>
        </div>
      </body>
    </html>
  `;

	return html;
}

/**
 * Main request handler
 */
async function handleRequest(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const pathname = url.pathname;

	// Static assets - styles
	if (pathname.startsWith('/styles/')) {
		const filePath = join(process.cwd(), 'docs', 'src', pathname);
		const response = await serveStaticFile(filePath);
		if (response) return response;
		return new Response('Not Found', { status: 404 });
	}

	// Static assets - scripts
	if (pathname.startsWith('/scripts/')) {
		const filePath = join(process.cwd(), 'docs', 'src', pathname);
		const response = await serveStaticFile(filePath);
		if (response) return response;
		return new Response('Not Found', { status: 404 });
	}

	// Documentation pages
	if (pathname.startsWith('/docs')) {
		return handleDocsPage(pathname);
	}

	// Root redirect
	if (pathname === '/') {
		return Response.redirect('/docs', 302);
	}

	// API endpoints
	if (pathname === '/api/validate') {
		return handleValidateAPI(request);
	}

	return new Response('Not Found', { status: 404 });
}

// Start server using Bun.serve
console.log(`🚀 Documentation server starting on http://localhost:${PORT}`);

Bun.serve({
	port: PORT,
	fetch: handleRequest,
});
