import { describe, expect, it } from "vitest";
import { islandSsrExpression, isStaticallyClientOnly } from "../island-ssr-flag.ts";

describe("isStaticallyClientOnly", () => {
	it("detects ssr: false in an object literal", () => {
		expect(isStaticallyClientOnly("{ ssr: false }")).toBe(true);
		expect(isStaticallyClientOnly("{ condition: 'on:idle', ssr: false }")).toBe(true);
		expect(isStaticallyClientOnly("{ ...defaults, ssr: false }")).toBe(true);
	});

	it("ignores nested ssr and a later spread that can override", () => {
		expect(isStaticallyClientOnly("{ nested: { ssr: false } }")).toBe(false);
		expect(isStaticallyClientOnly("{ ssr: false, ...overrides }")).toBe(false);
		expect(isStaticallyClientOnly("{ ssr: true }")).toBe(false);
	});

	it("rejects runtime values and SSR islands", () => {
		expect(isStaticallyClientOnly("opts")).toBe(false);
		expect(isStaticallyClientOnly("{ condition: 'on:client' }")).toBe(false);
		expect(isStaticallyClientOnly(null)).toBe(false);
	});
});

describe("islandSsrExpression", () => {
	it("reads an explicit ssr field", () => {
		expect(islandSsrExpression("{ ssr: false }")).toContain("__i.ssr !== undefined");
		expect(islandSsrExpression("{ ssr: false }")).not.toContain("clientOnly");
	});
});
