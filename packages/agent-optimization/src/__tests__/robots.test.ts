import { describe, expect, it } from "vitest";
import { buildRobotsTxt } from "../robots.ts";

describe("buildRobotsTxt", () => {
	it("includes sitemap URL", () => {
		const txt = buildRobotsTxt("https://example.com/");
		expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
	});
});
