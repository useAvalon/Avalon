import type { Framework } from "./types.ts";
import type { ViteDevServer } from "vite";
import { registry } from "../core/integrations/registry.ts";
// Global Vite server reference
declare global {
  var __viteDevServer: ViteDevServer | undefined;
}

/**
 * Get all integration configs for detection
 * Returns configs from registered integrations
 */
export function getIntegrationConfigs() {
  const integrations = registry.getAll();
  return integrations.map(integration => integration.config());
}

/**
 * Get integration config by framework name
 */
export function getIntegrationConfig(framework: string) {
  const integration = registry.get(framework);
  return integration?.config();
}

/**
 * Check if a framework integration is available
 */
export function hasFrameworkIntegration(framework: string) {
  return registry.has(framework);
}

/**
 * Resolve Island component path for Vite SSR loading
 * Converts /islands/* paths to /src/islands/* for proper resolution
 * Also handles framework-specific naming conventions
 * 
 * Updated to work with integration-based loading system
 */
export function resolveIslandPath(src: string): string {
  let resolvedPath = src;

  // If path starts with /islands/, convert to /src/islands/
  if (src.startsWith("/islands/")) {
    resolvedPath = src.replace("/islands/", "/src/islands/");
  }

  // If path already starts with /src/islands/, use as-is
  if (src.startsWith("/src/islands/")) {
    resolvedPath = src;
  }

  // Handle framework-specific naming conventions
  // If the path doesn't have a framework-specific extension, try to find the actual file
  if (
    resolvedPath.endsWith(".tsx") && !resolvedPath.includes(".solid.") &&
    !resolvedPath.includes(".preact.")
  ) {
    // Get all registered integrations to check for possible file extensions
    const integrations = registry.getAll();
    const possiblePaths: string[] = [];
    
    // Build list of possible paths based on integration file extensions
    const basePath = resolvedPath.replace(".tsx", "");
    for (const integration of integrations) {
      const config = integration.config();
      for (const ext of config.fileExtensions) {
        // Handle special naming conventions (e.g., .solid.tsx)
        if (ext === ".tsx" || ext === ".jsx") {
          possiblePaths.push(`${basePath}.${config.name}${ext}`);
        } else {
          possiblePaths.push(`${basePath}${ext}`);
        }
      }
    }
    
    // Add original path as fallback
    possiblePaths.push(resolvedPath);

    // Check which file actually exists (synchronously for performance)
    for (const possiblePath of possiblePaths) {
      try {
        // Try the path as-is (relative to project root)
        const pathVariation = possiblePath.startsWith("/")
          ? possiblePath.substring(1)
          : possiblePath;
        try {
          Deno.statSync(pathVariation);
          return possiblePath;
        } catch {
          continue;
        }
      } catch {
        // File doesn't exist, continue to next possibility
        continue;
      }
    }
  }

  return resolvedPath;
}

/**
 * Quick framework detection based on file extension and naming conventions
 * Used for setting framework attributes without async file reading
 * 
 * Updated to query integration configs for detection patterns
 */
export function detectFrameworkFromSrc(
  src: string,
): "solid" | "vue" | "svelte" | "preact" | "react" | "lit" {
  // Normalize path separators
  const normalizedSrc = src.replace(/\\/g, "/");
  
  // Get all registered integrations
  const integrations = registry.getAll();
  
  // First pass: Check for framework-specific naming conventions (e.g., .solid.tsx)
  // This takes priority over generic extensions
  for (const integration of integrations) {
    const config = integration.config();
    
    if (normalizedSrc.includes(`.${config.name}.`)) {
      return config.name as "solid" | "vue" | "svelte" | "preact" | "react" | "lit";
    }
  }
  
  // Second pass: Check file extensions for unique extensions (e.g., .vue, .svelte)
  for (const integration of integrations) {
    const config = integration.config();
    
    // Check if file extension matches
    for (const ext of config.fileExtensions) {
      if (normalizedSrc.endsWith(ext)) {
        return config.name as "solid" | "vue" | "svelte" | "preact" | "react" | "lit";
      }
    }
  }
  
  // Fallback: Check for common patterns if no integrations are loaded yet
  if (normalizedSrc.endsWith(".vue")) {
    return "vue";
  }
  if (normalizedSrc.endsWith(".svelte")) {
    return "svelte";
  }
  if (normalizedSrc.includes(".solid.") || normalizedSrc.toLowerCase().includes("solid")) {
    return "solid";
  }
  if (normalizedSrc.includes("react") || normalizedSrc.toLowerCase().includes("react")) {
    return "react";
  }

  // Default to preact for .tsx/.jsx files
  return "preact";
}

