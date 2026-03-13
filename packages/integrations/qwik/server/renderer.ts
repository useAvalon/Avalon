/**
 * Qwik server-side renderer
 *
 * Handles SSR for Qwik components using @builder.io/qwik/server.
 * Qwik's SSR produces HTML with serialized state embedded in the DOM,
 * enabling resumability on the client without a hydration step.
 */

import type { RenderParams, RenderResult } from "../../core/types.ts";
import { loadComponent } from "./utils.ts";

/**
 * Render a Qwik component to HTML string
 *
 * Uses Qwik's renderToString for SSR. The output includes:
 * - Rendered HTML with q:container attributes
 * - Serialized state in <script type="qwik/json"> blocks
 * - Event listener declarations as on: attributes
 *
 * @param params - Render parameters including component, props, and source path
 * @returns Render result with HTML and resumability data
 */
export async function render(params: RenderParams): Promise<RenderResult> {
  const { props = {}, src, condition = "on:client", ssrOnly = false } = params;

  try {
    const Component = await loadComponent(src);

    if (!Component) {
      throw new Error(`Invalid Qwik component in ${src}: component not found`);
    }

    // Import Qwik's SSR utilities through Vite's SSR loader if available
    // Qwik's renderToString signature: (rootNode, opts?) => Promise<RenderToStringResult>
    let renderToString: (
      rootNode: unknown,
      opts?: { containerTagName?: string; containerAttributes?: Record<string, string> }
    ) => Promise<{ html: string }>;

    // Use Vite's ssrLoadModule if available (during dev), otherwise dynamic import
    const viteServer = (globalThis as any).__viteDevServer;
    let qwikServerModule: any;
    
    if (viteServer?.ssrLoadModule) {
      qwikServerModule = await viteServer.ssrLoadModule("@builder.io/qwik/server");
    } else {
      // Production or non-Vite context - use dynamic import with vite-ignore
      const moduleId = "@builder.io/qwik/server";
      qwikServerModule = await import(/* @vite-ignore */ moduleId);
    }

    renderToString = qwikServerModule.renderToString || qwikServerModule.default?.renderToString;

    if (!renderToString) {
      throw new Error("renderToString not found in @builder.io/qwik/server");
    }

    const containerId = `qwik-island-${src.replaceAll(/[^a-zA-Z0-9]/g, "-")}`;

    // Load Qwik core for JSX creation
    const qwikCore = await viteServer?.ssrLoadModule?.("@builder.io/qwik") || 
                     await import(/* @vite-ignore */ "@builder.io/qwik");

    // With 'inline' entry strategy, component$ returns a QRL-wrapped component
    // We use jsx() to create the element, which handles QRLs properly
    const jsxElement = qwikCore.jsx(Component, props || {});

    // Qwik's renderToString takes (rootNode, opts) - rootNode is the first argument
    // The q:container attribute marks the resumable boundary
    const result = await renderToString(jsxElement, {
      containerTagName: "div",
      containerAttributes: {
        "data-island-id": containerId,
      },
    });

    const html = typeof result === "string" ? result : result.html;

    if (!html || typeof html !== "string") {
      throw new Error(`renderToString returned invalid result: ${typeof html}`);
    }

    return {
      html,
      hydrationData: { src, props, framework: "qwik", condition, containerId, ssrOnly },
    };
  } catch (error) {
    throw new Error(
      `Failed to render Qwik component ${src}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

/**
 * Render a Qwik component with error boundary
 */
export async function renderWithErrorBoundary(params: RenderParams): Promise<RenderResult | null> {
  try {
    return await render(params);
  } catch {
    return null;
  }
}
