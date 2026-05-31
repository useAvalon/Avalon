/**
 * Shared error page HTML templates for development mode.
 * Extracted from nitro-integration.ts to keep that file focused on coordination.
 *
 * @module render/error-pages
 */

/**
 * Escapes HTML special characters
 */
function escapeHtml(str: string): string {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

/**
 * Generates a styled 500 error page for development with stack trace.
 */
export function generateErrorPage(error: Error): string {
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SSR Error</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        padding: 40px;
        background: #1a1a1a;
        color: #fff;
      }
      .error-container {
        max-width: 800px;
        margin: 0 auto;
        background: #2d2d2d;
        padding: 40px;
        border-radius: 8px;
        border-left: 4px solid #ff6b6b;
      }
      h1 { color: #ff6b6b; margin-top: 0; font-size: 24px; }
      .message { font-size: 18px; color: #ccc; margin-bottom: 20px; }
      pre {
        background: #1a1a1a;
        padding: 20px;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 14px;
        line-height: 1.5;
        color: #e0e0e0;
      }
      .stack-title { color: #888; font-size: 12px; text-transform: uppercase; margin-bottom: 10px; }
    </style>
  </head>
  <body>
    <div class="error-container">
      <h1>SSR Error</h1>
      <p class="message">${escapeHtml(error.message)}</p>
      ${
				error.stack
					? `
      <div class="stack-title">Stack Trace</div>
      <pre>${escapeHtml(error.stack)}</pre>
      `
					: ""
			}
    </div>
    <script type="module" src="/@vite/client"></script>
  </body>
</html>`;
}

/**
 * Generates a minimal fallback 404 page when the error handler itself fails.
 */
export function generateFallback404(url: string): string {
	return `<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 - Page Not Found</h1><p>The page ${escapeHtml(url)} was not found.</p></body></html>`;
}