/**
 * Detect the framework used by a component file
 * Updated to query integration configs for detection patterns
 */
export async function detectFramework(
  src: string,
): Promise<Framework> {
  const logPrefix = `🔍 [${src}]`;
  const detectionStart = performance.now();

  console.log(`${logPrefix} Starting framework detection...`);

  // Get all registered integrations
  const integrations = registry.getAll();

  // Quick filename-based detection using integration configs
  for (const integration of integrations) {
    const config = integration.config();
    
    // Check file extensions
    for (const ext of config.fileExtensions) {
      if (src.endsWith(ext)) {
        const detectionTime = performance.now() - detectionStart;
        console.log(
          `${logPrefix} Framework detected via file extension (${ext}): ${config.name} (${
            detectionTime.toFixed(2)
          }ms)`,
        );
        return config.name as Framework;
      }
    }
    
    // Check for framework-specific naming conventions
    if (src.includes(`.${config.name}.`)) {
      const detectionTime = performance.now() - detectionStart;
      console.log(
        `${logPrefix} Framework detected via naming convention: ${config.name} (${
          detectionTime.toFixed(2)
        }ms)`,
      );
      return config.name as Framework;
    }
  }

  // Try to read file content for more accurate detection
  try {
    let fileContent: string;
    let contentSource = "";

    try {
      // Try to read the file directly using resolved path
      const resolvedPath = resolveIslandPath(src);
      const filePath = resolvedPath.replace(/^\//, "");
      console.log(
        `${logPrefix} Attempting direct file read: ${src} -> ${filePath}`,
      );
      fileContent = await Deno.readTextFile(filePath);
      contentSource = "direct file read";
    } catch (fileError) {
      console.log(
        `${logPrefix} Direct file read failed, trying Vite SSR:`,
        fileError,
      );
      // If direct read fails, try through Vite in development
      const viteServer = globalThis.__viteDevServer;
      if (viteServer) {
        const resolvedPath = resolveIslandPath(src);
        console.log(
          `${logPrefix} Using Vite SSR module loading: ${src} -> ${resolvedPath}`,
        );
        const module = await viteServer.ssrLoadModule(resolvedPath);
        fileContent = module.toString();
        contentSource = "Vite SSR module";
      } else {
        console.log(
          `${logPrefix} No Vite server available, cannot detect framework`,
        );
        return "unknown";
      }
    }

    console.log(
      `${logPrefix} File content loaded via ${contentSource} (${fileContent.length} chars)`,
    );

    // Check imports and content patterns using integration configs
    for (const integration of integrations) {
      const config = integration.config();
      
      // Check import patterns
      for (const pattern of config.detectionPatterns.imports) {
        if (pattern.test(fileContent)) {
          const detectionTime = performance.now() - detectionStart;
          console.log(
            `${logPrefix} Framework detected via import pattern: ${config.name} (${
              detectionTime.toFixed(2)
            }ms)`,
          );
          return config.name as Framework;
        }
      }
      
      // Check content patterns
      for (const pattern of config.detectionPatterns.content) {
        if (pattern.test(fileContent)) {
          const detectionTime = performance.now() - detectionStart;
          console.log(
            `${logPrefix} Framework detected via content pattern: ${config.name} (${
              detectionTime.toFixed(2)
            }ms)`,
          );
          return config.name as Framework;
        }
      }
    }

    // Fallback: If no integrations are loaded, use hardcoded patterns for backward compatibility
    if (integrations.length === 0) {
      console.log(`${logPrefix} No integrations loaded, using fallback detection`);
      const checks = [
        {
          pattern: /solid-js|@jsxImportSource solid-js/,
          framework: "solid" as const,
        },
        { pattern: /vue|Vue/, framework: "vue" as const },
        { pattern: /svelte/, framework: "svelte" as const },
        { pattern: /react/, framework: "react" as const },
        { pattern: /preact/, framework: "preact" as const },
      ];

      for (const check of checks) {
        if (check.pattern.test(fileContent)) {
          const detectionTime = performance.now() - detectionStart;
          console.log(
            `${logPrefix} Framework detected via fallback content analysis: ${check.framework} (${
              detectionTime.toFixed(2)
            }ms)`,
          );
          return check.framework;
        }
      }
    }

    // Default to preact for JSX files
    const detectionTime = performance.now() - detectionStart;
    console.log(
      `${logPrefix} No specific framework detected, defaulting to preact (${
        detectionTime.toFixed(2)
      }ms)`,
    );
    return "preact";
  } catch (error) {
    const detectionTime = performance.now() - detectionStart;
    console.warn(
      `${logPrefix} Framework detection failed after ${
        detectionTime.toFixed(2)
      }ms:`,
      error,
    );
    return "unknown";
  }
}
