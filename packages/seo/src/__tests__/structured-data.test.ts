import { describe, it, expect } from 'vitest';
import {
  buildWebPageJsonLd,
  buildWebSiteJsonLd,
  buildBreadcrumbListJsonLd,
  buildArticleJsonLd,
  injectJsonLd,
} from '../structured-data.ts';
import type { SeoConfig } from '../config.ts';

const baseSeoConfig: SeoConfig = {
  siteUrl: 'https://example.com',
  siteName: 'My Site',
  locale: 'en_US',
  canonical: true,
  openGraph: true,
  twitterCards: true,
  structuredData: true,
  breadcrumbs: true,
  speakable: true,
  speakableSelectors: ['h1', '[data-speakable]'],
  searchQueryParam: 'q',
};

describe('buildWebPageJsonLd', () => {
  it('builds a WebPage with title and description', () => {
    const result = buildWebPageJsonLd(
      { title: 'Test Page', description: 'A test page' },
      'https://example.com/test',
    );
    expect(result).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      url: 'https://example.com/test',
      name: 'Test Page',
      description: 'A test page',
    });
  });

  it('includes image from openGraph', () => {
    const result = buildWebPageJsonLd(
      { title: 'Test', openGraph: { image: '/img.png' } },
      'https://example.com/test',
    );
    expect(result).toHaveProperty('image', '/img.png');
  });
});

describe('buildWebSiteJsonLd', () => {
  it('builds a basic WebSite', () => {
    const result = buildWebSiteJsonLd(baseSeoConfig);
    expect(result).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      url: 'https://example.com',
      name: 'My Site',
    });
  });

  it('includes SearchAction when searchPath is configured', () => {
    const config = { ...baseSeoConfig, searchPath: '/search' };
    const result = buildWebSiteJsonLd(config) as any;
    expect(result.potentialAction).toEqual({
      '@type': 'SearchAction',
      target: 'https://example.com/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    });
  });
});

describe('buildBreadcrumbListJsonLd', () => {
  it('returns null for root path', () => {
    expect(buildBreadcrumbListJsonLd('/', 'https://example.com')).toBeNull();
  });

  it('builds breadcrumbs from path segments', () => {
    const result = buildBreadcrumbListJsonLd('/docs/guides/performance', 'https://example.com') as any;
    expect(result['@type']).toBe('BreadcrumbList');
    expect(result.itemListElement).toHaveLength(4); // Home + 3 segments
    expect(result.itemListElement[0].name).toBe('Home');
    expect(result.itemListElement[1].name).toBe('Docs');
    expect(result.itemListElement[2].name).toBe('Guides');
    expect(result.itemListElement[3].name).toBe('Performance');
    // Last item should not have "item" property
    expect(result.itemListElement[3]).not.toHaveProperty('item');
  });
});

describe('buildArticleJsonLd', () => {
  it('builds Article with full Person author and Organization publisher', () => {
    const config: SeoConfig = {
      ...baseSeoConfig,
      author: {
        name: 'John Doe',
        url: 'https://example.com/about',
        image: 'https://example.com/john.jpg',
        jobTitle: 'Staff Engineer',
        sameAs: ['https://twitter.com/johndoe'],
      },
      publisher: {
        name: 'My Company',
        url: 'https://example.com',
        logo: { url: 'https://example.com/logo.png', width: 600, height: 60 },
      },
      defaultOgImage: { url: '/default-og.png', width: 1200, height: 630 },
    };

    const result = buildArticleJsonLd(
      {
        title: 'Test Article',
        description: 'A test article',
        datePublished: '2026-01-01',
        dateModified: '2026-01-02',
        section: 'Tech',
        tags: ['javascript', 'seo'],
      },
      'https://example.com/blog/test',
      config,
    ) as any;

    expect(result['@type']).toBe('Article');
    expect(result.headline).toBe('Test Article');
    expect(result.author['@type']).toBe('Person');
    expect(result.author.name).toBe('John Doe');
    expect(result.author.jobTitle).toBe('Staff Engineer');
    expect(result.author.sameAs).toEqual(['https://twitter.com/johndoe']);
    expect(result.publisher['@type']).toBe('Organization');
    expect(result.publisher.logo['@type']).toBe('ImageObject');
    expect(result.publisher.logo.width).toBe(600);
    expect(result.image['@type']).toBe('ImageObject');
    expect(result.image.width).toBe(1200);
    expect(result.image.height).toBe(630);
    expect(result.speakable['@type']).toBe('SpeakableSpecification');
    expect(result.speakable.cssSelector).toEqual(['h1', '[data-speakable]']);
    expect(result.articleSection).toBe('Tech');
    expect(result.keywords).toBe('javascript, seo');
  });

  it('uses image dimensions from metadata when provided', () => {
    const result = buildArticleJsonLd(
      {
        title: 'Test',
        image: '/hero.png',
        imageWidth: 800,
        imageHeight: 400,
      },
      'https://example.com/test',
      baseSeoConfig,
    ) as any;

    expect(result.image.url).toBe('https://example.com/hero.png');
    expect(result.image.width).toBe(800);
    expect(result.image.height).toBe(400);
  });
});

describe('injectJsonLd', () => {
  it('injects before </head>', () => {
    const html = '<html><head><title>Test</title></head><body></body></html>';
    const result = injectJsonLd(html, { '@type': 'WebPage' });
    expect(result).toContain('<script type="application/ld+json">{"@type":"WebPage"}</script></head>');
  });

  it('returns unchanged HTML when no </head> found', () => {
    const html = '<div>no head</div>';
    expect(injectJsonLd(html, {})).toBe(html);
  });
});
