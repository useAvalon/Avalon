import { describe, expect, it } from "vitest";
import type { JsonRpcRequest, JsonRpcSuccess } from "../protocol/types.ts";
import { createAvalonMcpServer } from "../server.ts";

const server = createAvalonMcpServer();

async function call(method: string, params?: Record<string, unknown>, id: number | null = 1) {
	const req: JsonRpcRequest = { jsonrpc: "2.0", id, method, params };
	return server.handleMessage(req);
}

function resultOf(res: unknown): Record<string, unknown> {
	return (res as JsonRpcSuccess).result as Record<string, unknown>;
}

describe("MCP protocol handling", () => {
	it("initialize echoes a supported protocol version and advertises capabilities", async () => {
		const res = await call("initialize", { protocolVersion: "2025-06-18" });
		const result = resultOf(res);
		expect(result.protocolVersion).toBe("2025-06-18");
		expect(result.capabilities).toMatchObject({ tools: {}, resources: {}, prompts: {} });
		expect((result.serverInfo as { name: string }).name).toBe("avalon-mcp");
	});

	it("falls back to the latest version when the client asks for an unsupported one", async () => {
		const res = await call("initialize", { protocolVersion: "1999-01-01" });
		expect(resultOf(res).protocolVersion).toBe("2025-06-18");
	});

	it("returns null for notifications", async () => {
		const res = await server.handleMessage({
			jsonrpc: "2.0",
			method: "notifications/initialized",
		});
		expect(res).toBeNull();
	});

	it("lists tools, resources, templates, and prompts", async () => {
		const tools = resultOf(await call("tools/list")).tools as unknown[];
		const resources = resultOf(await call("resources/list")).resources as unknown[];
		const templates = resultOf(await call("resources/templates/list"))
			.resourceTemplates as unknown[];
		const prompts = resultOf(await call("prompts/list")).prompts as unknown[];
		expect(tools.length).toBeGreaterThanOrEqual(7);
		expect(resources.length).toBeGreaterThanOrEqual(4);
		expect(templates.length).toBeGreaterThanOrEqual(1);
		expect(prompts.length).toBeGreaterThanOrEqual(3);
	});

	it("responds to ping with an empty object", async () => {
		expect(resultOf(await call("ping"))).toEqual({});
	});

	it("reports a title in serverInfo", async () => {
		const info = resultOf(await call("initialize", { protocolVersion: "2025-06-18" }))
			.serverInfo as { title?: string };
		expect(info.title).toBe("Avalon Framework");
	});

	it("marks all tools as read-only", async () => {
		const tools = resultOf(await call("tools/list")).tools as Array<{
			annotations?: { readOnlyHint?: boolean };
		}>;
		expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
	});

	it("returns MethodNotFound for unknown methods", async () => {
		const res = (await call("does/not/exist")) as { error: { code: number } };
		expect(res.error.code).toBe(-32601);
	});
});

describe("tools/call", () => {
	it("converts an Astro directive via avalon_hydration_directive", async () => {
		const res = resultOf(
			await call("tools/call", {
				name: "avalon_hydration_directive",
				arguments: { behavior: "client:load" },
			}),
		);
		const text = (res.content as Array<{ text: string }>)[0].text;
		expect(text).toContain("on:client");
		expect(text).toContain("Astro");
	});

	it("lints Astro-isms via avalon_lint", async () => {
		const res = resultOf(
			await call("tools/call", {
				name: "avalon_lint",
				arguments: { code: "<C client:visible />" },
			}),
		);
		const text = (res.content as Array<{ text: string }>)[0].text;
		expect(text).toContain("client:visible");
		expect(text).toContain("island={{ condition: 'on:visible' }}");
	});

	it("reports a clean lint for valid Avalon code", async () => {
		const res = resultOf(
			await call("tools/call", {
				name: "avalon_lint",
				arguments: { code: "<C island={{ condition: 'on:idle' }} />" },
			}),
		);
		const text = (res.content as Array<{ text: string }>)[0].text;
		expect(text).toContain("No Astro-isms");
	});

	it("errors on an unknown tool", async () => {
		const res = (await call("tools/call", { name: "nope" })) as { error: { code: number } };
		expect(res.error.code).toBe(-32602);
	});
});

describe("resources/read", () => {
	it("reads the directive cheat sheet", async () => {
		const res = resultOf(await call("resources/read", { uri: "avalon://directives" }));
		const text = (res.contents as Array<{ text: string }>)[0].text;
		expect(text).toContain("island");
		expect(text).toContain("on:visible");
	});

	it("reads a templated docs topic", async () => {
		const res = resultOf(await call("resources/read", { uri: "avalon://docs/server-actions" }));
		const text = (res.contents as Array<{ text: string }>)[0].text;
		expect(text).toContain("defineAction");
	});

	it("errors on an unknown resource", async () => {
		const res = (await call("resources/read", { uri: "avalon://nope" })) as {
			error: { code: number };
		};
		expect(res.error.code).toBe(-32602);
	});
});

describe("prompts/get", () => {
	it("builds the avalon_island prompt", async () => {
		const res = resultOf(
			await call("prompts/get", {
				name: "avalon_island",
				arguments: { component: "a counter", hydration: "on:visible" },
			}),
		);
		const messages = res.messages as Array<{ content: { text: string } }>;
		expect(messages[0].content.text).toContain("a counter");
		expect(messages[0].content.text).toContain("Do NOT use Astro");
	});
});
