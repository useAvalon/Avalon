import { describe, expect, it } from "vitest";
import {
	attachDeclarativeShadowRoots,
	isHtmlResponse,
	outletKeyOf,
	reconcileHead,
	replaceBody,
	replaceOutlets,
} from "../swap.ts";

describe("isHtmlResponse", () => {
	it("accepts HTML content types including 404 documents", () => {
		expect(isHtmlResponse("text/html")).toBe(true);
		expect(isHtmlResponse("text/html; charset=utf-8")).toBe(true);
		expect(isHtmlResponse("application/xhtml+xml")).toBe(false);
		expect(isHtmlResponse("application/json")).toBe(false);
		expect(isHtmlResponse(null)).toBe(false);
	});
});

const SSR_STYLE_SELECTOR = "style[data-universal-ssr], style[data-avalon-ssr-css]";

class FakeStyle {
	textContent: string;
	dataset: { avalonCss?: string; avalonSsrCss?: string; universalSsr?: string };
	private attrs: Record<string, string>;
	private owner: FakeHead | null = null;

	constructor(attrs: Record<string, string>, textContent: string) {
		this.attrs = { ...attrs };
		this.textContent = textContent;
		this.dataset = {
			avalonCss: attrs["data-avalon-css"],
			avalonSsrCss: attrs["data-avalon-ssr-css"],
			universalSsr: attrs["data-universal-ssr"],
		};
	}

	getAttribute(name: string): string | null {
		return this.attrs[name] ?? null;
	}

	hasAttribute(name: string): boolean {
		return name in this.attrs;
	}

	attach(owner: FakeHead): this {
		this.owner = owner;
		return this;
	}

	clone(): FakeStyle {
		return new FakeStyle(this.attrs, this.textContent);
	}

	remove(): void {
		this.owner?.detach(this);
	}
}

class FakeHead {
	styles: FakeStyle[] = [];

	querySelectorAll(selector: string): FakeStyle[] {
		if (selector === "meta" || selector === "link" || selector.startsWith("link")) return [];
		if (selector === SSR_STYLE_SELECTOR) {
			return this.styles.filter(
				(el) => el.hasAttribute("data-universal-ssr") || el.hasAttribute("data-avalon-ssr-css"),
			);
		}
		if (selector === "style[data-avalon-css]") {
			return this.styles.filter((el) => el.hasAttribute("data-avalon-css"));
		}
		return [];
	}

	appendChild(el: FakeStyle): FakeStyle {
		el.attach(this);
		this.styles.push(el);
		return el;
	}

	detach(el: FakeStyle): void {
		this.styles = this.styles.filter((s) => s !== el);
	}
}

function fakeDoc(styles: FakeStyle[] = []) {
	const head = new FakeHead();
	for (const style of styles) {
		head.appendChild(style);
	}
	return {
		title: "",
		head,
		importNode: (el: FakeStyle) => el.clone(),
	} as unknown as Document;
}

describe("reconcileHead style tags", () => {
	it("replaces Vue/Svelte universal SSR styles from the next document", () => {
		const current = fakeDoc([new FakeStyle({ "data-universal-ssr": "true" }, ".old{}")]);
		const next = fakeDoc([new FakeStyle({ "data-universal-ssr": "true" }, ".vue-counter{}")]);

		reconcileHead(current, next);

		const copied = (current.head as unknown as FakeHead).styles;
		expect(copied).toHaveLength(1);
		expect(copied[0]?.textContent).toBe(".vue-counter{}");
		expect(copied[0]?.getAttribute("data-universal-ssr")).toBe("true");
	});

	it("replaces data-avalon-ssr-css tags from the next document", () => {
		const current = fakeDoc([new FakeStyle({ "data-avalon-ssr-css": "" }, "body{color:red}")]);
		const next = fakeDoc([new FakeStyle({ "data-avalon-ssr-css": "" }, "body{color:blue}")]);

		reconcileHead(current, next);

		const copied = (current.head as unknown as FakeHead).styles;
		expect(copied[0]?.textContent).toBe("body{color:blue}");
	});

	it("adds missing hashed style[data-avalon-css] without duplicating", () => {
		const current = fakeDoc([new FakeStyle({ "data-avalon-css": "/a.css" }, ".a{}")]);
		const next = fakeDoc([
			new FakeStyle({ "data-avalon-css": "/a.css" }, ".a{}"),
			new FakeStyle({ "data-avalon-css": "/b.css" }, ".b{}"),
		]);

		reconcileHead(current, next);

		const hrefs = (current.head as unknown as FakeHead).styles.map((s) =>
			s.getAttribute("data-avalon-css"),
		);
		expect(hrefs).toEqual(["/a.css", "/b.css"]);
	});
});

