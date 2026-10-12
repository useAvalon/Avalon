import { describe, expect, it } from "vitest";
import type { ProjectConfig, StylingOption } from "../types";
import { generateStylingFiles } from "./styling";

describe("generateStylingFiles", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	function configWithStyling(styling: StylingOption): ProjectConfig {
		return { ...baseConfig, styling };
	}

	// --- Common files ---

	it("always generates main.css", () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has("app/shared/styles/main.css")).toBe(true);
	});

	it("always ships the MDX syntax-highlighting stylesheet", () => {
		const files = generateStylingFiles(baseConfig);
		const css = files.get("public/syntax-highlighting.css");
		expect(css).toBeDefined();
		expect(css).toContain(".hljs");
	});

	it.each([
		["css-modules", true],
		["tailwind", false],
		["shadcn", false],
	] as const)("generates reset.css only for css-modules (%s)", (styling, expected) => {
		const files = generateStylingFiles(configWithStyling(styling));
		expect(files.has("app/shared/styles/reset.css")).toBe(expected);
	});

	it.each([
		["css-modules", true],
		["tailwind", false],
		["shadcn", false],
	] as const)("main.css imports reset.css only for css-modules (%s)", (styling, shouldImport) => {
		const main = generateStylingFiles(configWithStyling(styling)).get("app/shared/styles/main.css");
		const assertion = shouldImport ? expect(main) : expect(main).not;
		assertion.toContain("@import './reset.css'");
	});

	// --- CSS Modules ---

	it("generates tokens.css for css-modules", () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has("app/shared/styles/tokens.css")).toBe(true);
		expect(files.get("app/shared/styles/tokens.css")).toContain("--color-primary");
	});

	it.each([
		["app/shared/layouts/_layout.module.css", ".layout"],
		["app/modules/main/pages/index.module.css", ".shell"],
		["app/modules/about/pages/index.module.css", ".shell"],
		["app/modules/main/pages/404.module.css", ".status"],
	] as const)("generates %s for css-modules", (path, snippet) => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has(path)).toBe(true);
		const css = files.get(path);
		expect(css).toContain(snippet);
		if (path === "app/modules/about/pages/index.module.css") {
			expect(css).toContain(".homeLink");
		}
	});

	it("main.css imports tokens.css for css-modules", () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.get("app/shared/styles/main.css")).toContain("@import './tokens.css'");
	});

	it("does not generate tailwind files for css-modules", () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has("tailwind.config.js")).toBe(false);
		expect(files.has("app/shared/styles/global.css")).toBe(false);
		expect(files.has("components.json")).toBe(false);
	});

	// --- Tailwind ---

	it.each(["tailwind", "shadcn"] as const)("generates tailwind.config.js for %s", (styling) => {
		const files = generateStylingFiles(configWithStyling(styling));
		expect(files.has("tailwind.config.js")).toBe(true);
		expect(files.get("tailwind.config.js")).toContain("content");
		if (styling === "tailwind") {
			expect(files.get("tailwind.config.js")).toContain("app/**/*.{ts,tsx}");
		}
	});

	it.each(["tailwind", "shadcn"] as const)(
		"generates global.css with tailwind directive for %s",
		(styling) => {
			const files = generateStylingFiles(configWithStyling(styling));
			expect(files.has("app/shared/styles/global.css")).toBe(true);
			expect(files.get("app/shared/styles/global.css")).toContain('@import "tailwindcss"');
		},
	);

	it("main.css imports global.css for tailwind", () => {
		const files = generateStylingFiles(configWithStyling("tailwind"));
		expect(files.get("app/shared/styles/main.css")).toContain("@import './global.css'");
	});

	it.each([
		[
			"tailwind",
			[
				"app/shared/styles/tokens.css",
				"app/shared/layouts/_layout.module.css",
				"app/modules/main/pages/index.module.css",
				"app/modules/about/pages/index.module.css",
				"app/modules/main/pages/404.module.css",
			],
		],
		[
			"shadcn",
			[
				"app/shared/styles/tokens.css",
				"app/shared/layouts/_layout.module.css",
				"app/modules/main/pages/index.module.css",
			],
		],
	] as const)("does not generate css-modules files for %s", (styling, paths) => {
		const files = generateStylingFiles(configWithStyling(styling));
		for (const path of paths) {
			expect(files.has(path)).toBe(false);
		}
	});

	it("does not generate components.json for tailwind", () => {
		const files = generateStylingFiles(configWithStyling("tailwind"));
		expect(files.has("components.json")).toBe(false);
	});

	// --- shadcn ---

	it("generates components.json for shadcn", () => {
		const files = generateStylingFiles(configWithStyling("shadcn"));
		expect(files.has("components.json")).toBe(true);
		const componentsJson = files.get("components.json");
		expect(componentsJson).toBeDefined();
		const json = JSON.parse(componentsJson ?? "");
		expect(json.$schema).toBe("https://ui.shadcn.com/schema.json");
		expect(json.style).toBe("default");
		expect(json.tailwind.config).toBe("tailwind.config.js");
		expect(json.aliases.components).toBe("@shared/components");
	});

	it("generates cn utility for shadcn", () => {
		const files = generateStylingFiles(configWithStyling("shadcn"));
		expect(files.has("app/shared/utils/cn.ts")).toBe(true);
		expect(files.get("app/shared/utils/cn.ts")).toContain("twMerge");
		expect(files.get("app/shared/utils/cn.ts")).toContain("clsx");
	});

	it("shadcn global.css includes CSS variables", () => {
		const files = generateStylingFiles(configWithStyling("shadcn"));
		expect(files.get("app/shared/styles/global.css")).toContain("@theme inline");
		expect(files.get("app/shared/styles/global.css")).toContain("--color-primary");
	});

	// --- Reset CSS content ---

	it("reset.css contains box-sizing reset", () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.get("app/shared/styles/reset.css")).toContain("box-sizing: border-box");
	});
});
