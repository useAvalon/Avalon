/**
 * Nitro SSR Renderer Handler for Avalon
 *
 * This module provides the main SSR renderer for Nitro integration.
 * It handles page rendering using Avalon's existing SSR pipeline while
 * integrating with Nitro's h3 event handling system.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 9.1, 9.2, 9.3, 9.4
 */

import type {
  H3Event,
  NitroRenderContext,
  LayoutContext,
  SSRRenderOptions,
  SSRRenderResult,
  PageModule,
  AvalonRuntimeConfig,
  HttpError,
} from "./types.ts";
import { createNotFoundError, createInternalError, isHttpError } from "./types.ts";

/**
 * Resolved page route information
 */
export interface ResolvedPageRoute {
  /** File path to the page module */
  filePath: string;
  /** Route pattern that matched */
  pattern: string;
  /** Extracted route parameters */
  params: Record<string, string>;
  /** Layout files to apply (outermost first) */
  layouts?: string[];
}

/**
 * Render handler options
 */
export interface RenderHandlerOptions {
  /** Avalon runtime configuration */
  avalonConfig: AvalonRuntimeConfig;
  /** Whether running in development mode */
  isDev?: boolean;
  /** Vite dev server URL for development */
  viteServerUrl?: string;
  /** Custom page resolver function */
  resolvePageRoute?: (pathname: string, pagesDir: string) => Promise<ResolvedPageRoute | null>;
  /** Custom page module loader */
  loadPageModule?: (filePath: string) => Promise<PageModule>;
  /** Custom layout resolver */
  resolveLayouts?: (routePath: string, config: AvalonRuntimeConfig) => Promise<string[]>;
}

/**
 * Creates a render context from an H3 event
 *
 * @param event - The H3 event from Nitro
 * @param params - Route parameters extracted from the URL
 * @returns NitroRenderContext for use in rendering
 */
export function createRenderContext(
  event: H3Event,
  params: Record<string, string> = {}
): NitroRenderContext {
  const url = getRequestURL(event);

  return {
    url,
    params,
    query: Object.fromEntries(url.searchParams),
    request: toRequest(event),
    event,
  };
}

/**
 * Gets the request URL from an H3 event
 */
export function getRequestURL(event: H3Event): URL {
  // In a real Nitro environment, this would use h3's getRequestURL
  // For now, we construct it from the event path
  const protocol = "http";
  const host = "localhost";
  return new URL(event.path, `${protocol}://${host}`);
}

/**
 * Converts an H3 event to a standard Request object
 */
export function toRequest(event: H3Event): Request {
  const url = getRequestURL(event);
  return new Request(url, {
    method: event.method,
    headers: getRequestHeaders(event),
  });
}

/**
 * Gets request headers from an H3 event
 */
export function getRequestHeaders(event: H3Event): Headers {
  const headers = new Headers();
  // In a real Nitro environment, headers would come from event.node.req.headers
  // This is a placeholder implementation
  return headers;
}

/**
 * Sets a response header on an H3 event
 */
export function setResponseHeader(
  event: H3Event,
  name: string,
  value: string
): void {
  // In a real Nitro environment, this would use h3's setResponseHeader
  // Store in event context for now
  if (!event.context.responseHeaders) {
    event.context.responseHeaders = {};
  }
  (event.context.responseHeaders as Record<string, string>)[name] = value;
}

/**
 * Creates an error response
 */
