import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineAction } from "../define.ts";
import { flattenActions, isAction } from "../registry.ts";

describe("flattenActions", () => {
	const greet = defineAction({ handler: () => "hi" });
	const like = defineAction({ input: z.object({ id: z.string() }), handler: () => true });
	const follow = defineAction({ handler: () => true });

	it("flattens top-level actions by name", () => {
		const map = flattenActions({ greet });
		expect([...map.keys()]).toEqual(["greet"]);
		expect(map.get("greet")).toBe(greet);
	});

	it("flattens nested namespaces into dotted names", () => {
		const map = flattenActions({ greet, user: { like, social: { follow } } });
		expect(new Set(map.keys())).toEqual(new Set(["greet", "user.like", "user.social.follow"]));
		expect(map.get("user.like")).toBe(like);
		expect(map.get("user.social.follow")).toBe(follow);
	});

	it("ignores non-action, non-object values", () => {
		const map = flattenActions({ greet, version: 1 as any, label: "x" as any });
		expect([...map.keys()]).toEqual(["greet"]);
	});

	it("returns an empty map for null/undefined", () => {
		expect(flattenActions(null).size).toBe(0);
		expect(flattenActions(undefined).size).toBe(0);
	});

	it("never treats a namespace object as an action", () => {
		const map = flattenActions({ user: { like } });
		expect(isAction(map.get("user.like"))).toBe(true);
		// The namespace itself is not registered as an action.
		expect(map.has("user")).toBe(false);
	});
});
