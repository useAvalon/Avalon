/**
 * Lit DOM Shim Installation
 * 
 * MUST be imported before any Lit modules to ensure DOM APIs are available.
 * Provides minimal DOM APIs (HTMLElement, customElements, etc.) for SSR.
 */

import {
  HTMLElement,
  Element,
  CustomEvent,
  Event,
  EventTarget,
  CustomElementRegistry,
} from "@lit-labs/ssr-dom-shim";

// Install shim classes as globals at module load time
// @ts-ignore - adding to globalThis
if (typeof globalThis.HTMLElement === "undefined") {
  // @ts-ignore
  globalThis.HTMLElement = HTMLElement;
}

// @ts-ignore
if (typeof globalThis.Element === "undefined") {
  // @ts-ignore
  globalThis.Element = Element;
}

// @ts-ignore
if (typeof globalThis.CustomEvent === "undefined") {
  // @ts-ignore
  globalThis.CustomEvent = CustomEvent;
}

// @ts-ignore
if (typeof globalThis.Event === "undefined") {
  // @ts-ignore
  globalThis.Event = Event;
}

// @ts-ignore
if (typeof globalThis.EventTarget === "undefined") {
  // @ts-ignore
  globalThis.EventTarget = EventTarget;
}

// @ts-ignore
if (typeof globalThis.customElements === "undefined") {
  // @ts-ignore
  globalThis.customElements = new CustomElementRegistry();
}

export function verifyDOMShim(): boolean {
  return (
    typeof HTMLElement !== "undefined" &&
    typeof customElements !== "undefined" &&
    typeof Element !== "undefined"
  );
}

export const DOM_SHIM_INSTALLED = true;
