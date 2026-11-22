import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { h } from "preact";
import { Suspense } from "preact/compat";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearHtmlPostProcessHooks, registerHtmlPostProcess } from "../html-post-process.ts";
import { createNitroRenderer } from "../renderer.ts";
import type { PageModule } from "../types.ts";

// Precompiled templates are recognised by `Fragment` identity, so the template factory has to come
// from the same copy of Preact the stream renderer uses.
const rendererDir = dirname(createRequire(import.meta.url).resolve("preact-render-to-string"));
const preactJsxRuntime = join(
	rendererDir,
	"..",
	"..",
	"preact",
	"jsx-runtime",
	"dist",
	"jsxRuntime.mjs",
);
const { jsxTemplate } = (await import(/* @vite-ignore */ pathToFileURL(preactJsxRuntime).href)) as {
	jsxTemplate: (templates: string[]) => unknown;
};

const BEFORE = "<!DOCTYPE html><html><head><title>t</title></head><body><main>";
const AFTER = "</main></body></html>";

function makeRenderer(page: PageModule, streaming: boolean) {
	const wrap = vi.fn(async (html: string) => BEFORE + html + AFTER);
	const parts = vi.fn(async () => ({ before: BEFORE, after: AFTER }));
	const renderer = createNitroRenderer({
		avalonConfig: { pagesDir: "pages", srcDir: "src", streaming } as never,
		isDev: false,
		resolvePageRoute: async (pathname: string) => ({
			filePath: pathname,
			pattern: pathname,
			params: {},
		}),
		loadPageModule: async () => page,
		wrapWithLayouts: wrap,
		wrapWithLayoutsParts: parts,
	} as never);
	return { renderer, wrap, parts };
}

const request = () => new Request("http://localhost/page");

/** A component that suspends until `release` is called. */
function deferred() {
	let release!: () => void;
	let done = false;
	const promise = new Promise<void>((resolve) => {
		release = () => {
			done = true;
			resolve();
		};
	});
	function Slow() {
		if (!done) throw promise;
		return h("p", null, "resolved");
	}
	return { Slow, release };
}

afterEach(() => {
	clearHtmlPostProcessHooks();
});

