/**
 * Nitro Integration Module for Avalon Vite Plugin
 *
 * This module provides the integration between Avalon's Vite plugin and Nitro,
 * enabling unified development experience with universal deployment capabilities.
 * It generates virtual modules for routes and coordinates between Vite and Nitro.
 *
 * @module vite-plugin/nitro-integration
 */

import type { Plugin, ViteDevServer } from "vite";
import type { ResolvedAvalonConfig } from "./types.ts";
import {
  createNitroConfig,
  type AvalonNitroConfig,
  type NitroConfigOutput,
} from "../nitro/config.ts";
import {
  discoverRoutes,
  discoverPageRoutes,
  discoverApiRoutes,
  type DiscoveredRoute,
} from "../nitro/route-discovery.ts";
import {
  createNitroBuildPlugin,
  createIslandManifestPlugin,
  createSourceMapPlugin,
  createSourceMapConfig,
} from "../nitro/index.ts";

/**
 * Virtual module IDs for Nitro integration
 */
export const VIRTUAL_MODULE_IDS = {
  /** Virtual module containing discovered page routes */
  PAGE_ROUTES: "virtual:avalon/page-routes",
  /** Virtual module containing discovered API routes */
  API_ROUTES: "virtual:avalon/api-routes",
  /** Virtual module containing the island manifest */
  ISLAND_MANIFEST: "virtual:avalon/island-manifest",
  /** Virtual module containing runtime configuration */
  RUNTIME_CONFIG: "virtual:avalon/runtime-config",
} as const;

/**
 * Resolved virtual module IDs (with null byte prefix)
 */
export const RESOLVED_VIRTUAL_IDS = {
  PAGE_ROUTES: "\0" + VIRTUAL_MODULE_IDS.PAGE_ROUTES,
  API_ROUTES: "\0" + VIRTUAL_MODULE_IDS.API_ROUTES,
  ISLAND_MANIFEST: "\0" + VIRTUAL_MODULE_IDS.ISLAND_MANIFEST,
  RUNTIME_CONFIG: "\0" + VIRTUAL_MODULE_IDS.RUNTIME_CONFIG,
} as const;

/**
 * Result of creating Nitro integration
 */
export interface NitroIntegrationResult {
  /** Nitro configuration options */
  nitroOptions: NitroConfigOutput;
  /** Vite plugins for Nitro coordination */
  plugins: Plugin[];
}

/**
 * Options for the Nitro coordination plugin
 */
