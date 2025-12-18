import type { JSX } from "preact";
import {
  analyzeComponentContent,
  type AnalyzerOptions,
} from "../core/components/component-analyzer.ts";
import { resolveIslandPath } from "./framework-detection.ts";
import type { IslandProps } from "./types.ts";

/**
 * Analyze component file for rendering strategy
 * 
 * Attempts to read the component file from various path variations and
 * analyzes its content to determine the optimal rendering strategy.
 * 
 * @param src - The source path to the component
 * @param options - Analyzer options for customizing the analysis
 * @returns Analysis result with rendering strategy decision
 * @throws Error if component file cannot be found
 */
export async function analyzeComponentFile(
  src: string,
  options: AnalyzerOptions = {},
) {
  // Resolve the path first, then try variations
  const resolvedSrc = resolveIslandPath(src);

  // Create comprehensive path variations including framework-specific naming
  const baseName = src
    .split("/")
    .pop()
    ?.replace(/\.(tsx|jsx|vue|svelte)$/, "") || "";

  // Get the original file extension
  const originalExt = src.split(".").pop() || "tsx";

  const pathVariations = [
    resolvedSrc.startsWith("/") ? resolvedSrc.substring(1) : resolvedSrc,
    src.startsWith("/") ? src.substring(1) : src,
    `examples/${baseName}.${originalExt}`,
    `examples/${baseName}.tsx`,
    `examples/${baseName}.ts`,
    `examples/${baseName}.solid.tsx`,
    `examples/${baseName}.preact.tsx`,
    `examples/${baseName}.svelte`,
    `examples/${baseName}.vue`,
    `src/islands/${baseName}.${originalExt}`,
    `src/islands/${baseName}.tsx`,
    `src/islands/${baseName}.ts`,
    `src/islands/${baseName}.solid.tsx`,
    `src/islands/${baseName}.preact.tsx`,
    `src/islands/${baseName}.svelte`,
    `src/islands/${baseName}.vue`,
    `islands/${baseName}.${originalExt}`,
    `islands/${baseName}.tsx`,
    `islands/${baseName}.ts`,
    `islands/${baseName}.solid.tsx`,
    `islands/${baseName}.preact.tsx`,
    `islands/${baseName}.svelte`,
    `islands/${baseName}.vue`,
  ];

  for (const pathVariation of pathVariations) {
    try {
      const content = await Deno.readTextFile(pathVariation);
      return analyzeComponentContent(pathVariation, content, options);
    } catch {
      // Continue to next path variation
      continue;
    }
  }

  throw new Error(`Component file not found: ${src}`);
}

/**
 * Render component with SSR-only strategy (no hydration)
 * 
 * Renders a component server-side without adding client-side hydration.
 * This is useful for static components that don't require interactivity.
 * 
 * @param params - Rendering parameters
 * @param params.src - Component source path
 * @param params.condition - Island hydration condition
 * @param params.props - Props to pass to the component
 * @param params.framework - Optional explicit framework (if not provided, will be detected)
 * @param params.renderOptions - Additional render options
 * @returns Island component with SSR-only rendering
 * @throws Error if SSR rendering fails
 */
export async function renderComponentSSROnly({
  src,
  condition,
  props,
  framework: explicitFramework,
  renderOptions,
}: {
  src: string;
  condition: IslandProps["condition"];
  props: Record<string, unknown>;
  framework?: string;
  renderOptions: AnalyzerOptions;
}) {
  console.log(`🔄 Attempting SSR-only rendering for: ${src}`);

  try {
    // Import Island component dynamically to avoid circular dependencies
    const { default: Island } = await import("./island.tsx");
    
    // Import integration loader to load the appropriate framework integration
    const { loadIntegration } = await import("./integration-loader.ts");
    const { detectFramework } = await import("./framework-detection.ts");
    
    // Use explicit framework if provided, otherwise detect it
    let framework: string;
    if (explicitFramework) {
      framework = explicitFramework;
      console.log(`🔄 Using explicit framework for ${src}: ${framework}`);
    } else if (src.endsWith(".vue")) {
      framework = "vue";
    } else if (src.endsWith(".svelte")) {
      framework = "svelte";
    } else if (src.endsWith(".tsx") || src.endsWith(".jsx") || src.endsWith(".ts") || src.endsWith(".js")) {
      framework = await detectFramework(src);
    } else {
      framework = "preact"; // Default fallback
    }
    
    if (!explicitFramework) {
      console.log(`🔄 Detected framework for ${src}: ${framework}`);
    }
    
    // Load the appropriate integration
    const integration = await loadIntegration(framework);
    
    // Get Vite server reference for dev mode
    const viteServer = globalThis.__viteDevServer;
    const isDev = typeof Deno !== "undefined" && Deno.env?.get("DENO_ENV") !== "production";
    
    // Render the component using the integration
    const renderResult = await integration.render({
      component: null, // Integration will load the component from src
      props,
      src,
      condition,
      ssrOnly: true,
      viteServer,
      isDev,
    });
    
    console.log(`🔄 Integration rendered HTML for ${src}:`, {
      hasHtml: !!renderResult.html,
      htmlLength: renderResult.html?.length || 0,
      htmlPreview: renderResult.html?.substring(0, 100),
    });

    // Return Island component with the rendered HTML as children
    // This ensures the HTML is properly wrapped in <is-land> with ssrOnly attributes
    return Island({
      src,
      condition,
      props,
      children: renderResult.html, // Pass rendered HTML as children
      ssr: true,
      framework: framework as "solid" | "vue" | "preact" | "react" | "svelte" | "lit",
      ssrOnly: true,
      renderOptions,
      hydrationData: undefined, // No hydration data for SSR-only components
    });
  } catch (error) {
    console.error(`❌ SSR-only rendering failed for ${src}:`, error);
    throw error;
  }
}
