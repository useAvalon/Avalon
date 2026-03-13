/**
 * Vite plugin entry point for @avalon/agent-optimization.
 *
 * Middleware strategy — ALL middleware is registered as pre-middleware (directly
 * in configureServer, not in a returned function). This is critical because
 * Avalon's SSR handler also registers directly and calls res.end(html).
 * By patching res.end BEFORE Avalon runs, we can intercept the rendered HTML.
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Plugin, PluginOption, ViteDevServer } from 'vite';
import { validateConfig } from './config.ts';
import type { AgentOptimizationConfigInput, SitemapConfig, LlmsConfig } from './config.ts';
import { routesToSitemapEntries, buildSitemapXml } from './sitemap.ts';
import type { ResolvedSitemapConfig } from './sitemap.ts';
import { shouldServeMarkdown, htmlToMarkdown, buildFrontMatter } from './markdown.ts';
import type { PageMetadata } from './markdown.ts';
import { buildWebPageJsonLd, injectJsonLd } from './structured-data.ts';
import { routesToLlmsEntries, buildLlmsTxt, buildLlmsFullTxt } from './llms.ts';
import type { ResolvedLlmsConfig, LlmsRoute } from './llms.ts';

/**
 * Create the AI agent optimization Vite plugin array.
 * 
 * Returns PluginOption[] to avoid TypeScript's excessive stack depth issues
 * when comparing Plugin<any> arrays in Vite 8's complex type system.
 */
export function agentOptimization(config: AgentOptimizationConfigInput): PluginOption[] {
  const validatedConfig = validateConfig(config);
  const plugins: Plugin[] = [];

  const sitemapEnabled = validatedConfig.sitemap !== undefined && validatedConfig.sitemap !== false;
  const markdownEnabled = validatedConfig.markdown === true;
  const structuredDataEnabled = validatedConfig.structuredData === true;

  // Resolve sitemap config
  let resolvedSitemapConfig: ResolvedSitemapConfig | null = null;
  if (sitemapEnabled) {
    if (validatedConfig.sitemap === true) {
      console.warn(
        '[agent-optimization] sitemap enabled without siteUrl — falling back to http://localhost',
      );
      resolvedSitemapConfig = { siteUrl: 'http://localhost' };
    } else {
      const sc = validatedConfig.sitemap as SitemapConfig;
      resolvedSitemapConfig = {
        siteUrl: sc.siteUrl,
        changefreq: sc.changefreq,
        priority: sc.priority,
        dynamicPaths: sc.dynamicPaths,
        exclude: sc.exclude,
      };
    }
  }

  // Resolve llms config
  const llmsEnabled = validatedConfig.llms !== undefined && validatedConfig.llms !== false;
  let resolvedLlmsConfig: ResolvedLlmsConfig | null = null;
  if (llmsEnabled) {
    if (validatedConfig.llms === true) {
      console.warn(
        '[agent-optimization] llms enabled without siteUrl/siteName — falling back to defaults',
      );
      resolvedLlmsConfig = { siteUrl: 'http://localhost', siteName: 'My Site' };
    } else {
      const lc = validatedConfig.llms as LlmsConfig;
      resolvedLlmsConfig = {
        siteUrl: lc.siteUrl,
        siteName: lc.siteName,
        siteDescription: lc.siteDescription,
        sections: lc.sections,
        exclude: lc.exclude,
      };
    }
  }
  const llmsFullEnabled = llmsEnabled
    && validatedConfig.llms !== true
    && (validatedConfig.llms as LlmsConfig).full === true;

  plugins.push({
    name: 'agent-optimization:coordination',
    enforce: 'pre',
    configureServer(server: ViteDevServer) {
      // --- Sitemap handler ---
      if (sitemapEnabled && resolvedSitemapConfig) {
        const sitemapConfig = resolvedSitemapConfig;
        server.middlewares.use(async (req, res, next) => {
          if (req.method === 'GET' && req.url === '/sitemap.xml') {
            try {
              await handleSitemap(server, sitemapConfig, res);
            } catch (err) {
              next(err);
            }
            return;
          }
          next();
        });
      }

      // --- llms.txt / llms-full.txt handler ---
      if (llmsEnabled && resolvedLlmsConfig) {
        const llmsConfig = resolvedLlmsConfig;
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== 'GET') return next();
          if (req.url === '/llms.txt') {
            try {
              await handleLlmsTxt(server, llmsConfig, res);
            } catch (err) {
              next(err);
            }
            return;
          }
          if (req.url === '/llms-full.txt' && llmsFullEnabled) {
            try {
              await handleLlmsFullTxt(server, llmsConfig, res);
            } catch (err) {
              next(err);
            }
            return;
          }
          next();
        });
      }

      // --- Markdown + Structured Data response interception ---
      // Registered as PRE-middleware so it patches res.end BEFORE Avalon's
      // SSR handler runs. When Avalon calls res.end(html), our patched
      // version captures the HTML and transforms it.
      if (markdownEnabled || structuredDataEnabled) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ?? '/';

          // Skip non-page requests
          if (
            url.startsWith('/@') ||
            url.startsWith('/__') ||
            url.startsWith('/node_modules/') ||
            url.startsWith('/src/') ||
            url.startsWith('/packages/') ||
            url === '/sitemap.xml' ||
            (url.includes('.') && !url.endsWith('/'))
          ) {
            return next();
          }

          const wantsMarkdown = markdownEnabled && shouldServeMarkdown(req.headers.accept);
          const wantsStructuredData = structuredDataEnabled && !wantsMarkdown;

          if (!wantsMarkdown && !wantsStructuredData) {
            return next();
          }

          // Patch res.end to intercept the HTML that Avalon will write
          patchResponseForInterception(res, url, wantsMarkdown);
          next();
        });
      }
    },

    async writeBundle(options) {
      const outDir = options.dir ?? path.resolve(process.cwd(), '.output');
      await fs.mkdir(outDir, { recursive: true });

      const routes = await discoverRoutesForBuild(sitemapEnabled || llmsEnabled);

      if (sitemapEnabled && resolvedSitemapConfig) {
        const entries = routesToSitemapEntries(routes, resolvedSitemapConfig);
        const xml = buildSitemapXml(entries);
        await fs.writeFile(path.join(outDir, 'sitemap.xml'), xml, 'utf-8');
        console.log(`[agent-optimization] sitemap.xml written to ${outDir}`);
      }

      if (llmsEnabled && resolvedLlmsConfig) {
        await writeLlmsFiles(outDir, routes, resolvedLlmsConfig, llmsFullEnabled);
      }
    },
  });

  return plugins as PluginOption[];
}