export interface NitroCoordinationPluginOptions {
  /** Resolved Avalon configuration */
  avalonConfig: ResolvedAvalonConfig;
  /** Nitro-specific configuration */
  nitroConfig: AvalonNitroConfig;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Creates the Nitro integration for Avalon
 *
 * This function creates the Nitro configuration and Vite plugins needed
 * to coordinate Avalon with Nitro. It handles:
 * - Generating Nitro configuration from Avalon settings
 * - Creating virtual modules for route discovery
 * - Storing Vite dev server reference for SSR
 * - Coordinating HMR between Vite and Nitro
 *
 * @param avalonConfig - Resolved Avalon plugin configuration
 * @param nitroConfig - Nitro-specific configuration options
 * @returns Nitro configuration and Vite plugins
 *
 * @example
 * ```ts
 * const { nitroOptions, plugins } = createNitroIntegration(
 *   resolvedAvalonConfig,
 *   { preset: 'vercel', streaming: true }
 * );
 * ```
 */
export function createNitroIntegration(
  avalonConfig: ResolvedAvalonConfig,
  nitroConfig: AvalonNitroConfig = {}
): NitroIntegrationResult {
  // Create Nitro configuration from Avalon config
  const nitroOptions = createNitroConfig(nitroConfig, avalonConfig);

  // Create coordination plugin
  const coordinationPlugin = createNitroCoordinationPlugin({
    avalonConfig,
    nitroConfig,
    verbose: avalonConfig.verbose,
  });

  // Create virtual modules plugin
  const virtualModulesPlugin = createVirtualModulesPlugin({
    avalonConfig,
    nitroConfig,
    verbose: avalonConfig.verbose,
  });

  // Create build plugin for production builds
  const buildPlugin = createNitroBuildPlugin(avalonConfig, nitroConfig);

  // Create island manifest plugin for production builds
  const manifestPlugin = createIslandManifestPlugin(avalonConfig, {
    verbose: avalonConfig.verbose,
    generatePreloadHints: true,
  });

  // Create source map plugin for debugging support
  const sourceMapConfig = createSourceMapConfig(
    nitroConfig.preset ?? "node-server",
    avalonConfig.isDev
  );
  const sourceMapPlugin = createSourceMapPlugin(sourceMapConfig);

  return {
    nitroOptions,
    plugins: [coordinationPlugin, virtualModulesPlugin, buildPlugin, manifestPlugin, sourceMapPlugin],
  };
}

/**
 * Creates the Nitro coordination plugin
 *
 * This plugin handles:
 * - Storing resolved config globally for Nitro handlers
 * - Storing Vite dev server reference for SSR module loading
 * - Coordinating HMR between Vite and Nitro
 * - Setting up SSR middleware for development
 *
 * @param options - Plugin options
 * @returns Vite plugin for Nitro coordination
 */
export function createNitroCoordinationPlugin(
  options: NitroCoordinationPluginOptions
): Plugin {
  const { avalonConfig, verbose } = options;

  return {
    name: "avalon:nitro-coordination",
    enforce: "pre",

    /**
     * Called when Vite's config is resolved
     * Store resolved config globally for Nitro handlers
     */
    configResolved(_config) {
      // Store Avalon config globally for Nitro handlers to access
      globalThis.__avalonConfig = avalonConfig;

      if (verbose) {
        console.log("🚀 Avalon Nitro coordination initialized");
        console.log(`   Preset: ${options.nitroConfig.preset ?? "node-server"}`);
        console.log(`   Streaming: ${options.nitroConfig.streaming ?? true}`);
      }
    },

    /**
     * Called when the dev server is being configured
     * Store Vite dev server reference for SSR module loading
     * Set up SSR middleware for handling page requests
     */
    configureServer(server: ViteDevServer) {
      // Store server reference globally for SSR module loading
      // This is used by Nitro handlers to load and transform modules
      globalThis.__viteDevServer = server;

      if (verbose) {
        console.log("🚀 Vite dev server reference stored for Nitro SSR");
      }

      // Set up HMR coordination
      setupHMRCoordination(server, avalonConfig, verbose);

      // Add SSR middleware BEFORE Vite's internal middleware
      // This ensures our SSR handler runs for page requests before Vite's SPA fallback
      if (verbose) {
        console.log("🚀 Avalon SSR middleware registered");
      }
      
      server.middlewares.use(async (req, res, next) => {
        const originalUrl = req.url || "/";
        let url = originalUrl;
        
        // Normalize URL - remove .html suffix for page routing
        if (url.endsWith(".html")) {
          url = url.slice(0, -5) || "/";
        }
        if (url === "/index") {
          url = "/";
        }
        
        // Skip requests for static files, HMR, and Vite internals
        if (
          url.startsWith("/@") ||
          url.startsWith("/__") ||
          url.startsWith("/node_modules/") ||
          url.startsWith("/src/client/") ||
          url.startsWith("/packages/") ||
          (url.includes(".") && !url.endsWith("/"))
        ) {
          return next();
        }

        // Handle API routes separately
        if (url.startsWith("/api/")) {
          if (verbose) {
            console.log(`🔌 API handling: ${url}`);
          }
          try {
            const apiResponse = await handleApiRequest(server, url, req, avalonConfig, verbose);
            if (apiResponse) {
              res.statusCode = apiResponse.status;
              for (const [key, value] of Object.entries(apiResponse.headers)) {
                res.setHeader(key, value);
              }
              res.end(apiResponse.body);
              return;
            }
          } catch (error) {
            console.error("[API Error]", error);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Internal Server Error" }));
            return;
          }
          // API route not found, return 404
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Not Found" }));
          return;
        }

        if (verbose) {
          console.log(`🔍 SSR handling: ${url}`);
        }

        try {
          // Try to handle as SSR request
          const html = await handleSSRRequest(server, url, avalonConfig, verbose);
          
          if (html) {
            if (verbose) {
              console.log(`✅ SSR rendered: ${url}`);
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html");
            res.end(html);
            return;
          }
          
          if (verbose) {
            console.log(`❌ No page found for: ${url}`);
          }
        } catch (error) {
          // Log error and continue to next middleware
          console.error("[SSR Error]", error);
          
          // In development, show error page
          if (avalonConfig.isDev) {
            const errorHtml = generateErrorPage(error as Error);
            res.statusCode = 500;
            res.setHeader("Content-Type", "text/html");
            res.end(errorHtml);
            return;
          }
        }

        // Fall through to next middleware (404 handling)
        next();
      });
    },

    /**
     * Called when the build starts
     * Log Nitro integration status
     */
    buildStart() {
      if (verbose) {
        console.log("🚀 Avalon Nitro build starting...");
      }
    },
  };
}

/**
 * Creates the virtual modules plugin for Nitro
 *
 * This plugin generates virtual modules that provide:
 * - Discovered page routes
 * - Discovered API routes
 * - Island manifest
 * - Runtime configuration
 *
 * @param options - Plugin options
 * @returns Vite plugin for virtual modules
 */
export function createVirtualModulesPlugin(
  options: NitroCoordinationPluginOptions
): Plugin {
  const { avalonConfig, nitroConfig, verbose } = options;

  // Cache for discovered routes
  let cachedPageRoutes: DiscoveredRoute[] | null = null;
  let cachedApiRoutes: DiscoveredRoute[] | null = null;

  return {
    name: "avalon:nitro-virtual-modules",
    enforce: "pre",

    /**
     * Resolve virtual module IDs
     */
    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_IDS.PAGE_ROUTES) {
        return RESOLVED_VIRTUAL_IDS.PAGE_ROUTES;
      }
      if (id === VIRTUAL_MODULE_IDS.API_ROUTES) {
        return RESOLVED_VIRTUAL_IDS.API_ROUTES;
      }
      if (id === VIRTUAL_MODULE_IDS.ISLAND_MANIFEST) {
        return RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST;
      }
      if (id === VIRTUAL_MODULE_IDS.RUNTIME_CONFIG) {
        return RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG;
      }
      return null;
    },

    /**
     * Load virtual module content
     */
    async load(id: string) {
      if (id === RESOLVED_VIRTUAL_IDS.PAGE_ROUTES) {
        return await generatePageRoutesModule(avalonConfig, verbose);
      }
      if (id === RESOLVED_VIRTUAL_IDS.API_ROUTES) {
        return await generateApiRoutesModule(avalonConfig, verbose);
      }
      if (id === RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST) {
        return generateIslandManifestModule(avalonConfig);
      }
      if (id === RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG) {
        return generateRuntimeConfigModule(avalonConfig, nitroConfig);
      }
      return null;
    },

    /**
     * Handle HMR for virtual modules
     * Invalidate cached routes when files change
     */
    handleHotUpdate({ file, server }) {
      const pagesDir = avalonConfig.pagesDir;
      const apiDir = avalonConfig.apiDir;

      // Check if the changed file is in pages or API directory
      if (file.includes(pagesDir)) {
        cachedPageRoutes = null;
        // Invalidate the virtual module
        const mod = server.moduleGraph.getModuleById(
          RESOLVED_VIRTUAL_IDS.PAGE_ROUTES
        );
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
        if (verbose) {
          console.log("🔄 Page routes invalidated due to file change:", file);
        }
      }

      if (file.includes(apiDir)) {
        cachedApiRoutes = null;
        // Invalidate the virtual module
        const mod = server.moduleGraph.getModuleById(
          RESOLVED_VIRTUAL_IDS.API_ROUTES
        );
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
        if (verbose) {
          console.log("🔄 API routes invalidated due to file change:", file);
        }
      }

      return undefined;
    },
  };
}

