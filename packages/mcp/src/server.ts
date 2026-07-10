/**
 * Assembles the Avalon MCP server: registers all tools, resources, and prompts
 * on a fresh {@link McpServer} instance.
 *
 * @module server
 */

import { createPrompts } from "./prompts.ts";
import { connectStdio, McpServer } from "./protocol/server.ts";
import { createResources, createResourceTemplates } from "./resources.ts";
import { createTools } from "./tools.ts";

/** Package version, kept in sync with package.json. */
export const AVALON_MCP_VERSION = "0.1.0";

const INSTRUCTIONS = [
	"This server provides authoritative knowledge about the Avalon Framework.",
	"CRITICAL: Avalon is NOT Astro. Avalon has no `client:*` template attributes.",
	"Control hydration with a single `island={{ condition: 'on:client' }}` prop on an imported component.",
	"When writing or reviewing Avalon code, use `avalon_lint` to catch Astro-isms and",
	"`avalon_hydration_directive` to get the correct condition syntax.",
].join(" ");

/**
 * Create a fully-configured Avalon MCP server instance.
 *
 * Exposed so it can be driven by any transport (stdio, tests, custom hosts).
 */
export function createAvalonMcpServer(): McpServer {
	const server = new McpServer({
		name: "avalon-mcp",
		version: AVALON_MCP_VERSION,
		title: "Avalon Framework",
		instructions: INSTRUCTIONS,
	});

	for (const tool of createTools()) server.registerTool(tool);
	for (const resource of createResources()) server.registerResource(resource);
	for (const template of createResourceTemplates()) server.registerResourceTemplate(template);
	for (const prompt of createPrompts()) server.registerPrompt(prompt);

	return server;
}

/**
 * Start the Avalon MCP server over stdio. This is what the `avalon-mcp` binary
 * calls; it never returns (it listens on stdin until the stream closes).
 */
export function runStdio(): void {
	const server = createAvalonMcpServer();
	// Announce on stderr so we don't corrupt the stdout JSON-RPC stream.
	process.stderr.write(`[avalon-mcp] v${AVALON_MCP_VERSION} listening on stdio\n`);
	connectStdio(server);
}
