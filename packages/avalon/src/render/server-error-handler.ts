/**
 * Server error handler for displaying errors in the browser during development
 * Requirements: 3.5
 */

export interface ServerError {
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
}

/**
 * Parse error to extract useful information
 */
export function parseError(error: Error): ServerError {
  const parsed: ServerError = {
    message: error.message,
    stack: error.stack,
  };

  // Try to extract file location from stack trace
  if (error.stack) {
    const stackLines = error.stack.split('\n');
    
    // Look for file:// URLs in the stack
    for (const line of stackLines) {
      const match = line.match(/at\s+(?:.*\s+\()?(.+):(\d+):(\d+)\)?/);
      if (match) {
        parsed.file = match[1];
        parsed.line = parseInt(match[2], 10);
        parsed.column = parseInt(match[3], 10);
        break;
      }
    }
  }

  // Check for syntax errors
  if (error.message.includes('SyntaxError') || error.name === 'SyntaxError') {
    parsed.code = 'SYNTAX_ERROR';
  }

  return parsed;
}

/**
 * Generate HTML error page for displaying in browser
 */
export function generateErrorHTML(error: ServerError): string {
  const errorType = error.code === 'SYNTAX_ERROR' ? 'Syntax Error' : 'Server Error';
  const location = error.file && error.line 
    ? `${error.file}:${error.line}:${error.column || 0}`
    : 'Unknown location';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${errorType} - Avalon</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #1a1a1a;
      color: #e0e0e0;
      padding: 2rem;
      line-height: 1.6;
    }

    .error-container {
      max-width: 1200px;
      margin: 0 auto;
      background: #2a2a2a;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }

    .error-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #ff4444;
    }

    .error-icon {
      width: 48px;
      height: 48px;
      background: #ff4444;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: white;
    }

    .error-title {
      flex: 1;
    }

    .error-title h1 {
      font-size: 1.5rem;
      color: #ff4444;
      margin-bottom: 0.25rem;
    }

    .error-location {
      font-size: 0.875rem;
      color: #999;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    }

    .error-message {
      background: #1a1a1a;
      padding: 1.5rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
      border-left: 4px solid #ff4444;
    }

    .error-message pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      color: #ffcccc;
    }

    .error-stack {
      background: #1a1a1a;
      padding: 1.5rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
    }

    .error-stack h2 {
      font-size: 1rem;
      color: #999;
      margin-bottom: 1rem;
    }

    .error-stack pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.75rem;
      color: #ccc;
      line-height: 1.5;
    }

    .error-actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .error-button {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-block;
    }

    .error-button-primary {
      background: #4CAF50;
      color: white;
    }

    .error-button-primary:hover {
      background: #45a049;
    }

    .error-button-secondary {
      background: #555;
      color: white;
    }

    .error-button-secondary:hover {
      background: #666;
    }

    .error-tip {
      background: #2a3a4a;
      padding: 1rem;
      border-radius: 6px;
      margin-top: 1.5rem;
      border-left: 4px solid #4CAF50;
    }

    .error-tip h3 {
      font-size: 0.875rem;
      color: #4CAF50;
      margin-bottom: 0.5rem;
    }

    .error-tip p {
      font-size: 0.875rem;
      color: #ccc;
    }

    @media (max-width: 768px) {
      body {
        padding: 1rem;
      }

      .error-container {
        padding: 1rem;
      }

      .error-header {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-header">
      <div class="error-icon">!</div>
      <div class="error-title">
        <h1>${errorType}</h1>
        <div class="error-location">${location}</div>
      </div>
    </div>

    <div class="error-message">
      <pre>${escapeHtml(error.message)}</pre>
    </div>

    ${error.stack ? `
    <div class="error-stack">
      <h2>Stack Trace</h2>
      <pre>${escapeHtml(error.stack)}</pre>
    </div>
    ` : ''}

    <div class="error-actions">
      <button class="error-button error-button-primary" onclick="window.location.reload()">
        Reload Page
      </button>
      <button class="error-button error-button-secondary" onclick="history.back()">
        Go Back
      </button>
    </div>

    <div class="error-tip">
      <h3>💡 Tip</h3>
      <p>
        Fix the error in your code and save the file. The dev server will automatically reload.
        ${error.code === 'SYNTAX_ERROR' ? 'Check for missing brackets, quotes, or semicolons.' : ''}
      </p>
    </div>
  </div>

  <script>
    // Auto-reload when HMR connection is restored
    if (import.meta.hot) {
      import.meta.hot.on('vite:beforeUpdate', () => {
        console.log('[HMR] Error fixed, reloading...');
        window.location.reload();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.location.reload();
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Create error response for browser display
 */
export function createErrorResponse(error: Error): Response {
  const parsed = parseError(error);
  const html = generateErrorHTML(parsed);

  return new Response(html, {
    status: 500,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

/**
 * Wrap a request handler with error catching
 */
export function withErrorHandler(
  handler: (req: Request) => Promise<Response> | Response,
  isDev: boolean
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (error) {
      console.error('[Server Error]', error);

      if (isDev) {
        // In development, show error in browser
        return createErrorResponse(error as Error);
      } else {
        // In production, show generic error
        return new Response('Internal Server Error', {
          status: 500,
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }
    }
  };
}