/**
 * Sets up HMR coordination between Vite and Nitro
 *
 * @param server - Vite dev server
 * @param config - Resolved Avalon configuration
 * @param verbose - Enable verbose logging
 */
function setupHMRCoordination(
  server: ViteDevServer,
  config: ResolvedAvalonConfig,
  verbose?: boolean
): void {
  // Listen for HMR updates
  server.watcher.on("change", (file) => {
    // Check if the file is a server-side file that needs Nitro reload
    const isServerFile =
      file.includes("/server/") ||
      file.includes("/api/") ||
      file.includes("_middleware");

    if (isServerFile && verbose) {
      console.log("🔄 Server file changed, Nitro will reload:", file);
    }
  });

  // Listen for file additions/deletions that affect routes
  server.watcher.on("add", (file) => {
    if (
      file.includes(config.pagesDir) ||
      file.includes(config.apiDir)
    ) {
      if (verbose) {
        console.log("📄 New route file detected:", file);
      }
    }
  });

  server.watcher.on("unlink", (file) => {
    if (
      file.includes(config.pagesDir) ||
      file.includes(config.apiDir)
    ) {
      if (verbose) {
        console.log("🗑️ Route file removed:", file);
      }
    }
  });
}

/**
 * Generates the page routes virtual module
 *
 * @param config - Resolved Avalon configuration
 * @param verbose - Enable verbose logging
 * @returns Generated module code
 */
