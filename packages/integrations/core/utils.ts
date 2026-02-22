/**
 * Common utilities for framework integrations.
 * Provides shared functionality for component loading, path resolution, and more.
 */

import type { ComponentLoadOptions, LoadContext } from "./types.ts";
import type { ViteDevServer } from "vite";
import { join, resolve } from "node:path";

/**
 * Load a component module in development or production
 * @param options - Component load options
 * @returns The loaded component module
 */
export async function loadComponent(
  options: ComponentLoadOptions,
) {
  const { src, context, target = "ssr" } = options;

  if (context.isDev && context.viteServer) {
    return await loadComponentDev(src, context.viteServer);
  }

  return await loadComponentProd(src, context.buildOutput, target);
}

/**
 * Load a component in development mode using Vite's SSR loader
 * @param src - Source path to component
 * @param viteServer - Vite dev server instance
 * @returns The loaded component module
 */
async function loadComponentDev(src: string, viteServer: ViteDevServer) {
  try {
    const module = await viteServer.ssrLoadModule(src);
    return module.default || module;
  } catch (error) {
    throw new Error(
      `Failed to load component in development: ${src}`,
      { cause: error },
    );
  }
}

/**
 * Load a component in production mode from build output
 * @param src - Source path to component
 * @param buildOutput - Path to build output directory
 * @param target - Whether loading for SSR or client
 * @returns The loaded component module
 */
async function loadComponentProd(
  src: string,
  buildOutput: string | undefined,
  target: "ssr" | "client",
) {
  const outputPath = resolveProductionPath(src, buildOutput, target);

  try {
    const module = await import(outputPath);
    return module.default || module;
  } catch (error) {
    throw new Error(
      `Failed to load component in production: ${outputPath}`,
      { cause: error },
    );
  }
}

/**
 * Resolve the production build path for a component
 * @param src - Source path to component
 * @param buildOutput - Path to build output directory
 * @param target - Whether loading for SSR or client
 * @returns Resolved path to built component
 */
export function resolveProductionPath(
  src: string,
  buildOutput: string | undefined,
  target: "ssr" | "client",
) {
  const base = buildOutput || "dist";
  const targetDir = target === "ssr" ? "ssr" : "client";

  // Convert source path to output path
  // e.g., /islands/Counter.tsx -> /dist/ssr/islands/Counter.js
  const outputPath = src
    .replace(/^\//, "") // Remove leading slash
    .replace(/\.(tsx|jsx|ts|js|vue|svelte)$/, ".js"); // Change extension to .js

  return join(base, targetDir, outputPath);
}

/**
 * Normalize a component path to be absolute
 * @param src - Source path (may be relative or absolute)
 * @param baseDir - Base directory to resolve relative paths from
 * @returns Absolute path
 */
export function normalizePath(src: string, baseDir?: string) {
  if (src.startsWith("/") || src.startsWith("file://")) {
    return src;
  }

  if (baseDir) {
    return resolve(baseDir, src);
  }

  return resolve(src);
}

/**
 * Extract the file extension from a path
 * @param path - File path
 * @returns File extension (including the dot)
 */
export function getExtension(path: string) {
  const match = path.match(/\.[^.]+$/);
  return match ? match[0] : "";
}

/**
 * Check if a path matches any of the given extensions
 * @param path - File path to check
 * @param extensions - Array of extensions (e.g., [".tsx", ".jsx"])
 * @returns True if path matches any extension
 */
export function hasExtension(path: string, extensions: string[]) {
  const ext = getExtension(path);
  return extensions.includes(ext);
}

/**
 * Generate a unique scope ID for a component (useful for CSS scoping)
 * @param src - Source path to component
 * @returns Unique scope identifier
 */
export function generateScopeId(src: string) {
  // Create a simple hash from the path
  const hash = src
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(-8);

  return `data-v-${hash}`;
}

/**
 * Serialize props for client-side hydration
 * @param props - Props object to serialize
 * @returns JSON string safe for HTML attributes
 */
export function serializeProps(props: Record<string, unknown>) {
  try {
    return JSON.stringify(props)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/'/g, "\\u0027")
      .replace(/"/g, "\\u0022");
  } catch (error) {
    console.error("Failed to serialize props:", error);
    return "{}";
  }
}

/**
 * Deserialize props from a JSON string
 * @param propsString - JSON string to deserialize
 * @returns Deserialized props object
 */
export function deserializeProps(propsString: string) {
  try {
    return JSON.parse(propsString);
  } catch (error) {
    console.error("Failed to deserialize props:", error);
    return {};
  }
}

/**
 * Create a load context from environment and parameters
 * @param viteServer - Optional Vite dev server
 * @param buildOutput - Optional build output directory
 * @returns Load context object
 */
export function createLoadContext(
  viteServer?: ViteDevServer,
  buildOutput?: string,
) {
  const isDev = process.env.NODE_ENV !== "production";

  return {
    isDev,
    viteServer: isDev ? viteServer : undefined,
    buildOutput: !isDev ? buildOutput : undefined,
  } satisfies LoadContext;
}

/**
 * Escape HTML special characters in a string
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Check if a module has a default export
 * @param module - Module to check
 * @returns True if module has a default export
 */
export function hasDefaultExport(module: unknown) {
  return module !== null && typeof module === "object" && "default" in module;
}

/**
 * Get the component from a module (handles default and named exports)
 * @param module - Module to extract component from
 * @returns The component
 */
export function getComponentFromModule(module: Record<string, unknown>) {
  if (hasDefaultExport(module)) {
    return (module as Record<string, unknown>).default;
  }

  // If no default export, return the module itself
  // (some frameworks export the component directly)
  return module;
}
