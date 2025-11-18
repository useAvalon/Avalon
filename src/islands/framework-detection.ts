import type { Framework } from "./types.ts";
import type { ViteDevServer } from "vite";

// Global Vite server reference
declare global {
  var __viteDevServer: ViteDevServer | undefined;
}

/**
 * Resolve Island component path for Vite SSR loading
 * Converts /islands/* paths to /src/islands/* for proper resolution
 * Also handles framework-specific naming conventions
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
    // Try to find the actual file with framework-specific naming
    const basePath = resolvedPath.replace(".tsx", "");
    const possiblePaths = [
      `${basePath}.solid.tsx`,
      `${basePath}.preact.tsx`,
      resolvedPath, // Original path as fallback
    ];

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
 */
export function detectFrameworkFromSrc(
  src: string,
): "solid" | "vue" | "svelte" | "preact" | "react" {
  // Check file extension and naming patterns
  if (src.endsWith(".vue")) {
    return "vue";
  }
  if (src.endsWith(".svelte")) {
    return "svelte";
  }
  if (src.includes(".solid.") || src.toLowerCase().includes("solid")) {
    return "solid";
  }
  if (src.includes("react") || src.toLowerCase().includes("react")) {
    return "react";
  }

  // Default to preact for .tsx/.jsx files
  return "preact";
}

/**
 * Detect the framework used by a component file
 */
export async function detectFramework(
  src: string,
): Promise<Framework> {
  const logPrefix = `🔍 [${src}]`;
  const detectionStart = performance.now();

  console.log(`${logPrefix} Starting framework detection...`);

  // Quick filename-based detection
  if (
    src.includes(".solid.") || src.includes("Solid") ||
    src.toLowerCase().includes("solid")
  ) {
    const detectionTime = performance.now() - detectionStart;
    console.log(
      `${logPrefix} Framework detected via filename: solid (${
        detectionTime.toFixed(2)
      }ms)`,
    );
    return "solid";
  }

  if (src.includes(".vue.") || src.includes("Vue")) {
    const detectionTime = performance.now() - detectionStart;
    console.log(
      `${logPrefix} Framework detected via filename: vue (${
        detectionTime.toFixed(2)
      }ms)`,
    );
    return "vue";
  }

  if (src.includes(".svelte") || src.includes("Svelte")) {
    const detectionTime = performance.now() - detectionStart;
    console.log(
      `${logPrefix} Framework detected via filename: svelte (${
        detectionTime.toFixed(2)
      }ms)`,
    );
    return "svelte";
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

    // Check imports and pragmas
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
          `${logPrefix} Framework detected via content analysis: ${check.framework} (${
            detectionTime.toFixed(2)
          }ms)`,
        );
        return check.framework;
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