async function generatePageRoutesModule(
  config: ResolvedAvalonConfig,
  verbose?: boolean
): Promise<string> {
  try {
    const routes = await discoverPageRoutes(config.pagesDir, {
      developmentMode: config.isDev,
    });

    if (verbose) {
      console.log(`📄 Discovered ${routes.length} page route(s)`);
    }

    // Generate module that exports the routes
    const routesJson = JSON.stringify(routes, null, 2);

    return `
/**
 * Auto-generated page routes module
 * This file is generated by Avalon's Nitro integration
 */

export const pageRoutes = ${routesJson};

export default pageRoutes;
`;
  } catch (error) {
    console.warn("[nitro-integration] Failed to discover page routes:", error);
    return `
export const pageRoutes = [];
export default pageRoutes;
`;
  }
}

/**
 * Generates the API routes virtual module
 *
 * @param config - Resolved Avalon configuration
 * @param verbose - Enable verbose logging
 * @returns Generated module code
 */
async function generateApiRoutesModule(
  config: ResolvedAvalonConfig,
  verbose?: boolean
): Promise<string> {
  try {
    const routes = await discoverApiRoutes(config.apiDir, {
      developmentMode: config.isDev,
    });

    if (verbose) {
      console.log(`📄 Discovered ${routes.length} API route(s)`);
    }

    // Generate module that exports the routes
    const routesJson = JSON.stringify(routes, null, 2);

    return `
/**
 * Auto-generated API routes module
 * This file is generated by Avalon's Nitro integration
 */

export const apiRoutes = ${routesJson};

export default apiRoutes;
`;
  } catch (error) {
    console.warn("[nitro-integration] Failed to discover API routes:", error);
    return `
export const apiRoutes = [];
export default apiRoutes;
`;
  }
}

/**
 * Generates the island manifest virtual module
 *
 * @param config - Resolved Avalon configuration
 * @returns Generated module code
 */
function generateIslandManifestModule(config: ResolvedAvalonConfig): string {
  // In development, the manifest is empty - islands are loaded dynamically
  // In production, this will be populated during the build process
  return `
/**
 * Auto-generated island manifest module
 * This file is generated by Avalon's Nitro integration
 * 
 * In development: Islands are loaded dynamically via Vite
 * In production: This contains the compiled island paths
 */

export const islandManifest = {
  islands: {},
  clientEntry: "",
  css: [],
};

export default islandManifest;
`;
}

/**
 * Generates the runtime configuration virtual module
 *
 * @param avalonConfig - Resolved Avalon configuration
 * @param nitroConfig - Nitro-specific configuration
 * @returns Generated module code
 */
function generateRuntimeConfigModule(
  avalonConfig: ResolvedAvalonConfig,
  nitroConfig: AvalonNitroConfig
): string {
  const runtimeConfig = {
    avalon: {
      streaming: nitroConfig.streaming ?? true,
      pagesDir: avalonConfig.pagesDir,
      apiDir: avalonConfig.apiDir,
      islandsDir: avalonConfig.islandsDir,
      isDev: avalonConfig.isDev,
    },
    ...nitroConfig.runtimeConfig,
  };

  return `
/**
 * Auto-generated runtime configuration module
 * This file is generated by Avalon's Nitro integration
 */

export const runtimeConfig = ${JSON.stringify(runtimeConfig, null, 2)};

export function useRuntimeConfig() {
  return runtimeConfig;
}

export default runtimeConfig;
`;
}

/**
 * Gets the Vite dev server reference
 *
 * @returns The Vite dev server, or undefined if not available
 */
export function getViteDevServer(): ViteDevServer | undefined {
  return globalThis.__viteDevServer;
}

/**
 * Gets the resolved Avalon configuration
 *
 * @returns The resolved Avalon configuration, or undefined if not available
 */
export function getAvalonConfig(): ResolvedAvalonConfig | undefined {
  return globalThis.__avalonConfig;
}

