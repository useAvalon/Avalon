/**
 * Lit Client-Side Hydration
 * 
 * Uses official @lit-labs/ssr-client hydration support.
 */

/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import type { LitElement } from "lit";
import type { LitHydrationOptions } from "../types.ts";

// Import hydration support - MUST be first
import "./lit-hydrate-support.ts";

/**
 * Hydrate a server-rendered Lit component
 */
export function hydrate(
  container: HTMLElement,
  ElementClass: typeof LitElement,
  props: Record<string, unknown>,
  options?: LitHydrationOptions
): void {
  if (container.hasAttribute("data-lit-hydrated")) return;

  const tagName =
    container.getAttribute("data-tag-name") ||
    
    (ElementClass as any).elementName ||
    ElementClass.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

  if (!tagName) {
    throw new Error("Could not determine tag name for Lit component");
  }

  if (options?.defer) {
    const trigger = () => performHydration(container, ElementClass, tagName, props);
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(trigger);
    } else {
      setTimeout(trigger, 0);
    }
    return;
  }

  performHydration(container, ElementClass, tagName, props);
  container.setAttribute("data-lit-hydrated", "true");
}

function performHydration(
  container: HTMLElement,
  ElementClass: typeof LitElement,
  tagName: string,
  props: Record<string, unknown>
): void {
  const element = container.querySelector(tagName);

  if (!element) {
    // Client-only render
    const newElement = document.createElement(tagName);
    Object.entries(props).forEach(([key, value]) => {
      
      (newElement as any)[key] = value;
    });
    container.appendChild(newElement);
    return;
  }

  // Register custom element if needed
  if (!customElements.get(tagName)) {
    
    customElements.define(tagName, ElementClass as any);
  }

  // Remove defer-hydration to trigger Lit's hydration
  if (element.hasAttribute("defer-hydration")) {
    element.removeAttribute("defer-hydration");
  }
}

/**
 * Get hydration script for automatic island hydration
 */
export function getHydrationScript(): string {
  return `
    import { hydrate } from '@avalon/lit/client';
    
    document.querySelectorAll('[data-framework="lit"]').forEach(async (el) => {
      const src = el.getAttribute('data-src');
      const propsJson = el.getAttribute('data-props');
      const props = propsJson ? JSON.parse(propsJson) : {};
      
      try {
        const module = await import(src);
        const Component = module.default || module;
        hydrate(el, Component, props);
      } catch (error) {
        console.error('Failed to hydrate Lit component:', src, error);
      }
    });
  `;
}
