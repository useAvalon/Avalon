/**
 * Separate module so ESM evaluates this stub before `@useavalon/lit`
 * (and `lit-html`, which reads `document` at module eval). Imports in the
 * same file are hoisted together; a dedicated first import is the only
 * ordering guarantee. Avoid importing `linkedom` here — Bun's layout is
 * not visible to Rolldown from a virtual module.
 */
export const SSR_DOM_VIRTUAL_ID = "virtual:avalon/ssr-dom";

export function ssrDomShimModuleSource(): string {
	return `
if (typeof globalThis.HTMLElement === "undefined") {
	globalThis.HTMLElement = class HTMLElement {};
}
if (typeof globalThis.Element === "undefined") {
	globalThis.Element = class Element {};
}
if (typeof globalThis.EventTarget === "undefined") {
	globalThis.EventTarget = class EventTarget {};
}
if (typeof globalThis.Event === "undefined") {
	globalThis.Event = class Event { constructor(type) { this.type = type; } };
}
if (typeof globalThis.CustomEvent === "undefined") {
	globalThis.CustomEvent = class CustomEvent extends Event {
		constructor(type, init) { super(type); this.detail = init?.detail; }
	};
}
if (typeof globalThis.customElements === "undefined") {
	globalThis.customElements = { define() {}, get() { return undefined; }, whenDefined() { return Promise.resolve(); } };
}
if (typeof globalThis.document === "undefined") {
	const createEl = () => ({
		nodeType: 1,
		childNodes: [],
		attributes: {},
		style: {},
		setAttribute() {},
		getAttribute() { return null; },
		appendChild(c) { return c; },
		addEventListener() {},
		removeEventListener() {},
	});
	globalThis.document = {
		createComment() { return { nodeType: 8 }; },
		createTextNode(t) { return { nodeType: 3, data: t }; },
		createElement() { return createEl(); },
		createElementNS() { return createEl(); },
		createTreeWalker() { return { nextNode() { return null; } }; },
		createDocumentFragment() { return createEl(); },
		implementation: { createHTMLDocument() { return globalThis.document; } },
		body: createEl(),
		head: createEl(),
		documentElement: createEl(),
	};
}
if (typeof globalThis.Node === "undefined") {
	globalThis.Node = class Node {};
}
`;
}
