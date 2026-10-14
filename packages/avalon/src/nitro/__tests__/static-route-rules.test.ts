import { describe, expect, it } from "vitest";
import { createDefaultFrameworkRouteRules, createDefaultStaticAssetRouteRules } from "../config.ts";

describe("createDefaultFrameworkRouteRules", () => {
	it("disables cache on server island and action endpoints", () => {
		const rules = createDefaultFrameworkRouteRules();
		expect(rules["/_server-islands/**"]?.cache).toBe(false);
		expect(rules["/_actions/**"]?.cache).toBe(false);
	});
});

describe("createDefaultStaticAssetRouteRules", () => {
	it("does not add webfont suffix rules (h3 preMerge rejects overlapping /**/*.ext patterns)", () => {
		const rules = createDefaultStaticAssetRouteRules({});
		expect(rules["/**/*.woff"]).toBeUndefined();
		expect(rules["/**/*.woff2"]).toBeUndefined();
		expect(rules["/**/*.woff*"]).toBeUndefined();
		expect(rules["/assets/**"]?.headers?.["Cache-Control"]).toContain("immutable");
	});
});
