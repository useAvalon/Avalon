import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../types";
import { generateSampleMiddleware } from "./middleware";

describe("generateSampleMiddleware", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("generates middleware using defineHandler from nitro", () => {
		const result = generateSampleMiddleware(baseConfig);
		expect(result).toContain("import { defineHandler } from 'nitro';");
		expect(result).toContain("defineHandler((event)");
	});

	it("middleware uses h3 v2 web API (event.req.method, event.url.pathname)", () => {
		const result = generateSampleMiddleware(baseConfig);
		expect(result).toContain("event.req.method");
		expect(result).toContain("event.url.pathname");
	});

	it("middleware does not use deprecated event.method or event.path", () => {
		const result = generateSampleMiddleware(baseConfig);
		// Should not contain the deprecated shorthand properties
		expect(result).not.toMatch(/event\.method[^.]/);
		expect(result).not.toMatch(/event\.path[^n]/);
	});

	it("middleware exports default handler", () => {
		const result = generateSampleMiddleware(baseConfig);
		expect(result).toContain("export default defineHandler");
	});

	it("all middleware options generate the same defineHandler middleware", () => {
		for (const middleware of ["h3", "hono", "elysia"] as const) {
			const config: ProjectConfig = { ...baseConfig, middleware };
			const result = generateSampleMiddleware(config);
			expect(result).toContain("import { defineHandler } from 'nitro';");
			expect(result).toContain("event.req.method");
			expect(result).toContain("event.url.pathname");
			expect(result).toContain("console.log");
			expect(result).toContain("new Date().toISOString()");
		}
	});
});
