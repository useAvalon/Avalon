import type { JSX } from "preact";
import { h } from "preact";
import type { ViteDevServer } from "vite";
import type { AnalyzerOptions } from "../core/components/component-analyzer.ts";
import { detectFramework } from "./framework-detection.ts";
import { analyzeComponentFile, renderComponentSSROnly } from "./component-analysis.ts";
import { loadIntegration, detectFrameworkFromPath } from "./integration-loader.ts";
import type { Integration } from "@avalon/shared";
import { addUniversalCSS } from "./universal-css-collector.ts";
import { addUniversalHead } from "./universal-head-collector.ts";

// Enhanced global CSS collector for SSR with scoping support
declare global {
  var __viteDevServer: ViteDevServer | undefined;
}

// Dev-only logging helper
const isDev = () => Deno.env.get("DENO_ENV") !== "production";
const devWarn = (...args: unknown[]) => isDev() && console.warn(...args);
const devError = (...args: unknown[]) => isDev() && console.error(...args);

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
  /** Hydration data from integration renderer */
  hydrationData?: Record<string, unknown>;
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
  hydrationData = {},
}: IslandProps): JSX.Element {
  // Generate deterministic ID for the island (SSR-safe)
  // Use src path to ensure server and client generate the same ID
  const islandId = `island-${src.replace(/[^a-zA-Z0-9]/g, "-")}`;

  // Determine if this should be SSR-only based on explicit flag or render options
  const shouldSkipHydration = ssrOnly || renderOptions.forceSSROnly;

  // Auto-detect framework if not provided
  const detectedFramework = framework || detectFrameworkFromPath(src);

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
        "data-condition": condition,
        "data-src": src,
        "data-props": JSON.stringify(props),
        "data-render-strategy": "hydrate",
        // Include renderId if present (for Solid.js hydration) - use data-solid-render-id 
        ...(hydrationData.renderId ? { "data-solid-render-id": hydrationData.renderId as string } : {}),
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
    "data-condition": condition,
    "data-src": src,
    "data-props": JSON.stringify(props),
    "data-render-strategy": "hydrate",
    "data-framework": detectedFramework,
    // Include renderId if present (for Solid.js hydration) - use data-solid-render-id 
    ...(hydrationData.renderId ? { "data-solid-render-id": hydrationData.renderId as string } : {}),
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
  const logPrefix = `🏝️ [${src}]`;

  // Perform intelligent component analysis if not explicitly SSR-only
  let shouldSkipHydration = ssrOnly;

  if (!ssrOnly && renderOptions.detectScripts !== false) {
    try {
      const analysisResult = await analyzeComponentFile(src, renderOptions);
      shouldSkipHydration = !analysisResult.decision.shouldHydrate;

      if (
        analysisResult.decision.warnings &&
        analysisResult.decision.warnings.length > 0
      ) {
        analysisResult.decision.warnings.forEach((warning) =>
          devWarn(`${logPrefix} Analysis warning: ${warning}`)
        );
      }
    } catch (error) {
      devWarn(`${logPrefix} Component analysis failed:`, error);
    }
  }

  // If component is determined to be SSR-only, handle accordingly
  if (shouldSkipHydration) {
    if (ssr && !children) {
      try {
        return await renderComponentSSROnly({
          src,
          condition,
          props,
          renderOptions,
        });
      } catch (error) {
        devError(`${logPrefix} SSR failed for SSR-only component:`, error);
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
    return Island({ src, condition, props, children, ssr, renderOptions });
  }

  // Determine framework (explicit or auto-detect)
  let detectedFramework = "unknown";
  let integration: Integration | null = null;

  try {
    // Use explicit framework if provided
    if (framework) {
      detectedFramework = framework;
    } else {
      // Auto-detect framework based on file extension and content
      if (src.endsWith(".vue")) {
        detectedFramework = "vue";
      } else if (src.endsWith(".svelte")) {
        detectedFramework = "svelte";
      } else if (
        src.endsWith(".tsx") || src.endsWith(".jsx") || src.endsWith(".ts") ||
        src.endsWith(".js")
      ) {
        detectedFramework = await detectFramework(src);
      }
    }

    // Load the appropriate integration
    try {
      integration = await loadIntegration(detectedFramework);
    } catch (error) {
      devError(`${logPrefix} Failed to load ${detectedFramework} integration:`, error);
      throw new Error(
        `Failed to load integration for framework '${detectedFramework}'. ` +
        `Make sure @avalon/integration-${detectedFramework} is installed.\n` +
        `Install it with: deno add @avalon/integration-${detectedFramework}`,
        { cause: error }
      );
    }

    // Render using the integration
    const viteServer = globalThis.__viteDevServer;
    const isDevMode = isDev();

    const renderResult = await integration.render({
      component: null, // Integration will load the component
      props,
      src,
      condition,
      ssrOnly,
      viteServer,
      isDev: isDevMode,
    });

    // Collect CSS from the integration for later injection
    if (renderResult.css) {
      const scopeId = (renderResult as { scopeId?: string }).scopeId;
      addUniversalCSS(renderResult.css, src, detectedFramework, scopeId);
    }

    // Create Island with rendered content and hydration data
    const result = Island({
      src,
      condition,
      props,
      children: renderResult.html,
      ssr: true,
      framework: detectedFramework as "solid" | "vue" | "preact" | "react" | "svelte",
      ssrOnly,
      renderOptions,
      hydrationData: renderResult.hydrationData,
    });

    // Collect head content (hydration scripts, etc.) from the integration
    if (renderResult.head) {
      const headContent = renderResult.head.trim();
      let contentType: 'script' | 'meta' | 'link' | 'other' = 'other';
      
      if (headContent.startsWith('<script')) {
        contentType = 'script';
      } else if (headContent.startsWith('<style')) {
        // Don't add style tags to head collector - they should go through CSS collector
        devWarn(`${logPrefix} Skipping <style> tag in head content`);
      } else if (headContent.startsWith('<meta')) {
        contentType = 'meta';
      } else if (headContent.startsWith('<link')) {
        contentType = 'link';
      } else if (headContent.includes('window._$HY') || headContent.includes('_$HY=')) {
        // Solid hydration script (raw JavaScript)
        contentType = 'script';
      }
      
      // Only add non-style content to head collector
      if (!headContent.startsWith('<style')) {
        addUniversalHead(renderResult.head, src, detectedFramework, contentType);
      }
    }

    return result;
  } catch (error) {
    devError(`${logPrefix} Framework rendering failed:`, error);

    // Fallback to basic Island
    return Island({
      src,
      condition,
      props,
      children: undefined,
      ssr: false,
      framework: detectedFramework as "solid" | "vue" | "preact" | "react" | "svelte",
      renderOptions,
    });
  }
}


