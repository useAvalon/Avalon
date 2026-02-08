/**
 * Lit Server-Side Rendering
 * 
 * Handles SSR of Lit components using @lit-labs/ssr.
 * DOM shim MUST be imported first, before any Lit modules.
 */

// Import DOM shim FIRST
import "./dom-shim.ts";
import { DOM_SHIM_INSTALLED, verifyDOMShim, waitForDOMShim } from "./dom-shim.ts";

import type { LitRenderParams, LitRenderResult } from "../types.ts";
import { 
  loadComponent, 
  serializeAttributes, 
  collectStyles,
  extractTagNameFromSource
} from "./utils.ts";
import { render as litRender } from "@lit-labs/ssr";
import { html, unsafeStatic } from "lit/static-html.js";
import type { LitElement } from "lit";

if (!DOM_SHIM_INSTALLED || !verifyDOMShim()) {
  throw new Error("Lit DOM shim is not properly installed");
}

/**
 * Render a Lit element using @lit-labs/ssr with declarative shadow DOM
 * Uses the proper SSR approach: render the custom element tag, not the instance
 */
function renderLitElementWithSSR(
  ElementClass: typeof LitElement,
  props: Record<string, unknown>,
  tagName: string
): { html: string; styles: string } {
  // Build attributes for the custom element
  const attributes = serializeAttributes(props);
  const attrsString = attributes ? ` ${attributes}` : "";
  
  // Create the element template using lit's static html
  // This is the proper way to SSR Lit elements - render the tag, not the class instance
  const tag = unsafeStatic(tagName);
  const elementTemplate = html`<${tag}${unsafeStatic(attrsString)} defer-hydration></${tag}>`;
  
  // Use @lit-labs/ssr to render the element
  const ssrResult = litRender(elementTemplate);
  
  let renderedHtml = "";
  for (const chunk of ssrResult) {
    renderedHtml += chunk;
  }
  
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
