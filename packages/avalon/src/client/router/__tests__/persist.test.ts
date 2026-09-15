import { describe, expect, it } from "vitest";
import {
	clearViewTransitionGeometry,
	extractPersisted,
	hasPersistedNodes,
	leftoverPersisted,
	persistKeyOf,
	restorePersisted,
} from "../persist.ts";

interface FakeEl {
	dataset: Record<string, string | undefined>;
	attributes: Record<string, string>;
	parent: FakeParent | null;
	children: FakeEl[];
	removed: boolean;
	replacedWith: FakeEl | null;
	getAttribute(name: string): string | null;
	removeAttribute(name: string): void;
	querySelector(selector: string): FakeEl | null;
	querySelectorAll(selector: string): FakeEl[];
	closest(selector: string): FakeEl | null;
	style: {
		props: Record<string, string>;
		getPropertyValue(name: string): string;
		removeProperty(name: string): void;
	};
	remove(): void;
	replaceWith(node: FakeEl): void;
}

interface FakeParent {
	nodes: FakeEl[];
	querySelectorAll(selector: string): FakeEl[];
}

function el(attrs: Record<string, string>, children: FakeEl[] = []): FakeEl {
	const node: FakeEl = {
		dataset: {},
		attributes: { ...attrs },
		parent: null,
		children,
		removed: false,
		replacedWith: null,
		getAttribute(name) {
			return node.attributes[name] ?? null;
		},
		removeAttribute(name) {
			delete node.attributes[name];
		},
		querySelector(selector) {
			return node.querySelectorAll(selector)[0] ?? null;
		},
		querySelectorAll(selector) {
			const out: FakeEl[] = [];
			for (const child of node.children) {
				if (matches(child, selector)) out.push(child);
				out.push(...child.querySelectorAll(selector));
			}
			return out;
		},
		closest() {
			return null;
		},
		style: {
			props: {} as Record<string, string>,
			getPropertyValue(name) {
				return node.style.props[name] ?? "";
			},
			removeProperty(name) {
				delete node.style.props[name];
				if (Object.keys(node.style.props).length === 0) node.attributes.style = "";
			},
		},
		remove() {
			node.removed = true;
			if (node.parent) {
				node.parent.nodes = node.parent.nodes.filter((n) => n !== node);
			}
		},
		replaceWith(next) {
			node.replacedWith = next;
			if (!node.parent) return;
			node.parent.nodes = node.parent.nodes.map((n) => (n === node ? next : n));
			next.parent = node.parent;
		},
	};
	if (attrs["data-framework"]) node.dataset.framework = attrs["data-framework"];
	if (attrs["data-router-persist"] != null) {
		node.dataset.routerPersist = attrs["data-router-persist"];
	}
	for (const child of children) {
		child.parent = {
			nodes: children,
			querySelectorAll: (sel) => children.filter((c) => matches(c, sel)),
		};
	}
	return node;
}

function matches(node: FakeEl, selector: string): boolean {
	if (selector === "[data-router-persist]") return node.getAttribute("data-router-persist") != null;
	if (selector === "[data-framework='qwik']") return node.dataset.framework === "qwik";
	return false;
}

function rootOf(
	nodes: FakeEl[],
): FakeParent & { querySelectorAll: FakeParent["querySelectorAll"] } {
	const parent: FakeParent = {
		nodes,
		querySelectorAll(selector) {
			const out: FakeEl[] = [];
			for (const node of parent.nodes) {
				if (matches(node, selector)) out.push(node);
				out.push(...node.querySelectorAll(selector));
			}
			return out;
		},
	};
	for (const node of nodes) node.parent = parent;
	return parent;
}

describe("persistKeyOf", () => {
	it("trims and rejects empty keys", () => {
		expect(persistKeyOf(el({ "data-router-persist": "theme" }))).toBe("theme");
		expect(persistKeyOf(el({ "data-router-persist": "  " }))).toBeNull();
		expect(persistKeyOf(el({}))).toBeNull();
	});
});

describe("extractPersisted / restorePersisted", () => {
	it("detaches matching nodes and restores them onto stubs", () => {
		const live = el({ "data-router-persist": "theme" });
		const oldRoot = rootOf([live]);
		const saved = extractPersisted(oldRoot as unknown as ParentNode);
		expect(saved.get("theme")).toBe(live);
		expect(live.removed).toBe(true);

		const stub = el({ "data-router-persist": "theme" });
		const nextRoot = rootOf([stub]);
		const restored = restorePersisted(nextRoot as unknown as ParentNode, saved);
		expect(restored.has("theme")).toBe(true);
		expect(stub.replacedWith).toBe(live);
	});

	it("skips Qwik islands", () => {
		const qwik = el({ "data-router-persist": "q", "data-framework": "qwik" });
		const saved = extractPersisted(rootOf([qwik]) as unknown as ParentNode);
		expect(saved.size).toBe(0);
		expect(qwik.removed).toBe(false);
	});

	it("strips leftover view-transition geometry from persist nodes", () => {
		const live = el({ "data-router-persist": "theme" });
		live.style.props.top = "80px";
		live.style.props.transform = "translateY(12px)";
		live.attributes.style = "top: 80px";
		clearViewTransitionGeometry(rootOf([live]) as unknown as ParentNode);
		expect(live.style.props.top).toBeUndefined();
		expect(live.style.props.transform).toBeUndefined();
		expect(live.getAttribute("style")).toBeNull();
	});

	it("reports whether a root has persist slots", () => {
		expect(hasPersistedNodes(rootOf([]) as unknown as ParentNode)).toBe(false);
		expect(
			hasPersistedNodes(rootOf([el({ "data-router-persist": "theme" })]) as unknown as ParentNode),
		).toBe(true);
	});

	it("returns leftover nodes that have no stub on the next page", () => {
		const live = el({ "data-router-persist": "gone" });
		const saved = extractPersisted(rootOf([live]) as unknown as ParentNode);
		const restored = restorePersisted(rootOf([]) as unknown as ParentNode, saved);
		expect(leftoverPersisted(saved, restored)).toEqual([live]);
	});
});
