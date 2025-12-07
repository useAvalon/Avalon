/**
 * Solid server-side renderer
 * Handles SSR for Solid components using solid-js/web
 * 
 * Migrated from src/islands/renderers/solid-renderer.ts
 */

import type { RenderParams, RenderResult } from "../../shared/types.ts";
import type { SolidComponent } from "../types.ts";
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
  
  const logPrefix = `🔄 [Solid:${src}]`;
  const renderStart = performance.now();
  
  console.log(`${logPrefix} Starting Solid SSR rendering...`, {
    ssrOnly,
    propsKeys: Object.keys(props),
    isDev: Deno.env.get("DENO_ENV") !== "production",
  });
  
  try {
    const moduleStart = performance.now();
    
    // Load the Solid component
    const Component = await loadComponent(src);
    
    const moduleLoadTime = performance.now() - moduleStart;
    console.log(
      `${logPrefix} ✅ Module loaded in ${moduleLoadTime.toFixed(2)}ms`,
      {
        componentType: typeof Component,
        isFunction: typeof Component === "function",
      },
    );
    
    if (!Component || typeof Component !== "function") {
      throw new Error(`Invalid Solid component in ${src}: expected function, got ${typeof Component}`);
    }
    
    // Import Solid.js SSR utilities with fallback handling
    let renderToStringAsync: (fn: () => unknown, options?: { nonce?: string; renderId?: string }) => Promise<string>;
    let createComponent: (component: any, props: any) => any;
    let generateHydrationScript: (options?: { nonce?: string; eventNames?: string[] }) => string;

    try {
      const solidWeb = await import("solid-js/web");
      // Handle both named and default exports
      // deno-lint-ignore no-explicit-any
      const solidWebModule = solidWeb as any;
      renderToStringAsync = solidWebModule.renderToStringAsync ||
        solidWebModule.default?.renderToStringAsync;
      createComponent = solidWebModule.createComponent ||
        solidWebModule.default?.createComponent;
      generateHydrationScript = solidWebModule.generateHydrationScript ||
        solidWebModule.default?.generateHydrationScript;

      if (!renderToStringAsync) {
        // Fallback to synchronous renderToString
        const renderToString = solidWebModule.renderToString ||
          solidWebModule.default?.renderToString;
        if (!renderToString) {
          throw new Error(
            "Neither renderToStringAsync nor renderToString found in solid-js/web import",
          );
        }
        renderToStringAsync = (fn) => Promise.resolve(renderToString(fn));
      }
      
      if (!createComponent) {
        throw new Error("createComponent not found in solid-js/web import");
      }
      
      if (!generateHydrationScript) {
        throw new Error("generateHydrationScript not found in solid-js/web import");
      }
    } catch (importError: unknown) {
      console.error(`${logPrefix} Failed to import solid-js/web:`, importError);
      const errorMessage = importError instanceof Error
        ? importError.message
        : String(importError);
      throw new Error(`Cannot import solid-js/web: ${errorMessage}`);
    }

    console.log(`${logPrefix} 📦 Successfully imported solid-js/web`);
    
    // Render the component using Solid's renderToStringAsync
    // This handles Solid's reactive system and async resources
    const renderStringStart = performance.now();
    
    // Generate a unique render ID for this component ( does)
    const renderId = `s${Math.random().toString(36).slice(2, 11)}`;
    
    // Render with hydration support and renderId ( uses createComponent)
    const html = await renderToStringAsync(() => createComponent(Component as SolidComponent, props), {
      renderId,
    });
    const renderStringTime = performance.now() - renderStringStart;
    
    if (!html || typeof html !== "string") {
      throw new Error(`renderToStringAsync returned invalid result: ${typeof html}`);
    }
    
    // Note: We don't use generateHydrationScript()  doesn't
    // Solid's hydrate() function works without the global _$HY script
    
    console.log(
      `${logPrefix} ✅ Solid component rendered successfully in ${renderStringTime.toFixed(2)}ms (${html.length} chars)`,
    );
    
    // Generate the hydration script - REQUIRED for Solid hydration to work
    // This creates the global _$HY object that hydrate() needs
    const hydrationScript = generateHydrationScript();
    console.log(`${logPrefix} 📜 Generated hydration script (${hydrationScript.length} chars)`);
    
    // Generate deterministic container ID for hydration
    const containerId = generateContainerId(src);
    
    const totalTime = performance.now() - renderStart;
    console.log(
      `${logPrefix} ✅ Solid SSR completed in ${totalTime.toFixed(2)}ms (module: ${moduleLoadTime.toFixed(2)}ms)`,
    );
    
    // Don't wrap - Solid's renderToStringAsync with renderId already adds hydration markers
    // The renderId is embedded in the HTML by Solid itself
    
    return {
      html,
      // Include the hydration script - REQUIRED for Solid hydration
      // Don't wrap in <script> tags - the universal head collector will do that
      head: hydrationScript,
      hydrationData: {
        src,
        props,
        framework: "solid",
        condition,
        containerId,
        ssrOnly,
        renderId,
      },
    };
  } catch (error) {
    const failTime = performance.now() - renderStart;
    console.error(
      `${logPrefix} ❌ Solid SSR failed after ${failTime.toFixed(2)}ms:`,
      error,
    );
    throw new Error(
      `Failed to render Solid component ${src}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

/**
 * Render a Solid component with error boundary
 * Falls back to client-only rendering on error
 * 
 * @param params - Render parameters
 * @returns Render result or null on error
 */
export async function renderWithErrorBoundary(
  params: RenderParams
): Promise<RenderResult | null> {
  try {
    return await render(params);
  } catch (error) {
    console.error(`Solid SSR error boundary caught:`, error);
    return null;
  }
}

/**
 * Generate a deterministic container ID for hydration
 * 
 * @param src - Component source path
 * @returns Container ID string
 */
function generateContainerId(src: string): string {
  return `solid-island-${src.replace(/[^a-zA-Z0-9]/g, "-")}`;
}
