// Server-side utilities for React integration

import type { ComponentType } from "react";
import type { ComponentMetadata } from "../types.ts";
import { join } from "node:path";
import { readFileSync } from "node:fs";

/**
 * Resolve island path from /islands/ to /src/islands/
 */
function resolveIslandPath(src: string): string {
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
 * Load a React component from file path
 * 
 * @param src - Component source path
 * @returns React component
 */
export async function loadComponent(src: string): Promise<ComponentType<Record<string, unknown>>> {
  try {
    // Resolve the island path
    const resolvedSrc = resolveIslandPath(src);
    
    // Resolve the component path
    // If path starts with /, it's relative to workspace root (e.g., /src/islands/Counter.tsx)
    // Otherwise, it's already an absolute path or relative to current file
    let componentPath: string;
    if (resolvedSrc.startsWith("/")) {
      // Remove leading slash and join with cwd
      componentPath = join(process.cwd(), resolvedSrc.slice(1));
    } else {
      componentPath = resolvedSrc;
    }
    
    // Import the component module
    const module = await import(/* @vite-ignore */ componentPath);
    
    // Get the default export or named export
    const Component = module.default || module[Object.keys(module)[0]];
    
    if (!Component || typeof Component !== "function") {
      throw new Error(
        `Invalid React component in ${src}: expected function, got ${typeof Component}`
      );
    }
    
    return Component as ComponentType<Record<string, unknown>>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load React component from ${src}: ${errorMessage}`,
      { cause: error }
    );
  }
}

/**
 * Check if a component has "use client" directive
 * 
 * @param src - Component source path
 * @returns True if component has "use client" directive
 */
export function hasUseClientDirective(src: string): boolean {
  try {
    // Resolve the island path
    const resolvedSrc = resolveIslandPath(src);
    
    // Resolve the component path
    let componentPath: string;
    if (resolvedSrc.startsWith("/")) {
      // Remove leading slash and join with cwd
      componentPath = join(process.cwd(), resolvedSrc.slice(1));
    } else {
      componentPath = resolvedSrc;
    }
    
    // Read the file content
    const content = readFileSync(componentPath, "utf-8");
    
    // Check for "use client" directive at the top of the file
    // It should be one of the first statements (after imports/comments)
    const useClientPattern = /^['"]use client['"];?\s*$/m;
    return useClientPattern.test(content);
  } catch (error) {
    console.warn(`Failed to check "use client" directive in ${src}:`, error);
    return false;
  }
}

/**
 * Extract import statements from component file
 * 
 * @param content - File content
 * @returns Array of import sources
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  
  // Match ES6 imports: import ... from "source"
  const importPattern = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = importPattern.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Analyze component file for RSC classification
 * 
 * @param filePath - Component file path
 * @returns Component metadata
 */
export function analyzeComponent(filePath: string): ComponentMetadata {
  try {
    // Resolve the island path
    const resolvedPath = resolveIslandPath(filePath);
    
    // Resolve the component path
    let componentPath: string;
    if (resolvedPath.startsWith("/")) {
      // Remove leading slash and join with cwd
      componentPath = join(process.cwd(), resolvedPath.slice(1));
    } else {
      componentPath = resolvedPath;
    }
    
    // Read the file content
    const content = readFileSync(componentPath, "utf-8");
    
    // Check for directives
    const isClientComponent = /^['"]use client['"];?\s*$/m.test(content);
    const isServerComponent = /^['"]use server['"];?\s*$/m.test(content);
    
    // Check for async function components
    // Look for: export default async function, export async function, const Component = async
    const hasAsyncRender = 
      /export\s+default\s+async\s+function/.test(content) ||
      /export\s+async\s+function/.test(content) ||
      /const\s+\w+\s*=\s*async\s+(?:function|\()/.test(content);
    
    // Extract dependencies
    const dependencies = extractImports(content);
    
    return {
      path: filePath,
      isClientComponent,
      isServerComponent,
      hasAsyncRender,
      dependencies,
    };
  } catch (error) {
    console.warn(`Failed to analyze component ${filePath}:`, error);
    return {
      path: filePath,
      isClientComponent: false,
      isServerComponent: false,
      hasAsyncRender: false,
      dependencies: [],
    };
  }
}

/**
 * Normalize and serialize component props
 * Removes non-serializable values like functions, symbols, etc.
 * 
 * @param props - Raw props object
 * @returns Serialized props
 */
export function serializeProps(props: Record<string, unknown>): Record<string, unknown> {
  try {
    // Use JSON stringify/parse to remove non-serializable values
    // This also handles nested objects and arrays
    // biome-ignore lint/performance/noBarrelFile: JSON round-trip intentionally strips non-serializable values (functions, symbols) which structuredClone cannot handle
    return JSON.parse(JSON.stringify(props)) as Record<string, unknown>;
  } catch (error) {
    console.warn("Failed to serialize props, returning empty object:", error);
    return {};
  }
}
