import type { JSX } from "preact";
import type { IslandProps } from "../types.ts";
import type { AnalyzerOptions } from "../../core/components/component-analyzer.ts";
import Island from "../island.tsx";
import { resolveIslandPath } from "../framework-detection.ts";

/**
 * Render Vue component with SSR
 */
export async function renderVueComponent({
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
  const logPrefix = `🔄 [Vue:${src}]`;
  const renderStart = performance.now();

  console.log(`${logPrefix} Starting Vue SSR rendering...`, {
    ssrOnly,
    propsKeys: Object.keys(props),
    isDev: Deno.env.get("DENO_ENV") !== "production",
  });

  try {
    const isDev = Deno.env.get("DENO_ENV") !== "production";
    let moduleLoadTime = 0;
    let moduleSource = "";

    if (isDev) {
      // In development, use Vite's ssrLoadModule
      const viteServer = globalThis.__viteDevServer;
      if (viteServer) {
        const moduleStart = performance.now();
        const resolvedPath = resolveIslandPath(src);
        console.log(
          `${logPrefix} 📡 Loading via Vite SSR: ${src} -> ${resolvedPath}`,
        );
        const module = await viteServer.ssrLoadModule(resolvedPath);
        moduleLoadTime = performance.now() - moduleStart;
        moduleSource = "Vite SSR";

        const VueComponent = module.default || module;
        console.log(
          `${logPrefix} ✅ Module loaded via ${moduleSource} in ${
            moduleLoadTime.toFixed(2)
          }ms`,
          {
            hasDefault: !!module.default,
            moduleKeys: Object.keys(module),
            componentType: typeof VueComponent,
          },
        );

        const result = await renderVueToString(
          VueComponent,
          props,
          src,
          condition,
          ssrOnly,
          renderOptions,
        );
        const totalTime = performance.now() - renderStart;
        console.log(
          `${logPrefix} ✅ Vue SSR completed in ${
            totalTime.toFixed(2)
          }ms (module: ${moduleLoadTime.toFixed(2)}ms)`,
        );
        return result;
      } else {
        console.log(
          `${logPrefix} ❌ No Vite server available in development mode`,
        );
        throw new Error("No Vite server available for Vue SSR in development");
      }
    } else {
      // In production, load from pre-built SSR bundle
      const ssrPath = src.replace("/islands/", "/dist/ssr/islands/").replace(
        ".vue",
        ".js",
      );
      const moduleStart = performance.now();
      console.log(`${logPrefix} 📦 Loading production SSR bundle: ${ssrPath}`);
      const module = await import(ssrPath);
      moduleLoadTime = performance.now() - moduleStart;
      moduleSource = "production bundle";

      const VueComponent = module.default || module;
      console.log(
        `${logPrefix} ✅ Module loaded via ${moduleSource} in ${
          moduleLoadTime.toFixed(2)
        }ms`,
      );

      const result = await renderVueToString(
        VueComponent,
        props,
        src,
        condition,
        ssrOnly,
        renderOptions,
      );
      const totalTime = performance.now() - renderStart;
      console.log(
        `${logPrefix} ✅ Vue SSR completed in ${
          totalTime.toFixed(2)
        }ms (module: ${moduleLoadTime.toFixed(2)}ms)`,
      );
      return result;
    }
  } catch (error) {
    const failTime = performance.now() - renderStart;
    console.error(
      `${logPrefix} ❌ Vue SSR failed after ${failTime.toFixed(2)}ms:`,
      error,
    );
  }

  // No template fallbacks - SSR should work or fail cleanly

  // Extract CSS even when SSR fails
  let fallbackCSS = "";
  try {
    fallbackCSS = await extractVueCSS(src);
  } catch (error) {
    console.warn(`⚠️ Failed to extract CSS in Vue fallback for ${src}:`, error);
  }

  // Fallback to client-only (or SSR-only if specified) with CSS
  const totalTime = performance.now() - renderStart;
  const fallbackMode = ssrOnly ? "SSR-only" : "client-only";
  console.log(
    `${logPrefix} 🔄 Falling back to ${fallbackMode} Island after ${
      totalTime.toFixed(2)
    }ms`,
  );

  // Include CSS in the fallback if found
  const children = fallbackCSS
    ? `<style data-vue-ssr-id="fallback">${fallbackCSS}</style>`
    : undefined;

  // Use ssr: true when we have CSS children to include
  const shouldUseSSR = !!children;

  return Island({
    src,
    condition,
    props,
    ssr: shouldUseSSR,
    ssrOnly,
    renderOptions,
    children,
  });
}

/**
 * Render Vue component to string with proper SSR/hydration setup (internal use only)
 *
 * Based on Vue.js SSR documentation and Astro's Vue integration:
 * - Creates proper SSR app with createSSRApp
 * - Wraps SSR HTML in a div with data-server-rendered="true"
 * - Uses consistent container structure for client hydration
 */
async function renderVueToString(
  VueComponent: Record<string, unknown>,
  props: Record<string, unknown> = {},
  src: string,
  condition: IslandProps["condition"] = "on:client",
  ssrOnly: boolean = false,
  renderOptions: AnalyzerOptions = {},
): Promise<JSX.Element> {
  try {
    // CRITICAL FIX: Import the dedicated Vue server renderer.
    // This ensures the server-generated HTML is compatible with client hydration.
    const { renderToString: vueRenderToString } = await import(
      "vue/server-renderer"
    );
    const { createSSRApp } = await import("vue");

    // Create a new Vue app instance for each server-side render
    const app = createSSRApp(VueComponent, props);

    // Render the Vue component
    const ssrHtml = await vueRenderToString(app);

    console.log(
      `✅ Vue component rendered successfully with vue/server-renderer for ${src}`,
    );

    // Extract CSS directly from Vue component file
    let componentCSS = "";
    try {
      componentCSS = await extractVueCSS(src);
    } catch (error) {
      console.warn(`⚠️ Failed to extract CSS from Vue file ${src}:`, error);
    }

    // Include CSS and apply scoping if found
    let styledContent = ssrHtml;
    if (componentCSS) {
      // Generate a consistent scope ID for the component
      const scopeId = `data-v-${
        src.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
      }`;

      // Add scope attributes to HTML elements
      const scopedHtml = ssrHtml.replace(
        /<([a-zA-Z][^>]*?)>/g,
        (match, tagContent) => {
          // Skip closing tags and self-closing tags
          if (tagContent.startsWith("/") || tagContent.endsWith("/")) {
            return match;
          }
          // Add scope attribute
          return `<${tagContent} ${scopeId}>`;
        },
      );

      styledContent =
        `<style data-vue-ssr-id="${scopeId}">${componentCSS}</style>${scopedHtml}`;
      console.log(
        `📝 Vue component CSS extracted and scoped: ${componentCSS.length} chars`,
      );
    } else {
      console.log(`⚠️ No CSS extracted for Vue component ${src}`);
    }

    // Use Island component with proper SSR-only handling
    return Island({
      src,
      condition,
      props,
      children: styledContent,
      ssr: true,
      ssrOnly,
      renderOptions,
    });
  } catch (error: unknown) {
    console.error(`❌ Vue renderToString failed for ${src}:`, error);
    throw `❌ Vue renderToString failed for ${src}: ${error}`;
  }
}

/**
 * Extract CSS from Vue Single File Component
 * 
 * Parses <style> blocks from .vue files and applies scoping if needed
 */
async function extractVueCSS(src: string): Promise<string> {
  // Try different path variations to find the Vue file
  const pathVariations = [
    // Standard framework paths
    src.startsWith("/") ? `src${src}` : src,
    src.replace("/islands/", "/src/islands/"),
    // Remove leading slash variations
    src.startsWith("/") ? src.substring(1) : src,
  ];

  let vueContent = "";
  for (const path of pathVariations) {
    try {
      vueContent = await Deno.readTextFile(path);
      console.log(`📁 Vue file found at: ${path}`);
      break;
    } catch {
      continue;
    }
  }

  if (!vueContent) {
    throw new Error(
      `Vue file not found in any of the attempted paths: ${
        pathVariations.join(", ")
      }`,
    );
  }

  // Extract style blocks using regex
  const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
  let match;
  let componentCSS = "";

  while ((match = styleRegex.exec(vueContent)) !== null) {
    const attributes = match[1];
    const content = match[2].trim();
    const isScoped = attributes.includes("scoped");

    if (isScoped) {
      // Generate a consistent scope ID for the component
      const scopeId = `data-v-${
        src.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()
      }`;

      // Apply scoping to CSS selectors
      const scopedCSS = content.replace(/([^{}]+){/g, (match, selector) => {
        const trimmedSelector = selector.trim();
        // Skip @media, @keyframes, etc.
        if (trimmedSelector.startsWith("@")) {
          return match;
        }
        // Add scope attribute to each selector
        return `${trimmedSelector}[${scopeId}] {`;
      });

      componentCSS += scopedCSS;
      console.log(`📝 Vue scoped CSS extracted and processed for ${src}`);
    } else {
      // Non-scoped styles
      componentCSS += content;
      console.log(`📝 Vue global CSS extracted for ${src}`);
    }
  }

  return componentCSS;
}