// ---------------------------------------------------------------------------
// Build-time helpers
// ---------------------------------------------------------------------------

async function discoverRoutesForBuild(enabled: boolean): Promise<Array<{ pattern: string; type?: string }>> {
  if (!enabled) return [];
  
  try {
    const projectRoot = process.cwd();
    
    // Try to import Avalon's route discovery directly using path resolution
    // In a monorepo, the packages are siblings
    const avalonPath = path.resolve(projectRoot, 'packages/avalon');
    let routeDiscoveryPath = path.join(avalonPath, 'src/nitro/route-discovery.ts');
    let moduleDiscoveryPath = path.join(avalonPath, 'src/vite-plugin/module-discovery.ts');
    
    // If not found, try relative to this package (for when running from www/)
    try {
      await fs.access(routeDiscoveryPath);
    } catch {
      routeDiscoveryPath = path.resolve(projectRoot, '../packages/avalon/src/nitro/route-discovery.ts');
      moduleDiscoveryPath = path.resolve(projectRoot, '../packages/avalon/src/vite-plugin/module-discovery.ts');
    }
    
    const routeDiscovery = await import(/* @vite-ignore */ routeDiscoveryPath) as {
      discoverPageRoutes: (dir: string, opts?: { developmentMode?: boolean }) => Promise<Array<{ pattern: string; type?: string }>>;
      discoverPageRoutesFromMultipleDirs?: (dirs: Array<{ dir: string; prefix: string }>, opts?: { developmentMode?: boolean }) => Promise<Array<{ pattern: string; type?: string }>>;
    };
    const moduleDiscovery = await import(/* @vite-ignore */ moduleDiscoveryPath) as {
      getAllPageDirs: (pagesDir: string, modulesConfig: unknown, projectRoot: string) => Promise<Array<{ dir: string; prefix: string }>>;
    };
    
    const pageDirs: Array<{ dir: string; prefix: string }> = [];
    
    // Check for modular architecture (app/modules)
    const modulesDir = path.resolve(projectRoot, 'app/modules');
    try {
      const stat = await fs.stat(modulesDir);
      if (stat.isDirectory()) {
        // Use modular architecture
        const modulesConfig = { dir: 'app/modules', pagesDirName: 'pages', layoutsDirName: 'layouts' };
        const dirs = await moduleDiscovery.getAllPageDirs('src/pages', modulesConfig, projectRoot);
        pageDirs.push(...dirs);
      }
    } catch {
      // No modular architecture, try traditional
    }
    
    // Fall back to traditional pages directory
    if (pageDirs.length === 0) {
      const traditionalPagesDir = path.resolve(projectRoot, 'src/pages');
      try {
        const stat = await fs.stat(traditionalPagesDir);
        if (stat.isDirectory()) {
          pageDirs.push({ dir: traditionalPagesDir, prefix: '/' });
        }
      } catch {
        // No pages directory found
      }
    }
    
    if (pageDirs.length === 0) {
      console.warn('[agent-optimization] No page directories found during build');
      return [];
    }
    
    // Use multi-dir discovery
    if (routeDiscovery.discoverPageRoutesFromMultipleDirs) {
      const discovered = await routeDiscovery.discoverPageRoutesFromMultipleDirs(pageDirs);
      return discovered.filter((r: { type?: string }) => r.type === 'page');
    }
    
    // Fall back to single-dir discovery
    const allRoutes: Array<{ pattern: string; type?: string }> = [];
    for (const { dir, prefix } of pageDirs) {
      const routes = await routeDiscovery.discoverPageRoutes(dir);
      for (const route of routes) {
        if (route.type === 'page') {
          const pattern = prefix === '/' ? route.pattern : prefix + (route.pattern === '/' ? '' : route.pattern);
          allRoutes.push({ ...route, pattern });
        }
      }
    }
    return allRoutes;
  } catch (err) {
    console.warn('[agent-optimization] Route discovery failed during build:', err);
  }
  return [];
}

