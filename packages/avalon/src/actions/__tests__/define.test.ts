import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ACTION_ERROR_STATUS, ActionError, defineAction, isActionError } from "../define.ts";
import { isAction } from "../registry.ts";
import { ACTION_MARKER } from "../types.ts";

describe("defineAction", () => {
	it("returns a branded action with default accept mode 'json'", () => {
		const action = defineAction({
			input: z.object({ name: z.string() }),
			handler: ({ name }) => `Hello, ${name}!`,
		});

		expect((action as any)[ACTION_MARKER]).toBe(true);
		expect(action.accept).toBe("json");
		expect(isAction(action)).toBe(true);
	});

	it("respects an explicit accept mode", () => {
		const action = defineAction({
			accept: "form",
			handler: () => "ok",
		});
		expect(action.accept).toBe("form");
	});

	it("normalizes the handler to always return a promise", async () => {
		const action = defineAction({ handler: () => 42 });
		const result = action.handler(undefined as never, {} as never);
		expect(result).toBeInstanceOf(Promise);
		expect(await result).toBe(42);
	});

	it("passes input and context through to the handler", async () => {
		const action = defineAction({
			input: z.object({ n: z.number() }),
			handler: ({ n }, ctx) => ({ doubled: n * 2, hasEvent: Boolean(ctx) }),
		});
		const ctx = {
			event: {},
			request: undefined,
			headers: new Headers(),
			cookies: { get: () => undefined },
		};
		expect(await action.handler({ n: 21 }, ctx as never)).toEqual({ doubled: 42, hasEvent: true });
	});
});

describe("ActionError", () => {
	it("derives the HTTP status from the code", () => {
		expect(new ActionError({ code: "NOT_FOUND" }).status).toBe(404);
		expect(new ActionError({ code: "UNAUTHORIZED" }).status).toBe(401);
		expect(new ActionError({ code: "INTERNAL_SERVER_ERROR" }).status).toBe(500);
	});

	it("uses a sensible default message per code", () => {
		expect(new ActionError({ code: "FORBIDDEN" }).message).toBe("Forbidden");
		expect(new ActionError({ code: "BAD_REQUEST", message: "custom" }).message).toBe("custom");
	});

	it("carries validation fields", () => {
		const err = new ActionError({ code: "BAD_REQUEST", fields: { email: ["Invalid"] } });
		expect(err.fields).toEqual({ email: ["Invalid"] });
	});

	it("rehydrates from a status + wire body", () => {
		const err = ActionError.fromStatus(404, { code: "NOT_FOUND", message: "Unknown action" });
		expect(err).toBeInstanceOf(ActionError);
		expect(err.code).toBe("NOT_FOUND");
		expect(err.message).toBe("Unknown action");
	});

	it("falls back to a status-derived code when the body lacks one", () => {
		const err = ActionError.fromStatus(401, undefined);
		expect(err.code).toBe("UNAUTHORIZED");
	});

	it("isActionError narrows correctly", () => {
		expect(isActionError(new ActionError({ code: "CONFLICT" }))).toBe(true);
		expect(isActionError(new Error("nope"))).toBe(false);
		expect(isActionError({ code: "CONFLICT" })).toBe(false);
	});

	it("maps every code to a status", () => {
		for (const status of Object.values(ACTION_ERROR_STATUS)) {
			expect(typeof status).toBe("number");
		}
	});
});
