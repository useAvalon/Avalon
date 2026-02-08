/**
 * Nitro Integration Module for Avalon Vite Plugin
 *
 * Provides coordination between Avalon's Vite plugin and Nitro:
 * - API routes: Auto-discovered by Nitro from `api/` directory
 * - Page routes: Virtual module for SSR page component discovery
 * - Middleware: Auto-discovered by Nitro from `middleware/` directory
 */

import type { Plugin, ViteDevServer } from "vite";
import type { ResolvedAvalonConfig } from "./types.ts";
import {
  createNitroConfig,
  type AvalonNitroConfig,
  type NitroConfigOutput,
} from "../nitro/config.ts";
import {
  discoverPageRoutes,
} from "../nitro/route-discovery.ts";
import type { DiscoveredRoute, PageModule } from "../nitro/types.ts";
import {
  createNitroBuildPlugin,
  createIslandManifestPlugin,
  createSourceMapPlugin,
  createSourceMapConfig,
} from "../nitro/index.ts";
import {
  discoverScopedMiddleware,
  executeScopedMiddleware,
  clearMiddlewareCache,
} from "../middleware/index.ts";
import type { MiddlewareRoute } from "../middleware/types.ts";
import type { H3Event } from "h3";
import { generateErrorPage, generateFallback404 } from "../render/error-pages.ts";

export const VIRTUAL_MODULE_IDS = {
  PAGE_ROUTES: "virtual:avalon/page-routes",
  ISLAND_MANIFEST: "virtual:avalon/island-manifest",
  RUNTIME_CONFIG: "virtual:avalon/runtime-config",
} as const;

export const RESOLVED_VIRTUAL_IDS = {
  PAGE_ROUTES: "\0" + VIRTUAL_MODULE_IDS.PAGE_ROUTES,
  ISLAND_MANIFEST: "\0" + VIRTUAL_MODULE_IDS.ISLAND_MANIFEST,
  RUNTIME_CONFIG: "\0" + VIRTUAL_MODULE_IDS.RUNTIME_CONFIG,
} as const;

export interface NitroIntegrationResult {
  nitroOptions: NitroConfigOutput;
  plugins: Plugin[];
}

export interface NitroCoordinationPluginOptions {
  avalonConfig: ResolvedAvalonConfig;
  nitroConfig: AvalonNitroConfig;
  verbose?: boolean;
}

/**
 * Creates the Nitro integration for Avalon — configuration, virtual modules,
 * build plugins, and SSR coordination.
 */
