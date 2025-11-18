import type { JSX } from "preact";
import { h } from "preact";
import type { IslandProps } from "../types.ts";
import type { AnalyzerOptions } from "../../core/components/component-analyzer.ts";
import { resolveIslandPath } from "../framework-detection.ts";
import Island from "../island.tsx";

/**
 * Render Solid component with SSR
 */
export async function renderSolidComponent({
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
  console.log(`🔄 Attempting Solid SSR for: ${src}`);

  try {
    const isDev = Deno.env.get("DENO_ENV") !== "production";

    if (isDev) {
      // In development, use Vite's ssrLoadModule if available
      const viteServer = globalThis.__viteDevServer;
      if (viteServer) {
        const resolvedPath = resolveIslandPath(src);
        console.log(`📡 Loading Solid component: ${src} -> ${resolvedPath}`);
        const module = await viteServer.ssrLoadModule(resolvedPath);
        const SolidComponent = module.default || module;

        if (!SolidComponent || typeof SolidComponent !== "function") {
          throw new Error(`Invalid Solid component in ${src}`);
        }

        return await renderSolidToString(SolidComponent, props, src, condition);
      } else {
        // Fallback: try direct import when no Vite server is available
        console.log(
          `⚠️ No Vite server available, attempting direct import for ${src}`,
        );
        const resolvedPath = resolveIslandPath(src);
        // Convert to relative path for import, accounting for Avalon directory structure
        const filePath = resolvedPath.startsWith("/")
          ? `.${resolvedPath}`
          : `./${resolvedPath}`;

        // If the path doesn't exist, try with Avalon prefix
        try {
          await Deno.stat(filePath.substring(2)); // Remove './' to check if file exists
        } catch {
          // File doesn't exist at the standard path, try with Avalon prefix
          if (resolvedPath.startsWith("/src/")) {
            console.warn(
              `⚠️ File not found at ${filePath}, using original path`,
            );
          }
        }

        try {
          const module = await import(filePath);
          const SolidComponent = module.default || module;

          if (!SolidComponent || typeof SolidComponent !== "function") {
            throw new Error(`Invalid Solid component in ${src}`);
          }

          return await renderSolidToString(
            SolidComponent,
            props,
            src,
            condition,
          );
        } catch (importError) {
          console.error(`❌ Direct import failed for ${src}:`, importError);
          throw importError;
        }
      }
    } else {
      // In production, load from pre-built SSR bundle
      const ssrPath = src.replace("/islands/", "/dist/ssr/islands/").replace(
        /\.(tsx|jsx)$/,
        ".js",
      );
      console.log(`📦 Loading Solid SSR bundle: ${ssrPath}`);
      const module = await import(ssrPath);
      const SolidComponent = module.default || module;
      return await renderSolidToString(SolidComponent, props, src, condition);
    }
  } catch (error) {
    console.error(`❌ Solid SSR failed for ${src}:`, error);
  }

  // Fallback to client-only (or SSR-only if specified)
  console.log(
    `🔄 Solid SSR failed, falling back to ${
      ssrOnly ? "SSR-only" : "client-only"
    } for ${src}`,
  );
  return Island({ src, condition, props, ssr: false, ssrOnly, renderOptions });
}

/**
 * Render Solid component using proper SSR approach with semantic is-land element (internal use only)
 */
async function renderSolidToString(
  SolidComponent: (props: Record<string, unknown>) => unknown,
  props: Record<string, unknown> = {},
  src: string,
  condition: IslandProps["condition"] = "on:client",
): Promise<JSX.Element> {
  try {
    console.log(`🔄 Rendering Solid component to string for ${src}`);

    // Import Solid.js SSR utilities
    let renderToStringAsync: (fn: () => unknown) => Promise<string>;

    try {
      const solidWeb = await import("solid-js/web");
      // Handle both named and default exports
      const solidWebModule = solidWeb as any;
      renderToStringAsync = solidWebModule.renderToStringAsync ||
        solidWebModule.default?.renderToStringAsync;

      if (!renderToStringAsync) {
        // Fallback to synchronous renderToString
        const renderToString = solidWebModule.renderToString ||
          solidWebModule.default?.renderToString;
        if (!renderToString) {
          throw new Error(
            "Neither renderToStringAsync nor renderToString found in solid-js/web import",
          );
        }
        renderToStringAsync = (fn) => Promise.resolve(renderToString(fn));
      }
    } catch (importError: unknown) {
      console.error(`Failed to import solid-js/web:`, importError);
      const errorMessage = importError instanceof Error
        ? importError.message
        : String(importError);
      throw new Error(`Cannot import solid-js/web: ${errorMessage}`);
    }

    console.log(`📦 Successfully imported solid-js/web for ${src}`);

    // Validate component
    if (typeof SolidComponent !== "function") {
      throw new Error(
        `Expected SolidComponent to be a function, got ${typeof SolidComponent}`,
      );
    }

    // Render the component - SolidJS will add its own hydration markers
    const ssrHtml = await renderToStringAsync(() => SolidComponent(props));

    if (!ssrHtml || typeof ssrHtml !== "string") {
      throw new Error(
        `renderToStringAsync returned invalid result: ${typeof ssrHtml}`,
      );
    }

    console.log(
      `✅ Solid component rendered successfully for ${src}, HTML length: ${ssrHtml.length}`,
    );

    // Generate deterministic container ID (SSR-safe)
    const containerId = `solid-island-${src.replace(/[^a-zA-Z0-9]/g, "-")}`;

    // Resolve the path for hydration - ensure it matches what Vite can serve
    const hydrationPath = resolveIslandPath(src);

    // Use semantic is-land element with dedicated Solid hydration attributes
    return h("is-land", {
      id: containerId,
      "data-solid-hydrate": hydrationPath,
      "data-solid-props": JSON.stringify(props),
      "data-solid-condition": condition,
      dangerouslySetInnerHTML: { __html: ssrHtml },
    });
  } catch (error: unknown) {
    console.error(`❌ Solid SSR failed for ${src}:`, error);
    throw `❌ Solid renderToString failed for ${src}: ${error}`;
  }
}