async function writeLlmsFiles(
  outDir: string,
  routes: Array<{ pattern: string }>,
  config: ResolvedLlmsConfig,
  generateFull: boolean,
): Promise<void> {
  const entries = routesToLlmsEntries(routes as LlmsRoute[], config);
  const llmsTxt = buildLlmsTxt(entries, config);
  await fs.writeFile(path.join(outDir, 'llms.txt'), llmsTxt, 'utf-8');
  console.log(`[agent-optimization] llms.txt written to ${outDir}`);

  if (!generateFull) return;

  const projectRoot = process.cwd();
  const pages: Array<{ route: LlmsRoute; html: string }> = [];

  for (const entry of entries) {
    const urlPath = new URL(entry.url).pathname;
    try {
      const html = await renderPageForLlms(projectRoot, urlPath);
      if (html) {
        pages.push({
          route: { pattern: urlPath, title: entry.name, description: entry.description },
          html,
        });
      }
    } catch (err) {
      console.warn(`[agent-optimization] Failed to render ${urlPath} for llms-full.txt:`, err);
    }
  }

  if (pages.length > 0) {
    const fullTxt = buildLlmsFullTxt(pages, config);
    await fs.writeFile(path.join(outDir, 'llms-full.txt'), fullTxt, 'utf-8');
    console.log(`[agent-optimization] llms-full.txt written to ${outDir} (${pages.length} pages)`);
  }
}

// ---------------------------------------------------------------------------
// Response Interception
// ---------------------------------------------------------------------------

/**
 * Monkey-patch res.end and res.write so that when a downstream middleware
 * (Avalon SSR) writes HTML, we capture it and transform it before sending.
 */
