import type { JSX } from "preact";
import { h } from "preact";
import type { ViteDevServer } from "vite";
import type { AnalyzerOptions } from "../core/components/component-analyzer.ts";
import { detectFramework } from "./framework-detection.ts";
import { analyzeComponentFile, renderComponentSSROnly } from "./component-analysis.ts";
import { loadIntegration, detectFrameworkFromPath } from "./integration-loader.ts";
import { addUniversalCSS } from "./universal-css-collector.ts";
import { addUniversalHead } from "./universal-head-collector.ts";
import { getIslandBundlePath } from "../build/island-manifest.ts";
import type { Integration } from "../integrations/shared/types.ts";

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
  framework?: "solid" | "vue" | "preact" | "react" | "svelte" | "lit";
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
  // 🔍 DIAGNOSTIC: Log Island component inputs
  console.log(`🔍 [Island Component] ${src}`, {
    ssr,
    ssrOnly,
    hasChildren: !!children,
    childrenType: typeof children,
    childrenLength: typeof children === 'string' ? children.length : 'N/A',
    childrenPreview: typeof children === 'string' ? children.substring(0, 100) : 'N/A',
    framework,
    condition,
    hasHydrationData: !!hydrationData && Object.keys(hydrationData).length > 0,
  });

  // Generate deterministic ID for the island (SSR-safe)
  // Use src path to ensure server and client generate the same ID
  const islandId = `island-${src.replace(/[^a-zA-Z0-9]/g, "-")}`;

  // Determine if this should be SSR-only based on explicit flag or render options
  const shouldSkipHydration = ssrOnly || renderOptions.forceSSROnly;

  // Auto-detect framework if not provided
  const detectedFramework = framework || detectFrameworkFromPath(src);

  console.log(`🔍 [Island Component] ${src} - Computed values:`, {
    shouldSkipHydration,
    detectedFramework,
    willRenderSSR: ssr && children,
  });

  // If we have SSR content (children), render it directly in the is-land element
  // FIX: Check for children more robustly - empty strings should be treated as no content
  const hasValidChildren = children !== undefined && children !== null && children !== "";
  
  if (ssr && hasValidChildren) {
    console.log(`🔍 [Island Component] ${src} - Rendering SSR content (ssr && children path)`);

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
        "data-src": getIslandBundlePath(src),
        "data-props": JSON.stringify(props),
        "data-render-strategy": "hydrate",
        // Include renderId if present (for Solid.js hydration) - use data-solid-render-id 
        ...(hydrationData.renderId ? { "data-solid-render-id": hydrationData.renderId as string } : {}),
        // Include tagName if present (for Lit hydration) - use data-tag-name
        ...(hydrationData.metadata && (hydrationData.metadata as Record<string, unknown>).tagName 
          ? { "data-tag-name": (hydrationData.metadata as Record<string, unknown>).tagName as string } 
          : {}),
      };

    // Debug logging for Lit components
    if (detectedFramework === "lit") {
      console.log(`🔍 [Island Component] ${src} - Lit hydration data:`, {
        hasHydrationData: !!hydrationData,
        hydrationDataKeys: hydrationData ? Object.keys(hydrationData) : [],
        hasMetadata: !!(hydrationData.metadata),
        metadata: hydrationData.metadata,
        tagName: hydrationData.metadata ? (hydrationData.metadata as Record<string, unknown>).tagName : undefined,
        willAddTagNameAttr: !!(hydrationData.metadata && (hydrationData.metadata as Record<string, unknown>).tagName),
      });
    }

    const allAttributes = { ...baseAttributes, ...hydrationAttributes };

    // FIX: Handle string children with dangerouslySetInnerHTML
    // This is safe because the HTML comes from trusted server-side integration renderers
    if (typeof children === "string") {
      console.log(`🔍 [Island Component] ${src} - Rendering string children with dangerouslySetInnerHTML`);
      return h("is-land", {
        ...allAttributes,
        dangerouslySetInnerHTML: { __html: children },
      });
    } else {
      console.log(`🔍 [Island Component] ${src} - Rendering JSX children directly`);
      // For JSX children, include them directly
      return h("is-land", allAttributes, children);
    }
  }

  console.log(`🔍 [Island Component] ${src} - Not rendering SSR content (ssr=${ssr}, hasValidChildren=${hasValidChildren})`);

  // FIX: Add fallback handling for edge cases
  // If SSR is enabled but we don't have children, this might be an error condition
  if (ssr && !hasValidChildren && shouldSkipHydration) {
    devWarn(`${src}: SSR-only component has no rendered content. This may indicate a rendering error.`);
  }

  // Client-only: render empty is-land that will be hydrated (unless SSR-only)
  if (shouldSkipHydration) {
    console.log(`🔍 [Island Component] ${src} - Rendering empty SSR-only element`);
    // For SSR-only components without children, render empty element
    // This is a fallback case - ideally SSR-only components should have rendered content
    return h("is-land", {
      id: islandId,
      "data-render-strategy": "ssr-only",
      "data-framework": detectedFramework,
    });
  }

  console.log(`🔍 [Island Component] ${src} - Rendering client-only hydration element`);
  return h("is-land", {
    id: islandId,
    "data-condition": condition,
    "data-src": getIslandBundlePath(src),
    "data-props": JSON.stringify(props),
    "data-render-strategy": "hydrate",
    "data-framework": detectedFramework,
    // Include renderId if present (for Solid.js hydration) - use data-solid-render-id 
    ...(hydrationData.renderId ? { "data-solid-render-id": hydrationData.renderId as string } : {}),
    // Include tagName if present (for Lit hydration) - use data-tag-name
    ...(hydrationData.metadata && (hydrationData.metadata as Record<string, unknown>).tagName 
      ? { "data-tag-name": (hydrationData.metadata as Record<string, unknown>).tagName as string } 
      : {}),
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

  // FIX: If ssrOnly is true, we MUST enable SSR to render the component
  // This fixes the issue where ssrOnly=true with condition="on:client" would result in ssr=false
  if (ssrOnly && !ssr) {
    ssr = true;
  }

  console.log(`🔍 [renderIsland] ${src} - Starting render`, {
    ssr,
    ssrOnly,
    hasChildren: !!children,
    framework,
    condition,
    propsKeys: Object.keys(props),
  });

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
          framework,
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
    console.log(`${logPrefix} Skipping SSR: ssr=${ssr}, hasChildren=${!!children}`);
    return Island({ src, condition, props, children, ssr, renderOptions });
  }

  console.log(`${logPrefix} 🚀 Starting SSR rendering...`);

  // Determine framework (explicit or auto-detect)
  let detectedFramework = "unknown";
  let integration: Integration | null = null;

  try {
    // Use explicit framework if provided
    if (framework) {
      detectedFramework = framework;
      console.log(`${logPrefix} Using explicit framework: ${framework}`);
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
      console.log(`${logPrefix} Loading integration for framework: ${detectedFramework}`);
      integration = await loadIntegration(detectedFramework);
      console.log(`${logPrefix} ✅ Integration loaded successfully`);
    } catch (error) {
      console.error(`${logPrefix} ❌ Failed to load ${detectedFramework} integration:`, error);
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

    console.log(`${logPrefix} Calling integration.render()...`);
    const renderResult = await integration.render({
      component: null, // Integration will load the component
      props,
      src,
      condition,
      ssrOnly,
      viteServer,
      isDev: isDevMode,
    });

    console.log(`🔍 [renderIsland] ${src} - Integration render result:`, {
      hasHtml: !!renderResult.html,
      htmlLength: renderResult.html?.length || 0,
      htmlPreview: renderResult.html?.substring(0, 150) || 'N/A',
      hasCss: !!renderResult.css,
      hasHead: !!renderResult.head,
      hasHydrationData: !!renderResult.hydrationData,
      hydrationDataKeys: renderResult.hydrationData ? Object.keys(renderResult.hydrationData) : [],
    });

    // Collect CSS from the integration for later injection
    if (renderResult.css) {
      const scopeId = (renderResult as { scopeId?: string }).scopeId;
      addUniversalCSS(renderResult.css, src, detectedFramework, scopeId);
    }

    console.log(`🔍 [renderIsland] ${src} - Calling Island() with:`, {
      hasChildren: !!renderResult.html,
      childrenType: typeof renderResult.html,
      ssr: true,
      framework: detectedFramework,
      ssrOnly,
    });

    // Create Island with rendered content and hydration data
    // FIX: Ensure ssrOnly components don't get hydration data
    const result = Island({
      src,
      condition,
      props,
      children: renderResult.html,
      ssr: true,
      framework: detectedFramework as "solid" | "vue" | "preact" | "react" | "svelte" | "lit",
      ssrOnly,
      renderOptions,
      // Only pass hydration data if not SSR-only
      hydrationData: ssrOnly ? undefined : renderResult.hydrationData,
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
    // Always log Lit SSR errors for debugging
    if (detectedFramework === "lit") {
      console.error(`${logPrefix} ❌ Lit SSR rendering failed:`, error);
      console.error(`${logPrefix} Error stack:`, error instanceof Error ? error.stack : 'No stack');
    } else {
      devError(`${logPrefix} Framework rendering failed:`, error);
    }

    // Fallback to basic Island
    return Island({
      src,
      condition,
      props,
      children: undefined,
      ssr: false,
      framework: detectedFramework as "solid" | "vue" | "preact" | "react" | "svelte" | "lit",
      renderOptions,
    });
  }
}


