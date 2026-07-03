import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../types";
import { generateMainLayout, generateRootLayout } from "./layouts";

describe("generateRootLayout", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("generates an HTML shell with <html>, <head>, and <body>", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain('<html lang="en">');
		expect(result).toContain("<head>");
		expect(result).toContain("<body");
		expect(result).toContain("</html>");
	});

	it("includes charset and viewport meta tags", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain('<meta charset="UTF-8"');
		expect(result).toContain('<meta name="viewport"');
	});

	it("includes a {children} slot", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain("{children}");
	});

	it("sets the title to the project name as default", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain("'my-app'");
		expect(result).toContain("<title>{title}</title>");
	});

	it("uses the provided project name as the fallback title", () => {
		const config: ProjectConfig = { ...baseConfig, projectName: "cool-project" };
		const result = generateRootLayout(config);
		expect(result).toContain("'cool-project'");
	});

	it("imports main.css stylesheet", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain("import '../styles/main.css'");
	});

	it("exports a default async function", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain("export default async function RootLayout");
	});

	it("imports LayoutProps from @useavalon/avalon and uses Readonly<LayoutProps>", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain("import type { LayoutProps } from '@useavalon/avalon'");
		expect(result).toContain("Readonly<LayoutProps>");
	});

	it("sets body margin to 0 via inline style", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain("style={{ margin: 0 }}");
	});

	it("always imports main.css regardless of styling option", () => {
		for (const styling of ["css-modules", "tailwind", "shadcn"] as const) {
			const config: ProjectConfig = { ...baseConfig, styling };
			const result = generateRootLayout(config);
			expect(result).toContain("import '../styles/main.css'");
		}
	});

	it("always includes favicon link", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain('href="/favicon.ico"');
	});

	it("includes meta description from frontmatter", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain('name="description"');
	});

	it("does not include OG/Twitter tags (handled by @useavalon/seo plugin)", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).not.toContain("og:title");
		expect(result).not.toContain("twitter:card");
	});

	it("does not include canonical URL (handled by @useavalon/seo plugin)", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).not.toContain('rel="canonical"');
	});
});

describe("generateMainLayout", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("includes a {children} slot", () => {
		const result = generateMainLayout(baseConfig);
		expect(result).toContain("{children}");
	});

	it("exports a default async function", () => {
		const result = generateMainLayout(baseConfig);
		expect(result).toContain("export default async function MainLayout");
	});

	it("imports LayoutProps from @useavalon/avalon and uses Readonly<LayoutProps>", () => {
		const result = generateMainLayout(baseConfig);
		expect(result).toContain("import type { LayoutProps } from '@useavalon/avalon'");
		expect(result).toContain("Readonly<LayoutProps>");
	});

	it("is a passthrough fragment layout", () => {
		const result = generateMainLayout(baseConfig);
		expect(result).toContain("<>{children}</>");
	});

	it("does not include <html> or <head> tags", () => {
		const result = generateMainLayout(baseConfig);
		expect(result).not.toContain("<html");
		expect(result).not.toContain("<head");
	});

	it("does not import CSS modules regardless of styling", () => {
		for (const styling of ["css-modules", "tailwind", "shadcn"] as const) {
			const config: ProjectConfig = { ...baseConfig, styling };
			const result = generateMainLayout(config);
			expect(result).not.toContain(".module.css");
		}
	});
});
