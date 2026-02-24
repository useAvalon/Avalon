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
import { createRequire } from 'node:module';
import type { Plugin, ViteDevServer } from 'vite';
import { validateConfig } from './config.ts';
import type { AgentOptimizationConfigInput, SitemapConfig } from './config.ts';
import { routesToSitemapEntries, buildSitemapXml } from './sitemap.ts';
import type { ResolvedSitemapConfig } from './sitemap.ts';
import { shouldServeMarkdown, htmlToMarkdown, buildFrontMatter } from './markdown.ts';
import type { PageMetadata } from './markdown.ts';
import { buildWebPageJsonLd, injectJsonLd } from './structured-data.ts';

/**
 * Create the AI agent optimization Vite plugin array.
 */
export function agentOptimization(config: AgentOptimizationConfigInput): Plugin[] {
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
      if (!sitemapEnabled || !resolvedSitemapConfig) return;

      let routes: Array<{ pattern: string; type?: string }> = [];

      try {
        const pagesDir = path.resolve(process.cwd(), 'src/pages');
        // Resolve @avalon/avalon's main entry (mod.ts), then derive the package root
        // to locate route-discovery.ts. This avoids requiring a subpath export for
        // package.json and works regardless of which directory the build runs from.
        const require = createRequire(import.meta.url);
        const avalonEntry = require.resolve('@avalon/avalon');
        const avalonRoot = path.dirname(avalonEntry);
        const routeDiscoveryPath = path.join(avalonRoot, 'src/nitro/route-discovery.ts');
        const routeDiscovery = await import(/* @vite-ignore */ routeDiscoveryPath);

        const discoverFn = routeDiscovery?.discoverPageRoutes;
        if (typeof discoverFn === 'function') {
          const discovered = await discoverFn(pagesDir);
          routes = discovered.filter((r: any) => r.type === 'page');
        }
      } catch (err) {
        console.warn('[agent-optimization] Route discovery failed during build, writing empty sitemap:', err);
      }

      const entries = routesToSitemapEntries(routes, resolvedSitemapConfig);
      const xml = buildSitemapXml(entries);

      const outDir = options.dir ?? path.resolve(process.cwd(), '.output');
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(path.join(outDir, 'sitemap.xml'), xml, 'utf-8');

      console.log(`[agent-optimization] sitemap.xml written to ${outDir}`);
    },
  });

  return plugins;
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
  let routes: Array<{ pattern: string }> = [];

  try {
    const pagesDir = path.resolve(server.config.root, 'src/pages');
    const mod = await server.ssrLoadModule('@avalon/avalon');
    const discoverFn = (mod as any).discoverPageRoutes
      ?? (await server.ssrLoadModule(
        path.resolve(server.config.root, '../packages/avalon/src/nitro/route-discovery.ts'),
      ) as any).discoverPageRoutes;

    if (typeof discoverFn === 'function') {
      const discovered = await discoverFn(pagesDir, { developmentMode: true });
      routes = discovered.filter((r: any) => r.type === 'page');
    }
  } catch (err) {
    console.warn('[agent-optimization] Route discovery failed, serving empty sitemap:', err);
  }

  const entries = routesToSitemapEntries(routes, sitemapConfig);
  const xml = buildSitemapXml(entries);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.statusCode = 200;
  res.end(xml);
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
