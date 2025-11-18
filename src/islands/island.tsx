import type { JSX } from "preact";
import { h } from "preact";
import { getIslandBundlePath } from "../build/island-manifest.ts";
import type { ViteDevServer } from "vite";
import type { AnalyzerOptions } from "../core/components/component-analyzer.ts";
import { detectFramework, detectFrameworkFromSrc } from "./framework-detection.ts";
import { analyzeComponentFile, renderComponentSSROnly } from "./component-analysis.ts";
import { renderPreactComponent } from "./renderers/preact-renderer.ts";
import { renderVueComponent } from "./renderers/vue-renderer.ts";
import { renderSolidComponent } from "./renderers/solid-renderer.ts";
import { renderSvelteComponent } from "./renderers/svelte-renderer.ts";

// Enhanced global CSS collector for SSR with scoping support
declare global {
  var __viteDevServer: ViteDevServer | undefined;
}

export interface IslandProps {
  /** Path to the island component (e.g., "/islands/Counter.tsx") */
  src: string;
  /** Hydration condition */
  condition?:
    | "on:visible"
    | "on:interaction"
    | "on:idle"
    | "on:client"
    | `media:${string}`;
  /** Props to pass to the island component */
  props?: Record<string, unknown>;
  /** Children to render inside the island (for SSR) */
  children?: JSX.Element | JSX.Element[] | string;
  /** Whether to render server-side (default: true unless condition is 'on:client') */
  ssr?: boolean;
  /** Framework hint for client hydration */
  framework?: "solid" | "vue" | "preact" | "react" | "svelte";
  /** Force SSR-only rendering without hydration */
  ssrOnly?: boolean;
  /** Component render options for intelligent detection */
  renderOptions?: AnalyzerOptions;
}

/**
 * Universal Island component - renders <is-land> custom elements for better DOM structure
 *
 * Uses custom elements instead of div wrappers for cleaner, more semantic markup
 * Supports intelligent rendering strategy detection to skip hydration for SSR-only components
 */
export default function Island({
  src,
  condition = "on:client",
  props = {},
  children,
  ssr = condition !== "on:client",
  framework,
  ssrOnly = false,
  renderOptions = {},
}: IslandProps): JSX.Element {
  // Generate deterministic ID for the island (SSR-safe)
  // Use src path to ensure server and client generate the same ID
  const islandId = `island-${src.replace(/[^a-zA-Z0-9]/g, "-")}`;

  // Determine if this should be SSR-only based on explicit flag or render options
  const shouldSkipHydration = ssrOnly || renderOptions.forceSSROnly;

  // Auto-detect framework if not provided
  const detectedFramework = framework || detectFrameworkFromSrc(src);

  // Only get bundle path if we need hydration
  const bundlePath = shouldSkipHydration ? "" : getIslandBundlePath(src);

  // If we have SSR content (children), render it directly in the is-land element
  if (ssr && children) {
    const baseAttributes = {
      id: islandId,
      "data-framework": detectedFramework,
    };

    // Add hydration attributes only if not SSR-only
    const hydrationAttributes = shouldSkipHydration
      ? {
        "data-render-strategy": "ssr-only",
      }
      : {
        "data-island": condition,
        "data-hydrate": bundlePath,
        "data-props": JSON.stringify(props),
        "data-render-strategy": "hydrate",
      };

    const allAttributes = { ...baseAttributes, ...hydrationAttributes };

    if (typeof children === "string") {
      return h("is-land", {
        ...allAttributes,
        dangerouslySetInnerHTML: { __html: children },
      });
    } else {
      // For JSX children, include them directly
      return h("is-land", allAttributes, children);
    }
  }

  // Client-only: render empty is-land that will be hydrated (unless SSR-only)
  if (shouldSkipHydration) {
    // For SSR-only components without children, render empty element
    return h("is-land", {
      id: islandId,
      "data-render-strategy": "ssr-only",
      "data-framework": detectedFramework,
    });
  }

  return h("is-land", {
    id: islandId,
    "data-island": condition,
    "data-hydrate": bundlePath,
    "data-props": JSON.stringify(props),
    "data-render-strategy": "hydrate",
    "data-framework": detectedFramework,
  });
}

/**
 * Universal renderIsland function - auto-detects framework and handles SSR + hydration
 *
 * This is the main function you should use - it automatically:
 * - Detects the component framework (Vue, Solid.js, Preact/React)
 * - Analyzes component for intelligent rendering strategy detection
 * - Handles server-side rendering when possible
 * - Falls back to client-only rendering when needed
 * - Returns the appropriate Island component
 */
