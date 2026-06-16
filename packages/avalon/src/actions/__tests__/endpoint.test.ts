import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActionError, defineAction } from "../define.ts";
import { defineActionHandler } from "../endpoint.ts";
import { flattenActions } from "../registry.ts";

const server = {
	greet: defineAction({
		input: z.object({ name: z.string().min(1) }),
		handler: ({ name }) => ({ message: `Hello, ${name}!` }),
	}),
	noInput: defineAction({ handler: () => ({ ok: true }) }),
	boom: defineAction({
		handler: () => {
			throw new Error("kaboom");
		},
	}),
	guarded: defineAction({
		handler: () => {
			throw new ActionError({ code: "UNAUTHORIZED", message: "login required" });
		},
	}),
	user: {
		like: defineAction({
			input: z.object({ postId: z.string() }),
			handler: ({ postId }) => ({ liked: postId }),
		}),
	},
};

const registry = flattenActions(server);

function makeEvent(
	name: string,
	{
		method = "POST",
		json,
		headers,
	}: { method?: string; json?: unknown; headers?: Record<string, string> } = {},
): any {
	const url = new URL(`http://localhost/_actions/${name}`);
	const body = json !== undefined ? JSON.stringify(json) : undefined;
	const request = new Request(url, {
		method,
		body,
		headers: { "content-type": "application/json", ...headers },
	});
	return { url, web: { request }, context: { params: { name } } };
}

describe("defineActionHandler", () => {
	const handler = defineActionHandler({ registry, isDev: true });

	it("runs an action and returns { data }", async () => {
		const res = await handler(makeEvent("greet", { json: { name: "World" } }));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({ data: { message: "Hello, World!" } });
	});

	it("runs a no-input action", async () => {
		const res = await handler(makeEvent("noInput", {}));
		expect(res.status).toBe(200);
		expect((await res.json()).data).toEqual({ ok: true });
	});

	it("resolves nested namespace actions by dotted name", async () => {
		const res = await handler(makeEvent("user.like", { json: { postId: "p1" } }));
		expect(res.status).toBe(200);
		expect((await res.json()).data).toEqual({ liked: "p1" });
	});

	it("returns 404 for an unknown action", async () => {
		const res = await handler(makeEvent("missing", { json: {} }));
		expect(res.status).toBe(404);
		expect((await res.json()).error.code).toBe("NOT_FOUND");
	});

	it("returns 405 for non-POST methods", async () => {
		const res = await handler(makeEvent("greet", { method: "GET" }));
		expect(res.status).toBe(405);
		expect((await res.json()).error.code).toBe("METHOD_NOT_ALLOWED");
	});

	it("returns 400 with field issues on validation failure", async () => {
		const res = await handler(makeEvent("greet", { json: { name: "" } }));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error.code).toBe("BAD_REQUEST");
		expect(body.error.fields.name).toBeDefined();
	});

	it("passes through a thrown ActionError", async () => {
		const res = await handler(makeEvent("guarded", { json: {} }));
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error.code).toBe("UNAUTHORIZED");
		expect(body.error.message).toBe("login required");
	});

	it("returns 500 with message in dev for unexpected errors", async () => {
		const res = await handler(makeEvent("boom", { json: {} }));
		expect(res.status).toBe(500);
		expect((await res.json()).error.message).toBe("kaboom");
	});

	it("hides unexpected error messages in production", async () => {
		const prodHandler = defineActionHandler({ registry, isDev: false });
		const res = await prodHandler(makeEvent("boom", { json: {} }));
		expect(res.status).toBe(500);
		expect((await res.json()).error.message).toBe("Internal server error");
	});

	it("exposes cookies and headers via context", async () => {
		const ctxServer = {
			whoami: defineAction({
				handler: (_input, ctx) => ({ uid: ctx.cookies.get("uid"), ua: ctx.headers.get("x-test") }),
			}),
		};
		const ctxHandler = defineActionHandler({ registry: flattenActions(ctxServer), isDev: true });
		const res = await ctxHandler(
			makeEvent("whoami", { json: {}, headers: { cookie: "uid=u123", "x-test": "abc" } }),
		);
		expect((await res.json()).data).toEqual({ uid: "u123", ua: "abc" });
	});
});
