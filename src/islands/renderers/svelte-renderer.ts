import type { JSX } from "preact";
import { h } from "preact";
import type { IslandProps } from "../types.ts";
import type { AnalyzerOptions } from "../../core/components/component-analyzer.ts";
import { resolveIslandPath } from "../framework-detection.ts";

/**
 * Island component import - used for wrapping rendered content
 */
let Island: any;

// Lazy load Island to avoid circular dependency
async function getIsland() {
  if (!Island) {
    const module = await import("../island.tsx");
    Island = module.default;
  }
  return Island;
}

/**
 * Render Svelte component with SSR using Svelte 5 render() function
 * 
 * @param params - Rendering parameters
 * @param params.src - Path to the Svelte component
 * @param params.condition - Hydration condition
 * @param params.props - Props to pass to the component
 * @param params.ssr - Whether to perform server-side rendering
 * @param params.renderOptions - Additional rendering options
 * @param params.ssrOnly - Whether to skip hydration entirely
 * @returns Promise resolving to Island JSX element
 */
export async function renderSvelteComponent({
  src,
  condition,
  props,
  ssr: _ssr,
  renderOptions = {},
  ssrOnly = false,
}: {
  src: string;
  condition: IslandProps["condition"];
  props: Record<string, unknown>;
  ssr: boolean;
  renderOptions?: AnalyzerOptions;
  ssrOnly?: boolean;
}): Promise<JSX.Element> {
  console.log(`🔄 Attempting Svelte SSR for: ${src}`);

  try {
    // Load the Svelte component via Vite
    const vite = globalThis.__viteDevServer;
    if (!vite) {
      throw new Error("Vite dev server not available");
    }

    const resolvedPath = resolveIslandPath(src);
    console.log(`📡 Loading Svelte via Vite SSR: ${src} -> ${resolvedPath}`);

    const module = await vite.ssrLoadModule(resolvedPath);
    const SvelteComponent = module.default;

    if (!SvelteComponent) {
      throw new Error("No default export found in Svelte component");
    }

    // Use Svelte 5's render() function for SSR
    const { render } = await import("svelte/server");

    // Render with proper context
    const result = render(SvelteComponent, {
      props: props || {},
      context: new Map(),
    });

    const ssrHtml = result.body;
    const ssrHead = result.head || "";

    console.log(`✅ Svelte SSR completed for ${src}`, {
      bodyLength: ssrHtml.length,
      hasHead: !!ssrHead,
    });

    const IslandComponent = await getIsland();
    return IslandComponent({
      src,
      condition,
      props,
      children: ssrHead + ssrHtml,
      ssr: true,
      framework: "svelte",
      ssrOnly,
      renderOptions,
    });
  } catch (error) {
    console.error(`❌ Svelte SSR failed for ${src}:`, error);

    // Fallback to client-only rendering
    console.log(`🔄 Svelte SSR failed, falling back to client-only for ${src}`);
    const IslandComponent = await getIsland();
    return IslandComponent({
      src,
      condition,
      props,
      ssr: false,
      framework: "svelte",
      ssrOnly,
      renderOptions,
    });
  }
}