export function createNitroIntegration(
  avalonConfig: ResolvedAvalonConfig,
  nitroConfig: AvalonNitroConfig = {}
): NitroIntegrationResult {
  const nitroOptions = createNitroConfig(nitroConfig, avalonConfig);

  const coordinationPlugin = createNitroCoordinationPlugin({
    avalonConfig,
    nitroConfig,
    verbose: avalonConfig.verbose,
  });

  const virtualModulesPlugin = createVirtualModulesPlugin({
    avalonConfig,
    nitroConfig,
    verbose: avalonConfig.verbose,
  });

  const buildPlugin = createNitroBuildPlugin(avalonConfig, nitroConfig);

  const manifestPlugin = createIslandManifestPlugin(avalonConfig, {
    verbose: avalonConfig.verbose,
    generatePreloadHints: true,
  });

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
 * Coordination plugin: stores config/server refs, sets up SSR middleware and HMR,
 * and prewarms core infrastructure modules (fire-and-forget).
 */
export function createNitroCoordinationPlugin(
  options: NitroCoordinationPluginOptions
): Plugin {
  const { avalonConfig, verbose } = options;

  return {
    name: "avalon:nitro-coordination",
    enforce: "pre",

    configResolved(_config) {
      globalThis.__avalonConfig = avalonConfig;
    },

    configureServer(server: ViteDevServer) {
      globalThis.__viteDevServer = server;

      // Scoped middleware — discovered once, cached until invalidated by HMR
      let scopedMiddlewareRoutes: MiddlewareRoute[] | null = null;

      async function getScopedMiddleware(): Promise<MiddlewareRoute[]> {
        if (!scopedMiddlewareRoutes) {
          const viteRoot = server.config.root || Deno.cwd();
          scopedMiddlewareRoutes = await discoverScopedMiddleware({
            baseDir: `${viteRoot}/src`,
            devMode: verbose,
          });
        }
        return scopedMiddlewareRoutes;
      }

      function clearScopedMiddlewareRoutes(): void {
        scopedMiddlewareRoutes = null;
      }

      setupHMRCoordination(server, avalonConfig, verbose, clearScopedMiddlewareRoutes);

      // Pre-discover middleware (non-blocking)
      getScopedMiddleware().catch((err) => {
        console.warn("[middleware] Failed to discover middleware:", err);
      });

      // Fire-and-forget: prewarm only core infrastructure modules.
      // Pages, islands, and per-route middleware are loaded on-demand.
      prewarmCoreModules(server, verbose).catch((err) => {
        console.error("[prewarm] Core modules pre-warm failed:", err);
      });

      // SSR middleware — runs before Vite's SPA fallback
      server.middlewares.use(async (req, res, next) => {
        const originalUrl = req.url || "/";
        let url = originalUrl;

        if (url.endsWith(".html")) {
          url = url.slice(0, -5) || "/";
        }
        if (url === "/index") {
          url = "/";
        }

        // Skip static files, HMR, and Vite internals
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

        // API routes
        if (url.startsWith("/api/")) {
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
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Not Found" }));
          return;
        }

        try {
          // Execute scoped middleware
          const middlewareStart = performance.now();
          const middlewareRoutes = await getScopedMiddleware();

          if (middlewareRoutes.length > 0) {
            const headers: Record<string, string> = {};
            const rawHeaders = req.headers;
            if (rawHeaders) {
              for (const [key, value] of Object.entries(rawHeaders)) {
                if (typeof value === 'string') {
                  headers[key] = value;
                } else if (Array.isArray(value)) {
                  headers[key] = value.join(', ');
                }
              }
            }

            const h3Event = {
              method: req.method || 'GET',
              path: url,
              node: { req: { url, headers }, res: {} },
              context: {} as Record<string, unknown>,
            } as unknown as H3Event;

            const middlewareResponse = await executeScopedMiddleware(
              h3Event,
              middlewareRoutes,
              { devMode: verbose }
            );

            const middlewareTime = performance.now() - middlewareStart;
            if (middlewareTime > 100) {
              console.warn(`⚠️ Slow middleware: ${middlewareTime.toFixed(0)}ms for ${url}`);
            }

            if (middlewareResponse) {
              res.statusCode = middlewareResponse.status;
              middlewareResponse.headers.forEach((value, key) => {
                res.setHeader(key, value);
              });
              const body = await middlewareResponse.text();
              res.end(body);
              return;
            }
          }

          // SSR rendering
          const html = await handleSSRRequest(server, url, avalonConfig);

          if (html) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html");
            res.end(html);
            return;
          }

          // 404 — try custom page, then fallback
          try {
            const { discoverErrorPages, getErrorPageModule, generateDefaultErrorPage } = await import("../nitro/error-handler.ts");

            const errorPages = await discoverErrorPages({
              isDev: avalonConfig.isDev,
              pagesDir: avalonConfig.pagesDir,
              loadPageModule: async (filePath: string): Promise<PageModule> => {
                return await server.ssrLoadModule(filePath) as PageModule;
              },
            });
            const errorPageModule = getErrorPageModule(404, errorPages);

            if (errorPageModule?.default && typeof errorPageModule.default === 'function') {
              const { renderToHtml } = await import("../render/ssr.ts");
              const ErrorPageComponent = errorPageModule.default;
              const errorHtml = await renderToHtml(
                { component: () => ErrorPageComponent({ statusCode: 404, message: `Page not found: ${url}`, url }) },
                {}
              );
              res.statusCode = 404;
              res.setHeader("Content-Type", "text/html");
              res.end(errorHtml);
              return;
            }

            const fallbackHtml = generateDefaultErrorPage(404, `Page not found: ${url}`, avalonConfig.isDev);
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/html");
            res.end(fallbackHtml);
          } catch {
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/html");
            res.end(generateFallback404(url));
          }
        } catch (error) {
          console.error("[SSR Error]", error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/html");
          res.end(generateErrorPage(error as Error));
        }
      });
    },

    buildStart() {
      // no-op in production — coordination happens via other plugins
    },
  };
}

/**
 * Prewarms only core infrastructure modules (fire-and-forget).
 * Pages, islands, and per-route middleware are loaded on-demand.
 */
async function prewarmCoreModules(server: ViteDevServer, verbose?: boolean): Promise<void> {
  const prewarmStart = performance.now();

  const coreModules = [
    // SSR infrastructure
    { path: "../packages/avalon/src/render/ssr.ts", assignTo: "ssr" },
    { path: "../packages/avalon/src/core/layout/enhanced-layout-resolver.ts", assignTo: "layout" },
    { path: "../packages/avalon/src/middleware/index.ts", assignTo: null },
    // Framework renderers
    { path: "../packages/integrations/react/server/renderer.ts", assignTo: null },
    { path: "../packages/integrations/vue/server/renderer.ts", assignTo: null },
    { path: "../packages/integrations/solid/server/renderer.ts", assignTo: null },
    { path: "../packages/integrations/svelte/server/renderer.ts", assignTo: null },
    { path: "../packages/integrations/lit/server/renderer.ts", assignTo: null },
    { path: "../packages/integrations/preact/server/renderer.ts", assignTo: null },
  ];

  const results = await Promise.allSettled(
    coreModules.map(async ({ path, assignTo }) => {
      const mod = await server.ssrLoadModule(path);
      if (assignTo === "ssr") cachedSSRModule = mod;
      if (assignTo === "layout") cachedLayoutModule = mod;
    })
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results
    .map((r, i) => r.status === 'rejected' ? coreModules[i].path : null)
    .filter(Boolean);
  const totalTime = performance.now() - prewarmStart;

  if (failed.length > 0) {
    console.warn(`⚠️ Failed to prewarm: ${failed.join(', ')}`);
  }
  if (verbose) {
    console.log(`🔥 SSR ready in ${totalTime.toFixed(0)}ms (${succeeded}/${coreModules.length} core modules)`);
  }
}

/**
 * Virtual modules plugin — page routes, island manifest, runtime config.
 */
export function createVirtualModulesPlugin(
  options: NitroCoordinationPluginOptions
): Plugin {
  const { avalonConfig, nitroConfig, verbose } = options;
  let cachedPageRoutes: DiscoveredRoute[] | null = null;

  return {
    name: "avalon:nitro-virtual-modules",
    enforce: "pre",

    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_IDS.PAGE_ROUTES) return RESOLVED_VIRTUAL_IDS.PAGE_ROUTES;
      if (id === VIRTUAL_MODULE_IDS.ISLAND_MANIFEST) return RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST;
      if (id === VIRTUAL_MODULE_IDS.RUNTIME_CONFIG) return RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG;
      return null;
    },

    async load(id: string) {
      if (id === RESOLVED_VIRTUAL_IDS.PAGE_ROUTES) return await generatePageRoutesModule(avalonConfig, verbose);
      if (id === RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST) return generateIslandManifestModule();
      if (id === RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG) return generateRuntimeConfigModule(avalonConfig, nitroConfig);
      return null;
    },

    handleHotUpdate({ file, server }) {
      if (file.includes(avalonConfig.pagesDir)) {
        cachedPageRoutes = null;
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_IDS.PAGE_ROUTES);
        if (mod) server.moduleGraph.invalidateModule(mod);
      }
      return undefined;
    },
  };
}

