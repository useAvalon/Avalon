// @useavalon/seo — Public API

// Plugin entry point
export { seo } from './src/plugin.ts';

// Config schema and validation
export { validateSeoConfig, SeoConfigSchema, PersonConfigSchema, OrganizationConfigSchema } from './src/config.ts';
export type { SeoConfig, SeoConfigInput, PersonConfig, OrganizationConfig } from './src/config.ts';

// Structured data utilities
export {
  buildWebPageJsonLd,
  buildWebSiteJsonLd,
  buildBreadcrumbListJsonLd,
  buildArticleJsonLd,
  injectJsonLd,
} from './src/structured-data.ts';
export type { PageMetadata, ArticleMetadata } from './src/structured-data.ts';

// Meta tag utilities
export {
  injectMetaTags,
  extractMetadataFromHtml,
  extractArticleMetaFromHtml,
  extractMetaProperty,
} from './src/meta-tags.ts';
