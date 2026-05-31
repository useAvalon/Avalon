// @useavalon/seo — Public API

export type { OrganizationConfig, PersonConfig, SeoConfig, SeoConfigInput } from "./src/config.ts";

// Config schema and validation
export {
	OrganizationConfigSchema,
	PersonConfigSchema,
	SeoConfigSchema,
	validateSeoConfig,
} from "./src/config.ts";
// Meta tag utilities
export {
	extractArticleMetaFromHtml,
	extractMetadataFromHtml,
	extractMetaProperty,
	injectMetaTags,
} from "./src/meta-tags.ts";
// Plugin entry point
export { seo } from "./src/plugin.ts";
export type { ArticleMetadata, PageMetadata } from "./src/structured-data.ts";
// Structured data utilities
export {
	buildArticleJsonLd,
	buildBreadcrumbListJsonLd,
	buildWebPageJsonLd,
	buildWebSiteJsonLd,
	injectJsonLd,
} from "./src/structured-data.ts";
