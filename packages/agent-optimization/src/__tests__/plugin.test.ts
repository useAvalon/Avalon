import { describe, expect, it } from "vitest";
import { agentOptimization } from "../plugin.ts";

describe("agentOptimization", () => {
	it("returns a valid Vite plugin array for empty config", () => {
		const plugins = agentOptimization({});
		expect(Array.isArray(plugins)).toBe(true);
		expect(plugins.length).toBeGreaterThan(0);
		for (const plugin of plugins) {
			expect(plugin).toHaveProperty("name");
			expect(typeof plugin.name).toBe("string");
		}
	});

	it("returns plugins with the expected coordination plugin name", () => {
		const plugins = agentOptimization({});
		const names = plugins.map((p) => p.name);
		expect(names).toContain("agent-optimization:coordination");
	});

	it("returns plugins when all features are enabled", () => {
		const plugins = agentOptimization({
			sitemap: { siteUrl: "https://example.com" },
			markdown: true,
		});
		expect(plugins.length).toBeGreaterThan(0);
		expect(plugins[0].name).toBe("agent-optimization:coordination");
	});

	it("returns plugins when all features are disabled", () => {
		const plugins = agentOptimization({
			sitemap: false,
			markdown: false,
		});
		expect(plugins.length).toBeGreaterThan(0);
		// Still returns the coordination plugin, but features are disabled internally
		expect(plugins[0].name).toBe("agent-optimization:coordination");
	});

	it("returns plugins when sitemap is true (boolean shorthand)", () => {
		// sitemap: true should work — warns about missing siteUrl but doesn't throw
		const plugins = agentOptimization({ sitemap: true });
		expect(plugins.length).toBeGreaterThan(0);
	});

	it("throws descriptive error for invalid config", () => {
		expect(() => agentOptimization({ sitemap: { siteUrl: "not-a-url" } } as any)).toThrow(
			"Invalid agent-optimization config",
		);
	});

	it("throws for invalid sitemap priority", () => {
		expect(() =>
			agentOptimization({
				sitemap: { siteUrl: "https://example.com", priority: 5 },
			} as any),
		).toThrow("Invalid agent-optimization config");
	});

	it("throws for wrong type on markdown field", () => {
		expect(() => agentOptimization({ markdown: "yes" } as any)).toThrow(
			"Invalid agent-optimization config",
		);
	});

	it("coordination plugin has configureServer hook", () => {
		const plugins = agentOptimization({ markdown: true });
		const coordination = plugins.find((p) => p.name === "agent-optimization:coordination");
		expect(coordination).toBeDefined();
		expect(coordination!.configureServer).toBeDefined();
		expect(typeof coordination!.configureServer).toBe("function");
	});
});
