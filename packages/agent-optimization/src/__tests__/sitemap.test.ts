import { describe, it, expect, vi } from 'vitest';
import {
  routesToSitemapEntries,
  buildSitemapXml,
  type DiscoveredRoute,
  type ResolvedSitemapConfig,
  type SitemapEntry,
} from '../sitemap.ts';

// ---------------------------------------------------------------------------
// routesToSitemapEntries
// ---------------------------------------------------------------------------

describe('routesToSitemapEntries', () => {
  const baseConfig: ResolvedSitemapConfig = {
    siteUrl: 'https://example.com',
    changefreq: 'weekly',
    priority: 0.5,
    lastmod: '2025-01-01T00:00:00.000Z',
  };

  it('includes static public routes', () => {
    const routes: DiscoveredRoute[] = [
      { pattern: '/' },
      { pattern: '/about' },
      { pattern: '/blog' },
    ];
    const entries = routesToSitemapEntries(routes, baseConfig);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.loc)).toEqual([
      'https://example.com/',
      'https://example.com/about',
      'https://example.com/blog',
    ]);
  });

  it('excludes private routes (paths with _ segments)', () => {
    const routes: DiscoveredRoute[] = [
      { pattern: '/' },
      { pattern: '/_middleware' },
      { pattern: '/_error' },
      { pattern: '/admin/_internal' },
    ];
    const entries = routesToSitemapEntries(routes, baseConfig);
    expect(entries).toHaveLength(1);
    expect(entries[0].loc).toBe('https://example.com/');
  });

  it('excludes dynamic routes by default', () => {
    const routes: DiscoveredRoute[] = [
      { pattern: '/' },
      { pattern: '/blog/:slug' },
      { pattern: '/docs/**' },
    ];
    const entries = routesToSitemapEntries(routes, baseConfig);
    expect(entries).toHaveLength(1);
    expect(entries[0].loc).toBe('https://example.com/');
  });

  it('includes dynamic routes when dynamicPaths provides expansions', () => {
    const routes: DiscoveredRoute[] = [
      { pattern: '/' },
      { pattern: '/blog/:slug' },
    ];
    const config: ResolvedSitemapConfig = {
      ...baseConfig,
      dynamicPaths: {
        '/blog/:slug': ['/blog/hello', '/blog/world'],
      },
    };
    const entries = routesToSitemapEntries(routes, config);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.loc)).toEqual([
      'https://example.com/',
      'https://example.com/blog/hello',
      'https://example.com/blog/world',
    ]);
  });

  it('sets lastmod, changefreq, and priority on every entry', () => {
    const routes: DiscoveredRoute[] = [{ pattern: '/about' }];
    const entries = routesToSitemapEntries(routes, baseConfig);
    expect(entries[0]).toEqual({
      loc: 'https://example.com/about',
      lastmod: '2025-01-01T00:00:00.000Z',
      changefreq: 'weekly',
      priority: 0.5,
    });
  });

  it('strips trailing slashes from siteUrl', () => {
    const config: ResolvedSitemapConfig = {
      ...baseConfig,
      siteUrl: 'https://example.com/',
    };
    const entries = routesToSitemapEntries([{ pattern: '/about' }], config);
    expect(entries[0].loc).toBe('https://example.com/about');
  });

  it('falls back to http://localhost and warns when siteUrl is empty', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config: ResolvedSitemapConfig = {
      ...baseConfig,
      siteUrl: '',
    };
    const entries = routesToSitemapEntries([{ pattern: '/about' }], config);
    expect(entries[0].loc).toBe('http://localhost/about');
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('returns empty array for empty routes', () => {
    const entries = routesToSitemapEntries([], baseConfig);
    expect(entries).toEqual([]);
  });

  it('skips dynamic routes with empty expansions array', () => {
    const routes: DiscoveredRoute[] = [{ pattern: '/blog/:slug' }];
    const config: ResolvedSitemapConfig = {
      ...baseConfig,
      dynamicPaths: { '/blog/:slug': [] },
    };
    const entries = routesToSitemapEntries(routes, config);
    expect(entries).toHaveLength(0);
  });

  it('excludes routes matching exact exclude patterns', () => {
    const routes: DiscoveredRoute[] = [
      { pattern: '/' },
      { pattern: '/about' },
      { pattern: '/login' },
    ];
    const config: ResolvedSitemapConfig = {
      ...baseConfig,
      exclude: ['/login'],
    };
    const entries = routesToSitemapEntries(routes, config);
    expect(entries.map((e) => e.loc)).toEqual([
      'https://example.com/',
      'https://example.com/about',
    ]);
  });

  it('excludes routes matching glob exclude patterns', () => {
    const routes: DiscoveredRoute[] = [
      { pattern: '/' },
      { pattern: '/admin' },
      { pattern: '/admin/users' },
      { pattern: '/admin/settings' },
      { pattern: '/about' },
    ];
    const config: ResolvedSitemapConfig = {
      ...baseConfig,
      exclude: ['/admin/**'],
    };
    const entries = routesToSitemapEntries(routes, config);
    expect(entries.map((e) => e.loc)).toEqual([
      'https://example.com/',
      'https://example.com/about',
    ]);
  });
});

// ---------------------------------------------------------------------------
// buildSitemapXml
// ---------------------------------------------------------------------------

describe('buildSitemapXml', () => {
  it('produces valid XML with urlset namespace', () => {
    const entries: SitemapEntry[] = [
      {
        loc: 'https://example.com/',
        lastmod: '2025-01-01T00:00:00.000Z',
        changefreq: 'weekly',
        priority: 0.5,
      },
    ];
    const xml = buildSitemapXml(entries);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });

  it('includes loc, lastmod, changefreq, and priority for each entry', () => {
    const entries: SitemapEntry[] = [
      {
        loc: 'https://example.com/about',
        lastmod: '2025-06-01T00:00:00.000Z',
        changefreq: 'daily',
        priority: 0.8,
      },
    ];
    const xml = buildSitemapXml(entries);
    expect(xml).toContain('<loc>https://example.com/about</loc>');
    expect(xml).toContain('<lastmod>2025-06-01T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<changefreq>daily</changefreq>');
    expect(xml).toContain('<priority>0.8</priority>');
  });

  it('escapes special XML characters in URLs', () => {
    const entries: SitemapEntry[] = [
      {
        loc: 'https://example.com/search?q=a&b=c',
        lastmod: '2025-01-01T00:00:00.000Z',
        changefreq: 'weekly',
        priority: 0.5,
      },
    ];
    const xml = buildSitemapXml(entries);
    expect(xml).toContain('<loc>https://example.com/search?q=a&amp;b=c</loc>');
    expect(xml).not.toContain('<loc>https://example.com/search?q=a&b=c</loc>');
  });

  it('produces empty urlset for no entries', () => {
    const xml = buildSitemapXml([]);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
    expect(xml).not.toContain('<url>');
  });

  it('handles multiple entries', () => {
    const entries: SitemapEntry[] = [
      { loc: 'https://example.com/', lastmod: '2025-01-01T00:00:00.000Z', changefreq: 'daily', priority: 1 },
      { loc: 'https://example.com/about', lastmod: '2025-01-01T00:00:00.000Z', changefreq: 'weekly', priority: 0.5 },
    ];
    const xml = buildSitemapXml(entries);
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(2);
  });

  it('omits optional elements when not provided', () => {
    const entries: SitemapEntry[] = [{ loc: 'https://example.com/' }];
    const xml = buildSitemapXml(entries);
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).not.toContain('<lastmod>');
    expect(xml).not.toContain('<changefreq>');
    expect(xml).not.toContain('<priority>');
  });
});
