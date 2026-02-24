import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  AgentOptimizationConfigSchema,
  SitemapConfigSchema,
} from '../config.ts';

describe('SitemapConfigSchema', () => {
  it('parses a valid sitemap config with defaults', () => {
    const result = SitemapConfigSchema.safeParse({ siteUrl: 'https://example.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.siteUrl).toBe('https://example.com');
      expect(result.data.changefreq).toBe('weekly');
      expect(result.data.priority).toBe(0.5);
    }
  });

  it('rejects an invalid URL', () => {
    const result = SitemapConfigSchema.safeParse({ siteUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects priority outside 0-1', () => {
    const result = SitemapConfigSchema.safeParse({
      siteUrl: 'https://example.com',
      priority: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('accepts dynamicPaths as record of string arrays', () => {
    const result = SitemapConfigSchema.safeParse({
      siteUrl: 'https://example.com',
      dynamicPaths: { '/blog/[slug]': ['/blog/hello', '/blog/world'] },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dynamicPaths).toEqual({
        '/blog/[slug]': ['/blog/hello', '/blog/world'],
      });
    }
  });
});

describe('AgentOptimizationConfigSchema', () => {
  it('parses an empty config', () => {
    const result = AgentOptimizationConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts sitemap as boolean', () => {
    const result = AgentOptimizationConfigSchema.safeParse({ sitemap: true });
    expect(result.success).toBe(true);
  });

  it('accepts sitemap as config object', () => {
    const result = AgentOptimizationConfigSchema.safeParse({
      sitemap: { siteUrl: 'https://example.com', siteName: 'My Site' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid sitemap config', () => {
    const result = AgentOptimizationConfigSchema.safeParse({
      sitemap: { siteUrl: 123 },
    });
    expect(result.success).toBe(false);
  });
});

describe('validateConfig', () => {
  it('returns parsed config for valid input', () => {
    const config = validateConfig({
      sitemap: { siteUrl: 'https://example.com' },
      markdown: true,
    });
    expect(config.markdown).toBe(true);
    expect(config.sitemap).toEqual(
      expect.objectContaining({ siteUrl: 'https://example.com' })
    );
  });

  it('throws with descriptive error for invalid input', () => {
    expect(() => validateConfig({ sitemap: { siteUrl: 'bad' } })).toThrow(
      'Invalid agent-optimization config'
    );
  });

  it('throws with field path in error message', () => {
    try {
      validateConfig({ sitemap: { siteUrl: 'bad' } });
    } catch (e: any) {
      expect(e.message).toContain('sitemap');
    }
  });

  it('returns defaults for empty config', () => {
    const config = validateConfig({});
    expect(config.sitemap).toBeUndefined();
    expect(config.markdown).toBeUndefined();
    expect(config.structuredData).toBeUndefined();
  });
});
