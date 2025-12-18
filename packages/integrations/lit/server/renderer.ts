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
  getTagName, 
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
 * Render a Lit element using @lit-labs/ssr
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
 * Fallback render without SSR
 */
function renderLitElementFallback(tagName: string, attributes: string): string {
  const attrs = attributes ? ` ${attributes}` : "";
  return `<${tagName}${attrs}></${tagName}>`;
}

/**
 * Render a Lit component on the server
 */
export async function render(params: LitRenderParams): Promise<LitRenderResult> {
  const { component, props = {}, src, ssrOnly = false, condition = "on:client", viteServer } = params;
  
  let tagName: string;
  let styles = "";
  let ElementClass: typeof import("lit").LitElement | null = null;
  
  // Strategy 1: Use explicit tagName if provided
  if (params.tagName) {
    tagName = params.tagName;
  } 
  // Strategy 2: Extract from source (avoids decorator issues)
  else {
    const extractedTagName = await extractTagNameFromSource(src);
    
    if (extractedTagName) {
      tagName = extractedTagName;
      
      // Try to load module for full SSR
      try {
        ElementClass = component || await loadComponent(src, viteServer);
        styles = collectStyles(ElementClass);
      } catch {
        ElementClass = null;
      }
    } 
    // Strategy 3: Load module (may fail with decorators)
    else {
      ElementClass = component || await loadComponent(src, viteServer);
      tagName = getTagName(ElementClass);
      styles = collectStyles(ElementClass);
    }
  }
  
  const attributes = serializeAttributes(props);
  let html: string;
  
  if (ElementClass) {
    try {
      const ssrResult = await renderLitElementWithSSR(ElementClass, props, tagName);
      html = ssrResult.html;
      styles = ssrResult.styles;
    } catch {
      html = renderLitElementFallback(tagName, attributes);
    }
  } else {
    html = renderLitElementFallback(tagName, attributes);
  }
  
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
 * Render with error boundary
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
