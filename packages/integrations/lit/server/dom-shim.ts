/**
 * Lit DOM Shim Installation
 *
 * MUST be imported before any Lit modules to ensure DOM APIs are available.
 * Uses @lit-labs/ssr-dom-shim for core shim classes and linkedom for full DOM API.
 *
 * linkedom is loaded via dynamic import() to bypass Vite's SSR module runner,
 * which can't resolve linkedom's transitive deps (uhyphen, cssom, etc.) under
 * Deno's webworker SSR target.
 */

import {
	CustomElementRegistry,
	CustomEvent as ShimCustomEvent,
	Element as ShimElement,
	Event as ShimEvent,
	EventTarget as ShimEventTarget,
	HTMLElement as ShimHTMLElement,
} from "@lit-labs/ssr-dom-shim";

// Install shim classes as globals immediately (synchronous, no linkedom needed)
// @ts-expect-error
if (typeof globalThis.HTMLElement === "undefined") {
	// @ts-expect-error
	globalThis.HTMLElement = ShimHTMLElement;
}
// @ts-expect-error
if (typeof globalThis.Element === "undefined") {
	// @ts-expect-error
	globalThis.Element = ShimElement;
}
// @ts-expect-error
if (typeof globalThis.CustomEvent === "undefined") {
	// @ts-expect-error
	globalThis.CustomEvent = ShimCustomEvent;
}
// @ts-expect-error
if (typeof globalThis.Event === "undefined") {
	// @ts-expect-error
	globalThis.Event = ShimEvent;
}
// @ts-expect-error
if (typeof globalThis.EventTarget === "undefined") {
	// @ts-expect-error
	globalThis.EventTarget = ShimEventTarget;
}
// @ts-expect-error
if (typeof globalThis.customElements === "undefined") {
	// @ts-expect-error
	globalThis.customElements = new CustomElementRegistry();
}

// Load linkedom via dynamic import to bypass Vite's module runner.
// This lets Deno resolve linkedom and all its transitive deps natively.
let _domReady: Promise<void> | null = null;

function ensureLinkedom(): Promise<void> {
	if (!_domReady) {
		_domReady = (async () => {
			try {
				const linkedom = await import("linkedom");
				const { document: linkedomDocument, Node } = linkedom.parseHTML(
					"<!DOCTYPE html><html><head></head><body></body></html>",
				);

				// @ts-expect-error
				if (typeof globalThis.Node === "undefined") {
					// @ts-expect-error
					globalThis.Node = Node;
				}
				// @ts-expect-error
				if (typeof globalThis.document === "undefined") {
					// @ts-expect-error
					globalThis.document = linkedomDocument;
				}
			} catch (err) {
				console.warn("[lit/dom-shim] Could not load linkedom:", err);
				// Provide minimal stubs so Lit SSR can still attempt rendering
				// @ts-expect-error
				if (typeof globalThis.Node === "undefined") {
					// @ts-expect-error
					globalThis.Node = class Node {};
				}
			}
		})();
	}
	return _domReady;
}

// Kick off linkedom loading immediately (non-blocking)
ensureLinkedom();

/**
 * Wait for the full DOM shim (including linkedom) to be ready.
 * Call this before any rendering that needs document/Node globals.
 */
export async function waitForDOMShim(): Promise<void> {
	await ensureLinkedom();
}

export function verifyDOMShim(): boolean {
	return (
		typeof globalThis.HTMLElement !== "undefined" &&
		typeof globalThis.customElements !== "undefined" &&
		typeof globalThis.Element !== "undefined"
	);
}
