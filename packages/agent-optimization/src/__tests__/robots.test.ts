import { describe, expect, it } from "vitest";
import { buildRobotsTxt } from "../robots.ts";

describe("buildRobotsTxt", () => {
	it("includes sitemap URL", () => {
		const txt = buildRobotsTxt("https://example.com/");
		expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
	});

	it("allows OAI-SearchBot for ChatGPT Search", () => {
		const txt = buildRobotsTxt("https://example.com");
		expect(txt).toContain("User-agent: OAI-SearchBot");
		expect(txt).toMatch(/User-agent: OAI-SearchBot[\s\S]*Allow: \//);
	});
});