// ─── HMR Coordination ───────────────────────────────────────────────────────

function setupHMRCoordination(
  server: ViteDevServer,
  config: ResolvedAvalonConfig,
  verbose?: boolean,
  clearScopedMiddlewareRoutes?: () => void
): void {
  server.watcher.on("change", (file) => {
    if (file.includes("_middleware")) {
      clearMiddlewareCache();
      clearScopedMiddlewareRoutes?.();
    }
    if (file.includes("/render/") || file.includes("/layout/") || file.includes("/islands/")) {
      cachedSSRModule = null;
      cachedLayoutModule = null;
    }
  });

  server.watcher.on("add", (file) => {
    if (file.includes("_middleware")) {
      clearMiddlewareCache();
      clearScopedMiddlewareRoutes?.();
    }
  });

  server.watcher.on("unlink", (file) => {
    if (file.includes("_middleware")) {
      clearMiddlewareCache();
      clearScopedMiddlewareRoutes?.();
    }
  });
}

// ─── Virtual Module Generators ───────────────────────────────────────────────

async function generatePageRoutesModule(
  config: ResolvedAvalonConfig,
  verbose?: boolean
): Promise<string> {
  try {
    const routes = await discoverPageRoutes(config.pagesDir, {
      developmentMode: config.isDev,
    });
    const routesJson = JSON.stringify(routes, null, 2);
    return `export const pageRoutes = ${routesJson};\nexport default pageRoutes;\n`;
  } catch (error) {
    console.warn("[nitro-integration] Failed to discover page routes:", error);
    return `export const pageRoutes = [];\nexport default pageRoutes;\n`;
  }
}

