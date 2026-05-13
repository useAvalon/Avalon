# @useavalon/seo

SEO plugin for [Avalon](https://useavalon.dev) — auto-injects Open Graph, Twitter cards, canonical URLs, JSON-LD structured data, and font preconnect links into every page.

## Install

```bash
bun add @useavalon/seo
```

## Usage

Add the plugin to your `vite.config.ts`:

```ts
import { seo } from '@useavalon/seo';
import { avalon } from '@useavalon/avalon';
import { defineConfig } from 'vite';

export default defineConfig(async () => {
  const avalonPlugins = await avalon({ /* ... */ });

  return {
    plugins: [
      seo({
        siteUrl: 'https://mysite.com',
        siteName: 'My Site',
        defaultDescription: 'A site built with Avalon',
        defaultOgImage: {
          url: '/og-image.png',
          width: 1200,
          height: 630,
        },
        twitterSite: '@mysite',
        twitterCreator: '@author',
        searchPath: '/search',
        author: {
          name: 'Jane Doe',
          url: 'https://mysite.com/about',
          image: 'https://mysite.com/jane.jpg',
          jobTitle: 'Software Engineer',
          sameAs: ['https://twitter.com/janedoe', 'https://github.com/janedoe'],
        },
        publisher: {
          name: 'My Company',
          url: 'https://mysite.com',
          logo: { url: 'https://mysite.com/logo.png', width: 600, height: 60 },
        },
        fontPreconnect: [
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
        ],
      }),
      ...avalonPlugins,
    ],
  };
});
```

## What It Does

The plugin intercepts every HTML response and auto-injects missing SEO tags. It reads existing tags to avoid duplication — if your layout already sets `og:title`, the plugin won't add another one.

### Meta Tags

- **Canonical URL** — `<link rel="canonical">` from the current request path
- **Open Graph** — `og:title`, `og:description`, `og:url`, `og:type`, `og:locale`, `og:site_name`, `og:image` with `og:image:width` and `og:image:height`
- **Twitter Cards** — `twitter:card`, `twitter:site`, `twitter:creator`, `twitter:title`, `twitter:description`, `twitter:image`
- **Font Preconnect** — `<link rel="preconnect">` for configured font CDNs

### JSON-LD Structured Data

- **WebPage** — on every page
- **WebSite** — with `SearchAction` when `searchPath` is configured (enables Google sitelinks search box)
- **BreadcrumbList** — auto-generated from URL path segments
- **Article** — when the page has `article:published_time` meta tag, includes full Person author (E-E-A-T), Organization publisher with logo ImageObject, and image with dimensions
- **Speakable** — `SpeakableSpecification` on Article schema for voice engines

## Config Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `siteUrl` | `string` | required | Base URL of the site |
| `siteName` | `string` | required | Site name for OG and JSON-LD |
| `defaultDescription` | `string?` | — | Fallback meta description |
| `defaultOgImage` | `{ url, width?, height? }?` | — | Default OG image with dimensions |
| `twitterSite` | `string?` | — | Twitter handle for `twitter:site` |
| `twitterCreator` | `string?` | — | Twitter handle for `twitter:creator` |
| `locale` | `string?` | `'en_US'` | Default OG locale |
| `author` | `PersonConfig?` | — | Author info for Article JSON-LD |
| `publisher` | `OrganizationConfig?` | — | Publisher info for Article JSON-LD |
| `searchPath` | `string?` | — | Path to search page (enables SearchAction) |
| `searchQueryParam` | `string?` | `'q'` | Query param name for search |
| `canonical` | `boolean?` | `true` | Inject canonical URLs |
| `openGraph` | `boolean?` | `true` | Inject OG meta tags |
| `twitterCards` | `boolean?` | `true` | Inject Twitter card tags |
| `structuredData` | `boolean?` | `true` | Inject JSON-LD |
| `breadcrumbs` | `boolean?` | `true` | Inject BreadcrumbList JSON-LD |
| `speakable` | `boolean?` | `true` | Add Speakable to Article JSON-LD |
| `speakableSelectors` | `string[]?` | `['h1', '[data-speakable]']` | CSS selectors for speakable content |
| `fontPreconnect` | `string[]?` | — | URLs to preconnect for fonts |

## How Pages Opt Into Article Schema

The plugin reads `article:*` meta tags from the HTML to decide when to inject Article JSON-LD. Set these in your page's frontmatter/metadata:

```tsx
export const metadata = {
  title: 'My Blog Post',
  description: 'A great article about...',
};

// In your layout, emit these meta tags from frontmatter:
<meta property="article:published_time" content="2026-01-15" />
<meta property="article:modified_time" content="2026-02-01" />
<meta property="article:author" content="Jane Doe" />
<meta property="article:section" content="Tech" />
<meta property="article:tag" content="javascript" />
<meta property="article:tag" content="seo" />
```

When `article:published_time` is present, the plugin generates full Article JSON-LD with author, publisher, image dimensions, and speakable specification.

## License

MIT
