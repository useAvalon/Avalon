import { describe, expect, it } from "vitest";
import { islandSsrExpression, isStaticallyClientOnly } from "../island-ssr-flag.ts";

describe("isStaticallyClientOnly", () => {
	it("detects clientOnly: true in an object literal", () => {
		expect(isStaticallyClientOnly("{ clientOnly: true }")).toBe(true);
		expect(isStaticallyClientOnly("{ condition: 'on:idle', clientOnly: true }")).toBe(true);
	});

	it("detects ssr: false in an object literal", () => {
		expect(isStaticallyClientOnly("{ ssr: false }")).toBe(true);
	});

	it("rejects runtime values and SSR islands", () => {
		expect(isStaticallyClientOnly("opts")).toBe(false);
		expect(isStaticallyClientOnly("{ condition: 'on:client' }")).toBe(false);
		expect(isStaticallyClientOnly(null)).toBe(false);
	});
});

describe("islandSsrExpression", () => {
	it("prefers clientOnly over the page SSR default", () => {
		const expr = islandSsrExpression("{ clientOnly: true }");
		expect(expr).toContain("clientOnly === true ? false");
		expect(expr).toContain("{ clientOnly: true }");
	});

	it("still reads an explicit ssr field", () => {
		expect(islandSsrExpression("{ ssr: false }")).toContain("__i.ssr !== undefined");
	});
});