/**
 * Checks if running in development mode
 *
 * @returns True if in development mode
 */
export function isDevelopmentMode(): boolean {
  return globalThis.__avalonConfig?.isDev ?? true;
}

/**
 * Handles SSR requests in development mode
 *
 * @param server - Vite dev server
 * @param url - Request URL
 * @param config - Resolved Avalon configuration
 * @param verbose - Enable verbose logging
 * @returns Rendered HTML or null if not a page route
 */
async function handleSSRRequest(
  server: ViteDevServer,
  url: string,
  config: ResolvedAvalonConfig,
  verbose?: boolean
): Promise<string | null> {
  // Parse the URL to get pathname
  const pathname = url.split("?")[0];

  if (verbose) {
    console.log(`🔍 SSR request: ${pathname}, pagesDir: ${config.pagesDir}, root: ${server.config.root}`);
  }

  // Try to find a matching page route
  const pageFile = await findPageFile(pathname, config.pagesDir, server);

  if (!pageFile) {
    if (verbose) {
      console.log(`   No page found for: ${pathname}`);
    }
    return null;
  }

  if (verbose) {
    console.log(`   Found page: ${pageFile}`);
  }

  try {
    // Load the page module through Vite
    const pageModule = await server.ssrLoadModule(pageFile);

    // Get the default export (the page component)
    const PageComponent = pageModule.default;

    if (!PageComponent) {
      console.warn(`[SSR] Page ${pageFile} has no default export`);
      return null;
    }

    if (verbose) {
      console.log(`   Rendering page component...`);
    }

    // Render the page using the existing SSR pipeline
    const html = await renderPageToHtml(
      PageComponent,
      pageModule,
      pathname,
      config,
      server
    );

    if (verbose) {
      console.log(`   Rendered ${html.length} bytes`);
    }

    return html;
  } catch (error) {
    console.error(`[SSR] Error rendering ${pageFile}:`, error);
    throw error;
  }
}

/**
 * Finds the page file for a given pathname
 *
 * @param pathname - URL pathname
 * @param pagesDir - Pages directory
 * @param server - Vite dev server
 * @returns Page file path or null
 */
