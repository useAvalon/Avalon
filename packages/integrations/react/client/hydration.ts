// Client-side hydration logic for React components
/// <reference lib="dom" />

import { hydrateRoot } from "react-dom/client";
import { createElement } from "react";
import type { ComponentType } from "react";
import type { ReactHydrationOptions } from "../types.ts";

/**
 * Hydrate a React component on the client
 * Attaches interactivity to server-rendered HTML using React 18's hydrateRoot
 * 
 * @param container - DOM element to hydrate into
 * @param Component - React component to hydrate
 * @param props - Component props
 * @param options - Hydration options including error recovery
 */
export function hydrate(
  container: HTMLElement,
  Component: ComponentType<Record<string, unknown>>,
  props: Record<string, unknown>,
  options?: ReactHydrationOptions
): void {
  try {
    const element = createElement(Component, props);
    
    hydrateRoot(container, element, {
      onRecoverableError: options?.onRecoverableError || ((error: unknown) => {
        console.error("React hydration recoverable error:", error);
      }),
    });
  } catch (error) {
    console.error("React hydration failed:", error);
    throw error;
  }
}

/**
 * Generate hydration script for React islands
 * This script is injected into the page to enable client-side hydration
 * Supports all hydration conditions: on:client, on:visible, on:idle, on:interaction
 * 
 * @returns JavaScript code as a string for client-side hydration
 */
export function getHydrationScript(): string {
  const script = [
    "import { hydrate } from '@avalon/react/client';",
    "",
    "// Helper to hydrate a single island",
    "async function hydrateIsland(el) {",
    "  const src = el.getAttribute('data-src');",
    "  const propsStr = el.getAttribute('data-props');",
    "  const props = propsStr ? JSON.parse(propsStr) : {};",
    "  ",
    "  try {",
    "    const module = await import(src);",
    "    const Component = module.default || module;",
    "    hydrate(el, Component, props);",
    "  } catch (error) {",
    "    console.error('Failed to hydrate React island:', error);",
    "  }",
    "}",
    "",
    "// Process all React islands based on their hydration condition",
    "document.querySelectorAll('[data-framework=\"react\"]').forEach((el) => {",
    "  const condition = el.getAttribute('data-condition') || 'on:client';",
    "  ",
    "  if (condition === 'on:client') {",
    "    // Hydrate immediately",
    "    hydrateIsland(el);",
    "  } else if (condition === 'on:visible') {",
    "    // Hydrate when element becomes visible",
    "    const observer = new IntersectionObserver((entries) => {",
    "      entries.forEach((entry) => {",
    "        if (entry.isIntersecting) {",
    "          hydrateIsland(entry.target);",
    "          observer.disconnect();",
    "        }",
    "      });",
    "    });",
    "    observer.observe(el);",
    "  } else if (condition === 'on:idle') {",
    "    // Hydrate when browser is idle",
    "    if ('requestIdleCallback' in window) {",
    "      requestIdleCallback(() => hydrateIsland(el));",
    "    } else {",
    "      // Fallback for browsers without requestIdleCallback",
    "      setTimeout(() => hydrateIsland(el), 200);",
    "    }",
    "  } else if (condition === 'on:interaction') {",
    "    // Hydrate on first user interaction",
    "    const events = ['click', 'touchstart', 'mouseenter', 'focus'];",
    "    const hydrateOnce = () => {",
    "      hydrateIsland(el);",
    "      events.forEach(event => el.removeEventListener(event, hydrateOnce));",
    "    };",
    "    events.forEach(event => el.addEventListener(event, hydrateOnce, { once: true, passive: true }));",
    "  }",
    "});",
  ].join("\n");
  
  return script;
}

/**
 * Check if a container is ready for hydration
 * 
 * @param container - DOM element to check
 * @returns True if container has content to hydrate
 */
export function isHydrationReady(container: HTMLElement): boolean {
  return container.hasChildNodes();
}

/**
 * Clean up hydration artifacts after hydration is complete
 * 
 * @param container - DOM element to clean up
 */
export function cleanupHydration(container: HTMLElement): void {
  // Remove hydration-specific attributes
  delete container.dataset.framework;
  delete container.dataset.src;
  delete container.dataset.props;
  delete container.dataset.condition;
}
