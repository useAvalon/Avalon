/**
 * JSON-LD structured data generation and HTML injection.
 *
 * Produces Schema.org-compliant JSON-LD for WebPage and WebSite types,
 * and injects the serialized script tags into rendered HTML.
 */

import type { PageMetadata } from './markdown.ts';

// ---------------------------------------------------------------------------
// JSON-LD Builders
// ---------------------------------------------------------------------------

/**
 * Build a Schema.org WebPage JSON-LD object from page metadata.
 *
 * Includes `name` (from title), `description`, and optionally `image`
 * (from openGraph.image). Always includes `@context` and `@type`.
 */
export function buildWebPageJsonLd(metadata: PageMetadata, url: string): object {
  const jsonLd: Record<string, string> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url,
  };

  if (metadata.title) {
    jsonLd['name'] = metadata.title;
  }

  if (metadata.description) {
    jsonLd['description'] = metadata.description;
  }

  if (metadata.openGraph?.image) {
    jsonLd['image'] = metadata.openGraph.image;
  }

  return jsonLd;
}

/**
 * Build a Schema.org WebSite JSON-LD object.
 */
export function buildWebSiteJsonLd(siteUrl: string, siteName: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: siteUrl,
    name: siteName,
  };
}

// ---------------------------------------------------------------------------
// HTML Injection
// ---------------------------------------------------------------------------

/**
 * Inject a JSON-LD script tag into the HTML string before `</head>`.
 *
 * If the HTML has no `</head>` tag, the original HTML is returned unchanged.
 */
export function injectJsonLd(html: string, jsonLd: object): string {
  const closingHeadIdx = html.toLowerCase().indexOf('</head>');
  if (closingHeadIdx === -1) return html;

  const script = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  return html.slice(0, closingHeadIdx) + script + html.slice(closingHeadIdx);
}