function generateIslandManifestModule(): string {
  return `export const islandManifest = { islands: {}, clientEntry: "", css: [] };\nexport default islandManifest;\n`;
}

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
  return `export const runtimeConfig = ${JSON.stringify(runtimeConfig, null, 2)};\nexport function useRuntimeConfig() { return runtimeConfig; }\nexport default runtimeConfig;\n`;
}

// ─── Public Accessors ────────────────────────────────────────────────────────

export function getViteDevServer(): ViteDevServer | undefined {
  return globalThis.__viteDevServer;
}

export function getAvalonConfig(): ResolvedAvalonConfig | undefined {
  return globalThis.__avalonConfig;
}

export function isDevelopmentMode(): boolean {
  return globalThis.__avalonConfig?.isDev ?? true;
}

// ─── SSR Request Handling ────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
let cachedSSRModule: any = null;
// deno-lint-ignore no-explicit-any
let cachedLayoutModule: any = null;

async function handleSSRRequest(
  server: ViteDevServer,
  url: string,
  config: ResolvedAvalonConfig,
): Promise<string | null> {
  const pathname = url.split("?")[0];
  const pageFile = await findPageFile(pathname, config.pagesDir, server);

  if (!pageFile) return null;

  try {
    const pageModule = await server.ssrLoadModule(pageFile);
    const PageComponent = pageModule.default;

    if (!PageComponent) {
      console.warn(`[SSR] Page ${pageFile} has no default export`);
      return null;
    }

    return await renderPageToHtml(PageComponent, pageModule, pathname, config, server);
  } catch (error) {
    console.error(`[SSR] Error rendering ${pageFile}:`, error);
    throw error;
  }
}

