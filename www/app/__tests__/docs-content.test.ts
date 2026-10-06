import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cwd = process.cwd();

const quickStart = readFileSync(
	path.resolve(cwd, "www/app/modules/docs/pages/quick-start.mdx"),
	"utf-8",
);
const introduction = readFileSync(
	path.resolve(cwd, "www/app/modules/docs/pages/introduction.mdx"),
	"utf-8",
);
const viteConfig = readFileSync(path.resolve(cwd, "www/vite.config.ts"), "utf-8");

describe("Quick Start content", () => {
	it("uses PackageManagerTabs for scaffold and dev", () => {
		expect(quickStart).toContain('preset="scaffold"');
		expect(quickStart).toContain('preset="dev"');
		expect(quickStart).toContain("PackageManagerTabs");
	});

	it("contains http://localhost:3000", () => {
		expect(quickStart).toContain("http://localhost:3000");
	});

	it("contains .output/", () => {
		expect(quickStart).toContain(".output/");
	});
});

describe("Introduction LLM summary", () => {
	it("contains a ## Summary heading", () => {
		expect(introduction).toContain("## Summary");
	});
});

describe("InteractiveExample island files", () => {
	it("InteractiveExample.tsx exists", () => {
		expect(existsSync(path.resolve(cwd, "www/app/shared/components/InteractiveExample.tsx"))).toBe(
			true,
		);
	});

	it("InteractiveExample.module.css exists", () => {
		expect(
			existsSync(path.resolve(cwd, "www/app/shared/components/InteractiveExample.module.css")),
		).toBe(true);
	});
});

describe("Agent optimization config", () => {
	it("vite.config.ts lists Docs in agentOptimization llms sections", () => {
		expect(viteConfig).toContain('Docs: ["/docs"]');
	});
});

describe("Docs index redirect", () => {
	it("www/app/modules/docs/pages/index.tsx exists and redirects to /docs/introduction", () => {
		const indexPath = path.resolve(cwd, "www/app/modules/docs/pages/index.tsx");
		expect(existsSync(indexPath)).toBe(true);
		const content = readFileSync(indexPath, "utf-8");
		expect(content).toContain("/docs/introduction");
	});
});