function patchResponseForInterception(
  res: import('node:http').ServerResponse,
  url: string,
  wantsMarkdown: boolean,
): void {
  const originalEnd = res.end.bind(res);
  const originalSetHeader = res.setHeader.bind(res);
  const originalWriteHead = res.writeHead.bind(res);
  const chunks: Buffer[] = [];
  let intercepting = false;

  const markAsIntercepting = () => { intercepting = true; };

  res.setHeader = function (name: string, value: any): any {
    if (name.toLowerCase() === 'content-type' && typeof value === 'string' && value.includes('text/html')) {
      markAsIntercepting();
    }
    return originalSetHeader(name, value);
  } as any;

  res.writeHead = function (statusCode: number, ...rest: any[]): any {
    checkWriteHeadHeaders(rest, markAsIntercepting);
    return originalWriteHead(statusCode, ...rest);
  } as any;

  res.end = function (chunk?: any, encodingOrCb?: any, cb?: any): any {
    if (!intercepting) {
      const ct = res.getHeader('content-type');
      if (typeof ct === 'string' && ct.includes('text/html')) {
        markAsIntercepting();
      }
    }

    if (!intercepting) {
      return originalEnd(chunk, encodingOrCb, cb);
    }

    appendChunk(chunks, chunk, encodingOrCb);

    if (chunks.length === 0) {
      return originalEnd(chunk, encodingOrCb, cb);
    }

    const html = Buffer.concat(chunks).toString('utf-8');
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;

    return sendTransformed(html, url, wantsMarkdown, originalEnd, originalSetHeader, callback);
  } as any;
}

/** Check writeHead args for content-type: text/html */
function checkWriteHeadHeaders(args: any[], onHtml: () => void): void {
  for (const arg of args) {
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      for (const [key, val] of Object.entries(arg)) {
        if (key.toLowerCase() === 'content-type' && typeof val === 'string' && val.includes('text/html')) {
          onHtml();
        }
      }
    }
  }
}

/** Push a chunk into the buffer array, handling string/Buffer types. */
function appendChunk(chunks: Buffer[], chunk: any, encodingOrCb: any): void {
  if (!chunk) return;
  if (Buffer.isBuffer(chunk)) {
    chunks.push(chunk);
  } else if (typeof chunk === 'string') {
    const encoding = typeof encodingOrCb === 'string' ? encodingOrCb as BufferEncoding : 'utf-8';
    chunks.push(Buffer.from(chunk, encoding));
  }
}

/** Transform captured HTML and send the response. */
function sendTransformed(
  html: string,
  url: string,
  wantsMarkdown: boolean,
  originalEnd: (...args: any[]) => any,
  originalSetHeader: (name: string, value: string) => any,
  callback?: () => void,
): any {
  if (wantsMarkdown) {
    const markdown = htmlToMarkdown(html);
    const metadata = extractMetadataFromHtml(html);
    const frontMatter = buildFrontMatter(metadata);
    const body = frontMatter + markdown;

    originalSetHeader('Content-Type', 'text/markdown; charset=utf-8');
    originalSetHeader('Content-Length', String(Buffer.byteLength(body)));
    return originalEnd(body, 'utf-8', callback);
  }

  const finalHtml = maybeInjectJsonLd(html, url);
  if (finalHtml !== html) {
    originalSetHeader('Content-Length', String(Buffer.byteLength(finalHtml)));
  }
  return originalEnd(finalHtml, 'utf-8', callback);
}


// ---------------------------------------------------------------------------
// Sitemap Handler
// ---------------------------------------------------------------------------

async function handleSitemap(
  server: ViteDevServer,
  sitemapConfig: ResolvedSitemapConfig,
  res: import('node:http').ServerResponse,
): Promise<void> {
  const routes = await discoverRoutes(server);
  const entries = routesToSitemapEntries(routes, sitemapConfig);
  const xml = buildSitemapXml(entries);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.statusCode = 200;
  res.end(xml);
}

// ---------------------------------------------------------------------------
// llms.txt Handlers
// ---------------------------------------------------------------------------