describe("replaceBody", () => {
	it("adopts the next body instead of cloning it", () => {
		const nextBody = { nodeName: "BODY" };
		const adopted = { nodeName: "BODY", adopted: true };
		let replaced: unknown;
		const currentBody = {
			replaceWith(node: unknown) {
				replaced = node;
			},
			querySelectorAll: () => [],
		};
		const current = {
			body: currentBody,
			adoptNode(node: unknown) {
				expect(node).toBe(nextBody);
				return adopted;
			},
		};

		replaceBody(current as unknown as Document, { body: nextBody } as unknown as Document);
		expect(replaced).toBe(adopted);
	});
});

describe("attachDeclarativeShadowRoots", () => {
	it("moves leftover shadowrootmode templates into a new shadow root", () => {
		const content = { kind: "fragment" };
		const appended: unknown[] = [];
		const template = {
			parentElement: null as {
				shadowRoot: ShadowRoot | null;
				attachShadow: (init: { mode: string }) => { appendChild: (node: unknown) => unknown };
			} | null,
			getAttribute(name: string) {
				return name === "shadowrootmode" ? "open" : null;
			},
			content,
			removed: false,
			remove() {
				this.removed = true;
			},
		};
		const host = {
			shadowRoot: null as ShadowRoot | null,
			attachShadow(init: { mode: string }) {
				expect(init.mode).toBe("open");
				return {
					appendChild(node: unknown) {
						appended.push(node);
						return node;
					},
				};
			},
		};
		template.parentElement = host;

		attachDeclarativeShadowRoots({
			querySelectorAll: () => [template],
		} as unknown as ParentNode);

		expect(appended).toEqual([content]);
		expect(template.removed).toBe(true);
	});

	it("skips hosts that already have a shadow root", () => {
		const template = {
			parentElement: {
				shadowRoot: {},
				attachShadow: () => {
					throw new Error("should not attach");
				},
			},
			getAttribute: () => "open",
			content: {},
			removed: false,
			remove() {
				this.removed = true;
			},
		};

		attachDeclarativeShadowRoots({
			querySelectorAll: () => [template],
		} as unknown as ParentNode);

		expect(template.removed).toBe(true);
	});
});

describe("replaceOutlets", () => {
	interface FakeOutlet {
		dataset: { routerOutlet?: string };
		replacedWith: FakeOutlet | null;
		replaceWith(node: FakeOutlet): void;
	}

	function outlet(key?: string): FakeOutlet {
		const node: FakeOutlet = {
			dataset: key ? { routerOutlet: key } : {},
			replacedWith: null,
			replaceWith(next) {
				node.replacedWith = next;
			},
		};
		return node;
	}

	function doc(nodes: FakeOutlet[]): Document {
		return {
			body: {
				querySelectorAll: (selector: string) =>
					selector === "[data-router-outlet]" ? nodes.filter((n) => n.dataset.routerOutlet) : [],
			},
			querySelectorAll: (selector: string) =>
				selector === "[data-router-outlet]" ? nodes.filter((n) => n.dataset.routerOutlet) : [],
			adoptNode: (node: FakeOutlet) => node,
		} as unknown as Document;
	}

	it("reads a trimmed outlet key", () => {
		expect(outletKeyOf({ dataset: { routerOutlet: "docs-page" } } as HTMLElement)).toBe(
			"docs-page",
		);
		expect(outletKeyOf({ dataset: { routerOutlet: "  " } } as HTMLElement)).toBeNull();
	});

	it("swaps matching outlets", () => {
		const livePage = outlet("docs-page");
		const liveToc = outlet("docs-toc");
		const nextPage = outlet("docs-page");
		const nextToc = outlet("docs-toc");
		expect(replaceOutlets(doc([livePage, liveToc]), doc([nextPage, nextToc]))).toEqual([
			livePage,
			liveToc,
		]);
		expect(livePage.replacedWith).toBe(nextPage);
		expect(liveToc.replacedWith).toBe(nextToc);
	});

	it("falls back when outlet keys do not match", () => {
		const live = outlet("docs-page");
		expect(replaceOutlets(doc([live]), doc([outlet()]))).toBeNull();
		expect(live.replacedWith).toBeNull();
	});
});
