/**
 * Solid server-side renderer
 * Handles SSR for Solid components using solid-js/web
 * 
 * Migrated from src/islands/renderers/solid-renderer.ts
 */

import type { RenderParams, RenderResult } from "../../core/types.ts";
import { loadComponent } from "./utils.ts";

/**
 * Render a Solid component to HTML string
 * 
 * Uses Solid's renderToStringAsync for proper SSR with reactive system support.
 * Handles both named and default exports from solid-js/web.
 * 
 * @param params - Render parameters including component, props, and source path
 * @returns Render result with HTML and hydration data
 */
export async function render(params: RenderParams): Promise<RenderResult> {
  const { props = {}, src, condition = "on:client", ssrOnly = false } = params;
  
  try {
    const Component = await loadComponent(src);
    
    if (!Component || typeof Component !== "function") {
      throw new Error(`Invalid Solid component in ${src}: expected function, got ${typeof Component}`);
    }
    
    // Import Solid.js SSR utilities
    let renderToStringAsync: (fn: () => unknown, options?: { nonce?: string; renderId?: string }) => Promise<string>;
    let createComponent: (component: any, props: any) => any;
    let generateHydrationScript: (options?: { nonce?: string; eventNames?: string[] }) => string;

    const solidWeb = await import("solid-js/web");
    
    const solidWebModule = solidWeb as any;
    renderToStringAsync = solidWebModule.renderToStringAsync || solidWebModule.default?.renderToStringAsync;
    createComponent = solidWebModule.createComponent || solidWebModule.default?.createComponent;
    generateHydrationScript = solidWebModule.generateHydrationScript || solidWebModule.default?.generateHydrationScript;

    if (!renderToStringAsync) {
      const renderToString = solidWebModule.renderToString || solidWebModule.default?.renderToString;
      if (!renderToString) throw new Error("Neither renderToStringAsync nor renderToString found in solid-js/web");
      renderToStringAsync = (fn) => Promise.resolve(renderToString(fn));
    }
    
    if (!createComponent) throw new Error("createComponent not found in solid-js/web");
    if (!generateHydrationScript) throw new Error("generateHydrationScript not found in solid-js/web");
    
    const renderId = `s${Math.random().toString(36).slice(2, 11)}`;
    const html = await renderToStringAsync(() => createComponent(Component, props), { renderId });
    
    if (!html || typeof html !== "string") {
      throw new Error(`renderToStringAsync returned invalid result: ${typeof html}`);
    }
    
    const hydrationScript = generateHydrationScript();
    const containerId = `solid-island-${src.replaceAll(/[^a-zA-Z0-9]/g, "-")}`;
    
    return {
      html,
      head: hydrationScript,
      hydrationData: { src, props, framework: "solid", condition, containerId, ssrOnly, renderId },
    };
  } catch (error) {
    throw new Error(
      `Failed to render Solid component ${src}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

/**
 * Render a Solid component with error boundary
 */
export async function renderWithErrorBoundary(params: RenderParams): Promise<RenderResult | null> {
  try {
    return await render(params);
  } catch {
    return null;
  }
}
