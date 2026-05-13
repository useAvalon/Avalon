/**
 * JSON-LD structured data generation and HTML injection.
 *
 * Produces Schema.org-compliant JSON-LD for WebPage, WebSite, Article,
 * BreadcrumbList, and SearchAction types.
 */

import type { SeoConfig, PersonConfig, OrganizationConfig } from './config.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageMetadata {
  title?: string;
  description?: string;
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
    imageWidth?: number;
    imageHeight?: number;
  };
}

export interface ArticleMetadata {
  title: string;
  description?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  authorUrl?: string;
  section?: string;
  tags?: string[];
  wordCount?: number;
}

// ---------------------------------------------------------------------------
// JSON-LD Builders
// ---------------------------------------------------------------------------

/**
 * Build a Schema.org WebPage JSON-LD object from page metadata.
 */
export function buildWebPageJsonLd(metadata: PageMetadata, url: string): object {
  const jsonLd: Record<string, string> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url,
  };

  if (metadata.title) jsonLd['name'] = metadata.title;
  if (metadata.description) jsonLd['description'] = metadata.description;
  if (metadata.openGraph?.image) jsonLd['image'] = metadata.openGraph.image;

  return jsonLd;
}

/**
 * Build a Schema.org WebSite JSON-LD object, optionally with SearchAction.
 */
export function buildWebSiteJsonLd(config: SeoConfig): object {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: config.siteUrl,
    name: config.siteName,
  };

  if (config.searchPath) {
    const baseUrl = config.siteUrl.replace(/\/+$/, '');
    const param = config.searchQueryParam || 'q';
    jsonLd.potentialAction = {
      '@type': 'SearchAction',
      target: `${baseUrl}${config.searchPath}?${param}={search_term_string}`,
      'query-input': 'required name=search_term_string',
    };
  }

  return jsonLd;
}

/**
 * Build a Schema.org BreadcrumbList JSON-LD object from a URL path.
 *
 * Generates breadcrumb items from the path segments:
 * /docs/guides/performance → Home > Docs > Guides > Performance
 */
export function buildBreadcrumbListJsonLd(urlPath: string, siteUrl: string): object | null {
  const segments = urlPath.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const baseUrl = siteUrl.replace(/\/+$/, '');

  const items: object[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: baseUrl || '/',
    },
  ];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const name = segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const isLast = i === segments.length - 1;
    const entry: Record<string, unknown> = {
      '@type': 'ListItem',
      position: i + 2,
      name,
    };
    if (!isLast) {
      entry.item = `${baseUrl}/${segments.slice(0, i + 1).join('/')}`;
    }
    items.push(entry);
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/**
 * Build a Schema.org Article JSON-LD object from page metadata.
 *
 * Includes author as Person (with full E-E-A-T fields), publisher as
 * Organization with logo ImageObject, and image as ImageObject with dimensions.
 */
export function buildArticleJsonLd(
  metadata: ArticleMetadata,
  url: string,
  config: SeoConfig,
): object {
  const siteUrl = config.siteUrl.replace(/\/+$/, '');
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: metadata.title,
    mainEntityOfPage: url,
  };

  if (metadata.description) jsonLd.description = metadata.description;

  // Image as ImageObject with dimensions (required for rich results)
  const imageUrl = metadata.image || config.defaultOgImage?.url;
  if (imageUrl) {
    const imgObj: Record<string, unknown> = {
      '@type': 'ImageObject',
      url: imageUrl.startsWith('http') ? imageUrl : `${siteUrl}${imageUrl}`,
    };
    const width = metadata.imageWidth || config.defaultOgImage?.width;
    const height = metadata.imageHeight || config.defaultOgImage?.height;
    if (width) imgObj.width = width;
    if (height) imgObj.height = height;
    jsonLd.image = imgObj;
  }

  if (metadata.datePublished) jsonLd.datePublished = metadata.datePublished;
  if (metadata.dateModified) jsonLd.dateModified = metadata.dateModified;

  // Author as full Person schema (E-E-A-T)
  jsonLd.author = buildPersonJsonLd(metadata, config);

  // Publisher as Organization with logo ImageObject
  jsonLd.publisher = buildPublisherJsonLd(config);

  if (metadata.wordCount) jsonLd.wordCount = metadata.wordCount;
  if (metadata.section) jsonLd.articleSection = metadata.section;
  if (metadata.tags?.length) jsonLd.keywords = metadata.tags.join(', ');

  // Speakable specification
  if (config.speakable && config.speakableSelectors?.length) {
    jsonLd.speakable = {
      '@type': 'SpeakableSpecification',
      cssSelector: config.speakableSelectors,
    };
  }

  return jsonLd;
}

// ---------------------------------------------------------------------------
// Person & Organization builders
// ---------------------------------------------------------------------------

function buildPersonJsonLd(metadata: ArticleMetadata, config: SeoConfig): object {
  if (config.author) {
    return buildFullPersonJsonLd(config.author);
  }

  // Fallback: minimal person from article metadata
  if (metadata.author) {
    const person: Record<string, string> = {
      '@type': 'Person',
      name: metadata.author,
    };
    if (metadata.authorUrl) person.url = metadata.authorUrl;
    return person;
  }

  return { '@type': 'Person', name: config.siteName };
}

function buildFullPersonJsonLd(person: PersonConfig): object {
  const jsonLd: Record<string, unknown> = {
    '@type': 'Person',
    name: person.name,
  };

  if (person.url) jsonLd.url = person.url;
  if (person.image) jsonLd.image = person.image;
  if (person.jobTitle) jsonLd.jobTitle = person.jobTitle;
  if (person.description) jsonLd.description = person.description;
  if (person.worksFor) {
    jsonLd.worksFor = {
      '@type': 'Organization',
      name: person.worksFor.name,
      ...(person.worksFor.url && { url: person.worksFor.url }),
    };
  }
  if (person.sameAs?.length) jsonLd.sameAs = person.sameAs;

  return jsonLd;
}

function buildPublisherJsonLd(config: SeoConfig): object {
  if (config.publisher) {
    const pub: Record<string, unknown> = {
      '@type': 'Organization',
      name: config.publisher.name,
    };
    if (config.publisher.url) pub.url = config.publisher.url;
    if (config.publisher.logo) {
      pub.logo = {
        '@type': 'ImageObject',
        url: config.publisher.logo.url,
        ...(config.publisher.logo.width && { width: config.publisher.logo.width }),
        ...(config.publisher.logo.height && { height: config.publisher.logo.height }),
      };
    }
    return pub;
  }

  // Fallback: use siteName
  const siteUrl = config.siteUrl.replace(/\/+$/, '');
  return {
    '@type': 'Organization',
    name: config.siteName,
    url: siteUrl,
  };
}

// ---------------------------------------------------------------------------
// HTML Injection
// ---------------------------------------------------------------------------

/**
 * Inject a JSON-LD script tag into the HTML string before `</head>`.
 */
export function injectJsonLd(html: string, jsonLd: object): string {
  const closingHeadIdx = html.toLowerCase().indexOf('</head>');
  if (closingHeadIdx === -1) return html;

  const script = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  return html.slice(0, closingHeadIdx) + script + html.slice(closingHeadIdx);
}
