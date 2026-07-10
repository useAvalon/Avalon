// @useavalon/mcp — Public API
//
// A Model Context Protocol (MCP) server that teaches AI agents how to use the
// Avalon Framework correctly — especially its `island` hydration directives,
// which are frequently confused with Astro's `client:*` attributes.

// Server assembly & runtime
export { AVALON_MCP_VERSION, createAvalonMcpServer, runStdio } from "./src/server.ts";

// Protocol primitives (for embedding the server in a custom host/transport)
export { connectStdio, McpServer, textResult } from "./src/protocol/server.ts";
export type {
	PromptDefinition,
	ResourceDefinition,
	ResourceTemplateDefinition,
	ServerInfo,
	ToolDefinition,
	ToolResult,
} from "./src/protocol/types.ts";

// Tool / resource / prompt factories
export { createPrompts } from "./src/prompts.ts";
export { createResources, createResourceTemplates } from "./src/resources.ts";
export { createTools } from "./src/tools.ts";

// Knowledge base (reusable outside the MCP server, e.g. in editor tooling)
export {
	API_ENTRIES,
	type ApiEntry,
	apiReferenceMarkdown,
} from "./src/knowledge/api.ts";
export {
	CONCEPT_MAP,
	convertClientDirective,
	convertSnippet,
	DIRECTIVE_MAP,
	type DirectiveMapping,
	type LintFinding,
	lintForAstroisms,
} from "./src/knowledge/astro-map.ts";
export {
	ALL_CONDITIONS,
	CORE_CONDITIONS,
	CUSTOM_DIRECTIVES,
	findCondition,
	type HydrationCondition,
	ISLAND_PROP_REFERENCE,
} from "./src/knowledge/directives.ts";
export {
	DOC_TOPICS,
	type DocTopic,
	getDoc,
	searchDocs,
} from "./src/knowledge/docs.ts";
export {
	scaffold,
	SCAFFOLD_KINDS,
	type ScaffoldKind,
	type ScaffoldTemplate,
} from "./src/knowledge/scaffold.ts";
