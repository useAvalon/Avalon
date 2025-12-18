/**
 * Lit Server-Side Rendering
 * 
 * Handles SSR of Lit components using @lit-labs/ssr.
 * DOM shim MUST be imported first, before any Lit modules.
 */

// Import DOM shim FIRST
import "./dom-shim.ts";
import { DOM_SHIM_INSTALLED, verifyDOMShim } from "./dom-shim.ts";

import type { LitRenderParams, LitRenderResult } from "../types.ts";
import { 
  loadComponent, 
  serializeAttributes, 
  collectStyles,
  extractTagNameFromSource
} from "./utils.ts";
import { render as litRender } from "@lit-labs/ssr";
import type { LitElement } from "lit";

if (!DOM_SHIM_INSTALLED || !verifyDOMShim()) {
  throw new Error("Lit DOM shim is not properly installed");
}

/**
 * Render a Lit element using @lit-labs/ssr with declarative shadow DOM
 */
async function renderLitElementWithSSR(
  ElementClass: typeof LitElement,
  props: Record<string, unknown>,
  tagName: string
): Promise<{ html: string; styles: string }> {
  const instance = new ElementClass();
  
  for (const [key, value] of Object.entries(props)) {
    // deno-lint-ignore no-explicit-any
    (instance as any)[key] = value;
  }
  
  if (instance.connectedCallback) {
    instance.connectedCallback();
  }
  
  const renderResult = instance.render();
  const ssrResult = litRender(renderResult);
  
  let renderedHtml = "";
  for (const chunk of ssrResult) {
    renderedHtml += chunk;
  }
  
  const styles = collectStyles(ElementClass);
  const attributes = serializeAttributes(props);
  const attrsString = attributes ? ` ${attributes}` : "";
  
  const shadowDomHtml = `<${tagName}${attrsString} defer-hydration>
  <template shadowrootmode="open">
    ${styles ? `<style>${styles}</style>` : ""}
    ${renderedHtml}
  </template>
</${tagName}>`;
  
  return { html: shadowDomHtml, styles };
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
  } catch {
    ElementClass = null;
  }
  
  // Render HTML
  const attributes = serializeAttributes(props);
  let html: string;
  
  if (ElementClass) {
    try {
      const ssrResult = await renderLitElementWithSSR(ElementClass, props, tagName);
      html = ssrResult.html;
      styles = ssrResult.styles;
    } catch {
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
