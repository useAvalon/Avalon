/**
 * Separate module so ESM evaluates this stub before `@useavalon/lit`
 * (and `lit-html`, which reads `document` at module eval). Imports in the
 * same file are hoisted together; a dedicated first import is the only
 * ordering guarantee.
 *
 * Prefer `@lit-labs/ssr-dom-shim` for HTMLElement / customElements so Lit SSR
 * can emit declarative shadow DOM. A no-op `customElements.define` left Lit
 * islands as empty tags until client hydration.
 *
 * Non-Lit apps do not install that package. A static import in the prerender
 * wrapper or Nitro virtual module then crashes with ERR_MODULE_NOT_FOUND.
 * Use {@link ssrDomSourceForProject} so the real shim is only emitted when
 * Node can resolve it.
 *
 * Cloudflare's on-disk `_dom_stub.mjs` cannot use bare package imports (the
 * Pages worker has no node_modules). Use {@link ssrDomStubFileSource} there.
 */
import { createRequire } from "node:module";
import { join } from "node:path";

export const SSR_DOM_VIRTUAL_ID = "virtual:avalon/ssr-dom";

/** True when `@lit-labs/ssr-dom-shim` is resolvable from the project. */
export function projectHasLitDomShim(fromDir = process.cwd()): boolean {
	try {
		createRequire(join(fromDir, "package.json")).resolve("@lit-labs/ssr-dom-shim");
		return true;
	} catch {
		return false;
	}
}

/** Real Lit shim when the package is installed; self-contained stub otherwise. */
export function ssrDomSourceForProject(fromDir = process.cwd()): string {
	return projectHasLitDomShim(fromDir) ? ssrDomShimModuleSource() : ssrDomStubFileSource();
}

/** Shared document / Node stubs for lit-html module evaluation. */
function documentStubSource(): string {
	return `
if (typeof globalThis.CSSStyleSheet === "undefined") {
	globalThis.CSSStyleSheet = class CSSStyleSheet {
		constructor() { this.cssRules = []; }
		replaceSync() {}
		replace() { return Promise.resolve(this); }
		insertRule() { return 0; }
		deleteRule() {}
	};
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

/**
 * Nitro virtual module + prerender Node wrapper: real ssr-dom-shim classes.
 * Rolldown / Node resolve `@lit-labs/ssr-dom-shim` from the project graph.
 * CSSStyleSheet must exist before CustomElementRegistry.define runs Lit
 * finalizeStyles (constructable stylesheets).
 */
export function ssrDomShimModuleSource(): string {
	return `
${documentStubSource()}
import {
	CustomElementRegistry,
	CustomEvent as ShimCustomEvent,
	Element as ShimElement,
	Event as ShimEvent,
	EventTarget as ShimEventTarget,
	HTMLElement as ShimHTMLElement,
} from "@lit-labs/ssr-dom-shim";

globalThis.HTMLElement = ShimHTMLElement;
globalThis.Element = ShimElement;
globalThis.EventTarget = ShimEventTarget;
globalThis.Event = ShimEvent;
globalThis.CustomEvent = ShimCustomEvent;
globalThis.customElements = new CustomElementRegistry();
`;
}

/**
 * Self-contained stub for Cloudflare `_dom_stub.mjs` (no bare imports).
 * Keeps a working customElements Map so dynamic Lit SSR in the Worker does not
 * fall back to empty tags when the real shim package is unavailable.
 */
export function ssrDomStubFileSource(): string {
	return `
if (typeof globalThis.HTMLElement === "undefined") {
	globalThis.HTMLElement = class HTMLElement {};
}
if (typeof globalThis.Element === "undefined") {
	globalThis.Element = class Element {};
}
if (typeof globalThis.EventTarget === "undefined") {
	globalThis.EventTarget = class EventTarget {
		addEventListener() {}
		removeEventListener() {}
		dispatchEvent() { return true; }
	};
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
	const registry = new Map();
	globalThis.customElements = {
		define(name, ctor) { registry.set(name, ctor); },
		get(name) { return registry.get(name); },
		whenDefined(name) {
			const ctor = registry.get(name);
			return ctor ? Promise.resolve(ctor) : Promise.resolve();
		},
		getName(ctor) {
			for (const [name, registered] of registry) {
				if (registered === ctor) return name;
			}
			return null;
		},
	};
} else if (typeof globalThis.customElements.get === "function") {
	const probeName = "avalon-ce-probe";
	try {
		const Probe = class extends globalThis.HTMLElement {};
		globalThis.customElements.define(probeName, Probe);
		if (globalThis.customElements.get(probeName) !== Probe) {
			const registry = new Map();
			globalThis.customElements = {
				define(name, ctor) { registry.set(name, ctor); },
				get(name) { return registry.get(name); },
				whenDefined(name) {
					const ctor = registry.get(name);
					return ctor ? Promise.resolve(ctor) : Promise.resolve();
				},
				getName(ctor) {
					for (const [name, registered] of registry) {
						if (registered === ctor) return name;
					}
					return null;
				},
			};
		}
	} catch {
		/* leave existing registry */
	}
}
${documentStubSource()}
`;
}
