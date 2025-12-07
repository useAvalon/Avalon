/// <reference lib="deno.ns" />

import { render as svelteRender } from "svelte/server";
import type { RenderParams, RenderResult } from "@avalon/shared";
import type { SvelteRenderResult, SvelteSsrRenderResult } from "../types.ts";

declare global {
  var __viteDevServer: {
    ssrLoadModule: (path: string) => Promise<Record<string, unknown>>;
  } | undefined;
}

function resolveIslandPath(src: string): string {
  if (src.startsWith("/islands/")) {
    return src.replace("/islands/", "/src/islands/");
  }
  if (src.startsWith("/src/islands/")) {
    return src;
  }
  return src;
}

async function loadComponent(src: string): Promise<unknown> {
  const isDev = Deno.env.get("DENO_ENV") !== "production";
  
  if (isDev && globalThis.__viteDevServer) {
    const resolvedPath = resolveIslandPath(src);
    const module = await globalThis.__viteDevServer.ssrLoadModule(resolvedPath);
    return module.default || module;
  }
  
  const ssrPath = src.replace("/islands/", "/dist/ssr/islands/").replace(/\.svelte$/, ".js");
  const module = await import(ssrPath) as Record<string, unknown>;
  return module.default || module;
}

async function extractCSS(src: string, scopeId: string): Promise<string | undefined> {
  try {
    const resolved = resolveIslandPath(src);
    const filePath = resolved.startsWith('/') ? resolved.slice(1) : resolved;
    const sourceCode = await Deno.readTextFile(filePath);
    const styleMatch = sourceCode.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    
    if (styleMatch) {
      const rawCSS = styleMatch[1].trim();
      const scopedCSS = rawCSS.replace(/(\.[a-zA-Z_-][a-zA-Z0-9_-]*)/g, (match) => match + "." + scopeId);
      return scopedCSS;
    }
  } catch (e) {
    console.error("CSS extraction failed:", e);
  }
  return undefined;
}

export async function render(params: RenderParams): Promise<RenderResult> {
  const { props = {}, src, condition = "on:client", ssrOnly = false } = params;
  
  try {
    const Component = await loadComponent(src);
    if (!Component) {
      throw new Error("No component found");
    }
    
    const result: SvelteSsrRenderResult = svelteRender(Component, { props: props || {}, context: new Map() });
    const ssrHtml = result.body;
    const ssrHead = result.head || "";
    
    const scopeMatch = ssrHtml.match(/class="[^"]*\b(svelte-[a-z0-9]+)\b/);
    const scopeId = scopeMatch ? scopeMatch[1] : null;
    
    let css: string | undefined;
    if (scopeId) {
      css = await extractCSS(src, scopeId);
    }
    
    return {
      html: ssrHtml,
      head: ssrHead || undefined,
      css: css || undefined,
      hydrationData: { src, props, framework: "svelte", condition, ssrOnly },
    };
  } catch (error) {
    console.error("Svelte SSR failed:", error);
    throw error;
  }
}
