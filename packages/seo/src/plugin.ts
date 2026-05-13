/**
 * Vite plugin entry point for @useavalon/seo.
 *
 * Intercepts rendered HTML responses and auto-injects:
 * - Canonical URLs
 * - Open Graph meta tags (with og:image:width/height)
 * - Twitter card meta tags
 * - JSON-LD structured data (WebPage, WebSite, BreadcrumbList, Article)
 * - Font preconnect links
 *
 * Uses the same pre-middleware strategy as agent-optimization: patches
 * res.end BEFORE Avalon's SSR handler runs to intercept the HTML.
 */

import type { Plugin, PluginOption, ViteDevServer } from 'vite';
import { validateSeoConfig } from './config.ts';
import type { SeoConfigInput, SeoConfig } from './config.ts';
import { injectMetaTags, extractMetadataFromHtml, extractArticleMetaFromHtml } from './meta-tags.ts';
import {
  buildWebPageJsonLd,
  buildWebSiteJsonLd,
  buildBreadcrumbListJsonLd,
  buildArticleJsonLd,
  injectJsonLd,
} from './structured-data.ts';
import type { ArticleMetadata } from './structured-data.ts';

/**
 * Create the SEO Vite plugin.
 *
 * Automatically injects SEO meta tags and JSON-LD structured data into
 * every HTML response. Reads existing tags to avoid duplication.
 */
export function seo(config: SeoConfigInput): PluginOption[] {
  const resolvedConfig = validateSeoConfig(config);
  const plugins: Plugin[] = [];

  plugins.push({
    name: 'avalon-seo',
    enforce: 'pre',
    configureServer(server: ViteDevServer) {
      // Register as pre-middleware to patch res.end BEFORE Avalon's SSR handler
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/';

        // Skip non-page requests
        if (
          url.startsWith('/@') ||
          url.startsWith('/__') ||
          url.startsWith('/node_modules/') ||
          url.startsWith('/src/') ||
          url.startsWith('/packages/') ||
          (url.includes('.') && !url.endsWith('/'))
        ) {
          return next();
        }

        patchResponseForSeo(res, url, resolvedConfig);
        next();
      });
    },
  });

  return plugins as PluginOption[];
}

// ---------------------------------------------------------------------------
// Response Interception
// ---------------------------------------------------------------------------

function patchResponseForSeo(
  res: import('node:http').ServerResponse,
  url: string,
  config: SeoConfig,
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
    for (const arg of rest) {
      if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
        for (const [key, val] of Object.entries(arg)) {
          if (key.toLowerCase() === 'content-type' && typeof val === 'string' && val.includes('text/html')) {
            markAsIntercepting();
          }
        }
      }
    }
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

    // Accumulate chunks
    if (chunk) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === 'string') {
        const encoding = typeof encodingOrCb === 'string' ? encodingOrCb as BufferEncoding : 'utf-8';
        chunks.push(Buffer.from(chunk, encoding));
      }
    }

    if (chunks.length === 0) {
      return originalEnd(chunk, encodingOrCb, cb);
    }

    const html = Buffer.concat(chunks).toString('utf-8');
    const callback = typeof encodingOrCb === 'function' ? encodingOrCb : cb;

    const finalHtml = transformHtml(html, url, config);
    if (finalHtml !== html) {
      originalSetHeader('Content-Length', String(Buffer.byteLength(finalHtml)));
    }
    return originalEnd(finalHtml, 'utf-8', callback);
  } as any;
}

// ---------------------------------------------------------------------------
// HTML Transformation
// ---------------------------------------------------------------------------

function transformHtml(html: string, url: string, config: SeoConfig): string {
  const metadata = extractMetadataFromHtml(html);
  if (!metadata.title && !metadata.description) return html;

  const siteUrl = config.siteUrl.replace(/\/+$/, '');
  const fullUrl = url.startsWith('http') ? url : `${siteUrl}${url}`;

  // 0. Apply title suffix (e.g., "Page Title — Site Name")
  if (config.titleSuffix !== false && metadata.title) {
    const suffix = typeof config.titleSuffix === 'string'
      ? config.titleSuffix
      : ` — ${config.siteName}`;
    if (!metadata.title.includes(config.siteName)) {
      const newTitle = metadata.title + suffix;
      html = html.replace(
        /<title[^>]*>[\s\S]*?<\/title>/i,
        `<title>${newTitle}</title>`,
      );
      metadata.title = newTitle;
    }
  }

  // 1. Inject meta tags (OG, Twitter, canonical, font preconnect)
  html = injectMetaTags(html, url, config);

  // 2. Inject JSON-LD structured data
  if (config.structuredData) {
    // WebPage JSON-LD
    html = injectJsonLd(html, buildWebPageJsonLd(metadata, fullUrl));

    // WebSite JSON-LD (with SearchAction if configured)
    html = injectJsonLd(html, buildWebSiteJsonLd(config));

    // BreadcrumbList JSON-LD
    if (config.breadcrumbs) {
      const urlPath = new URL(url, siteUrl || 'http://localhost').pathname;
      const breadcrumbJsonLd = buildBreadcrumbListJsonLd(urlPath, siteUrl);
      if (breadcrumbJsonLd) {
        html = injectJsonLd(html, breadcrumbJsonLd);
      }
    }

    // Article JSON-LD — when page has article-like metadata
    const articleMeta = extractArticleMetaFromHtml(html);
    if (metadata.title && (articleMeta.datePublished || metadata.description)) {
      const article: ArticleMetadata = {
        title: metadata.title,
        description: metadata.description,
        image: metadata.openGraph?.image,
        imageWidth: metadata.openGraph?.imageWidth,
        imageHeight: metadata.openGraph?.imageHeight,
        datePublished: articleMeta.datePublished,
        dateModified: articleMeta.dateModified,
        author: articleMeta.author,
        section: articleMeta.section,
        tags: articleMeta.tags,
      };
      html = injectJsonLd(html, buildArticleJsonLd(article, fullUrl, config));
    }
  }

  return html;
}
