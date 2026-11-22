import { h } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addModulepreload } from "../../islands/modulepreload-collector.ts";
import { clearHtmlPostProcessHooks, registerHtmlPostProcess } from "../html-post-process.ts";
import { createNitroRenderer } from "../renderer.ts";
import type { PageModule } from "../types.ts";

const avalonConfig = { pagesDir: "pages", srcDir: "src", streaming: false } as never;

function makeRenderer(options: {
	page: PageModule;
	isDev?: boolean;
	parts?: (() => Promise<{ before: string; after: string } | null>) | null;
	wrap?: (html: string) => string;
}) {
	const wrap = vi.fn(
		async (html: string) => options.wrap?.(html) ?? `<html><body>${html}</body></html>`,
	);
	const parts =
		options.parts === null
			? undefined
			: vi.fn(
					options.parts ??
						(async () => ({
							before: "<html><head></head><body><main>",
							after: "</main></body></html>",
						})),
				);
	const renderer = createNitroRenderer({
		avalonConfig,
		isDev: options.isDev ?? false,
		resolvePageRoute: async (pathname: string) => ({
			filePath: pathname,
			pattern: pathname,
			params: {},
		}),
		loadPageModule: async () => options.page,
		wrapWithLayouts: wrap,
		wrapWithLayoutsParts: parts,
	} as never);
	return { renderer, wrap, parts };
}

const request = () => new Request("http://localhost/page");

afterEach(() => {
	clearHtmlPostProcessHooks();
});

describe("split-document response", () => {
	it("joins the layout parts around the page without calling wrapWithLayouts", async () => {
		const { renderer, wrap, parts } = makeRenderer({
			page: { default: () => "hello" } as PageModule,
		});
		const response = await renderer.fetch(request());
		expect(parts).toHaveBeenCalledOnce();
		expect(wrap).not.toHaveBeenCalled();
		expect(response.headers.get("content-type")).toContain("text/html");
		const text = await response.text();
		// The head passes add the framework base style; everything else is the layout parts and page.
		expect(text.startsWith("<html><head>")).toBe(true);
		expect(text.endsWith("</head><body><main>hello</main></body></html>")).toBe(true);
	});

	it("encodes non-ASCII text across the encoder's batch boundaries", async () => {
		const page = () =>
			h(
				"table",
				null,
				Array.from({ length: 2000 }, (_, i) =>
					h("tr", { key: i }, h("td", null, "View → 😀 café")),
				),
			);
		const { renderer } = makeRenderer({ page: { default: page } as unknown as PageModule });
		const text = await (await renderer.fetch(request())).text();
		expect(text.startsWith("<html><head>")).toBe(true);
		expect(text).toContain("</head><body><main>");
		expect(text.split("View → 😀 café").length - 1).toBe(2000);
		expect(text).not.toContain("�");
	});

	it("falls back to wrapWithLayouts when the document cannot be split", async () => {
		const { renderer, wrap, parts } = makeRenderer({
			page: { default: () => "page" } as PageModule,
			parts: async () => null,
			wrap: (html) => `<!--fallback-->${html}`,
		});
		const text = await (await renderer.fetch(request())).text();
		expect(parts).toHaveBeenCalledOnce();
		expect(wrap).toHaveBeenCalledOnce();
		expect(text).toContain("<!--fallback-->");
		expect(text).toContain("page");
	});

	it("uses wrapWithLayouts in dev, where the head is injected per request", async () => {
		const { renderer, wrap, parts } = makeRenderer({
			page: { default: () => "x" } as PageModule,
			isDev: true,
		});
		await renderer.fetch(request());
		expect(parts).not.toHaveBeenCalled();
		expect(wrap).toHaveBeenCalledOnce();
	});

	it("uses wrapWithLayouts when an HTML post-process hook needs the whole document", async () => {
		registerHtmlPostProcess((html) => html.replace("</body>", "<!--hook--></body>"));
		const { renderer, wrap, parts } = makeRenderer({ page: { default: () => "x" } as PageModule });
		const text = await (await renderer.fetch(request())).text();
		expect(parts).not.toHaveBeenCalled();
		expect(wrap).toHaveBeenCalledOnce();
		expect(text).toContain("<!--hook-->");
	});

	it("applies a hook registered while the page renders, without rendering again", async () => {
		const page = vi.fn(() => {
			registerHtmlPostProcess((html) => html.replace("</body>", "<!--late--></body>"));
			return "x";
		});
		const { renderer, wrap, parts } = makeRenderer({
			page: { default: page } as unknown as PageModule,
		});
		const text = await (await renderer.fetch(request())).text();
		expect(parts).toHaveBeenCalledOnce();
		expect(wrap).not.toHaveBeenCalled();
		expect(page).toHaveBeenCalledOnce();
		expect(text).toContain("<!--late--></body>");
		expect(text).toContain("<main>x</main>");
	});

	it("runs the head passes on the whole document when the head closes after the slot", async () => {
		const page = () => {
			addModulepreload("/islands/Late.js");
			return "x";
		};
		const { renderer } = makeRenderer({
			page: { default: page } as unknown as PageModule,
			parts: async () => ({
				before: "<html><head><title>t</title><meta name=a>",
				after: "</head><body>done</body></html>",
			}),
		});
		const text = await (await renderer.fetch(request())).text();
		expect(text).toContain('<link rel="modulepreload" href="/islands/Late.js"');
		expect(text.indexOf("modulepreload")).toBeLessThan(text.indexOf("</head>"));
	});

	it("uses wrapWithLayouts when the page opts out of client navigation", async () => {
		const { renderer, parts } = makeRenderer({
			page: { default: () => "x", clientNavigation: false } as PageModule,
		});
		await renderer.fetch(request());
		expect(parts).not.toHaveBeenCalled();
	});

	it("renders the error fragment when the page component throws", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { renderer } = makeRenderer({
			page: {
				default: () => {
					throw new Error("boom");
				},
			} as PageModule,
		});
		const text = await (await renderer.fetch(request())).text();
		expect(text).toContain("Error rendering page");
		spy.mockRestore();
	});
});