export function createErrorResponse(
  error: Error | HttpError,
  isDev: boolean
): Response {
  const statusCode = isHttpError(error) ? error.statusCode : 500;
  const message = error.message;

  if (isDev) {
    // Development: include full error details
    const errorHtml = generateDevErrorPage(error, statusCode);
    return new Response(errorHtml, {
      status: statusCode,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Production: generic error page
  const errorHtml = generateProdErrorPage(statusCode);
  return new Response(errorHtml, {
    status: statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Generates a development error page with full details
 */
function generateDevErrorPage(error: Error, statusCode: number): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Error ${statusCode}</title>
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
      h1 {
        color: #ff6b6b;
        margin-top: 0;
        font-size: 24px;
      }
      .status-code {
        font-size: 48px;
        font-weight: bold;
        color: #ff6b6b;
        margin-bottom: 10px;
      }
      .message {
        font-size: 18px;
        color: #ccc;
        margin-bottom: 20px;
      }
      pre {
        background: #1a1a1a;
        padding: 20px;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 14px;
        line-height: 1.5;
        color: #e0e0e0;
      }
      .stack-title {
        color: #888;
        font-size: 12px;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <div class="status-code">${statusCode}</div>
      <h1>${getStatusText(statusCode)}</h1>
      <p class="message">${escapeHtml(error.message)}</p>
      ${error.stack ? `
      <div class="stack-title">Stack Trace</div>
      <pre>${escapeHtml(error.stack)}</pre>
      ` : ""}
    </div>
  </body>
</html>`;
}

/**
 * Generates a production error page without sensitive details
 */
function generateProdErrorPage(statusCode: number): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Error ${statusCode}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        padding: 40px;
        background: #f5f5f5;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        box-sizing: border-box;
      }
      .error-container {
        text-align: center;
        max-width: 400px;
      }
      .status-code {
        font-size: 72px;
        font-weight: bold;
        color: #333;
        margin-bottom: 10px;
      }
      h1 {
        color: #666;
        font-size: 24px;
        margin: 0 0 20px 0;
      }
      p {
        color: #888;
        margin: 0;
      }
      a {
        color: #0066cc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <div class="status-code">${statusCode}</div>
      <h1>${getStatusText(statusCode)}</h1>
      <p><a href="/">Return to home</a></p>
    </div>
  </body>
</html>`;
}

/**
 * Gets the status text for an HTTP status code
 */
function getStatusText(statusCode: number): string {
  const statusTexts: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Page Not Found",
    405: "Method Not Allowed",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };
  return statusTexts[statusCode] || "Error";
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Island hydration marker information
 */
export interface IslandMarker {
  /** Framework identifier (react, vue, svelte, etc.) */
  framework: string;
  /** Source path to the island module */
  src: string;
  /** Serialized props for the island */
  props?: string;
  /** Hydration strategy (load, idle, visible, media) */
  hydrate?: string;
}

/**
 * Extracts island markers from HTML
 * Requirements: 9.1, 9.2, 9.3
 *
 * @param html - The rendered HTML string
 * @returns Array of island markers found in the HTML
 */
export function extractIslandMarkers(html: string): IslandMarker[] {
  const markers: IslandMarker[] = [];

  // Match island elements with data-framework attribute
  const islandRegex = /<[^>]*data-framework="([^"]+)"[^>]*>/g;
  let match;

  while ((match = islandRegex.exec(html)) !== null) {
    const fullMatch = match[0];
    const framework = match[1];

    // Extract data-src
    const srcMatch = fullMatch.match(/data-src="([^"]+)"/);
    const src = srcMatch ? srcMatch[1] : "";

    // Extract data-props
    const propsMatch = fullMatch.match(/data-props="([^"]*)"/);
    const props = propsMatch ? propsMatch[1] : undefined;

    // Extract data-hydrate (hydration strategy)
    const hydrateMatch = fullMatch.match(/data-hydrate="([^"]+)"/);
    const hydrate = hydrateMatch ? hydrateMatch[1] : undefined;

    markers.push({
      framework,
      src,
      props,
      hydrate,
    });
  }

  return markers;
}

/**
 * Ensures all required hydration markers are present on an island element
 * Requirements: 9.1, 9.2, 9.3
 *
 * @param element - The island element HTML string
 * @param marker - The island marker data to ensure
 * @returns The element with all required markers
 */
export function ensureHydrationMarkers(
  element: string,
  marker: Partial<IslandMarker>
): string {
  let result = element;

  // Ensure data-framework is present
  if (marker.framework && !result.includes("data-framework=")) {
    result = result.replace(/>/, ` data-framework="${marker.framework}">`);
  }

  // Ensure data-src is present
  if (marker.src && !result.includes("data-src=")) {
    result = result.replace(/>/, ` data-src="${marker.src}">`);
  }

  // Ensure data-props is present (even if empty)
  if (marker.props !== undefined && !result.includes("data-props=")) {
    result = result.replace(/>/, ` data-props="${marker.props}">`);
  }

  return result;
}

/**
 * Injects the client hydration script into HTML
 * Requirements: 2.6, 9.4
 *
 * This function:
 * 1. Checks if there are islands that need hydration
 * 2. Injects the client script before </body> if not already present
 * 3. Supports both development and production script paths
 *
 * @param html - The rendered HTML string
 * @param isDev - Whether running in development mode
 * @param options - Additional injection options
 * @returns HTML with hydration script injected
 */
export function injectHydrationScript(
  html: string,
  isDev: boolean,
  options: {
    /** Custom script path override */
    scriptPath?: string;
    /** Additional scripts to inject */
    additionalScripts?: string[];
    /** Whether to force injection even without islands */
    forceInject?: boolean;
  } = {}
): string {
  // Check if there are any islands that need hydration
  const hasIslands =
    html.includes("data-framework=") || html.includes("data-src=");

  if (!hasIslands && !options.forceInject) {
    // No islands found, no need to inject hydration script
    return html;
  }

  // Check if the client script is already included
  const existingScripts = [
    "/src/client/main.js",
    "/dist/client.js",
    "client/main.js",
  ];
  
  if (existingScripts.some(script => html.includes(script))) {
    return html;
  }

  // Determine the script path based on environment or override
  const scriptPath = options.scriptPath || (isDev ? "/src/client/main.js" : "/dist/client.js");
  
  // Build the script tags
  const scripts: string[] = [];
  
  // Main hydration script
  scripts.push(`<script type="module" src="${scriptPath}"></script>`);
  
  // Additional scripts if provided
  if (options.additionalScripts) {
    scripts.push(...options.additionalScripts);
  }

  const scriptBlock = scripts.join("\n");

  // Inject before closing </body> tag
  if (html.includes("</body>")) {
    return html.replace("</body>", `${scriptBlock}\n</body>`);
  }

  // Fallback: append to the end
  return html + scriptBlock;
}

/**
 * Validates that hydration markers are present in the HTML
 * Requirements: 2.3, 9.1, 9.2, 9.3
 *
 * @param html - The rendered HTML string
 * @returns Object with validation results
 */
export function validateHydrationMarkers(html: string): {
  hasFrameworkAttr: boolean;
  hasSrcAttr: boolean;
  hasPropsAttr: boolean;
  islandCount: number;
  islands: IslandMarker[];
  hasClientScript: boolean;
  isValid: boolean;
} {
  // Extract all island markers
  const islands = extractIslandMarkers(html);

  // Count islands with each attribute type
  const frameworkMatches = html.match(/data-framework="[^"]+"/g) || [];
  const srcMatches = html.match(/data-src="[^"]+"/g) || [];
  const propsMatches = html.match(/data-props="[^"]*"/g) || [];

  // Check for client script
  const hasClientScript =
    html.includes("/src/client/main.js") ||
    html.includes("/dist/client.js") ||
    html.includes("client/main.js");

  // Validation: all islands should have framework and src attributes
  const allIslandsValid = islands.every(
    (island) => island.framework && island.src
  );

  // Overall validity: if there are islands, they should be valid and have client script
  const isValid =
    islands.length === 0 || (allIslandsValid && hasClientScript);

  return {
    hasFrameworkAttr: frameworkMatches.length > 0,
    hasSrcAttr: srcMatches.length > 0,
    hasPropsAttr: propsMatches.length > 0,
    islandCount: frameworkMatches.length,
    islands,
    hasClientScript,
    isValid,
  };
}

/**
 * Processes HTML to ensure all hydration requirements are met
 * Requirements: 2.3, 2.6, 9.1, 9.2, 9.3, 9.4
 *
 * This is a convenience function that:
 * 1. Validates existing hydration markers
 * 2. Injects the client script if needed
 * 3. Returns the processed HTML
 *
 * @param html - The rendered HTML string
 * @param isDev - Whether running in development mode
 * @returns Processed HTML with all hydration requirements met
 */
export function processHydrationRequirements(
  html: string,
  isDev: boolean
): {
  html: string;
  validation: ReturnType<typeof validateHydrationMarkers>;
} {
  // First, inject the hydration script
  const processedHtml = injectHydrationScript(html, isDev);

  // Then validate the result
  const validation = validateHydrationMarkers(processedHtml);

  return {
    html: processedHtml,
    validation,
  };
}

/**
 * Renders a page to HTML string (non-streaming)
 * Requirements: 2.1, 2.2
 *
 * @param pageModule - The page module to render
 * @param context - The render context
 * @param options - Render options
 * @returns SSR render result
 */
export async function renderPage(
  pageModule: PageModule,
  context: NitroRenderContext,
  options: SSRRenderOptions = {}
): Promise<SSRRenderResult> {
  try {
    // Get page props if getServerSideProps is defined
    let pageProps: Record<string, unknown> = {};
    if (pageModule.getServerSideProps) {
      pageProps = await pageModule.getServerSideProps(context);
    }

    // The actual rendering would integrate with Avalon's existing renderToHtml
    // For now, we return a placeholder that shows the structure
    const html = await renderPageComponent(pageModule, pageProps, context, options);

    return {
      html,
      statusCode: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    };
  } catch (error) {
    console.error("[SSR Error]", error);

    if (options.onError && error instanceof Error) {
      options.onError(error);
    }

    throw error;
  }
}

/**
 * Renders a page component to HTML
 * This is a placeholder that would integrate with Avalon's existing SSR pipeline
 */
async function renderPageComponent(
  pageModule: PageModule,
  pageProps: Record<string, unknown>,
  context: NitroRenderContext,
  _options: SSRRenderOptions
): Promise<string> {
  // This would integrate with the existing renderToHtml function
  // For now, return a basic structure showing the integration point

  // In the real implementation, this would:
  // 1. Import and use renderToHtml from '../render/ssr.ts'
  // 2. Create a RouteConfig from the pageModule
  // 3. Apply layouts using the layout resolver
  // 4. Return the fully rendered HTML

  const componentName = pageModule.default?.name || "Page";
  const metadata = pageModule.metadata || {};

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${metadata.title || "Avalon App"}</title>
    ${metadata.description ? `<meta name="description" content="${metadata.description}">` : ""}
  </head>
  <body>
    <div id="app" data-page="${componentName}" data-props='${JSON.stringify(pageProps)}'>
      <!-- Page content rendered by Avalon SSR pipeline -->
    </div>
  </body>
</html>`;
}

/**
 * Streaming render state for tracking progress
 */
interface StreamingRenderState {
  shellSent: boolean;
  contentSent: boolean;
  closed: boolean;
  error: Error | null;
}

/**
 * Extended streaming options with additional callbacks
 */
export interface StreamingSSROptions extends SSRRenderOptions {
  /** Callback when shell rendering fails before streaming starts */
  onShellError?: (error: Error) => void;
  /** Timeout for shell ready in milliseconds */
  shellReadyTimeout?: number;
  /** Timeout for all content ready in milliseconds */
  allReadyTimeout?: number;
}

/**
 * Renders a page to a streaming response
 * Requirements: 2.4
 *
 * This function implements streaming SSR with proper shell/content separation:
 * 1. Shell (DOCTYPE, html, head, body opening) is sent first
 * 2. onShellReady callback is invoked when shell is ready
 * 3. Page content is streamed progressively
 * 4. onAllReady callback is invoked when all content is complete
 *
 * @param pageModule - The page module to render
 * @param context - The render context
 * @param options - Render options including streaming callbacks
 * @returns ReadableStream of HTML chunks
 */
export async function renderPageStream(
  pageModule: PageModule,
  context: NitroRenderContext,
  options: StreamingSSROptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  
  const state: StreamingRenderState = {
    shellSent: false,
    contentSent: false,
    closed: false,
    error: null,
  };

  // Set up timeouts if specified
  const shellTimeout = options.shellReadyTimeout;
  const allReadyTimeout = options.allReadyTimeout;
  let shellTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let allReadyTimeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearTimeouts = () => {
    if (shellTimeoutId) {
      clearTimeout(shellTimeoutId);
      shellTimeoutId = null;
    }
    if (allReadyTimeoutId) {
      clearTimeout(allReadyTimeoutId);
      allReadyTimeoutId = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      controller = ctrl;

      // Set up shell timeout
      if (shellTimeout && shellTimeout > 0) {
        shellTimeoutId = setTimeout(() => {
          if (!state.shellSent && !state.closed) {
            const timeoutError = new Error(`Shell ready timeout after ${shellTimeout}ms`);
            handleStreamError(timeoutError, true);
          }
        }, shellTimeout);
      }

      try {
        // Get page props if getServerSideProps is defined
        let pageProps: Record<string, unknown> = {};
        if (pageModule.getServerSideProps) {
          pageProps = await pageModule.getServerSideProps(context);
        }

        const metadata = pageModule.metadata || {};

        // Generate the shell (DOCTYPE, html, head, body opening)
        const shell = generateStreamingShell(metadata, context);
        
        // Send the shell
        if (!state.closed) {
          controller.enqueue(encoder.encode(shell));
          state.shellSent = true;

          // Clear shell timeout
          if (shellTimeoutId) {
            clearTimeout(shellTimeoutId);
            shellTimeoutId = null;
          }

          // Notify that shell is ready
          if (options.onShellReady) {
            options.onShellReady();
          }
        }

        // Set up all ready timeout
        if (allReadyTimeout && allReadyTimeout > 0) {
          allReadyTimeoutId = setTimeout(() => {
            if (!state.contentSent && !state.closed) {
              const timeoutError = new Error(`All ready timeout after ${allReadyTimeout}ms`);
              handleStreamError(timeoutError, false);
            }
          }, allReadyTimeout);
        }

        // Send the page content
        if (!state.closed) {
          const content = generateStreamingContent(pageModule, pageProps);
          controller.enqueue(encoder.encode(content));
          state.contentSent = true;
        }

        // Send the footer (closing body and html tags)
        if (!state.closed) {
          const footer = generateStreamingFooter();
          controller.enqueue(encoder.encode(footer));
        }

        // Clear all ready timeout
        clearTimeouts();

        // Notify that all content is ready
        if (options.onAllReady && !state.closed) {
          options.onAllReady();
        }

        if (!state.closed) {
          state.closed = true;
          controller.close();
        }
      } catch (error) {
        handleStreamError(
          error instanceof Error ? error : new Error(String(error)),
          !state.shellSent
        );
      }

      function handleStreamError(err: Error, isShellError: boolean) {
        state.error = err;
        clearTimeouts();

        console.error("[Streaming Error]", {
          message: err.message,
          stack: err.stack,
          shellSent: state.shellSent,
          isShellError,
          timestamp: new Date().toISOString(),
        });

        // Call appropriate error callback
        if (isShellError && options.onShellError) {
          options.onShellError(err);
        }
        if (options.onError) {
          options.onError(err);
        }

        if (!state.closed && controller) {
          if (!state.shellSent) {
            // Send complete error page if shell hasn't been sent
            const errorHtml = generateDevErrorPage(err, 500);
            controller.enqueue(encoder.encode(errorHtml));
          } else {
            // Inject error boundary into the stream
            const errorBoundary = generateStreamingErrorBoundary(err);
            controller.enqueue(encoder.encode(errorBoundary));
            
            // Close the HTML document gracefully
            const footer = generateStreamingFooter();
            controller.enqueue(encoder.encode(footer));
          }

          state.closed = true;
          controller.close();
        }
      }
    },

    cancel() {
      clearTimeouts();
      if (!state.closed && controller) {
        state.closed = true;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return stream;
}

/**
 * Generates the streaming shell (DOCTYPE, html, head, body opening)
 */
function generateStreamingShell(
  metadata: { title?: string; description?: string },
  _context: NitroRenderContext
): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${metadata.title || "Avalon App"}</title>
    ${metadata.description ? `<meta name="description" content="${metadata.description}">` : ""}
  </head>
  <body>
`;
}

/**
 * Generates the streaming content
 */
function generateStreamingContent(
  pageModule: PageModule,
  pageProps: Record<string, unknown>
): string {
  const componentName = pageModule.default?.name || "Page";
  return `    <div id="app" data-page="${componentName}" data-props='${JSON.stringify(pageProps)}'>
      <!-- Page content rendered by Avalon SSR pipeline -->
    </div>
`;
}

/**
 * Generates the streaming footer (closing body and html tags)
 */
function generateStreamingFooter(): string {
  return `  </body>
</html>`;
}

/**
 * Generates an error boundary for mid-stream errors
 */
function generateStreamingErrorBoundary(error: Error): string {
  const isDev = typeof Deno !== "undefined" 
    ? Deno.env.get("DENO_ENV") !== "production"
    : process.env.NODE_ENV !== "production";

  return `
    <div class="streaming-error-boundary" data-error-boundary="true" style="
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <span style="font-size: 24px;">⚠️</span>
        <h3 style="margin: 0; color: #856404;">Streaming Error</h3>
      </div>
      <p style="margin: 10px 0; color: #856404;">
        An error occurred while streaming this page.
      </p>
      ${isDev ? `
      <details style="margin-top: 15px;">
        <summary style="cursor: pointer; color: #856404; font-weight: bold;">
          Error Details (Development Mode)
        </summary>
        <div style="margin-top: 10px;">
          <p><strong>Error:</strong> ${escapeHtml(error.message)}</p>
          ${error.stack ? `<pre style="
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
            margin-top: 10px;
          ">${escapeHtml(error.stack)}</pre>` : ""}
        </div>
      </details>
      ` : ""}
    </div>
`;
}

/**
 * Creates a streaming response with proper headers
 * Requirements: 2.4
 *
 * @param stream - The ReadableStream to wrap
 * @param options - Additional response options
 * @returns Response object with streaming body
 */
export function createStreamingResponse(
  stream: ReadableStream<Uint8Array>,
  options: {
    status?: number;
    headers?: Record<string, string>;
  } = {}
): Response {
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Transfer-Encoding": "chunked",
    ...options.headers,
  });

  return new Response(stream, {
    status: options.status || 200,
    headers,
  });
}