async function findPageFile(
  pathname: string,
  pagesDir: string,
  server: ViteDevServer
): Promise<string | null> {
  // Normalize pathname - remove trailing slash and handle root
  let normalizedPath = pathname;
  if (normalizedPath.endsWith("/") && normalizedPath !== "/") {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  if (normalizedPath === "/") {
    normalizedPath = "/index";
  }

  // Possible file extensions
  const extensions = [".tsx", ".ts", ".jsx", ".js", ".mdx", ".md"];

  // Get the Vite root directory for resolving paths
  const viteRoot = server.config.root || Deno.cwd();

  // Build possible file paths
  const possiblePaths: string[] = [];

  // Direct file match (e.g., /about -> src/pages/about.tsx)
  for (const ext of extensions) {
    // Use path relative to Vite root
    const relativePath = `${pagesDir}${normalizedPath}${ext}`;
    possiblePaths.push(relativePath);
  }

  // Index file in directory (e.g., /about -> src/pages/about/index.tsx)
  if (!normalizedPath.endsWith("/index")) {
    for (const ext of extensions) {
      const relativePath = `${pagesDir}${normalizedPath}/index${ext}`;
      possiblePaths.push(relativePath);
    }
  }

  // Try each possible path using file system check
  for (const relativePath of possiblePaths) {
    try {
      // Resolve the full path relative to Vite root
      const fullPath = `${viteRoot}/${relativePath}`;
      
      // Use Deno's file system API to check if file exists
      const stat = await Deno.stat(fullPath);
      if (stat.isFile) {
        // Return the path that Vite can use for module loading
        // Vite expects paths starting with / to be relative to root
        return `/${relativePath}`;
      }
    } catch {
      // File doesn't exist, continue to next path
    }
  }

  return null;
}

/**
 * Renders a page component to HTML with layout support
 *
 * @param PageComponent - The page component
 * @param pageModule - The page module
 * @param pathname - URL pathname
 * @param config - Resolved Avalon configuration
 * @param server - Vite dev server
 * @returns Rendered HTML
 */
async function renderPageToHtml(
  PageComponent: unknown,
  pageModule: Record<string, unknown>,
  pathname: string,
  config: ResolvedAvalonConfig,
  server: ViteDevServer
): Promise<string> {
  // Get page metadata if available
  const metadata = (pageModule.metadata || {}) as {
    title?: string;
    description?: string;
  };

  // Try to use the existing renderToHtml from the SSR module
  // The path needs to be relative to the workspace root, not the Vite root
  try {
    // Try loading from the packages directory relative to workspace
    const ssrModulePath = "../packages/avalon/src/render/ssr.ts";
    const ssrModule = await server.ssrLoadModule(ssrModulePath);

    // Try to load the layout resolver
    const layoutModulePath = "../packages/avalon/src/core/layout/enhanced-layout-resolver.ts";
    const layoutModule = await server.ssrLoadModule(layoutModulePath);

    // Create a route config for the SSR pipeline
    const routeConfig = {
      component: () => {
        // If PageComponent is a function, call it
        if (typeof PageComponent === "function") {
          return (PageComponent as () => unknown)();
        }
        return PageComponent;
      },
      options: {
        title: metadata.title || "Avalon App",
      },
      frontmatter: pageModule.frontmatter as Record<string, unknown> | undefined,
    };

    // Try to use layout-aware rendering if available
    if (ssrModule.renderToHtmlWithLayouts && layoutModule.EnhancedLayoutResolver && layoutModule.EnhancedLayoutResolverUtils) {
      try {
        // Get the Vite root to resolve layout directory
        const viteRoot = server.config.root || Deno.cwd();
        
        // Use cached layout resolver or create a new one
        if (!globalThis.__avalonLayoutResolver) {
          const layoutBaseDirectory = `${viteRoot}/src`;
          globalThis.__avalonLayoutResolver = new layoutModule.EnhancedLayoutResolver({
            ...layoutModule.EnhancedLayoutResolverUtils.createDevelopmentConfig(layoutBaseDirectory),
            baseDirectory: `${viteRoot}/src/layouts`,
            // Disable expensive features for faster rendering
            enableMetrics: false,
            enableDebugInfo: false,
          });
        }
        const layoutResolver = globalThis.__avalonLayoutResolver;

        // Create layout context with a full URL (required by the layout resolver)
        const fullUrl = `http://localhost${pathname}`;
        const layoutContext = {
          params: {},
          query: {},
          url: fullUrl,
          request: {
            method: "GET",
            url: fullUrl,
            headers: new Headers(),
          },
        };

        if (config.verbose) {
          console.log(`   Using layout-aware rendering for: ${pathname}`);
        }

        // Use layout-aware rendering
        const html = await ssrModule.renderToHtmlWithLayouts(
          routeConfig,
          layoutResolver,
          layoutContext,
          pathname,
          { title: metadata.title || "Avalon App" },
          undefined, // viteHmrPort
          { suppressWarnings: true }
        );

        return html;
      } catch (layoutError) {
        // Layout rendering failed, fall back to basic rendering
        if (config.verbose) {
          console.warn("[SSR] Layout rendering failed, falling back to basic rendering:", layoutError);
        }
      }
    }

    // Fall back to basic renderToHtml without layouts
    if (ssrModule.renderToHtml) {
      const html = await ssrModule.renderToHtml(
        routeConfig,
        { title: metadata.title || "Avalon App" },
        undefined, // viteHmrPort - not needed in dev
        { suppressWarnings: true }
      );

      return html;
    }
  } catch (error) {
    // SSR module not available, fall back to basic rendering
    if (config.verbose) {
      console.warn("[SSR] Could not load SSR module:", error);
    }
  }

  // Fall back to basic HTML template
  // This is a simplified version - the full SSR pipeline handles islands, layouts, etc.
  const title = metadata.title || "Avalon App";
  const description = metadata.description || "";

  // Try to render the component using preact-render-to-string
  let content = "";
  try {
    const preactRenderModule = await server.ssrLoadModule("preact-render-to-string");
    if (preactRenderModule.render && typeof PageComponent === "function") {
      const element = (PageComponent as () => unknown)();
      content = preactRenderModule.render(element);
    }
  } catch {
    content = `<p>Loading page: ${escapeHtml(pathname)}</p>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
    <script type="module" src="/@vite/client"></script>
  </head>
  <body>
    <div id="app">
      ${content}
    </div>
    <script type="module" src="/src/client/main.js"></script>
  </body>
</html>`;
}

/**
 * Generates an error page for development
 *
 * @param error - The error that occurred
 * @returns HTML error page
 */
function generateErrorPage(error: Error): string {
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
      h1 {
        color: #ff6b6b;
        margin-top: 0;
        font-size: 24px;
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
      <h1>SSR Error</h1>
      <p class="message">${escapeHtml(error.message)}</p>
      ${error.stack ? `
      <div class="stack-title">Stack Trace</div>
      <pre>${escapeHtml(error.stack)}</pre>
      ` : ""}
    </div>
    <script type="module" src="/@vite/client"></script>
  </body>
</html>`;
}

/**
 * Escapes HTML special characters
 *
 * @param str - String to escape
 * @returns Escaped string
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
 * API response interface
 */
interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Handles API requests in development mode
 *
 * @param server - Vite dev server
 * @param url - Request URL
 * @param req - HTTP request
 * @param config - Resolved Avalon configuration
 * @param verbose - Enable verbose logging
 * @returns API response or null if not found
 */
async function handleApiRequest(
  server: ViteDevServer,
  url: string,
  req: { method?: string },
  config: ResolvedAvalonConfig,
  verbose?: boolean
): Promise<ApiResponse | null> {
  // Parse the URL to get pathname
  const pathname = url.split("?")[0];
  const method = req.method || "GET";

  if (verbose) {
    console.log(`🔌 API request: ${method} ${pathname}`);
  }

  // Try to find a matching API route
  const apiFile = await findApiFile(pathname, config.apiDir, server);

  if (!apiFile) {
    if (verbose) {
      console.log(`   No API route found for: ${pathname}`);
    }
    return null;
  }

  if (verbose) {
    console.log(`   Found API: ${apiFile}`);
  }

  try {
    // Load the API module through Vite
    const apiModule = await server.ssrLoadModule(apiFile);

    // Get the handler for the HTTP method
    const handler = apiModule[method] || apiModule[method.toLowerCase()] || apiModule.default;

    if (!handler || typeof handler !== "function") {
      if (verbose) {
        console.log(`   No handler for ${method} in ${apiFile}`);
      }
      return {
        status: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    // Create a Request object for the API handler
    // The handler expects a standard Request object
    const fullUrl = `http://localhost:8012${url}`;
    const request = new Request(fullUrl, {
      method,
      headers: new Headers(),
    });

    // Call the handler with the Request object
    const result = await handler(request);

    // Handle different response types
    if (result instanceof Response) {
      const body = await result.text();
      const headers: Record<string, string> = {};
      result.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return {
        status: result.status,
        headers,
        body,
      };
    }

    // Plain object - serialize as JSON
    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error(`[API] Error handling ${apiFile}:`, error);
    throw error;
  }
}

/**
 * Finds the API file for a given pathname
 *
 * @param pathname - URL pathname (e.g., /api/hello)
 * @param apiDir - API directory (e.g., src/api)
 * @param server - Vite dev server
 * @returns API file path or null
 */
async function findApiFile(
  pathname: string,
  apiDir: string,
  server: ViteDevServer
): Promise<string | null> {
  // Remove /api prefix to get the route path
  const routePath = pathname.replace(/^\/api/, "") || "/index";

  // Possible file extensions
  const extensions = [".ts", ".js"];

  // Get the Vite root directory for resolving paths
  const viteRoot = server.config.root || Deno.cwd();

  // Build possible file paths
  const possiblePaths: string[] = [];

  // Direct file match (e.g., /api/hello -> src/api/hello.ts)
  for (const ext of extensions) {
    const relativePath = `${apiDir}${routePath}${ext}`;
    possiblePaths.push(relativePath);
  }

  // Index file in directory (e.g., /api/users -> src/api/users/index.ts)
  if (!routePath.endsWith("/index")) {
    for (const ext of extensions) {
      const relativePath = `${apiDir}${routePath}/index${ext}`;
      possiblePaths.push(relativePath);
    }
  }

  // Try each possible path using file system check
  for (const relativePath of possiblePaths) {
    try {
      const fullPath = `${viteRoot}/${relativePath}`;
      const stat = await Deno.stat(fullPath);
      if (stat.isFile) {
        return `/${relativePath}`;
      }
    } catch {
      // File doesn't exist, continue to next path
    }
  }

  return null;
}

// Declare global types for cached instances
declare global {
  // deno-lint-ignore no-var
  var __avalonLayoutResolver: unknown;
}
