// @avalon/agent-optimization — Public API

// Plugin entry point
export { agentOptimization } from './src/plugin.ts';

// Config schema and validation
export { validateConfig, AgentOptimizationConfigSchema, SitemapConfigSchema, LlmsConfigSchema } from './src/config.ts';
export type { AgentOptimizationConfig, SitemapConfig, LlmsConfig } from './src/config.ts';

// Sitemap utilities
export { buildSitemapXml, routesToSitemapEntries } from './src/sitemap.ts';
export type { SitemapEntry, DiscoveredRoute, ResolvedSitemapConfig } from './src/sitemap.ts';

// Markdown content negotiation
export { htmlToMarkdown, buildFrontMatter, shouldServeMarkdown } from './src/markdown.ts';
export type { PageMetadata } from './src/markdown.ts';

// Structured data injection
export { buildWebPageJsonLd, buildWebSiteJsonLd, injectJsonLd } from './src/structured-data.ts';

// llms.txt generation
export { routesToLlmsEntries, buildLlmsTxt, buildLlmsFullTxt } from './src/llms.ts';
export type { LlmsEntry, LlmsRoute, ResolvedLlmsConfig } from './src/llms.ts';

