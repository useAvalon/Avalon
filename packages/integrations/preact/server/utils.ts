import type { PreactComponent, PreactComponentModule } from "../types.ts";

// Extend globalThis to include Vite dev server
declare global {
  // deno-lint-ignore no-explicit-any
  var __viteDevServer: any;
}

/**
 * Resolve island path from /islands/ to /src/islands/
 */
function resolveIslandPath(src: string) {
  // If path starts with /islands/, convert to /src/islands/
  if (src.startsWith("/islands/")) {
    return src.replace("/islands/", "/src/islands/");
  }
  
  // If path already starts with /src/islands/, use as-is
  if (src.startsWith("/src/islands/")) {
    return src;
  }
  
  // Otherwise return as-is
  return src;
}

/**
 * Load a Preact component from a file path
 * Handles both development (via Vite) and production (from build output)
 */
export async function loadComponent(src: string) {
  const isDev = Deno.env.get("DENO_ENV") !== "production";
  
  if (isDev && globalThis.__viteDevServer) {
    // Development: use Vite's SSR module loading
    const resolvedPath = resolveIslandPath(src);
    const module = await globalThis.__viteDevServer.ssrLoadModule(resolvedPath) as PreactComponentModule;
    return extractComponent(module, src);
  }
  
  // Production: load from build output
  const ssrPath = resolveSsrPath(src);
  const module = await import(
    /* @vite-ignore */
    ssrPath
  ) as PreactComponentModule;
  return extractComponent(module, src);
}

/**
 * Extract the component from a module
 * Handles default exports and named exports
 */
function extractComponent(module: PreactComponentModule, src: string) {
  if (module.default) {
    return module.default;
  }
  
  // Look for a named export that might be the component
  const keys = Object.keys(module);
  if (keys.length === 1) {
    return module[keys[0]] as PreactComponent;
  }
  
  throw new Error(
    `Could not find component export in ${src}. ` +
    `Make sure the component is exported as default or as a named export.`
  );
}

/**
 * Resolve the SSR path for a component in production
 */
function resolveSsrPath(src: string) {
  return src
    .replace("/islands/", "/dist/ssr/islands/")
    .replace(/\.(tsx|jsx)$/, ".js");
}

/**
 * Check if a file is a Preact component based on its extension
 */
export function isPreactComponent(path: string) {
  return /\.(tsx|jsx)$/.test(path);
}

/**
 * Normalize component props for rendering
 */
export function normalizeProps(props: Record<string, unknown>) {
  // Clone props to avoid mutations
  const normalized = { ...props };
  
  // Handle special prop transformations if needed
  // For example, converting class to className
  if ('class' in normalized && !('className' in normalized)) {
    normalized.className = normalized.class;
    delete normalized.class;
  }
  
  return normalized;
}
