/**
 * Island Directory Scanner
 * 
 * Recursively scans the source directory to discover all islands directories.
 * Supports nested patterns like /src/modules/[module]/islands/.
 */

import { resolve, relative, dirname, basename, extname } from "node:path";
import { stat as fsStat, readdir } from "node:fs/promises";
import type {
  IslandDirectory,
  IslandDiscoveryConfig,
  DiscoveredIsland,
} from "./types.ts";
import {
  DEFAULT_DISCOVERY_CONFIG,
  isSupportedIslandExtension,
} from "./types.ts";
import type { Framework } from "../types.ts";

/**
 * Discover all island directories within the source directory.
 * Uses recursive scanning to find all directories named "islands".
 * 
 * @param projectRoot - The root directory of the project
 * @param config - Optional configuration for discovery
 * @returns Array of discovered island directories
 */
export async function discoverIslandDirectories(
  projectRoot: string,
  config: IslandDiscoveryConfig = {}
): Promise<IslandDirectory[]> {
  const mergedConfig = { ...DEFAULT_DISCOVERY_CONFIG, ...config };
  const srcDir = resolve(projectRoot, mergedConfig.rootDir);
  const directories: IslandDirectory[] = [];

  // Check if src directory exists
  try {
    const statResult = await fsStat(srcDir);
    if (!statResult.isDirectory()) {
      return directories;
    }
  } catch {
    // src directory doesn't exist
    return directories;
  }

  // Recursively scan for islands directories
  await scanForIslandDirectories(
    srcDir,
    projectRoot,
    mergedConfig,
    directories
  );

  // Sort directories: default first, then alphabetically by path
  directories.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return a.relativePath.localeCompare(b.relativePath);
  });

  return directories;
}

/**
 * Recursively scan a directory for islands directories.
 */
async function scanForIslandDirectories(
  currentDir: string,
  projectRoot: string,
  config: Required<IslandDiscoveryConfig>,
  results: IslandDirectory[]
): Promise<void> {
  try {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = resolve(currentDir, entry.name);
      const relativeFromRoot = relative(projectRoot, fullPath);

      // Check if this directory should be excluded
      if (shouldExclude(relativeFromRoot, config.exclude)) {
        continue;
      }

      // Check if this is an islands directory
      if (entry.name === "islands") {
        const islandDir = createIslandDirectory(
          fullPath,
          projectRoot,
          config
        );
        results.push(islandDir);
        // Don't recurse into islands directories
        continue;
      }

      // Recurse into subdirectories
      await scanForIslandDirectories(
        fullPath,
        projectRoot,
        config,
        results
      );
    }
  } catch (error) {
    // Log but don't fail on permission errors or other issues
    if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== 'EACCES') {
      console.warn(`Warning: Could not scan directory ${currentDir}:`, error);
    }
  }
}

/**
 * Check if a path should be excluded from scanning.
 */
