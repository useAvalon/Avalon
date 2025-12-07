import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type { RenderParams, RenderResult } from "../../shared/types.ts";
import type { PreactRenderParams, PreactRenderResult } from "../types.ts";
import { loadComponent, normalizeProps } from "./utils.ts";

/**
 * Render a Preact component to HTML string
 * This is the main server-side rendering function for Preact components
 * 
 * Migrated from src/islands/renderers/preact-renderer.ts
 */
export async function render(params: RenderParams): Promise<RenderResult> {
  const { component, props = {}, src, ssrOnly = false, condition = "on:client" } = params as PreactRenderParams;
  
  const logPrefix = `🔄 [Preact:${src}]`;
  const renderStart = performance.now();

  console.log(`${logPrefix} Starting Preact SSR rendering...`, {
    ssrOnly,
    propsKeys: Object.keys(props),
    isDev: Deno.env.get("DENO_ENV") !== "production",
  });
  
  try {
    const moduleStart = performance.now();
    
    // Load the component if not provided
    const Component = component || await loadComponent(src);
    
    const moduleLoadTime = performance.now() - moduleStart;
    console.log(
      `${logPrefix} ✅ Module loaded in ${moduleLoadTime.toFixed(2)}ms`,
      {
        componentType: typeof Component,
        isFunction: typeof Component === "function",
      },
    );
    
    if (!Component || typeof Component !== "function") {
      throw new Error(
        `Invalid Preact component in ${src}: expected function, got ${typeof Component}`,
      );
    }
    
    // Normalize props for Preact
    const normalizedProps = normalizeProps(props);
    
    // Create VNode and render to string
    const renderStringStart = performance.now();
    const vnode = h(Component, normalizedProps);
    const html = renderToString(vnode);
    const renderStringTime = performance.now() - renderStringStart;
    
    console.log(
      `${logPrefix} ✅ Preact renderToString completed in ${renderStringTime.toFixed(2)}ms`,
      {
        htmlLength: html.length,
        htmlPreview: html.substring(0, 100) + (html.length > 100 ? "..." : ""),
      },
    );
    
    // Prepare hydration data
    const hydrationData = ssrOnly ? undefined : {
      src,
      props,
      framework: "preact" as const,
      condition,
    };
    
    const result: PreactRenderResult = {
      html,
      hydrationData,
      vnode,
    };
    
    const totalTime = performance.now() - renderStart;
    console.log(
      `${logPrefix} ✅ Preact SSR completed in ${totalTime.toFixed(2)}ms (module: ${moduleLoadTime.toFixed(2)}ms)`,
    );
    
    return result;
  } catch (error) {
    const failTime = performance.now() - renderStart;
    console.error(
      `${logPrefix} ❌ Preact SSR failed after ${failTime.toFixed(2)}ms:`,
      error,
    );
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to render Preact component from ${src}: ${errorMessage}`,
      { cause: error }
    );
  }
}

/**
 * Render a Preact component with error boundary
 * Provides graceful fallback if rendering fails
 */
export async function renderWithErrorBoundary(
  params: RenderParams,
  fallback?: string
): Promise<RenderResult> {
  try {
    return await render(params);
  } catch (error) {
    console.error("Preact SSR error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      html: fallback || `<!-- Preact SSR failed: ${errorMessage} -->`,
      hydrationData: {
        src: params.src,
        props: params.props || {},
        framework: "preact",
        ssrFailed: true,
      },
    };
  }
}
