/**
 * Lit Server-Side Rendering
 * 
 * Handles SSR of Lit components using @lit-labs/ssr.
 * DOM shim MUST be imported first, before any Lit modules.
 */

// Import DOM shim FIRST
import "./dom-shim.ts";
import { verifyDOMShim, waitForDOMShim } from "./dom-shim.ts";

import type { LitRenderParams, LitRenderResult } from "../types.ts";
import { 
  loadComponent, 
  serializeAttributes, 
  collectStyles,
  extractTagNameFromSource
} from "./utils.ts";
import type { LitElement } from "lit";
import { LitElementRenderer } from "@lit-labs/ssr/lib/lit-element-renderer.js";

if (!verifyDOMShim()) {
  throw new Error("Lit DOM shim is not properly installed");
}

/**
 * Convert a camelCase prop name to the attribute name the Lit element expects.
 * Checks the element's static `properties` map for an explicit `attribute`
 * mapping; falls back to camelCase → kebab-case conversion.
 */
function propToAttribute(
  ElementClass: typeof LitElement,
  propName: string
): string | null {
  
  const propDefs = (ElementClass as any).properties as
    | Record<string, { attribute?: string | boolean }>
    | undefined;

  if (propDefs && propName in propDefs) {
    const def = propDefs[propName];
    if (def.attribute === false) return null; // property-only, no attribute
    if (typeof def.attribute === "string") return def.attribute;
  }

  // Default: camelCase → kebab-case
  return propName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Render a Lit element using @lit-labs/ssr's LitElementRenderer directly.
 *
 * The previous approach used `unsafeStatic(attrsString)` inside a tagged
 * template literal.  That bakes attributes into the template's *static text*,
 * so @lit-labs/ssr never calls `setAttribute` → `attributeChangedCallback` →
 * `attributeToProperty` on the element instance.  Properties therefore stay at
 * their class-field defaults (e.g. `count = 0`).
 *
 * By driving the renderer directly we can call `setAttribute` for every prop,
 * which feeds through the full Lit reactive pipeline before `render()` runs.
 */
function renderLitElementWithSSR(
  ElementClass: typeof LitElement,
  props: Record<string, unknown>,
  tagName: string
): { html: string; styles: string } {
  // Ensure the element is registered (loadComponent side-effects may have
  // already done this, but be safe).
  if (!customElements.get(tagName)) {
    customElements.define(tagName, ElementClass as unknown as CustomElementConstructor);
  }

  // --- 1. Create the renderer (which internally does `new ElementClass()`) ---
  const renderer = new LitElementRenderer(tagName);

  // --- 2. Feed props as attributes so the reactive pipeline picks them up ---
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;

    const attrName = propToAttribute(ElementClass, key);
    if (attrName === null) {
      // Property with `attribute: false` — set directly on the instance
      if (renderer.element) {
        
        (renderer.element as any)[key] = value;
      }
      continue;
    }

    // Serialize the value to a string for setAttribute
    let strValue: string;
    if (typeof value === "boolean") {
      if (!value) continue; // false booleans → omit attribute
      strValue = "";
    } else if (typeof value === "object") {
      strValue = JSON.stringify(value);
    } else {
      strValue = String(value);
    }

    renderer.setAttribute(attrName, strValue);
  }

  // Always add defer-hydration for client-side hydration support
  renderer.setAttribute("defer-hydration", "");

  // --- 3. connectedCallback triggers willUpdate → update (reflects attrs) ---
  renderer.connectedCallback();

  // --- 4. Render shadow DOM content ---
  const renderInfo = {
    elementRenderers: [LitElementRenderer],
    customElementInstanceStack: [renderer] as Array<InstanceType<typeof LitElementRenderer> | undefined>,
    customElementHostStack: [renderer] as Array<InstanceType<typeof LitElementRenderer> | undefined>,
    eventTargetStack: [] as Array<HTMLElement | undefined>,
    slotStack: [] as Array<string | undefined>,
    deferHydration: false,
  };

  let shadowContent = "";
  const shadowResult = renderer.renderShadow(renderInfo);
  if (shadowResult) {
    for (const chunk of shadowResult) {
      shadowContent += String(chunk);
    }
  }

  // --- 5. Build the outer HTML with declarative shadow DOM ---
  let attrsHtml = "";
  for (const chunk of renderer.renderAttributes()) {
    attrsHtml += chunk;
  }

  const renderedHtml =
    `<${tagName}${attrsHtml}>` +
    `<template shadowrootmode="open">${shadowContent}</template>` +
    `</${tagName}>`;

  const styles = collectStyles(ElementClass);

  return { html: renderedHtml, styles };
}

/**
 * Fallback render - empty custom element tag
 */
function renderFallback(tagName: string, attributes: string): string {
  const attrs = attributes ? ` ${attributes}` : "";
  return `<${tagName}${attrs}></${tagName}>`;
}

/**
 * Render a Lit component on the server
 */
export async function render(params: LitRenderParams): Promise<LitRenderResult> {
  // Ensure linkedom DOM globals are ready before rendering
  await waitForDOMShim();
  
  const { component, props = {}, src, ssrOnly = false, condition = "on:client", viteServer } = params;
  
  // Extract tag name from source code (avoids decorator evaluation issues)
  const tagName = await extractTagNameFromSource(src);
  
  if (!tagName) {
    throw new Error(`Could not extract tag name from ${src}. Ensure @customElement decorator uses a string literal.`);
  }
  
  // Try to load component for full SSR rendering
  let ElementClass: typeof LitElement | null = null;
  let styles = "";
  
  try {
    ElementClass = component || await loadComponent(src, viteServer);
    styles = collectStyles(ElementClass);
  } catch (loadError) {
    // Component loading failed, will use fallback rendering
    ElementClass = null;
  }
  
  // Render HTML
  const attributes = serializeAttributes(props);
  let html: string;
  
  if (ElementClass) {
    try {
      const ssrResult = renderLitElementWithSSR(ElementClass, props, tagName);
      html = ssrResult.html;
      styles = ssrResult.styles;
    } catch (ssrError) {
      html = renderFallback(tagName, attributes);
    }
  } else {
    html = renderFallback(tagName, attributes);
  }
  
  // Build hydration data (unless SSR-only)
  const hydrationData = ssrOnly ? undefined : {
    src,
    props,
    framework: "lit" as const,
    condition,
    metadata: { tagName },
  };
  
  return {
    html,
    css: styles || undefined,
    styles,
    shadowContent: html,
    hydrationData,
  };
}

/**
 * Render with error boundary - returns fallback on failure
 */
export async function renderWithErrorBoundary(
  params: LitRenderParams,
  fallback?: string
): Promise<LitRenderResult> {
  try {
    return await render(params);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      html: fallback || `<!-- Lit SSR failed: ${errorMessage} -->`,
      hydrationData: {
        src: params.src,
        props: params.props || {},
        framework: "lit",
        metadata: { ssrFailed: true, errorMessage },
      },
    };
  }
}
