import { h } from "preact";
import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import Island, { renderIsland } from "../island.tsx";

describe("client-only island SSR", () => {
	it("does not execute the component render function", async () => {
		function BrowserWidget() {
			const width = (globalThis as { window?: { innerWidth: number } }).window?.innerWidth;
			if (width === undefined) {
				throw new Error("window.innerWidth must not run during SSR");
			}
			return h("div", null, String(width));
		}

		const vnode = await renderIsland({
			src: "/islands/BrowserWidget.tsx",
			framework: "preact",
			ssr: false,
			component: BrowserWidget,
			props: { userId: "u1" },
		});
		const html = render(vnode);

		expect(html).toContain("<avalon-island");
		expect(html).toContain('data-render-strategy="client-only"');
		expect(html).toContain('data-framework="preact"');
		expect(html).toContain("data-src=");
		expect(html).toContain("userId");
		expect(html).toContain("u1");
		expect(html).not.toContain("window.innerWidth must not run");
		expect(html).not.toMatch(/<div>\d+<\/div>/);
	});

	it("skips analysis and SSR-only when framework is omitted and ssr is false", async () => {
		const vnode = await renderIsland({
			src: "/islands/MissingOnDisk.tsx",
			ssr: false,
			props: { n: 1 },
		});
		const html = render(vnode);
		expect(html).toContain('data-render-strategy="client-only"');
		expect(html).not.toContain('data-render-strategy="ssr-only"');
	});

	it("emits an empty placeholder from Island() when ssr is false", () => {
		const html = render(
			Island({
				src: "/islands/Chart.tsx",
				framework: "preact",
				ssr: false,
				props: { n: 3 },
			}),
		);
		expect(html).toContain('data-render-strategy="client-only"');
		expect(html).toContain('data-props="{&quot;n&quot;:3}"');
		expect(html).not.toContain("<svg");
	});

	it("still mounts when ssr is false even if ssrOnly is set", () => {
		const html = render(
			Island({
				src: "/islands/Chart.tsx",
				framework: "preact",
				ssr: false,
				ssrOnly: true,
				props: { n: 1 },
			}),
		);
		expect(html).toContain('data-render-strategy="client-only"');
		expect(html).toContain("data-src=");
		expect(html).not.toContain('data-render-strategy="ssr-only"');
	});

	it("is valid HTML with no component output (JS-disabled)", () => {
		const html = render(
			Island({
				src: "/islands/Chart.tsx",
				framework: "vue",
				ssr: false,
			}),
		);
		expect(html).toMatch(/<avalon-island\b[^>]*><\/avalon-island>/);
		expect(html).toContain('data-framework="vue"');
	});
});
