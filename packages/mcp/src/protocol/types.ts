/**
 * Minimal type definitions for the JSON-RPC 2.0 messages and the subset of the
 * Model Context Protocol (MCP) that this server implements.
 *
 * We deliberately avoid depending on `@modelcontextprotocol/sdk`. The MCP
 * stdio + JSON-RPC 2.0 surface this server needs is small and stable, so a
 * self-contained implementation keeps the package zero-dependency: faster cold
 * starts for a CLI that agents spawn repeatedly, no transitive supply-chain
 * surface, and it runs in any Node/Bun environment without an install step.
 *
 * @module protocol/types
 */

/** JSON value type used across request/response payloads. */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/** A JSON-RPC 2.0 message id (absent on notifications). */
export type JsonRpcId = string | number | null;

/** A JSON-RPC 2.0 request or notification (notifications omit `id`). */
export interface JsonRpcRequest {
	jsonrpc: "2.0";
	id?: JsonRpcId;
	method: string;
	params?: Record<string, unknown>;
}

/** A successful JSON-RPC 2.0 response. */
export interface JsonRpcSuccess {
	jsonrpc: "2.0";
	id: JsonRpcId;
	result: unknown;
}

/** A JSON-RPC 2.0 error object. */
export interface JsonRpcErrorObject {
	code: number;
	message: string;
	data?: unknown;
}

/** A failed JSON-RPC 2.0 response. */
export interface JsonRpcErrorResponse {
	jsonrpc: "2.0";
	id: JsonRpcId;
	error: JsonRpcErrorObject;
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcErrorResponse;

/** Standard JSON-RPC error codes plus MCP-specific ones. */
export const ErrorCode = {
	ParseError: -32700,
	InvalidRequest: -32600,
	MethodNotFound: -32601,
	InvalidParams: -32602,
	InternalError: -32603,
} as const;

// --- MCP content blocks ----------------------------------------------------

/** A block of text returned by a tool, resource, or prompt. */
export interface TextContent {
	type: "text";
	text: string;
}

export type ContentBlock = TextContent;

// --- Tools -----------------------------------------------------------------

/** JSON Schema describing a tool's input. Kept loose on purpose. */
export interface JsonSchema {
	type: "object";
	properties?: Record<string, unknown>;
	required?: string[];
	[key: string]: unknown;
}

/** Result returned from a tool invocation. */
export interface ToolResult {
	content: ContentBlock[];
	isError?: boolean;
}

/** Behavioural hints a client can use to decide how to surface a tool. */
export interface ToolAnnotations {
	/** The tool only reads data and has no side effects. */
	readOnlyHint?: boolean;
	/** The tool may interact with entities outside its own closed world. */
	openWorldHint?: boolean;
	/** Human-friendly title for display. */
	title?: string;
}

/** A tool the server exposes. */
export interface ToolDefinition {
	name: string;
	title?: string;
	description: string;
	inputSchema: JsonSchema;
	annotations?: ToolAnnotations;
	handler: (args: Record<string, unknown>) => ToolResult | Promise<ToolResult>;
}

// --- Resources -------------------------------------------------------------

/** A static resource the server exposes. */
export interface ResourceDefinition {
	uri: string;
	name: string;
	title?: string;
	description?: string;
	mimeType?: string;
	read: () => string | Promise<string>;
}

/** A templated resource (RFC 6570-style URI template, e.g. `avalon://docs/{topic}`). */
export interface ResourceTemplateDefinition {
	uriTemplate: string;
	name: string;
	title?: string;
	description?: string;
	mimeType?: string;
	/** Resolve a concrete URI to content, or return null if it doesn't match. */
	read: (uri: string) => string | null | Promise<string | null>;
}

// --- Prompts ---------------------------------------------------------------

export interface PromptArgument {
	name: string;
	description?: string;
	required?: boolean;
}

export interface PromptMessage {
	role: "user" | "assistant";
	content: ContentBlock;
}

export interface PromptResult {
	description?: string;
	messages: PromptMessage[];
}

export interface PromptDefinition {
	name: string;
	title?: string;
	description: string;
	arguments?: PromptArgument[];
	handler: (args: Record<string, string>) => PromptResult | Promise<PromptResult>;
}

/** Metadata describing the server, sent during `initialize`. */
export interface ServerInfo {
	name: string;
	version: string;
	/** Human-friendly display name. */
	title?: string;
	/** Free-form guidance surfaced to the model by MCP clients. */
	instructions?: string;
}
