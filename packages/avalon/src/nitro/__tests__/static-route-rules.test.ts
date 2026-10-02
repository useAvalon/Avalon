import { describe, expect, it } from "vitest";
import { createDefaultStaticAssetRouteRules } from "../config.ts";

describe("createDefaultStaticAssetRouteRules", () => {
	it("does not add webfont suffix rules (h3 preMerge rejects overlapping /**/*.ext patterns)", () => {
		const rules = createDefaultStaticAssetRouteRules({});
		expect(rules["/**/*.woff"]).toBeUndefined();
		expect(rules["/**/*.woff2"]).toBeUndefined();
		expect(rules["/**/*.woff*"]).toBeUndefined();
		expect(rules["/assets/**"]?.headers?.["Cache-Control"]).toContain("immutable");
	});
});