/**
 * Creates the main Nitro renderer handler
 * This is the entry point for all page rendering in Nitro
 *
 * Requirements: 2.1, 2.2, 2.4
 *
 * @param options - Render handler options
 * @returns Handler function for Nitro
 */
export function createNitroRenderer(options: RenderHandlerOptions) {
  const { avalonConfig, isDev = false } = options;

  return async function nitroRendererHandler(event: H3Event): Promise<Response> {
    const url = getRequestURL(event);
    const pathname = url.pathname;

    try {
      // Resolve the page route
      const route = options.resolvePageRoute
        ? await options.resolvePageRoute(pathname, avalonConfig.pagesDir)
        : await defaultResolvePageRoute(pathname, avalonConfig.pagesDir);

      if (!route) {
        // No page found, return 404
        const error = createNotFoundError(`Page not found: ${pathname}`);
        return createErrorResponse(error, isDev);
      }

      // Load the page module
      const pageModule = options.loadPageModule
        ? await options.loadPageModule(route.filePath)
        : await defaultLoadPageModule(route.filePath);

      // Create render context
      const renderContext = createRenderContext(event, route.params);

      // Resolve layouts if available
      if (options.resolveLayouts) {
        const layouts = await options.resolveLayouts(pathname, avalonConfig);
        renderContext.layoutContext = { layouts };
      }

      // Render the page
      if (avalonConfig.streaming) {
        // Streaming SSR
        const stream = await renderPageStream(pageModule, renderContext, {
          onShellReady: () => {
            setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      } else {
        // Non-streaming SSR
        const result = await renderPage(pageModule, renderContext);

        // Inject hydration script
        const html = injectHydrationScript(result.html as string, isDev);

        return new Response(html, {
          status: result.statusCode,
          headers: result.headers,
        });
      }
    } catch (error) {
      console.error("[Nitro Renderer Error]", error);

      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResponse(err, isDev);
    }
  };
}

/**
 * Default page route resolver
 * This is a placeholder that would integrate with Avalon's file-system router
 */
async function defaultResolvePageRoute(
  pathname: string,
  _pagesDir: string
): Promise<ResolvedPageRoute | null> {
  // This would integrate with the existing FileSystemRouter
  // For now, return a basic structure

  // Handle root path
  if (pathname === "/" || pathname === "") {
    return {
      filePath: "src/pages/index.tsx",
      pattern: "/",
      params: {},
    };
  }

  // Convert pathname to potential file path
  const cleanPath = pathname.replace(/^\//, "").replace(/\/$/, "");
  const filePath = `src/pages/${cleanPath}.tsx`;

  return {
    filePath,
    pattern: pathname,
    params: {},
  };
}

/**
 * Default page module loader
 * This is a placeholder that would integrate with Vite's module loading
 */
async function defaultLoadPageModule(_filePath: string): Promise<PageModule> {
  // This would use Vite's ssrLoadModule in development
  // or import the built module in production

  return {
    default: () => null,
    metadata: {
      title: "Avalon Page",
    },
  };
}

// Export types for external use
export type { RenderHandlerOptions, ResolvedPageRoute };
