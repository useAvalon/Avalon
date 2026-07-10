/**
 * A tiny, dependency-free Model Context Protocol server.
 *
 * It speaks JSON-RPC 2.0 and implements the core MCP methods: `initialize`,
 * `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`,
 * `resources/read`, `prompts/list`, `prompts/get`, and `ping`.
 *
 * The class is transport-agnostic: {@link McpServer.handleMessage} takes a
 * parsed JSON-RPC message and returns the response object (or `null` for
 * notifications). {@link connectStdio} wires it to newline-delimited stdio,
 * which is the transport MCP clients launch by default.
 *
 * @module protocol/server
 */

import {
	type ContentBlock,
	ErrorCode,
	type JsonRpcErrorResponse,
	type JsonRpcId,
	type JsonRpcRequest,
	type JsonRpcResponse,
	type JsonRpcSuccess,
	type PromptDefinition,
	type ResourceDefinition,
	type ResourceTemplateDefinition,
	type ServerInfo,
	type ToolDefinition,
} from "./types.ts";

/**
 * Protocol versions this server understands, newest first. During
 * `initialize` we echo the client's version when we support it, otherwise we
 * offer our latest — the behaviour the MCP spec requires.
 */
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export class McpServer {
	private readonly tools = new Map<string, ToolDefinition>();
	private readonly resources = new Map<string, ResourceDefinition>();
	private readonly resourceTemplates: ResourceTemplateDefinition[] = [];
	private readonly prompts = new Map<string, PromptDefinition>();

	constructor(private readonly info: ServerInfo) {}

	registerTool(tool: ToolDefinition): this {
		this.tools.set(tool.name, tool);
		return this;
	}

	registerResource(resource: ResourceDefinition): this {
		this.resources.set(resource.uri, resource);
		return this;
	}

	registerResourceTemplate(template: ResourceTemplateDefinition): this {
		this.resourceTemplates.push(template);
		return this;
	}

	registerPrompt(prompt: PromptDefinition): this {
		this.prompts.set(prompt.name, prompt);
		return this;
	}

	/**
	 * Handle a single parsed JSON-RPC message.
	 *
	 * @returns the response to send, or `null` when the message is a
	 * notification (no `id`) that requires no reply.
	 */
	async handleMessage(message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
		const isNotification = message.id === undefined || message.id === null;
		const id = message.id ?? null;

		try {
			switch (message.method) {
				case "initialize":
					return this.ok(id, this.handleInitialize(message.params ?? {}));
				case "ping":
					return this.ok(id, {});
				case "notifications/initialized":
				case "notifications/cancelled":
					return null;
				case "tools/list":
					return this.ok(id, { tools: this.listTools() });
				case "tools/call":
					return this.ok(id, await this.callTool(message.params ?? {}));
				case "resources/list":
					return this.ok(id, { resources: this.listResources() });
				case "resources/templates/list":
					return this.ok(id, { resourceTemplates: this.listResourceTemplates() });
				case "resources/read":
					return this.ok(id, await this.readResource(message.params ?? {}));
				case "prompts/list":
					return this.ok(id, { prompts: this.listPrompts() });
				case "prompts/get":
					return this.ok(id, await this.getPrompt(message.params ?? {}));
				default:
					if (isNotification) return null;
					return this.fail(id, ErrorCode.MethodNotFound, `Unknown method: ${message.method}`);
			}
		} catch (err) {
			if (isNotification) return null;
			const rpcErr = err as { rpcCode?: number; message?: string };
			return this.fail(
				id,
				rpcErr.rpcCode ?? ErrorCode.InternalError,
				rpcErr.message ?? "Internal error",
			);
		}
	}

	// --- method handlers ----------------------------------------------------

	private handleInitialize(params: Record<string, unknown>) {
		const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
		const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
			? requested
			: LATEST_PROTOCOL_VERSION;

		return {
			protocolVersion,
			capabilities: {
				tools: { listChanged: false },
				resources: { listChanged: false },
				prompts: { listChanged: false },
			},
			serverInfo: {
				name: this.info.name,
				version: this.info.version,
				...(this.info.title ? { title: this.info.title } : {}),
			},
			...(this.info.instructions ? { instructions: this.info.instructions } : {}),
		};
	}

	private listTools() {
		return [...this.tools.values()].map((t) => ({
			name: t.name,
			...(t.title ? { title: t.title } : {}),
			description: t.description,
			inputSchema: t.inputSchema,
			...(t.annotations ? { annotations: t.annotations } : {}),
		}));
	}

	private async callTool(params: Record<string, unknown>) {
		const name = params.name;
		if (typeof name !== "string") {
			throw this.rpcError(ErrorCode.InvalidParams, "tools/call requires a string `name`");
		}
		const tool = this.tools.get(name);
		if (!tool) {
			throw this.rpcError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
		}
		const args = (params.arguments as Record<string, unknown>) ?? {};
		return await tool.handler(args);
	}

	private listResources() {
		return [...this.resources.values()].map((r) => ({
			uri: r.uri,
			name: r.name,
			...(r.title ? { title: r.title } : {}),
			...(r.description ? { description: r.description } : {}),
			...(r.mimeType ? { mimeType: r.mimeType } : {}),
		}));
	}

	private listResourceTemplates() {
		return this.resourceTemplates.map((t) => ({
			uriTemplate: t.uriTemplate,
			name: t.name,
			...(t.title ? { title: t.title } : {}),
			...(t.description ? { description: t.description } : {}),
			...(t.mimeType ? { mimeType: t.mimeType } : {}),
		}));
	}

	private async readResource(params: Record<string, unknown>) {
		const uri = params.uri;
		if (typeof uri !== "string") {
			throw this.rpcError(ErrorCode.InvalidParams, "resources/read requires a string `uri`");
		}

		const staticResource = this.resources.get(uri);
		if (staticResource) {
			const text = await staticResource.read();
			return {
				contents: [{ uri, mimeType: staticResource.mimeType ?? "text/markdown", text }],
			};
		}

		for (const template of this.resourceTemplates) {
			const text = await template.read(uri);
			if (text !== null) {
				return {
					contents: [{ uri, mimeType: template.mimeType ?? "text/markdown", text }],
				};
			}
		}

		throw this.rpcError(ErrorCode.InvalidParams, `Resource not found: ${uri}`);
	}

	private listPrompts() {
		return [...this.prompts.values()].map((p) => ({
			name: p.name,
			...(p.title ? { title: p.title } : {}),
			description: p.description,
			...(p.arguments ? { arguments: p.arguments } : {}),
		}));
	}

	private async getPrompt(params: Record<string, unknown>) {
		const name = params.name;
		if (typeof name !== "string") {
			throw this.rpcError(ErrorCode.InvalidParams, "prompts/get requires a string `name`");
		}
		const prompt = this.prompts.get(name);
		if (!prompt) {
			throw this.rpcError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
		}
		const args = (params.arguments as Record<string, string>) ?? {};
		return await prompt.handler(args);
	}

	// --- helpers ------------------------------------------------------------

	private ok(id: JsonRpcId, result: unknown): JsonRpcSuccess {
		return { jsonrpc: "2.0", id, result };
	}

	private fail(id: JsonRpcId, code: number, message: string): JsonRpcErrorResponse {
		return { jsonrpc: "2.0", id, error: { code, message } };
	}

	private rpcError(code: number, message: string): Error & { rpcCode: number } {
		const err = new Error(message) as Error & { rpcCode: number };
		err.rpcCode = code;
		return err;
	}
}

