/**
 * Vue Server Renderer
 * 
 * Provides server-side rendering capabilities for Vue components.
 * Uses Vue's official SSR API with proper hydration support.
 * 
 * Migrated from src/islands/renderers/vue-renderer.ts
 */

import { createSSRApp } from "vue";
import { renderToString as vueRenderToString } from "vue/server-renderer";
import type { RenderParams, RenderResult } from "../../core/types.ts";
import type { VueRenderResult } from "../types.ts";
import { extractCSS, generateScopeId, applyScopeToHTML } from "./css-extractor.ts";

/**
 * Render a Vue component to HTML string with SSR
 * 
 * Creates a Vue SSR app instance and renders it to string.
 * Extracts and applies scoped CSS from the component.
 * 
 * Based on Vue.js SSR documentation and Astro's Vue integration:
 * - Creates proper SSR app with createSSRApp
 * - Wraps SSR HTML in a div with data-server-rendered="true"
 * - Uses consistent container structure for client hydration
 * 
 * @param params - Render parameters including component, props, and source path
 * @returns Render result with HTML, CSS, and hydration data
 */
export async function render(params: RenderParams): Promise<RenderResult> {
  const { component: _component, props = {}, src, condition = "on:client", ssrOnly = false } = params;
  
  try {
    const VueComponent = await loadComponent(src);
    
    const app = createSSRApp(VueComponent as any, props);
    const ssrHtml = await vueRenderToString(app);
    
    let componentCSS = "";
    let scopeId = "";
    
    try {
      scopeId = generateScopeId(src);
      componentCSS = await extractCSS(src, { scopeId });
    } catch {
      // CSS extraction failed, continue without CSS
    }
    
    let finalHtml = ssrHtml;
    if (componentCSS) {
      finalHtml = applyScopeToHTML(ssrHtml, scopeId);
    }
    
    return {
      html: finalHtml,
      css: componentCSS || undefined,
      scopeId: scopeId || undefined,
      hydrationData: { src, props, framework: "vue", condition, ssrOnly },
    };
  } catch (error) {
    throw new Error(`Vue SSR rendering failed: ${error}`);
  }
}

/**
 * Load a Vue component module
 * 
 * Handles both development (via Vite) and production (pre-built) scenarios.
 * 
 * @param src - Component source path
 * @returns Vue component module
 */
/**
 * Resolve island path from /islands/ to /src/islands/
 */
function resolveIslandPath(src: string) {
  // If path starts with /islands/, convert to /src/islands/
  if (src.startsWith("/islands/")) {
    return src.replace("/islands/", "/src/islands/");
  }
  
  // If path already starts with /src/islands/, use as-is
  if (src.startsWith("/src/islands/")) {
    return src;
  }
  
  // Otherwise return as-is
  return src;
}

async function loadComponent(src: string) {
  const isDev = process.env.NODE_ENV !== "production";
  
  
  if (isDev && (globalThis as any).__viteDevServer) {
    // Development: use Vite's SSR module loading
    
    const viteServer = (globalThis as any).__viteDevServer;
    const resolvedPath = resolveIslandPath(src);
    const module = await viteServer.ssrLoadModule(resolvedPath);
    return module.default || module;
  }
  
  // Production: load from build output
  const ssrPath = src
    .replace("/islands/", "/dist/ssr/islands/")
    .replace(".vue", ".js");
  
  const module = await import(
    /* @vite-ignore */
    ssrPath
  );
  return module.default || module;
}

/**
 * Get component metadata for debugging
 * 
 * @param component - Vue component
 * @returns Component metadata object
 */
export function getComponentMetadata(component: unknown) {
  if (typeof component === "object" && component !== null) {
    return {
      name: (component as { name?: string }).name || "Anonymous",
      type: "component",
      hasSetup: "setup" in component,
      hasTemplate: "template" in component,
      hasRender: "render" in component,
    };
  }
  
  return {
    type: typeof component,
  };
}
