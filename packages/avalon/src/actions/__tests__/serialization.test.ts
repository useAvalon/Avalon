import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActionError } from "../define.ts";
import {
	parseClientResult,
	parseRequestInput,
	serializeError,
	zodIssuesToFields,
} from "../serialization.ts";

function eventWith(body: BodyInit | undefined, headers?: Record<string, string>): any {
	const request = new Request("http://localhost/_actions/x", {
		method: "POST",
		body,
		headers,
	});
	return { url: new URL("http://localhost/_actions/x"), web: { request } };
}

describe("parseRequestInput", () => {
	it("parses a JSON body", async () => {
		const event = eventWith(JSON.stringify({ name: "World" }), {
			"content-type": "application/json",
		});
		expect(await parseRequestInput(event, "json")).toEqual({ name: "World" });
	});

	it("returns undefined for an empty JSON body", async () => {
		const event = eventWith(undefined, { "content-type": "application/json" });
		expect(await parseRequestInput(event, "json")).toBeUndefined();
	});

	it("throws BAD_REQUEST on malformed JSON", async () => {
		const event = eventWith("{not json", { "content-type": "application/json" });
		await expect(parseRequestInput(event, "json")).rejects.toBeInstanceOf(ActionError);
	});

	it("parses urlencoded form bodies", async () => {
		const event = eventWith("email=a%40b.com&tag=x&tag=y", {
			"content-type": "application/x-www-form-urlencoded",
		});
		expect(await parseRequestInput(event, "form")).toEqual({
			email: "a@b.com",
			tag: ["x", "y"],
		});
	});

	it("parses multipart form data", async () => {
		const form = new FormData();
		form.set("email", "a@b.com");
		const event = eventWith(form);
		expect(await parseRequestInput(event, "form")).toEqual({ email: "a@b.com" });
	});

	it("treats a form content-type as form even when accept is json", async () => {
		const event = eventWith("a=1", { "content-type": "application/x-www-form-urlencoded" });
		expect(await parseRequestInput(event, "json")).toEqual({ a: "1" });
	});
});

describe("zodIssuesToFields", () => {
	it("maps issues to field → messages", () => {
		const schema = z.object({ email: z.string().email(), age: z.number().min(18) });
		const result = schema.safeParse({ email: "nope", age: 5 });
		expect(result.success).toBe(false);
		if (!result.success) {
			const fields = zodIssuesToFields(result.error);
			expect(Object.keys(fields)).toContain("email");
			expect(Object.keys(fields)).toContain("age");
		}
	});
});

describe("serializeError", () => {
	it("serializes an ActionError with its code/status/message", () => {
		const { status, body } = serializeError(
			new ActionError({ code: "UNAUTHORIZED", message: "nope" }),
			false,
		);
		expect(status).toBe(401);
		expect(body).toEqual({ code: "UNAUTHORIZED", message: "nope" });
	});

	it("includes fields for validation errors", () => {
		const { body } = serializeError(
			new ActionError({ code: "BAD_REQUEST", fields: { a: ["bad"] } }),
			false,
		);
		expect(body.fields).toEqual({ a: ["bad"] });
	});

	it("hides unexpected error messages in production", () => {
		const { status, body } = serializeError(new Error("secret stack"), false);
		expect(status).toBe(500);
		expect(body.code).toBe("INTERNAL_SERVER_ERROR");
		expect(body.message).toBe("Internal server error");
	});

	it("exposes unexpected error messages in development", () => {
		const { body } = serializeError(new Error("dev detail"), true);
		expect(body.message).toBe("dev detail");
	});
});

describe("parseClientResult", () => {
	it("returns data on a 200 response", async () => {
		const res = new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
		const result = await parseClientResult<{ ok: boolean }>(res);
		expect(result.error).toBeUndefined();
		expect(result.data).toEqual({ ok: true });
	});

	it("returns an ActionError on a failure response", async () => {
		const res = new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "no" } }), {
			status: 404,
		});
		const result = await parseClientResult(res);
		expect(result.data).toBeUndefined();
		expect(result.error).toBeInstanceOf(ActionError);
		expect(result.error?.code).toBe("NOT_FOUND");
	});
});
