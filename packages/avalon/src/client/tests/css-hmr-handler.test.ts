import { describe, expect, it } from "vitest";
import { applyCssText, applyDevCssHot, normalizeCssHref } from "../css-hmr-handler.ts";

class FakeStyle {
	textContent = "";
	dataset: { avalonCss?: string } = {};
}

class FakeDoc {
	readonly styles: FakeStyle[] = [];
	readonly head = {
		appendChild: (el: FakeStyle) => {
			this.styles.push(el);
		},
	};

	createElement(tag: string): FakeStyle {
		if (tag !== "style") throw new Error(`unexpected tag ${tag}`);
		return new FakeStyle();
	}

	querySelectorAll(selector: string): FakeStyle[] {
		if (selector === "style[data-avalon-css]") {
			return this.styles.filter((s) => s.dataset.avalonCss);
		}
		return [];
	}
}

describe("applyCssText", () => {
	it("normalizes hrefs", () => {
		expect(normalizeCssHref("app\\x.css?direct")).toBe("/app/x.css");
	});

	it("writes CSS without removing existing rules first", () => {
		const doc = new FakeDoc();
		applyCssText(doc as unknown as Document, "/a.css", "body{color:red}");
		expect(doc.styles[0]?.textContent).toBe("body{color:red}");
		applyCssText(doc as unknown as Document, "/a.css", "body{color:blue}");
		expect(doc.styles).toHaveLength(1);
		expect(doc.styles[0]?.textContent).toBe("body{color:blue}");
	});

	it("cache-busts an existing stylesheet link when no CSS payload is sent", () => {
		const links: Array<{ href: string; dataset: { avalonCss?: string } }> = [];
		const link = {
			href: "/a.css?direct",
			dataset: { avalonCss: "/a.css" },
		};
		links.push(link);
		const doc = {
			querySelectorAll: (sel: string) => (sel === "link[data-avalon-css]" ? links : []),
			head: { appendChild: () => {} },
			createElement: () => {
				throw new Error("should not create a style tag");
			},
		};
		applyDevCssHot(doc as unknown as Document, "/a.css", "");
		expect(link.href.startsWith("/a.css?direct&v=")).toBe(true);
	});

	it("cache-busts the link and writes a style tag from the CSS payload", () => {
		const doc = new FakeDoc();
		const link = {
			href: "/a.css?direct",
			dataset: { avalonCss: "/a.css" },
		};
		const originalQuery = doc.querySelectorAll.bind(doc);
		doc.querySelectorAll = (sel: string) => {
			if (sel === "link[data-avalon-css]") return [link] as never;
			return originalQuery(sel);
		};
		applyDevCssHot(doc as unknown as Document, "/a.css", "body{color:red}");
		expect(link.href.startsWith("/a.css?direct&v=")).toBe(true);
		expect(doc.styles[0]?.textContent).toBe("body{color:red}");
	});
});