/**
 * Discover routes from both traditional (src/pages) and modular (app/modules/[module]/pages) architectures.
 * Uses Avalon's route discovery functions when available.
 */
async function discoverRoutes(server: ViteDevServer): Promise<Array<{ pattern: string; type?: string }>> {
  try {
    const viteRoot = server.config.root;
    
    // Try to load Avalon's route discovery and module discovery
    const routeDiscoveryModule = await server.ssrLoadModule(
      path.resolve(viteRoot, '../packages/avalon/src/nitro/route-discovery.ts')
    ) as { 
      discoverPageRoutes?: (dir: string, opts?: { developmentMode?: boolean }) => Promise<Array<{ pattern: string; type?: string }>>;
      discoverPageRoutesFromMultipleDirs?: (dirs: Array<{ dir: string; prefix: string }>, opts?: { developmentMode?: boolean }) => Promise<Array<{ pattern: string; type?: string }>>;
    };
    
    const moduleDiscoveryModule = await server.ssrLoadModule(
      path.resolve(viteRoot, '../packages/avalon/src/vite-plugin/module-discovery.ts')
    ) as {
      getAllPageDirs?: (pagesDir: string, modulesConfig: unknown, projectRoot: string) => Promise<Array<{ dir: string; prefix: string }>>;
    };

    // Get Avalon config from global (set by nitro-integration)
    const avalonConfig = (globalThis as any).__avalonConfig as {
      pagesDir?: string;
      modules?: { dir: string; pagesDirName: string; layoutsDirName: string };
    } | undefined;

    // Collect all page directories
    const pageDirs: Array<{ dir: string; prefix: string }> = [];

    // Check for modular architecture first
    if (avalonConfig?.modules && moduleDiscoveryModule.getAllPageDirs) {
      const dirs = await moduleDiscoveryModule.getAllPageDirs(
        avalonConfig.pagesDir || 'src/pages',
        avalonConfig.modules,
        viteRoot
      );
      pageDirs.push(...dirs);
    } else {
      // Fall back to traditional pages directory
      const traditionalPagesDir = path.resolve(viteRoot, avalonConfig?.pagesDir || 'src/pages');
      try {
        const stat = await fs.stat(traditionalPagesDir);
        if (stat.isDirectory()) {
          pageDirs.push({ dir: traditionalPagesDir, prefix: '/' });
        }
      } catch {
        // Directory doesn't exist
      }
    }

    if (pageDirs.length === 0) {
      console.warn('[agent-optimization] No page directories found');
      return [];
    }

    // Use multi-dir discovery if available, otherwise fall back to single-dir
    if (routeDiscoveryModule.discoverPageRoutesFromMultipleDirs && pageDirs.length > 0) {
      const discovered = await routeDiscoveryModule.discoverPageRoutesFromMultipleDirs(pageDirs, { developmentMode: true });
      return discovered.filter((r) => r.type === 'page');
    } else if (routeDiscoveryModule.discoverPageRoutes) {
      // Fall back to single directory discovery
      const allRoutes: Array<{ pattern: string; type?: string }> = [];
      for (const { dir, prefix } of pageDirs) {
        const routes = await routeDiscoveryModule.discoverPageRoutes(dir, { developmentMode: true });
        for (const route of routes) {
          if (route.type === 'page') {
            // Apply prefix
            const pattern = prefix === '/' ? route.pattern : prefix + (route.pattern === '/' ? '' : route.pattern);
            allRoutes.push({ ...route, pattern });
          }
        }
      }
      return allRoutes;
    }
  } catch (err) {
    console.warn('[agent-optimization] Route discovery failed:', err);
  }
  return [];
}

async function handleLlmsTxt(
  server: ViteDevServer,
  llmsConfig: ResolvedLlmsConfig,
  res: import('node:http').ServerResponse,
): Promise<void> {
  const routes = await discoverRoutes(server);
  const entries = routesToLlmsEntries(routes as LlmsRoute[], llmsConfig);
  const txt = buildLlmsTxt(entries, llmsConfig);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.statusCode = 200;
  res.end(txt);
}

