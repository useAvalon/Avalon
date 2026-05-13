import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../types";
import { generatePackageJson } from "./package-json";

describe("generatePackageJson", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("sets name, type, and private fields", () => {
		const pkg = JSON.parse(generatePackageJson(baseConfig));
		expect(pkg.name).toBe("my-app");
		expect(pkg.type).toBe("module");
		expect(pkg.private).toBe(true);
	});

	it("always includes @useavalon/avalon as dependency", () => {
		const pkg = JSON.parse(generatePackageJson(baseConfig));
		expect(pkg.dependencies["@useavalon/avalon"]).toBe("latest");
	});

	it("includes dev, build, preview scripts", () => {
		const pkg = JSON.parse(generatePackageJson(baseConfig));
		expect(pkg.scripts.dev).toBe("bunx --bun vite dev");
		expect(pkg.scripts.build).toBe("node build.mjs");
		expect(pkg.scripts.preview).toBe("node .output/server/index.mjs");
	});

	it("includes vite, typescript, nitro as devDependencies", () => {
		const pkg = JSON.parse(generatePackageJson(baseConfig));
		expect(pkg.devDependencies.vite).toBe("latest");
		expect(pkg.devDependencies.typescript).toBe("latest");
		expect(pkg.devDependencies.nitro).toBe("latest");
	});

	it("adds hono dependency when hono middleware selected", () => {
		const config: ProjectConfig = { ...baseConfig, middleware: "hono" };
		const pkg = JSON.parse(generatePackageJson(config));
		expect(pkg.dependencies.hono).toBe("latest");
	});

	it("adds elysia dependency when elysia middleware selected", () => {
		const config: ProjectConfig = { ...baseConfig, middleware: "elysia" };
		const pkg = JSON.parse(generatePackageJson(config));
		expect(pkg.dependencies.elysia).toBe("latest");
	});

	it("does not add extra middleware dep for h3 (included via nitro)", () => {
		const pkg = JSON.parse(generatePackageJson(baseConfig));
		expect(pkg.dependencies.h3).toBeUndefined();
		expect(pkg.dependencies.hono).toBeUndefined();
		expect(pkg.dependencies.elysia).toBeUndefined();
	});

	it("adds tailwindcss devDependencies when tailwind styling selected", () => {
		const config: ProjectConfig = { ...baseConfig, styling: "tailwind" };
		const pkg = JSON.parse(generatePackageJson(config));
		expect(pkg.devDependencies.tailwindcss).toBe("latest");
		expect(pkg.devDependencies["@tailwindcss/vite"]).toBe("latest");
	});

	it("adds tailwindcss and @shadcn/ui when shadcn styling selected", () => {
		const config: ProjectConfig = { ...baseConfig, styling: "shadcn" };
		const pkg = JSON.parse(generatePackageJson(config));
		expect(pkg.devDependencies.tailwindcss).toBe("latest");
		expect(pkg.devDependencies["@tailwindcss/vite"]).toBe("latest");
		expect(pkg.dependencies["@shadcn/ui"]).toBe("latest");
	});

	it("does not add tailwind deps for css-modules styling", () => {
		const pkg = JSON.parse(generatePackageJson(baseConfig));
		expect(pkg.devDependencies.tailwindcss).toBeUndefined();
		expect(pkg.dependencies["@shadcn/ui"]).toBeUndefined();
	});

	it("maps selected integrations to @useavalon/* packages", () => {
		const config: ProjectConfig = {
			...baseConfig,
			integrations: ["react", "vue"],
		};
		const pkg = JSON.parse(generatePackageJson(config));
		expect(pkg.dependencies["@useavalon/react"]).toBe("latest");
		expect(pkg.dependencies["@useavalon/vue"]).toBe("latest");
		// Runtime deps (react, vue) are peer deps of @useavalon/* packages, not listed directly
		expect(pkg.dependencies.react).toBeUndefined();
		expect(pkg.dependencies.vue).toBeUndefined();
	});

	it("includes @useavalon/agent-optimization when plugin selected", () => {
		const config: ProjectConfig = {
			...baseConfig,
			plugins: ["agent-optimization"],
		};
		const pkg = JSON.parse(generatePackageJson(config));
		expect(pkg.dependencies["@useavalon/agent-optimization"]).toBe("latest");
	});

	it("does not include @useavalon/agent-optimization when plugin not selected", () => {
		const pkg = JSON.parse(generatePackageJson(baseConfig));
		expect(pkg.dependencies["@useavalon/agent-optimization"]).toBeUndefined();
	});

	it("includes @useavalon/seo when seo plugin selected", () => {
		const config: ProjectConfig = {
			...baseConfig,
			plugins: ["seo"],
		};
		const pkg = JSON.parse(generatePackageJson(config));
		expect(pkg.dependencies["@useavalon/seo"]).toBe("latest");
	});

	it("does not include @useavalon/seo when plugin not selected", () => {
		const pkg = JSON.parse(generatePackageJson(baseConfig));
		expect(pkg.dependencies["@useavalon/seo"]).toBeUndefined();
	});

	it("returns valid JSON with 2-space indent", () => {
		const result = generatePackageJson(baseConfig);
		expect(() => JSON.parse(result)).not.toThrow();
		// Verify 2-space indentation
		expect(result).toContain('  "name"');
	});
});