function shouldExclude(relativePath: string, excludePatterns: string[]): boolean {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  
  for (const pattern of excludePatterns) {
    // Simple pattern matching - check if path starts with or contains the pattern
    if (normalizedPath === pattern || 
        normalizedPath.startsWith(pattern + "/") ||
        normalizedPath.includes("/" + pattern + "/") ||
        normalizedPath.endsWith("/" + pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create an IslandDirectory object from a discovered path.
 */
function createIslandDirectory(
  absolutePath: string,
  projectRoot: string,
  config: Required<IslandDiscoveryConfig>
): IslandDirectory {
  const relativeFromSrc = relative(
    resolve(projectRoot, config.rootDir),
    absolutePath
  );

  // Determine if this is the default islands directory
  // Default is /src/islands/ (directly under src, not nested)
  const isDefault = relativeFromSrc === "islands";

  // Calculate namespace from the path
  // For /src/islands/ -> namespace is ""
  // For /src/modules/auth/islands/ -> namespace is "modules/auth"
  let namespace = "";
  if (!isDefault) {
    const parentDir = dirname(relativeFromSrc);
    namespace = parentDir.replace(/\\/g, "/");
    
    // Apply custom namespace mapping if configured
    if (config.namespaces[namespace]) {
      namespace = config.namespaces[namespace];
    }
  }

  return {
    path: absolutePath,
    relativePath: relativeFromSrc.replace(/\\/g, "/"),
    namespace,
    isDefault,
  };
}

/**
 * Check if a directory is an islands directory.
 */
export function isIslandsDirectory(dirPath: string): boolean {
  return basename(dirPath) === "islands";
}

/**
 * Get the default islands directory path.
 */
export function getDefaultIslandsPath(projectRoot: string, rootDir = "src"): string {
  return resolve(projectRoot, rootDir, "islands");
}

/**
 * Check if the default islands directory exists.
 */
export async function hasDefaultIslandsDirectory(
  projectRoot: string,
  rootDir = "src"
): Promise<boolean> {
  const defaultPath = getDefaultIslandsPath(projectRoot, rootDir);
  try {
    const statResult = await fsStat(defaultPath);
    return statResult.isDirectory();
  } catch {
    return false;
  }
}


/**
 * Discover all island components within a specific islands directory.
 * 
 * @param directory - The island directory to scan
 * @param projectRoot - The root directory of the project
 * @returns Array of discovered island components
 */
export async function discoverIslandsInDirectory(
  directory: IslandDirectory,
  projectRoot: string
): Promise<DiscoveredIsland[]> {
  const islands: DiscoveredIsland[] = [];

  try {
    const entries = await readdir(directory.path, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = extname(entry.name);
      if (!isSupportedIslandExtension(ext)) continue;

      const island = createDiscoveredIsland(
        entry.name,
        directory,
        projectRoot
      );
      islands.push(island);
    }
  } catch (error) {
    console.warn(
      `Warning: Could not scan islands directory ${directory.path}:`,
      error
    );
  }

  // Sort islands alphabetically by name
  islands.sort((a, b) => a.name.localeCompare(b.name));

  return islands;
}

/**
 * Discover all islands across all directories.
 * 
 * @param projectRoot - The root directory of the project
 * @param config - Optional configuration for discovery
 * @returns Array of all discovered island components
 */
export async function discoverAllIslands(
  projectRoot: string,
  config: IslandDiscoveryConfig = {}
): Promise<DiscoveredIsland[]> {
  const directories = await discoverIslandDirectories(projectRoot, config);
  const allIslands: DiscoveredIsland[] = [];

  for (const directory of directories) {
    const islands = await discoverIslandsInDirectory(directory, projectRoot);
    allIslands.push(...islands);
  }

  return allIslands;
}

/**
 * Create a DiscoveredIsland object from a file entry.
 */
function createDiscoveredIsland(
  fileName: string,
  directory: IslandDirectory,
  projectRoot: string
): DiscoveredIsland {
  const ext = extname(fileName);
  const name = extractComponentName(fileName);
  const filePath = resolve(directory.path, fileName);
  const relativePath = relative(projectRoot, filePath).replace(/\\/g, "/");
  const framework = detectFrameworkFromFileName(fileName);

  return {
    name,
    filePath,
    relativePath,
    namespace: directory.namespace,
    framework,
    extension: ext,
    directory,
  };
}

/**
 * Extract the component name from a file name.
 * Handles framework-specific naming conventions like .solid.tsx, .react.tsx
 */
function extractComponentName(fileName: string): string {
  // Remove extension
  const name = fileName;
  
  // Handle double extensions like .solid.tsx, .react.tsx, .lit.ts
  const frameworkPatterns = [
    ".solid.tsx", ".solid.jsx",
    ".react.tsx", ".react.jsx",
    ".lit.ts", ".lit.js",
    ".preact.tsx", ".preact.jsx",
  ];
  
  for (const pattern of frameworkPatterns) {
    if (name.endsWith(pattern)) {
      return name.slice(0, -pattern.length);
    }
  }
  
  // Handle single extensions
  const singleExtensions = [".tsx", ".ts", ".jsx", ".js", ".vue", ".svelte"];
  for (const ext of singleExtensions) {
    if (name.endsWith(ext)) {
      return name.slice(0, -ext.length);
    }
  }
  
  return name;
}

/**
 * Detect the framework from a file name based on extension and naming conventions.
 */
function detectFrameworkFromFileName(fileName: string): Framework {
  const normalizedName = fileName.toLowerCase();
  
  // Check for framework-specific naming conventions
  if (normalizedName.includes(".solid.")) return "solid";
  if (normalizedName.includes(".react.")) return "react";
  if (normalizedName.includes(".lit.")) return "lit";
  if (normalizedName.includes(".preact.")) return "preact";
  
  // Check file extensions
  if (fileName.endsWith(".vue")) return "vue";
  if (fileName.endsWith(".svelte")) return "svelte";
  
  // Lit files by naming convention (files starting with uppercase in .ts/.js)
  if ((fileName.endsWith(".ts") || fileName.endsWith(".js")) && 
      !fileName.endsWith(".d.ts")) {
    // Check if it looks like a component (PascalCase)
    const baseName = extractComponentName(fileName);
    if (/^[A-Z]/.test(baseName)) {
      return "lit";
    }
  }
  
  // Default to preact for .tsx/.jsx files
  if (fileName.endsWith(".tsx") || fileName.endsWith(".jsx")) {
    return "preact";
  }
  
  return "unknown";
}

/**
 * Get the qualified name for an island (namespace/name or just name for default).
 */
export function getQualifiedIslandName(island: DiscoveredIsland): string {
  if (island.namespace === "") {
    return island.name;
  }
  return `${island.namespace}/${island.name}`;
}

/**
 * Parse a qualified island name into namespace and name parts.
 */
export function parseQualifiedIslandName(qualifiedName: string): {
  namespace: string;
  name: string;
} {
  const lastSlashIndex = qualifiedName.lastIndexOf("/");
  if (lastSlashIndex === -1) {
    return { namespace: "", name: qualifiedName };
  }
  return {
    namespace: qualifiedName.slice(0, lastSlashIndex),
    name: qualifiedName.slice(lastSlashIndex + 1),
  };
}
