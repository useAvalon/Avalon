/**
 * Vite plugin to install Lit SSR DOM shim
 * 
 * Ensures DOM globals are available in SSR context before Lit loads.
 * Uses linkedom for a complete DOM implementation that Lit requires.
 */

import type { Plugin } from "vite";

export function litSSRShimPlugin(): Plugin {
  let shimInstalled = false;

  return {
    name: "lit-ssr-shim",
    enforce: "pre",

    async configureServer() {
      if (shimInstalled) return;

      try {
        // Use linkedom for a complete DOM implementation
        // @lit-labs/ssr-dom-shim is too minimal (no document.createComment)
        const { parseHTML } = await import("linkedom");
        const { document, customElements, HTMLElement, Element, CustomEvent, Event } = 
          parseHTML("<!DOCTYPE html><html><body></body></html>");

        // @ts-ignore
        if (typeof globalThis.HTMLElement === "undefined") globalThis.HTMLElement = HTMLElement;
        // @ts-ignore
        if (typeof globalThis.Element === "undefined") globalThis.Element = Element;
        // @ts-ignore
        if (typeof globalThis.CustomEvent === "undefined") globalThis.CustomEvent = CustomEvent;
        // @ts-ignore
        if (typeof globalThis.Event === "undefined") globalThis.Event = Event;
        // @ts-ignore
        if (typeof globalThis.customElements === "undefined") globalThis.customElements = customElements;
        // @ts-ignore
        if (typeof globalThis.document === "undefined") globalThis.document = document;

        shimInstalled = true;
      } catch (error) {
        console.warn("Failed to install Lit SSR DOM shim:", error);
      }
    },
  };
}
