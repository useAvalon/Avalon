import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../types";
import { generateAboutLayout, generateRootLayout } from "./layouts";

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

	it("does not import main.css (injected via nitro globalCSS in vite.config)", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).not.toContain("import '../styles/main.css'");
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

	it("uses a plain body element (reset comes from globalCSS)", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain("<body>");
		expect(result).not.toContain("style={{ margin: 0 }}");
	});

	it("always includes favicon link", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain('href="/favicon.ico"');
	});

	it("always links the built-in MDX syntax-highlighting stylesheet", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain('href="/syntax-highlighting.css"');
	});

	it("includes meta description from frontmatter", () => {
		const result = generateRootLayout(baseConfig);
		expect(result).toContain('name="description"');
		expect(result).toContain("typeof frontmatter?.description === 'string'");
		expect(result).toContain("content={description}");
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

describe("generateAboutLayout", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("is a passthrough fragment layout named AboutLayout", () => {
		const result = generateAboutLayout(baseConfig);
		expect(result).toContain("export default async function AboutLayout");
		expect(result).toContain("<>{children}</>");
		expect(result).not.toContain("<html");
	});
});