async function findPageFile(
  pathname: string,
  pagesDir: string,
  server: ViteDevServer
): Promise<string | null> {
  let normalizedPath = pathname;
  if (normalizedPath.endsWith("/") && normalizedPath !== "/") {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  if (normalizedPath === "/") {
    normalizedPath = "/index";
  }

  const extensions = [".tsx", ".ts", ".jsx", ".js", ".mdx", ".md"];
  const viteRoot = server.config.root || Deno.cwd();
  const possiblePaths: string[] = [];

  for (const ext of extensions) {
    possiblePaths.push(`${pagesDir}${normalizedPath}${ext}`);
  }
  if (!normalizedPath.endsWith("/index")) {
    for (const ext of extensions) {
      possiblePaths.push(`${pagesDir}${normalizedPath}/index${ext}`);
    }
  }

  for (const relativePath of possiblePaths) {
    try {
      const fullPath = `${viteRoot}/${relativePath}`;
      const stat = await Deno.stat(fullPath);
      if (stat.isFile) return `/${relativePath}`;
    } catch {
      // File doesn't exist
    }
  }

  return null;
}

async function renderPageToHtml(
  PageComponent: unknown,
  pageModule: Record<string, unknown>,
  pathname: string,
  config: ResolvedAvalonConfig,
  server: ViteDevServer,
): Promise<string> {
  const metadata = (pageModule.metadata || {}) as { title?: string; description?: string };

  try {
    if (!cachedSSRModule) {
      cachedSSRModule = await server.ssrLoadModule("../packages/avalon/src/render/ssr.ts");
    }
    const ssrModule = cachedSSRModule;

    if (!cachedLayoutModule) {
      cachedLayoutModule = await server.ssrLoadModule("../packages/avalon/src/core/layout/enhanced-layout-resolver.ts");
    }
    const layoutModule = cachedLayoutModule;

    const routeConfig = {
      component: () => typeof PageComponent === "function" ? (PageComponent as () => unknown)() : PageComponent,
      options: { title: metadata.title || "Avalon App" },
      frontmatter: pageModule.frontmatter as Record<string, unknown> | undefined,
    };

    // Try layout-aware rendering first
    if (ssrModule.renderToHtmlWithLayouts && layoutModule.EnhancedLayoutResolver && layoutModule.EnhancedLayoutResolverUtils) {
      try {
        const viteRoot = server.config.root || Deno.cwd();

        if (!globalThis.__avalonLayoutResolver) {
          globalThis.__avalonLayoutResolver = new layoutModule.EnhancedLayoutResolver({
            baseDirectory: `${viteRoot}/src/layouts`,
            filePattern: '_layout.tsx',
            excludeDirectories: ['node_modules', '.git', 'dist', 'build'],
            enableWatching: true,
            developmentMode: false,
            enableCaching: true,
            cacheTTL: 60 * 1000,
            maxCacheSize: 100,
            enableStreaming: true,
            enableErrorBoundaries: true,
            enableMetrics: false,
            enableDebugInfo: false,
          });
        }

        const fullUrl = `http://localhost${pathname}`;
        const layoutContext = {
          params: {},
          query: {},
          url: fullUrl,
          request: { method: "GET", url: fullUrl, headers: new Headers() },
        };

        return await ssrModule.renderToHtmlWithLayouts(
          routeConfig,
          globalThis.__avalonLayoutResolver,
          layoutContext,
          pathname,
          { title: metadata.title || "Avalon App" },
          undefined,
          { suppressWarnings: true }
        );
      } catch {
        // Layout rendering failed, fall back to basic rendering
      }
    }

    if (ssrModule.renderToHtml) {
      return await ssrModule.renderToHtml(
        routeConfig,
        { title: metadata.title || "Avalon App" },
        undefined,
        { suppressWarnings: true }
      );
    }
  } catch {
    // SSR module not available, fall back to basic rendering
  }

  // Fallback: basic HTML template
  const title = metadata.title || "Avalon App";
  const description = metadata.description || "";
  let content = "";
  try {
    const preactRenderModule = await server.ssrLoadModule("preact-render-to-string");
    if (preactRenderModule.render && typeof PageComponent === "function") {
      content = preactRenderModule.render((PageComponent as () => unknown)());
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
    <div id="app">${content}</div>
    <script type="module" src="/src/client/main.js"></script>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── API Request Handling ────────────────────────────────────────────────────

interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

async function handleApiRequest(
  server: ViteDevServer,
  url: string,
  req: { method?: string },
  config: ResolvedAvalonConfig,
  _verbose?: boolean
): Promise<ApiResponse | null> {
  const pathname = url.split("?")[0];
  const method = req.method || "GET";
  const apiFile = await findApiFile(pathname, config.apiDir, server);

  if (!apiFile) return null;

  try {
    const apiModule = await server.ssrLoadModule(apiFile);
    const handler = apiModule[method] || apiModule[method.toLowerCase()] || apiModule.default;

    if (!handler || typeof handler !== "function") {
      return {
        status: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    const fullUrl = `http://localhost:8012${url}`;
    const request = new Request(fullUrl, { method, headers: new Headers() });
    const result = await handler(request);

    if (result instanceof Response) {
      const body = await result.text();
      const headers: Record<string, string> = {};
      result.headers.forEach((value, key) => { headers[key] = value; });
      return { status: result.status, headers, body };
    }

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

async function findApiFile(
  pathname: string,
  apiDir: string,
  server: ViteDevServer
): Promise<string | null> {
  const routePath = pathname.replace(/^\/api/, "") || "/index";
  const extensions = [".ts", ".js"];
  const viteRoot = server.config.root || Deno.cwd();
  const possiblePaths: string[] = [];

  for (const ext of extensions) {
    possiblePaths.push(`${apiDir}${routePath}${ext}`);
  }
  if (!routePath.endsWith("/index")) {
    for (const ext of extensions) {
      possiblePaths.push(`${apiDir}${routePath}/index${ext}`);
    }
  }

  for (const relativePath of possiblePaths) {
    try {
      const fullPath = `${viteRoot}/${relativePath}`;
      const stat = await Deno.stat(fullPath);
      if (stat.isFile) return `/${relativePath}`;
    } catch {
      // File doesn't exist
    }
  }

  return null;
}

// ─── Global Type Declarations ────────────────────────────────────────────────

declare global {
  // deno-lint-ignore no-var
  var __avalonLayoutResolver: unknown;
}