async function handleLlmsFullTxt(
  server: ViteDevServer,
  llmsConfig: ResolvedLlmsConfig,
  res: import('node:http').ServerResponse,
): Promise<void> {
  const routes = await discoverRoutes(server);
  const filteredRoutes = routesToLlmsEntries(routes as LlmsRoute[], llmsConfig);

  // Render each page to HTML via the dev server, then convert to markdown
  const pages: Array<{ route: LlmsRoute; html: string }> = [];
  for (const entry of filteredRoutes) {
    const urlPath = new URL(entry.url).pathname;
    try {
      const html = await renderRouteViaDevServer(server, urlPath);
      if (html) {
        pages.push({
          route: { pattern: urlPath, title: entry.name, description: entry.description },
          html,
        });
      }
    } catch (err) {
      console.warn(`[agent-optimization] Failed to render ${urlPath} for llms-full.txt:`, err);
    }
  }

  const txt = buildLlmsFullTxt(pages, llmsConfig);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.statusCode = 200;
  res.end(txt);
}

/** Render a route by making an internal request to the dev server. */
async function renderRouteViaDevServer(server: ViteDevServer, urlPath: string): Promise<string | null> {
  const http = await import('node:http');

  return new Promise((resolve) => {
    const mockReq = Object.create(http.IncomingMessage.prototype);
    mockReq.method = 'GET';
    mockReq.url = urlPath;
    mockReq.headers = { accept: 'text/html', host: 'localhost' };

    const chunks: Buffer[] = [];
    let statusCode = 200;

    const mockRes = Object.create(http.ServerResponse.prototype);
    mockRes.setHeader = () => mockRes;
    mockRes.writeHead = (code: number) => { statusCode = code; return mockRes; };
    mockRes.getHeader = () => undefined;
    mockRes.end = (chunk?: any) => {
      if (chunk) {
        if (Buffer.isBuffer(chunk)) chunks.push(chunk);
        else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk, 'utf-8'));
      }
      if (statusCode === 200 && chunks.length > 0) {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      } else {
        resolve(null);
      }
    };

    server.middlewares.handle(mockReq, mockRes, () => resolve(null));
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maybeInjectJsonLd(html: string, url: string): string {
  const metadata = extractMetadataFromHtml(html);
  if (!metadata.title && !metadata.description) return html;
  const jsonLd = buildWebPageJsonLd(metadata, url);
  return injectJsonLd(html, jsonLd);
}

function extractMetadataFromHtml(html: string): PageMetadata {
  const metadata: PageMetadata = {};

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) metadata.title = titleMatch[1].trim();

  const descMatch = html.match(
    /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/i,
  );
  if (descMatch) {
    metadata.description = descMatch[1];
  } else {
    const descMatch2 = html.match(
      /<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i,
    );
    if (descMatch2) metadata.description = descMatch2[1];
  }

  const ogTitle = extractMetaContent(html, 'og:title');
  const ogDesc = extractMetaContent(html, 'og:description');
  const ogImage = extractMetaContent(html, 'og:image');

  if (ogTitle || ogDesc || ogImage) {
    metadata.openGraph = {};
    if (ogTitle) metadata.openGraph.title = ogTitle;
    if (ogDesc) metadata.openGraph.description = ogDesc;
    if (ogImage) metadata.openGraph.image = ogImage;
  }

  return metadata;
}

function extractMetaContent(html: string, property: string): string | undefined {
  const escaped = escapeForRegex(property);
  const patternA = String.raw`<meta\s[^>]*property\s*=\s*["']` + escaped + String.raw`["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*/?>`;
  const patternB = String.raw`<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']` + escaped + String.raw`["'][^>]*/?>`;

  const m1 = html.match(new RegExp(patternA, 'i'));
  if (m1) return m1[1];

  const m2 = html.match(new RegExp(patternB, 'i'));
  return m2 ? m2[1] : undefined;
}

function escapeForRegex(str: string): string {
  return str.replaceAll(/[.*+?^${}()|[\]\\]/g, (match) => '\\' + match);
}

// ---------------------------------------------------------------------------
// Build-time page rendering for llms-full.txt
// ---------------------------------------------------------------------------

