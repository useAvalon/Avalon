import { describe, expect, it } from "vitest";
import {
	buildLlmsFullTxt,
	buildLlmsTxt,
	type LlmsRoute,
	type ResolvedLlmsConfig,
	routesToLlmsEntries,
} from "../llms.ts";

// ---------------------------------------------------------------------------
// routesToLlmsEntries
// ---------------------------------------------------------------------------

describe("routesToLlmsEntries", () => {
	const baseConfig: ResolvedLlmsConfig = {
		siteUrl: "https://example.com",
		siteName: "Example",
	};

	it("includes static public routes", () => {
		const routes: LlmsRoute[] = [{ pattern: "/" }, { pattern: "/about" }, { pattern: "/blog" }];
		const entries = routesToLlmsEntries(routes, baseConfig);
		expect(entries).toHaveLength(3);
		expect(entries.map((e) => e.url)).toEqual([
			"https://example.com/",
			"https://example.com/about",
			"https://example.com/blog",
		]);
	});

	it("excludes private routes (_-prefixed segments)", () => {
		const routes: LlmsRoute[] = [
			{ pattern: "/" },
			{ pattern: "/_middleware" },
			{ pattern: "/_error" },
			{ pattern: "/admin/_internal" },
		];
		const entries = routesToLlmsEntries(routes, baseConfig);
		expect(entries).toHaveLength(1);
		expect(entries[0].url).toBe("https://example.com/");
	});

	it("excludes dynamic routes", () => {
		const routes: LlmsRoute[] = [
			{ pattern: "/" },
			{ pattern: "/blog/:slug" },
			{ pattern: "/docs/**" },
		];
		const entries = routesToLlmsEntries(routes, baseConfig);
		expect(entries).toHaveLength(1);
	});

	it("excludes routes matching exclude patterns", () => {
		const routes: LlmsRoute[] = [
			{ pattern: "/" },
			{ pattern: "/admin" },
			{ pattern: "/admin/settings" },
			{ pattern: "/about" },
		];
		const config: ResolvedLlmsConfig = {
			...baseConfig,
			exclude: ["/admin/**"],
		};
		const entries = routesToLlmsEntries(routes, config);
		expect(entries).toHaveLength(2);
		expect(entries.map((e) => e.url)).toEqual([
			"https://example.com/",
			"https://example.com/about",
		]);
	});

	it("excludes exact path matches", () => {
		const routes: LlmsRoute[] = [{ pattern: "/" }, { pattern: "/login" }, { pattern: "/about" }];
		const config: ResolvedLlmsConfig = {
			...baseConfig,
			exclude: ["/login"],
		};
		const entries = routesToLlmsEntries(routes, config);
		expect(entries).toHaveLength(2);
		expect(entries.map((e) => e.url)).toEqual([
			"https://example.com/",
			"https://example.com/about",
		]);
	});

	it("uses route title when available", () => {
		const routes: LlmsRoute[] = [{ pattern: "/about", title: "About Us" }];
		const entries = routesToLlmsEntries(routes, baseConfig);
		expect(entries[0].name).toBe("About Us");
	});

	it("generates name from pattern when no title", () => {
		const routes: LlmsRoute[] = [{ pattern: "/blog/getting-started" }];
		const entries = routesToLlmsEntries(routes, baseConfig);
		expect(entries[0].name).toBe("Blog — Getting-started");
	});

	it('names root route "Home"', () => {
		const routes: LlmsRoute[] = [{ pattern: "/" }];
		const entries = routesToLlmsEntries(routes, baseConfig);
		expect(entries[0].name).toBe("Home");
	});

	it("includes description when available", () => {
		const routes: LlmsRoute[] = [{ pattern: "/about", description: "Learn about us" }];
		const entries = routesToLlmsEntries(routes, baseConfig);
		expect(entries[0].description).toBe("Learn about us");
	});

	it("strips trailing slashes from siteUrl", () => {
		const config: ResolvedLlmsConfig = {
			siteUrl: "https://example.com/",
			siteName: "Example",
		};
		const routes: LlmsRoute[] = [{ pattern: "/about" }];
		const entries = routesToLlmsEntries(routes, config);
		expect(entries[0].url).toBe("https://example.com/about");
	});

	it("returns empty array for no routes", () => {
		expect(routesToLlmsEntries([], baseConfig)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildLlmsTxt
// ---------------------------------------------------------------------------

describe("buildLlmsTxt", () => {
	const baseConfig: ResolvedLlmsConfig = {
		siteUrl: "https://example.com",
		siteName: "My Site",
		siteDescription: "A great website about things.",
	};

	it("starts with H1 site name", () => {
		const result = buildLlmsTxt([], baseConfig);
		expect(result).toMatch(/^# My Site\n/);
	});

	it("includes blockquote description", () => {
		const result = buildLlmsTxt([], baseConfig);
		expect(result).toContain("> A great website about things.");
	});

	it("omits blockquote when no description", () => {
		const config: ResolvedLlmsConfig = { siteUrl: "https://example.com", siteName: "My Site" };
		const result = buildLlmsTxt([], config);
		expect(result).not.toContain(">");
	});

	it('lists entries under "Pages" when no sections configured', () => {
		const entries = [
			{ name: "Home", url: "https://example.com/" },
			{ name: "About", url: "https://example.com/about" },
		];
		const result = buildLlmsTxt(entries, baseConfig);
		expect(result).toContain("## Pages");
		expect(result).toContain("- [Home](https://example.com/)");
		expect(result).toContain("- [About](https://example.com/about)");
	});

	it("includes description after link when present", () => {
		const entries = [
			{ name: "About", url: "https://example.com/about", description: "Learn about us" },
		];
		const result = buildLlmsTxt(entries, baseConfig);
		expect(result).toContain("- [About](https://example.com/about): Learn about us");
	});

	it("groups entries into configured sections", () => {
		const config: ResolvedLlmsConfig = {
			...baseConfig,
			sections: {
				Blog: ["/blog"],
				Docs: ["/docs"],
			},
		};
		const entries = [
			{ name: "Home", url: "https://example.com/" },
			{ name: "Blog Index", url: "https://example.com/blog" },
			{ name: "Getting Started", url: "https://example.com/blog/getting-started" },
			{ name: "API Reference", url: "https://example.com/docs/api" },
		];
		const result = buildLlmsTxt(entries, config);
		expect(result).toContain("## Blog");
		expect(result).toContain("## Docs");
		expect(result).toContain("## Other");
		expect(result).toContain("- [Home](https://example.com/)");
	});

	it("skips empty sections", () => {
		const config: ResolvedLlmsConfig = {
			...baseConfig,
			sections: {
				Blog: ["/blog"],
				Empty: ["/nonexistent"],
			},
		};
		const entries = [{ name: "Blog Post", url: "https://example.com/blog/post" }];
		const result = buildLlmsTxt(entries, config);
		expect(result).toContain("## Blog");
		expect(result).not.toContain("## Empty");
		expect(result).not.toContain("## Other");
	});

	it("returns just header for empty entries", () => {
		const result = buildLlmsTxt([], baseConfig);
		expect(result).toContain("# My Site");
		expect(result).not.toContain("## Pages");
	});
});

// ---------------------------------------------------------------------------
// buildLlmsFullTxt
// ---------------------------------------------------------------------------

describe("buildLlmsFullTxt", () => {
	const baseConfig: ResolvedLlmsConfig = {
		siteUrl: "https://example.com",
		siteName: "My Site",
		siteDescription: "Full content export.",
	};

	it("starts with H1 site name and description", () => {
		const result = buildLlmsFullTxt([], baseConfig);
		expect(result).toMatch(/^# My Site\n/);
		expect(result).toContain("> Full content export.");
	});

	it("includes page content as markdown sections", () => {
		const pages = [
			{
				route: { pattern: "/about", title: "About Us" },
				html: "<html><body><main><p>We are a company.</p></main></body></html>",
			},
		];
		const result = buildLlmsFullTxt(pages, baseConfig);
		expect(result).toContain("## About Us");
		expect(result).toContain("We are a company.");
	});

	it("separates pages with horizontal rules", () => {
		const pages = [
			{
				route: { pattern: "/about", title: "About" },
				html: "<html><body><main><p>About content</p></main></body></html>",
			},
			{
				route: { pattern: "/blog", title: "Blog" },
				html: "<html><body><main><p>Blog content</p></main></body></html>",
			},
		];
		const result = buildLlmsFullTxt(pages, baseConfig);
		expect(result).toContain("---");
		expect(result).toContain("## About");
		expect(result).toContain("## Blog");
	});

	it("skips pages with empty markdown content", () => {
		const pages = [
			{
				route: { pattern: "/empty" },
				html: "<html><body><main>   </main></body></html>",
			},
			{
				route: { pattern: "/real", title: "Real Page" },
				html: "<html><body><main><p>Content here</p></main></body></html>",
			},
		];
		const result = buildLlmsFullTxt(pages, baseConfig);
		expect(result).not.toContain("Empty");
		expect(result).toContain("## Real Page");
	});

	it("generates title from pattern when no title provided", () => {
		const pages = [
			{
				route: { pattern: "/blog/my-post" },
				html: "<html><body><main><p>Post content</p></main></body></html>",
			},
		];
		const result = buildLlmsFullTxt(pages, baseConfig);
		expect(result).toContain("## Blog — My-post");
	});
});