describe("layout streaming", () => {
	it("returns the buffered document for a page without Suspense", async () => {
		const page = { default: () => h("section", null, "hi") } as unknown as PageModule;
		const streamed = await makeRenderer(page, true).renderer.fetch(request());
		const buffered = await makeRenderer(page, false).renderer.fetch(request());
		expect(await streamed.text()).toBe(await buffered.text());
		expect(streamed.headers.get("x-accel-buffering")).toBeNull();
	});

	it("awaits an async page component before rendering", async () => {
		const page = {
			default: async () => {
				await new Promise((r) => setTimeout(r, 5));
				return h("section", null, "late data");
			},
		} as unknown as PageModule;
		const text = await (await makeRenderer(page, true).renderer.fetch(request())).text();
		expect(text).toContain("<section>late data</section>");
	});

	it("keeps precompiled JSX templates working in the stream", async () => {
		const page = {
			default: () => jsxTemplate(["<i>static</i>"]),
		} as unknown as PageModule;
		const text = await (await makeRenderer(page, true).renderer.fetch(request())).text();
		expect(text).toContain("<main><i>static</i></main>");
	});

	it("flushes the layout head before a Suspense boundary resolves", async () => {
		const { Slow, release } = deferred();
		const page = {
			default: () =>
				h("div", null, h(Suspense, { fallback: h("span", null, "loading") }, h(Slow, null))),
		} as unknown as PageModule;
		const { renderer, parts, wrap } = makeRenderer(page, true);
		const response = await renderer.fetch(request());
		expect(wrap).not.toHaveBeenCalled();
		expect(parts).toHaveBeenCalledOnce();
		expect(response.headers.get("x-accel-buffering")).toBe("no");
		expect(response.headers.get("content-type")).toContain("text/html");

		const reader = (response.body as ReadableStream<Uint8Array>).getReader();
		const decoder = new TextDecoder();
		let seen = decoder.decode((await reader.read()).value);
		seen += decoder.decode((await reader.read()).value);
		expect(seen).toContain("</head>");
		expect(seen).toContain("loading");
		expect(seen).not.toContain("resolved");

		release();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			seen += decoder.decode(value);
		}
		expect(seen).toContain("resolved");
		expect(seen.endsWith(AFTER)).toBe(true);
	});

	it("leaves a boundary that fails after the flush to the client and still closes the layout", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		let reject!: (reason: Error) => void;
		const pending = new Promise<void>((_, r) => {
			reject = r;
		});
		function Broken(): never {
			throw pending;
		}
		const page = {
			default: () =>
				h("div", null, h(Suspense, { fallback: h("span", null, "loading") }, h(Broken, null))),
		} as unknown as PageModule;
		const response = await makeRenderer(page, true).renderer.fetch(request());
		expect(response.headers.get("x-accel-buffering")).toBe("no");

		const reader = (response.body as ReadableStream<Uint8Array>).getReader();
		const decoder = new TextDecoder();
		let text = "";
		while (!text.includes("loading")) {
			text += decoder.decode((await reader.read()).value);
		}
		expect(text).toContain("</head>");

		reject(new Error("boom"));
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			text += decoder.decode(value);
		}
		const logged = error.mock.calls.length;
		error.mockRestore();
		expect(logged).toBeGreaterThan(0);
		expect(text.endsWith(AFTER)).toBe(true);
		expect((text.match(/<div hidden>/g) ?? []).length).toBe(
			(text.match(/<\/div>/g) ?? []).length - 1,
		);
	});

	it("drains and uses the full pipeline when the shell contains a stylesheet link", async () => {
		const { Slow, release } = deferred();
		const page = {
			default: () =>
				h(
					"div",
					null,
					h("link", { rel: "stylesheet", href: "/a.css" }),
					h(Suspense, { fallback: "wait" }, h(Slow, null)),
				),
		} as unknown as PageModule;
		const { renderer, parts } = makeRenderer(page, true);
		// The response is only returned once the drained page has resolved.
		setTimeout(release, 20);
		const response = await renderer.fetch(request());
		expect(response.headers.get("x-accel-buffering")).toBeNull();
		expect(await response.text()).toContain("resolved");
		expect(parts).toHaveBeenCalledOnce();
	});

	it("renders a Suspense page without streaming when streaming is off", async () => {
		const page = {
			default: () => h("div", null, h(Suspense, { fallback: "wait" }, h("b", null, "ready"))),
		} as unknown as PageModule;
		const { renderer, parts } = makeRenderer(page, false);
		const response = await renderer.fetch(request());
		expect(response.headers.get("x-accel-buffering")).toBeNull();
		expect(await response.text()).toContain("<b>ready</b>");
		expect(parts).toHaveBeenCalledOnce();
	});

	it("falls back to the full pipeline when an HTML hook is registered", async () => {
		registerHtmlPostProcess((html) => html.replace("</body>", "<!--hook--></body>"));
		const { Slow, release } = deferred();
		release();
		const page = {
			default: () => h("div", null, h(Suspense, { fallback: "wait" }, h(Slow, null))),
		} as unknown as PageModule;
		const { renderer, wrap } = makeRenderer(page, true);
		const response = await renderer.fetch(request());
		expect(wrap).toHaveBeenCalledOnce();
		expect(response.headers.get("x-accel-buffering")).toBeNull();
		expect(await response.text()).toContain("<!--hook-->");
	});

	it("reports a page that throws before anything is sent as the error fragment", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const page = {
			default: () => {
				throw new Error("nope");
			},
		} as unknown as PageModule;
		const response = await makeRenderer(page, true).renderer.fetch(request());
		error.mockRestore();
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Error rendering page");
	});
});
