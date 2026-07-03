import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../types";
import { generateHelloRoute } from "./api-routes";

describe("generateHelloRoute", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("generates route using defineHandler from nitro", () => {
		const result = generateHelloRoute(baseConfig);
		expect(result).toContain("import { defineHandler } from 'nitro';");
		expect(result).toContain("defineHandler(");
	});

	it("route returns Response.json with hello message", () => {
		const result = generateHelloRoute(baseConfig);
		expect(result).toContain("Response.json(");
		expect(result).toContain("message: 'Hello from Avalon!'");
	});

	it("route exports default handler", () => {
		const result = generateHelloRoute(baseConfig);
		expect(result).toContain("export default defineHandler");
	});

	it("all middleware options generate the same defineHandler route", () => {
		for (const middleware of ["h3", "hono", "elysia"] as const) {
			const config: ProjectConfig = { ...baseConfig, middleware };
			const result = generateHelloRoute(config);
			expect(result).toContain("import { defineHandler } from 'nitro';");
			expect(result).toContain("Response.json(");
			expect(result).toContain("Hello from Avalon!");
			expect(result).toContain("export default");
		}
	});
});
