import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../types";
import { generate404Page, generateAboutPage, generateMainPage } from "./pages";

describe("generateMainPage", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("exports a default async function", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain("export default async function HomePage");
	});

	it("includes Avalon in the heading", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain("<h1");
		expect(result).toContain("Avalon");
	});

	it("does not include the folder name in the heading", () => {
		const config: ProjectConfig = { ...baseConfig, projectName: "cool-project" };
		const result = generateMainPage(config);
		expect(result).not.toContain("cool-project");
	});

	it("includes metadata export with Avalon title", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain("export const metadata");
		expect(result).toContain("title: 'Avalon");
	});

	it("includes documentation link to useavalon.dev", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain("https://useavalon.dev/docs/introduction");
		expect(result).toContain("Documentation");
	});

	it("includes GitHub link", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain("https://github.com/useAvalon/Avalon");
		expect(result).toContain("GitHub");
	});

	it("includes get-started hint to edit the page", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain("Edit app/modules/main/pages/index.tsx");
	});

	it("includes Powered by Avalon footer", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain("Powered by");
		expect(result).toContain("https://useavalon.dev");
	});

	it("uses CSS modules when css-modules styling is selected", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain("import styles from './index.module.css'");
		expect(result).toContain("className={styles.shell}");
		expect(result).not.toContain("style={{");
	});

	it("uses Tailwind classes when tailwind styling is selected", () => {
		const config: ProjectConfig = { ...baseConfig, styling: "tailwind" };
		const result = generateMainPage(config);
		expect(result).toContain('className="flex min-h-screen');
		expect(result).not.toContain("import styles");
		expect(result).not.toContain("style={{");
	});

	it("uses Tailwind classes when shadcn styling is selected", () => {
		const config: ProjectConfig = { ...baseConfig, styling: "shadcn" };
		const result = generateMainPage(config);
		expect(result).toContain('className="flex min-h-screen');
		expect(result).not.toContain("import styles");
	});

	it("includes Islands Architecture label", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain("Islands Architecture");
	});

	it("links to the about module route", () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain('href="/about"');
		expect(result).toContain("app/modules/about/pages/index.tsx");
	});
});

describe("generateAboutPage", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("maps the about module to /about", () => {
		const result = generateAboutPage(baseConfig);
		expect(result).toContain("export default function AboutPage");
		expect(result).toContain("app/modules/about/pages/index.tsx");
		expect(result).toContain("/about");
		expect(result).toContain('href="/"');
	});

	it("uses CSS modules when css-modules styling is selected", () => {
		const result = generateAboutPage(baseConfig);
		expect(result).toContain("import styles from './index.module.css'");
		expect(result).toContain("className={styles.shell}");
		expect(result).not.toContain("style={{");
	});

	it("uses Tailwind classes when tailwind styling is selected", () => {
		const config: ProjectConfig = { ...baseConfig, styling: "tailwind" };
		const result = generateAboutPage(config);
		expect(result).toContain('className="flex min-h-screen');
		expect(result).not.toContain("import styles");
		expect(result).not.toContain("style={{");
	});
});

describe("generate404Page", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("exports NotFoundPage with noindex metadata", () => {
		const result = generate404Page(baseConfig);
		expect(result).toContain("export default function NotFoundPage");
		expect(result).toContain("robots: 'noindex, nofollow'");
		expect(result).toContain('href="/"');
		expect(result).toContain("Go Home");
	});

	it("uses CSS modules when css-modules styling is selected", () => {
		const result = generate404Page(baseConfig);
		expect(result).toContain("import styles from './404.module.css'");
		expect(result).toContain("className={styles.page}");
		expect(result).not.toContain("style={{");
	});

	it("uses Tailwind classes when tailwind styling is selected", () => {
		const config: ProjectConfig = { ...baseConfig, styling: "tailwind" };
		const result = generate404Page(config);
		expect(result).toContain('className="flex min-h-screen');
		expect(result).not.toContain("import styles");
		expect(result).not.toContain("style={{");
	});
});
