import { describe, it, expect } from 'vitest';
import {
  buildWebPageJsonLd,
  buildWebSiteJsonLd,
  injectJsonLd,
} from '../structured-data.ts';
import type { PageMetadata } from '../markdown.ts';

describe('buildWebPageJsonLd', () => {
  it('produces JSON-LD with title and description', () => {
    const metadata: PageMetadata = {
      title: 'About Us',
      description: 'Learn more about our company',
    };
    const result = buildWebPageJsonLd(metadata, 'https://example.com/about') as Record<string, unknown>;

    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('WebPage');
    expect(result['name']).toBe('About Us');
    expect(result['description']).toBe('Learn more about our company');
    expect(result['url']).toBe('https://example.com/about');
  });

  it('includes image when openGraph.image is present', () => {
    const metadata: PageMetadata = {
      title: 'Blog Post',
      description: 'A great post',
      openGraph: { image: 'https://example.com/og.png' },
    };
    const result = buildWebPageJsonLd(metadata, 'https://example.com/blog/1') as Record<string, unknown>;

    expect(result['image']).toBe('https://example.com/og.png');
  });

  it('omits image when openGraph has no image', () => {
    const metadata: PageMetadata = {
      title: 'Page',
      openGraph: { title: 'OG Title' },
    };
    const result = buildWebPageJsonLd(metadata, 'https://example.com/') as Record<string, unknown>;

    expect(result).not.toHaveProperty('image');
  });

  it('omits name when title is missing', () => {
    const metadata: PageMetadata = { description: 'desc only' };
    const result = buildWebPageJsonLd(metadata, 'https://example.com/') as Record<string, unknown>;

    expect(result).not.toHaveProperty('name');
    expect(result['description']).toBe('desc only');
  });

  it('omits description when description is missing', () => {
    const metadata: PageMetadata = { title: 'Title only' };
    const result = buildWebPageJsonLd(metadata, 'https://example.com/') as Record<string, unknown>;

    expect(result['name']).toBe('Title only');
    expect(result).not.toHaveProperty('description');
  });

  it('always includes @context and @type', () => {
    const result = buildWebPageJsonLd({}, 'https://example.com/') as Record<string, unknown>;

    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('WebPage');
  });

  it('produces valid JSON when serialized', () => {
    const metadata: PageMetadata = {
      title: 'Test "quotes" & <special>',
      description: 'A description with\nnewlines',
    };
    const result = buildWebPageJsonLd(metadata, 'https://example.com/');
    const json = JSON.stringify(result);

    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed['name']).toBe('Test "quotes" & <special>');
  });
});

describe('buildWebSiteJsonLd', () => {
  it('produces JSON-LD with siteUrl and siteName', () => {
    const result = buildWebSiteJsonLd('https://example.com', 'My Site') as Record<string, unknown>;

    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('WebSite');
    expect(result['url']).toBe('https://example.com');
    expect(result['name']).toBe('My Site');
  });

  it('always includes @context and @type', () => {
    const result = buildWebSiteJsonLd('https://test.dev', 'Test') as Record<string, unknown>;

    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('WebSite');
  });
});

describe('injectJsonLd', () => {
  it('inserts script tag before </head>', () => {
    const html = '<html><head><title>Test</title></head><body></body></html>';
    const jsonLd = { '@context': 'https://schema.org', '@type': 'WebPage' };
    const result = injectJsonLd(html, jsonLd);

    expect(result).toContain('<script type="application/ld+json">');
    expect(result).toContain('"@context":"https://schema.org"');
    // Script should appear before </head>
    const scriptIdx = result.indexOf('<script type="application/ld+json">');
    const headCloseIdx = result.indexOf('</head>');
    expect(scriptIdx).toBeLessThan(headCloseIdx);
  });

  it('returns original HTML when no </head> tag exists', () => {
    const html = '<div>No head here</div>';
    const jsonLd = { '@type': 'WebPage' };
    const result = injectJsonLd(html, jsonLd);

    expect(result).toBe(html);
  });

  it('handles case-insensitive </head> matching', () => {
    const html = '<html><HEAD><title>Test</title></HEAD><body></body></html>';
    const jsonLd = { '@type': 'WebPage' };
    const result = injectJsonLd(html, jsonLd);

    expect(result).toContain('<script type="application/ld+json">');
  });

  it('produces valid JSON inside the script tag', () => {
    const html = '<html><head></head><body></body></html>';
    const jsonLd = buildWebPageJsonLd(
      { title: 'Test', description: 'Desc' },
      'https://example.com/',
    );
    const result = injectJsonLd(html, jsonLd);

    const match = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('WebPage');
    expect(parsed['name']).toBe('Test');
  });

  it('preserves existing head content', () => {
    const html = '<html><head><meta charset="utf-8"><title>Hi</title></head><body></body></html>';
    const jsonLd = { '@type': 'WebPage' };
    const result = injectJsonLd(html, jsonLd);

    expect(result).toContain('<meta charset="utf-8">');
    expect(result).toContain('<title>Hi</title>');
  });
});
