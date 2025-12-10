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
    `examples/${baseName}.solid.tsx`,
    `examples/${baseName}.preact.tsx`,
    `examples/${baseName}.svelte`,
    `examples/${baseName}.vue`,
    `src/islands/${baseName}.${originalExt}`,
    `src/islands/${baseName}.tsx`,
    `src/islands/${baseName}.solid.tsx`,
    `src/islands/${baseName}.preact.tsx`,
    `src/islands/${baseName}.svelte`,
    `src/islands/${baseName}.vue`,
    `islands/${baseName}.${originalExt}`,
    `islands/${baseName}.tsx`,
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
 * @param params.renderOptions - Additional render options
 * @returns Island component with SSR-only rendering
 * @throws Error if SSR rendering fails
 */
export async function renderComponentSSROnly({
  src,
  condition,
  props,
  renderOptions,
}: {
  src: string;
  condition: IslandProps["condition"];
  props: Record<string, unknown>;
  renderOptions: AnalyzerOptions;
}) {
  console.log(`🔄 Attempting SSR-only rendering for: ${src}`);

  try {
    // Import Island component dynamically to avoid circular dependencies
    const { default: Island } = await import("./island.tsx");

    // Use the Island component with ssrOnly flag
    // The Island component will use the integration system for rendering
    return Island({
      src,
      condition,
      props,
      children: undefined,
      ssr: true,
      ssrOnly: true,
      renderOptions,
    });
  } catch (error) {
    console.error(`❌ SSR-only rendering failed for ${src}:`, error);
    throw error;
  }
}
