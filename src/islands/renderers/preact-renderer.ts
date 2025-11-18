import type { JSX } from "preact";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type { IslandProps } from "../types.ts";
import type { AnalyzerOptions } from "../../core/components/component-analyzer.ts";
import { resolveIslandPath } from "../framework-detection.ts";
import Island from "../island.tsx";

/**
 * Parameters for rendering a Preact component
 */
interface RenderParams {
  src: string;
  condition: IslandProps["condition"];
  props: Record<string, unknown>;
  ssr: boolean;
  renderOptions?: AnalyzerOptions;
  ssrOnly?: boolean;
}

/**
 * Render Preact component with SSR
 */
export async function renderPreactComponent({
  src,
  condition,
  props,
  ssr: _ssr,
  renderOptions = {},
  ssrOnly = false,
}: RenderParams): Promise<JSX.Element> {
  const logPrefix = `🔄 [Preact:${src}]`;
  const renderStart = performance.now();

  console.log(`${logPrefix} Starting Preact SSR rendering...`, {
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

        const PreactComponent = module.default || module;

        console.log(
          `${logPrefix} ✅ Module loaded via ${moduleSource} in ${
            moduleLoadTime.toFixed(2)
          }ms`,
          {
            hasDefault: !!module.default,
            moduleKeys: Object.keys(module),
            componentType: typeof PreactComponent,
            isFunction: typeof PreactComponent === "function",
          },
        );

        if (!PreactComponent || typeof PreactComponent !== "function") {
          throw new Error(
            `Invalid Preact component in ${src}: expected function, got ${typeof PreactComponent}`,
          );
        }

        const result = renderPreactToString(
          PreactComponent,
          props,
          src,
          condition,
          ssrOnly,
          renderOptions,
        );
        const totalTime = performance.now() - renderStart;
        console.log(
          `${logPrefix} ✅ Preact SSR completed in ${
            totalTime.toFixed(2)
          }ms (module: ${moduleLoadTime.toFixed(2)}ms)`,
        );
        return result;
      } else {
        console.log(
          `${logPrefix} ❌ No Vite server available in development mode`,
        );
        throw new Error(
          "No Vite server available for Preact SSR in development",
        );
      }
    } else {
      // In production, load from pre-built SSR bundle
      const ssrPath = src.replace("/islands/", "/dist/ssr/islands/").replace(
        /\.(tsx|jsx)$/,
        ".js",
      );
      const moduleStart = performance.now();
      console.log(`${logPrefix} 📦 Loading production SSR bundle: ${ssrPath}`);
      const module = await import(ssrPath);
      moduleLoadTime = performance.now() - moduleStart;
      moduleSource = "production bundle";

      const PreactComponent = module.default || module;
      console.log(
        `${logPrefix} ✅ Module loaded via ${moduleSource} in ${
          moduleLoadTime.toFixed(2)
        }ms`,
      );

      const result = renderPreactToString(
        PreactComponent,
        props,
        src,
        condition,
        ssrOnly,
        renderOptions,
      );
      const totalTime = performance.now() - renderStart;
      console.log(
        `${logPrefix} ✅ Preact SSR completed in ${
          totalTime.toFixed(2)
        }ms (module: ${moduleLoadTime.toFixed(2)}ms)`,
      );
      return result;
    }
  } catch (error) {
    const failTime = performance.now() - renderStart;
    console.error(
      `${logPrefix} ❌ Preact SSR failed after ${failTime.toFixed(2)}ms:`,
      error,
    );
  }

  // Fallback to client-only (or SSR-only if specified)
  const totalTime = performance.now() - renderStart;
  const fallbackMode = ssrOnly ? "SSR-only" : "client-only";
  console.log(
    `${logPrefix} 🔄 Falling back to ${fallbackMode} Island after ${
      totalTime.toFixed(2)
    }ms`,
  );
  return Island({ src, condition, props, ssr: false, ssrOnly, renderOptions });
}

/**
 * Render Preact component to string (internal use only)
 */
function renderPreactToString(
  component: () => JSX.Element,
  props: Record<string, unknown> = {},
  src: string,
  condition: IslandProps["condition"] = "on:client",
  ssrOnly: boolean = false,
  renderOptions: AnalyzerOptions = {},
): JSX.Element {
  const logPrefix = `🔄 [PreactRender:${src}]`;
  const renderStart = performance.now();

  console.log(`${logPrefix} Starting Preact renderToString...`, {
    componentType: typeof component,
    propsKeys: Object.keys(props),
    ssrOnly,
  });

  try {
    // Render component directly, then add hydration attributes
    const renderStringStart = performance.now();
    const ssrHtml = renderToString(h(component, props));
    const renderStringTime = performance.now() - renderStringStart;

    console.log(
      `${logPrefix} ✅ Preact renderToString completed in ${
        renderStringTime.toFixed(2)
      }ms`,
      {
        htmlLength: ssrHtml.length,
        htmlPreview: ssrHtml.substring(0, 100) +
          (ssrHtml.length > 100 ? "..." : ""),
      },
    );

    const result = Island({
      src,
      condition,
      props,
      children: ssrHtml,
      ssr: true,
      framework: "preact",
      ssrOnly,
      renderOptions,
    });

    const totalTime = performance.now() - renderStart;
    console.log(
      `${logPrefix} ✅ Island creation completed in ${totalTime.toFixed(2)}ms`,
    );
    return result;
  } catch (error) {
    const failTime = performance.now() - renderStart;
    console.error(
      `${logPrefix} ❌ Preact renderToString failed after ${
        failTime.toFixed(2)
      }ms:`,
      error,
    );

    console.log(`${logPrefix} 🔄 Creating fallback Island without SSR`);
    return Island({
      src,
      condition: ssrOnly ? condition : "on:client",
      props,
      ssr: false,
      framework: "preact",
      ssrOnly,
      renderOptions,
    });
  }
}
