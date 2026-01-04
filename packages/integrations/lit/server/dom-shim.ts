/**
 * Lit DOM Shim Installation
 * 
 * MUST be imported before any Lit modules to ensure DOM APIs are available.
 * Uses linkedom for a complete DOM implementation in SSR environments.
 */

import {
  HTMLElement as ShimHTMLElement,
  Element as ShimElement,
  CustomEvent as ShimCustomEvent,
  Event as ShimEvent,
  EventTarget as ShimEventTarget,
  CustomElementRegistry,
} from "@lit-labs/ssr-dom-shim";

import { parseHTML } from "linkedom";

// Create a linkedom document for full DOM API support
const { document: linkedomDocument, Node } = parseHTML("<!DOCTYPE html><html><head></head><body></body></html>");

// Install shim classes as globals at module load time
// @ts-ignore - adding to globalThis
if (typeof globalThis.HTMLElement === "undefined") {
  // @ts-ignore
  globalThis.HTMLElement = ShimHTMLElement;
}

// @ts-ignore
if (typeof globalThis.Element === "undefined") {
  // @ts-ignore
  globalThis.Element = ShimElement;
}

// @ts-ignore
if (typeof globalThis.CustomEvent === "undefined") {
  // @ts-ignore
  globalThis.CustomEvent = ShimCustomEvent;
}

// @ts-ignore
if (typeof globalThis.Event === "undefined") {
  // @ts-ignore
  globalThis.Event = ShimEvent;
}

// @ts-ignore
if (typeof globalThis.EventTarget === "undefined") {
  // @ts-ignore
  globalThis.EventTarget = ShimEventTarget;
}

// @ts-ignore
if (typeof globalThis.customElements === "undefined") {
  // @ts-ignore
  globalThis.customElements = new CustomElementRegistry();
}

// @ts-ignore
if (typeof globalThis.Node === "undefined") {
  // @ts-ignore
  globalThis.Node = Node;
}

// Use linkedom's document which has full DOM API support including
// createComment, createTreeWalker, etc.
// @ts-ignore
if (typeof globalThis.document === "undefined") {
  // @ts-ignore
  globalThis.document = linkedomDocument;
}

export function verifyDOMShim(): boolean {
  return (
    typeof globalThis.HTMLElement !== "undefined" &&
    typeof globalThis.customElements !== "undefined" &&
    typeof globalThis.Element !== "undefined" &&
    typeof globalThis.document !== "undefined" &&
    typeof globalThis.document.createComment === "function" &&
    typeof globalThis.document.createTreeWalker === "function"
  );
}

export const DOM_SHIM_INSTALLED = true;