/** Convenience helper for building a plain text tool result. */
export function textResult(text: string, isError = false) {
	const content: ContentBlock[] = [{ type: "text", text }];
	return isError ? { content, isError: true } : { content };
}

/**
 * Connect an {@link McpServer} to a newline-delimited JSON-RPC stream (stdio).
 *
 * MCP's stdio transport frames each message as a single line of JSON with no
 * embedded newlines, so we buffer stdin and dispatch on each newline.
 */
export function connectStdio(server: McpServer): void {
	let buffer = "";

	process.stdin.setEncoding("utf8");
	process.stdin.on("data", (chunk: string) => {
		buffer += chunk;
		let newlineIndex = buffer.indexOf("\n");
		while (newlineIndex !== -1) {
			const line = buffer.slice(0, newlineIndex).trim();
			buffer = buffer.slice(newlineIndex + 1);
			if (line.length > 0) void dispatchLine(server, line);
			newlineIndex = buffer.indexOf("\n");
		}
	});

	process.stdin.on("end", () => process.exit(0));
}

async function dispatchLine(server: McpServer, line: string): Promise<void> {
	let parsed: JsonRpcRequest;
	try {
		parsed = JSON.parse(line);
	} catch {
		writeMessage({
			jsonrpc: "2.0",
			id: null,
			error: { code: ErrorCode.ParseError, message: "Parse error" },
		});
		return;
	}

	const response = await server.handleMessage(parsed);
	if (response) writeMessage(response);
}

function writeMessage(message: JsonRpcResponse): void {
	process.stdout.write(`${JSON.stringify(message)}\n`);
}
