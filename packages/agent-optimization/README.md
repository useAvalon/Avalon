# @useavalon/agent-optimization

AI agent optimization plugin for [Avalon](https://useavalon.dev) — serves llms.txt, markdown content negotiation, and sitemaps to make your site consumable by AI agents and LLMs.

## Install

```bash
bun add @useavalon/agent-optimization
```

## Usage

Add the plugin to your `vite.config.ts`:

```ts
import { agentOptimization } from '@useavalon/agent-optimization';
import { avalon } from '@useavalon/avalon';
import { defineConfig } from 'vite';

export default defineConfig(async () => {
  const avalonPlugins = await avalon({ /* ... */ });

  return {
    plugins: [
      agentOptimization({
        sitemap: {
          siteUrl: 'https://mysite.com',
          changefreq: 'weekly',
          exclude: ['/admin/**'],
        },
        markdown: true,
        llms: {
          siteUrl: 'https://mysite.com',
          siteName: 'My Site',
          siteDescription: 'A site built with Avalon',
          sections: {
            Pages: ['/'],
            Docs: ['/docs'],
            Blog: ['/blog'],
          },
          full: true,
        },
      }),
      ...avalonPlugins,
    ],
  };
});
```

## Features

### Sitemap (`/sitemap.xml`)

Auto-discovers routes from your Avalon pages directory and generates a Sitemap Protocol 0.9 compliant XML file. Excludes dynamic routes, private routes (`_`-prefixed), and paths matching your `exclude` patterns.

### Markdown Content Negotiation

When a request includes `Accept: text/markdown`, the plugin intercepts the HTML response and converts it to clean markdown with YAML front matter. This lets AI agents fetch your pages as structured text instead of parsing HTML.

```bash
curl -H "Accept: text/markdown" https://mysite.com/docs/intro
```

Returns:

```markdown
---
title: "Introduction"
description: "Get started with Avalon"
---

# Introduction

Get started with Avalon...
```

### llms.txt (`/llms.txt` and `/llms-full.txt`)

Implements the [llms.txt standard](https://llmstxt.org) — a markdown file at the site root that gives LLMs a structured overview of your content.

- **`/llms.txt`** — Concise index with site name, description, and categorized links
- **`/llms-full.txt`** — Full markdown content of all pages concatenated (when `full: true`)

## Config Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sitemap` | `boolean \| SitemapConfig` | — | Enable sitemap generation |
| `sitemap.siteUrl` | `string` | required | Base URL for sitemap entries |
| `sitemap.changefreq` | `string?` | `'weekly'` | Default change frequency |
| `sitemap.priority` | `number?` | `0.5` | Default priority (0–1) |
| `sitemap.dynamicPaths` | `Record<string, string[]>?` | — | Expand dynamic route params |
| `sitemap.exclude` | `string[]?` | — | Glob patterns to exclude |
| `markdown` | `boolean?` | — | Enable markdown content negotiation |
| `llms` | `boolean \| LlmsConfig` | — | Enable llms.txt generation |
| `llms.siteUrl` | `string` | required | Base URL for llms.txt links |
| `llms.siteName` | `string` | required | H1 heading in llms.txt |
| `llms.siteDescription` | `string?` | — | Blockquote description |
| `llms.sections` | `Record<string, string[]>?` | — | Group routes into named sections |
| `llms.exclude` | `string[]?` | — | Patterns to exclude |
| `llms.full` | `boolean?` | `false` | Generate llms-full.txt with full content |

## Relationship to @useavalon/seo

This plugin handles **AI/agent-facing** concerns. For **search-engine-facing** SEO (Open Graph, Twitter cards, canonical URLs, JSON-LD structured data), use [`@useavalon/seo`](https://www.npmjs.com/package/@useavalon/seo).

The two plugins complement each other and can be used together:

```ts
plugins: [
  seo({ siteUrl: '...', siteName: '...' }),
  agentOptimization({ sitemap: { siteUrl: '...' }, markdown: true, llms: { ... } }),
  ...avalonPlugins,
]
```

## License

MIT