export async function renderIsland({
  src,
  condition = "on:client",
  props = {},
  children,
  ssr = condition !== "on:client",
  framework,
  ssrOnly = false,
  renderOptions = {},
}: IslandProps): Promise<JSX.Element> {
  const startTime = performance.now();
  const logPrefix = `🏝️ [${src}]`;

  console.log(`${logPrefix} renderIsland called with:`, {
    src,
    ssr,
    condition,
    ssrOnly,
    hasChildren: !!children,
    propsKeys: Object.keys(props),
    renderOptions: Object.keys(renderOptions),
  });

  // Perform intelligent component analysis if not explicitly SSR-only
  let shouldSkipHydration = ssrOnly;
  let analysisReason = "";
  let analysisTime = 0;

  if (!ssrOnly && renderOptions.detectScripts !== false) {
    const analysisStart = performance.now();
    try {
      console.log(`${logPrefix} 🔍 Starting component analysis...`);
      // Try to analyze the component for intelligent rendering strategy
      const analysisResult = await analyzeComponentFile(src, renderOptions);
      shouldSkipHydration = !analysisResult.decision.shouldHydrate;
      analysisReason = analysisResult.decision.reason;
      analysisTime = performance.now() - analysisStart;

      console.log(
        `${logPrefix} 🔍 Component analysis completed in ${
          analysisTime.toFixed(2)
        }ms:`,
        {
          decision: shouldSkipHydration ? "SSR-ONLY" : "HYDRATE",
          reason: analysisReason,
          hasWarnings: !!analysisResult.decision.warnings?.length,
        },
      );

      if (
        analysisResult.decision.warnings &&
        analysisResult.decision.warnings.length > 0
      ) {
        analysisResult.decision.warnings.forEach((warning) =>
          console.warn(`${logPrefix} ⚠️ Analysis warning: ${warning}`)
        );
      }
    } catch (error) {
      analysisTime = performance.now() - analysisStart;
      console.warn(
        `${logPrefix} ⚠️ Component analysis failed after ${
          analysisTime.toFixed(2)
        }ms:`,
        error,
      );
      // Continue with original logic on analysis failure
    }
  } else {
    console.log(
      `${logPrefix} ⏭️ Skipping component analysis (ssrOnly: ${ssrOnly}, detectScripts: ${renderOptions.detectScripts})`,
    );
  }

  // If component is determined to be SSR-only, handle accordingly
  if (shouldSkipHydration) {
    const ssrOnlyStart = performance.now();
    console.log(
      `${logPrefix} 📄 Using SSR-only rendering (reason: ${analysisReason})`,
    );

    // For SSR-only components, we still want to render them server-side if possible
    // but without hydration attributes
    if (ssr && !children) {
      console.log(`${logPrefix} 🔄 Attempting SSR-only component rendering...`);
      try {
        const result = await renderComponentSSROnly({
          src,
          condition,
          props,
          renderOptions,
        });
        const ssrOnlyTime = performance.now() - ssrOnlyStart;
        const totalTime = performance.now() - startTime;
        console.log(
          `${logPrefix} ✅ SSR-only rendering completed in ${
            ssrOnlyTime.toFixed(2)
          }ms (total: ${
            totalTime.toFixed(
              2,
            )
          }ms)`,
        );
        return result;
      } catch (error) {
        const ssrOnlyTime = performance.now() - ssrOnlyStart;
        const totalTime = performance.now() - startTime;
        console.warn(
          `${logPrefix} ❌ SSR failed for SSR-only component after ${
            ssrOnlyTime.toFixed(2)
          }ms:`,
          error,
        );
        console.log(
          `${logPrefix} 🔄 Falling back to basic Island without hydration`,
        );
        // Fall back to basic Island without hydration
        return Island({
          src,
          condition,
          props,
          children: undefined,
          ssr: false,
          ssrOnly: true,
          renderOptions,
        });
      }
    } else {
      const totalTime = performance.now() - startTime;
      console.log(
        `${logPrefix} 📄 Using basic Island with SSR-only flag (completed in ${
          totalTime.toFixed(2)
        }ms)`,
      );
      // Use basic Island with SSR-only flag
      return Island({
        src,
        condition,
        props,
        children,
        ssr,
        ssrOnly: true,
        renderOptions,
      });
    }
  }

  // If SSR is disabled or we already have children, use basic Island
  if (!ssr || children) {
    const totalTime = performance.now() - startTime;
    console.log(
      `${logPrefix} 📄 Using basic Island (SSR disabled: ${!ssr}, has children: ${!!children}) - completed in ${
        totalTime.toFixed(
          2,
        )
      }ms`,
    );
    return Island({ src, condition, props, children, ssr, renderOptions });
  }

  // Determine framework (explicit or auto-detect)
  const frameworkDetectionStart = performance.now();
  let detectedFramework = "unknown";

  try {
    // Use explicit framework if provided
    if (framework) {
      detectedFramework = framework;
      const frameworkDetectionTime = performance.now() -
        frameworkDetectionStart;
      console.log(
        `${logPrefix} 🎯 Using explicit framework: ${framework} (${
          frameworkDetectionTime.toFixed(2)
        }ms)`,
      );
    } else {
      // Auto-detect framework based on file extension and content
      // Vue detection
      if (src.endsWith(".vue")) {
        detectedFramework = "vue";
        const frameworkDetectionTime = performance.now() -
          frameworkDetectionStart;
        console.log(
          `${logPrefix} 🔍 Detected Vue component (${
            frameworkDetectionTime.toFixed(2)
          }ms)`,
        );
      } // Svelte detection
      else if (src.endsWith(".svelte")) {
        detectedFramework = "svelte";
        const frameworkDetectionTime = performance.now() -
          frameworkDetectionStart;
        console.log(
          `${logPrefix} 🔍 Detected Svelte component (${
            frameworkDetectionTime.toFixed(2)
          }ms)`,
        );
      } // TypeScript/JavaScript files - need content analysis
      else if (
        src.endsWith(".tsx") || src.endsWith(".jsx") || src.endsWith(".ts") ||
        src.endsWith(".js")
      ) {
        detectedFramework = await detectFramework(src);
        const frameworkDetectionTime = performance.now() -
          frameworkDetectionStart;
        console.log(
          `${logPrefix} 🔍 Detected framework: ${detectedFramework} (${
            frameworkDetectionTime.toFixed(2)
          }ms)`,
        );
      }
    }

    // Render based on determined framework
    let result: JSX.Element;
    switch (detectedFramework) {
      case "vue":
        result = await renderVueComponent({
          src,
          condition,
          props,
          ssr,
          renderOptions,
        });
        break;
      case "svelte":
        result = await renderSvelteComponent({
          src,
          condition,
          props,
          ssr,
          renderOptions,
        });
        break;
      case "solid":
        result = await renderSolidComponent({
          src,
          condition,
          props,
          ssr,
          renderOptions,
        });
        break;
      case "preact":
      case "react":
      default:
        result = await renderPreactComponent({
          src,
          condition,
          props,
          ssr,
          renderOptions,
        });
        break;
    }

    const totalTime = performance.now() - startTime;
    console.log(
      `${logPrefix} ✅ ${detectedFramework} rendering completed in ${
        totalTime.toFixed(2)
      }ms`,
    );
    return result;
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.error(
      `${logPrefix} ❌ Framework rendering failed after ${
        totalTime.toFixed(2)
      }ms:`,
      error,
    );

    // Fallback to basic Island
    return Island({
      src,
      condition,
      props,
      children: undefined,
      ssr: false,
      framework: detectedFramework as any,
      renderOptions,
    });
  }
}

// ============================================================================
// Re-exports for backward compatibility
// ============================================================================

// CSS utilities - only export functions that are actually used externally
export {
  addSvelteSSRCSS,
  getSvelteSSRCSS,
  getSvelteSSRCSSForHead,
  getSvelteSSRCSSStats,
  getSvelteComponentCSS,
  clearSvelteComponentCSS,
  generateComponentScopeId,
} from "./css-utils.ts";

// Framework renderers - only export main component renderers
// Note: *ToString functions are internal and not exported
export { renderPreactComponent } from "./renderers/preact-renderer.ts";
export { renderVueComponent } from "./renderers/vue-renderer.ts";
export { renderSolidComponent } from "./renderers/solid-renderer.ts";
export { renderSvelteComponent } from "./renderers/svelte-renderer.ts";

// Framework detection utilities
export {
  detectFramework,
  detectFrameworkFromSrc,
  resolveIslandPath,
} from "./framework-detection.ts";

// Component analysis utilities
export {
  analyzeComponentFile,
  renderComponentSSROnly,
} from "./component-analysis.ts";
