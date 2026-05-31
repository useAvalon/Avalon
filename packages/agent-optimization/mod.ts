// @useavalon/agent-optimization — Public API

export type { AgentOptimizationConfig, LlmsConfig, SitemapConfig } from "./src/config.ts";

// Config schema and validation
export {
	AgentOptimizationConfigSchema,
	LlmsConfigSchema,
	SitemapConfigSchema,
	validateConfig,
} from "./src/config.ts";
export type { LlmsEntry, LlmsRoute, ResolvedLlmsConfig } from "./src/llms.ts";
// llms.txt generation
export { buildLlmsFullTxt, buildLlmsTxt, routesToLlmsEntries } from "./src/llms.ts";
export type { PageMetadata } from "./src/markdown.ts";

// Markdown content negotiation
export { buildFrontMatter, htmlToMarkdown, shouldServeMarkdown } from "./src/markdown.ts";
// Plugin entry point
export { agentOptimization } from "./src/plugin.ts";
export type { DiscoveredRoute, ResolvedSitemapConfig, SitemapEntry } from "./src/sitemap.ts";
// Sitemap utilities
export { buildSitemapXml, routesToSitemapEntries } from "./src/sitemap.ts";