/**
 * Render a page at build time by importing the page module and using
 * preact-render-to-string. Falls back to reading the source file as
 * plain text if rendering fails.
 * 
 * Supports both traditional (src/pages) and modular (app/modules/[module]/pages) architectures.
 */
async function renderPageForLlms(projectRoot: string, urlPath: string): Promise<string | null> {
  // Map URL path to file path - check both architectures
  const segments = urlPath === '/' ? ['index'] : urlPath.replace(/^\//, '').split('/');
  
  // Build possible file paths for both architectures
  const possibleFiles: string[] = [];
  
  // Check modular architecture first
  // For /docs/intro -> app/modules/docs/pages/intro.tsx
  // For / -> app/modules/home/pages/index.tsx
  const modulesDir = path.join(projectRoot, 'app/modules');
  const rootModules = ['home', 'root', 'main', 'index'];
  
  if (segments.length === 1 && segments[0] === 'index') {
    // Root route - check home module
    for (const moduleName of rootModules) {
      possibleFiles.push(
        path.join(modulesDir, moduleName, 'pages', 'index.tsx'),
        path.join(modulesDir, moduleName, 'pages', 'index.mdx'),
      );
    }
  } else {
    // Check if first segment is a module
    const moduleName = segments[0];
    const modulePagePath = segments.slice(1);
    const pageFile = modulePagePath.length === 0 ? 'index' : modulePagePath.join('/');
    
    possibleFiles.push(
      path.join(modulesDir, moduleName, 'pages', pageFile + '.tsx'),
      path.join(modulesDir, moduleName, 'pages', pageFile, 'index.tsx'),
      path.join(modulesDir, moduleName, 'pages', pageFile + '.mdx'),
      path.join(modulesDir, moduleName, 'pages', pageFile, 'index.mdx'),
    );
  }
  
  // Also check traditional pages directory
  const pagesDir = path.join(projectRoot, 'src/pages');
  possibleFiles.push(
    path.join(pagesDir, ...segments) + '.tsx',
    path.join(pagesDir, ...segments, 'index.tsx'),
    path.join(pagesDir, ...segments) + '.mdx',
    path.join(pagesDir, ...segments, 'index.mdx'),
  );

  let filePath: string | null = null;
  for (const candidate of possibleFiles) {
    try {
      await fs.access(candidate);
      filePath = candidate;
      break;
    } catch { /* not found, try next */ }
  }

  if (!filePath) return null;

  // Read the source file and extract text content
  // This is a lightweight approach that doesn't require a full SSR pipeline
  try {
    const source = await fs.readFile(filePath, 'utf-8');
    return extractContentFromSource(source, filePath);
  } catch {
    return null;
  }
}

/**
 * Extract readable content from a page source file.
 * For TSX: extracts JSX text content and string literals.
 * For MDX: returns the markdown content directly.
 */
function extractContentFromSource(source: string, filePath: string): string {
  if (filePath.endsWith('.mdx')) {
    // MDX is already markdown — strip frontmatter and return
    return source.replace(/^---[\s\S]*?---\n?/, '');
  }

  // For TSX, build a minimal HTML-like structure from JSX text
  const lines: string[] = [];

  // Extract string content from JSX — text between > and <
  const jsxTextMatches = source.matchAll(/>([^<>{]+)</g);
  for (const match of jsxTextMatches) {
    const text = match[1].trim();
    if (text && text.length > 1 && !text.startsWith('{') && !text.startsWith('//')) {
      lines.push(text);
    }
  }

  // Extract string literals in JSX attributes like title="..." or content="..."
  const attrMatches = source.matchAll(/(?:title|content|description|alt|label|placeholder)=["']([^"']+)["']/g);
  for (const match of attrMatches) {
    const text = match[1].trim();
    if (text) lines.push(text);
  }

  if (lines.length === 0) return '';

  // Wrap in basic HTML so htmlToMarkdown can process it
  const body = lines.map((l) => `<p>${l}</p>`).join('\n');
  return `<html><body><main>${body}</main></body></html>`;
}
