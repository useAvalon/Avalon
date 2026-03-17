import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type { RenderParams, RenderResult } from "@useavalon/core/types";
import type { PreactRenderParams, PreactRenderResult } from "../types.ts";
import { loadComponent, normalizeProps } from "./utils.ts";

/**
 * Render a Preact component to HTML string
 */
export async function render(params: RenderParams): Promise<RenderResult> {
  const { component, props = {}, src, ssrOnly = false, condition = "on:client" } = params as PreactRenderParams;
  
  try {
    const Component = component || await loadComponent(src);
    
    if (!Component || typeof Component !== "function") {
      throw new Error(`Invalid Preact component in ${src}: expected function, got ${typeof Component}`);
    }
    
    const normalizedProps = normalizeProps(props);
    const vnode = h(Component, normalizedProps);
    const html = renderToString(vnode);
    
    const result: PreactRenderResult = {
      html,
      hydrationData: ssrOnly ? undefined : { src, props, framework: "preact" as const, condition },
      vnode,
    };
    
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render Preact component from ${src}: ${errorMessage}`, { cause: error });
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
      html: fallback || `<!-- Preact SSR failed: ${errorMessage.replaceAll("-->", "--&gt;")} -->`,
      hydrationData: {
        src: params.src,
        props: params.props || {},
        framework: "preact",
        ssrFailed: true,
      },
    };
  }
}
