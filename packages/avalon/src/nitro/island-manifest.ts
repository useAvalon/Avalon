/**
 * Island Manifest Generation Module for Nitro
 *
 * This module provides island manifest generation during production builds.
 * The manifest contains information about all discovered islands, their
 * compiled asset paths, and framework metadata for client-side hydration.
 *
 * ## Build Output
 *
 * During production build, this module generates:
 * - `island-manifest.json` in the build output directory
 * - Contains metadata for all islands (src, framework, css, preload)
 * - Includes build timestamp and content hashes for cache busting
 * - Generates preload hints for critical assets
 *
 * ## Nitro Integration
 *
 * The manifest is used by Nitro's renderer to:
 * - Resolve compiled island paths for hydration scripts
 * - Inject CSS assets for islands used on a page
 * - Generate preload tags for critical resources
 *
 * ## Asset Metadata
 *
 * Each island entry includes:
 * - `src`: Compiled JavaScript path (e.g., `/islands/Counter.abc123.js`)
 * - `framework`: Detected framework (react, preact, vue, svelte, solid, lit)
 * - `css`: Associated CSS files
 * - `contentHash`: Hash for cache busting
 * - `preloadDeps`: Dependencies to preload
 *
 * @module nitro/island-manifest
 */

import type { Plugin } from "vite";
import type { ResolvedAvalonConfig } from "../vite-plugin/types.ts";
import type { IslandManifest, IslandEntry } from "./types.ts";

/**
 * Extended island entry with build-time metadata
 */
export interface BuildIslandEntry extends IslandEntry {
  /** Original source file path */
  sourcePath: string;
  /** Compiled JavaScript chunk name */
  chunkName: string;
  /** Content hash for cache busting */
  contentHash: string;
  /** Dependencies that need to be preloaded */
  preloadDeps: string[];
  /** Whether the island uses streaming */
  usesStreaming: boolean;
}

/**
 * Asset metadata for Nitro's asset manifest format
 * This matches Nitro's expected asset metadata structure
 */
export interface AssetMetadata {
  /** MIME type of the asset */
  type: string;
  /** ETag for cache validation */
  etag: string;
  /** Last modification time (ISO string) */
  mtime: string;
  /** File size in bytes */
  size: number;
}

/**
 * Build-time island manifest with additional metadata
 */
export interface BuildIslandManifest extends IslandManifest {
  /** Build timestamp */
  buildTime: number;
  /** Build version/hash */
  buildHash: string;
  /** Avalon version */
  avalonVersion: string;
  /** All CSS assets to inject */
  cssAssets: string[];
  /** Preload hints for critical assets */
  preloadHints: PreloadHint[];
  /** Framework-specific bundles */
  frameworkBundles: Record<string, string>;
  /** Asset metadata for cache headers (Nitro format) */
  assetMetadata?: Record<string, AssetMetadata>;
}

/**
 * Preload hint for resource optimization
 */
export interface PreloadHint {
  /** Resource URL */
  href: string;
  /** Resource type (script, style, font, etc.) */
  as: "script" | "style" | "font" | "image";
  /** MIME type */
  type?: string;
  /** Cross-origin setting */
  crossorigin?: "anonymous" | "use-credentials";
}

/**
 * Options for island manifest generation
 */
export interface IslandManifestOptions {
  /** Output path for the manifest file */
  outputPath?: string;
  /** Include source maps in manifest */
  includeSourceMaps?: boolean;
  /** Generate preload hints */
  generatePreloadHints?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Default manifest generation options
 */
export const DEFAULT_MANIFEST_OPTIONS: Required<IslandManifestOptions> = {
  outputPath: "dist/island-manifest.json",
  includeSourceMaps: false,
  generatePreloadHints: true,
  verbose: false,
};

/**
 * Framework detection patterns for island files
 */
const FRAMEWORK_PATTERNS: Record<string, RegExp[]> = {
  react: [
    /from\s+['"]react['"]/,
    /from\s+['"]react-dom['"]/,
    /@jsxImportSource\s+react/,
  ],
  preact: [
    /from\s+['"]preact['"]/,
    /from\s+['"]preact\/hooks['"]/,
    /@jsxImportSource\s+preact/,
  ],
  vue: [
    /from\s+['"]vue['"]/,
    /\.vue$/,
  ],
  svelte: [
    /from\s+['"]svelte['"]/,
    /\.svelte$/,
  ],
  solid: [
    /from\s+['"]solid-js['"]/,
    /\.solid\.(tsx|jsx)$/,
  ],
  lit: [
    /from\s+['"]lit['"]/,
    /from\s+['"]@lit['"]/,
    /\.lit\.(ts|js)$/,
  ],
};

/**
 * Detects the framework used by an island based on file content and extension
 *
 * @param filePath - Path to the island file
 * @param content - File content
 * @returns Detected framework name
 */
export function detectIslandFramework(
  filePath: string,
  content: string
): string {
  // Check file extension first
  if (filePath.endsWith(".vue")) return "vue";
  if (filePath.endsWith(".svelte")) return "svelte";
  if (filePath.includes(".solid.")) return "solid";
  if (filePath.includes(".lit.")) return "lit";

  // Check content patterns
  for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content) || pattern.test(filePath)) {
        return framework;
      }
    }
  }

  // Default to preact for JSX/TSX files
  if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) {
    return "preact";
  }

  return "unknown";
}

/**
 * Generates a content hash for cache busting
 *
 * @param content - Content to hash
 * @returns Short hash string
 */
export async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex.slice(0, 8);
}

/**
 * Extracts dependencies from island file content
 *
 * @param content - File content
 * @returns Array of dependency names
 */
export function extractIslandDependencies(content: string): string[] {
  const deps: string[] = [];
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;

  // Static imports
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      deps.push(importPath);
    }
  }

  // Dynamic imports
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      deps.push(importPath);
    }
  }

  return [...new Set(deps)];
}

/**
 * Creates an island entry from discovered island information
 *
 * @param name - Island name
 * @param sourcePath - Source file path
 * @param content - File content
 * @param compiledPath - Compiled asset path
 * @returns Island entry
 */
export async function createIslandEntry(
  name: string,
  sourcePath: string,
  content: string,
  compiledPath: string
): Promise<BuildIslandEntry> {
  const framework = detectIslandFramework(sourcePath, content);
  const contentHash = await generateContentHash(content);
  const deps = extractIslandDependencies(content);

  return {
    src: compiledPath,
    framework,
    css: [], // Will be populated during build
    preload: deps.filter((d) => !d.includes("/")), // Only top-level packages
    sourcePath,
    chunkName: name,
    contentHash,
    preloadDeps: [],
    usesStreaming: false,
  };
}

/**
 * Generates preload hints for critical assets
 *
 * @param manifest - Island manifest
 * @returns Array of preload hints
 */
export function generatePreloadHints(
  manifest: Partial<BuildIslandManifest>
): PreloadHint[] {
  const hints: PreloadHint[] = [];

  // Add client entry script
  if (manifest.clientEntry) {
    hints.push({
      href: manifest.clientEntry,
      as: "script",
      type: "text/javascript",
    });
  }

  // Add CSS assets
  for (const css of manifest.css ?? []) {
    hints.push({
      href: css,
      as: "style",
      type: "text/css",
    });
  }

  // Add framework bundles
  for (const bundle of Object.values(manifest.frameworkBundles ?? {})) {
    hints.push({
      href: bundle,
      as: "script",
      type: "text/javascript",
    });
  }

  return hints;
}

/**
 * Creates a Vite plugin for island manifest generation
 *
 * @param avalonConfig - Resolved Avalon configuration
 * @param options - Manifest generation options
 * @returns Vite plugin
 */
export function createIslandManifestPlugin(
  avalonConfig: ResolvedAvalonConfig,
  options: IslandManifestOptions = {}
): Plugin {
  const opts = { ...DEFAULT_MANIFEST_OPTIONS, ...options };
  const islands: Map<string, BuildIslandEntry> = new Map();
  const cssAssets: Set<string> = new Set();
  let clientEntry = "";

  return {
    name: "avalon:island-manifest",
    enforce: "post",

    // Track island chunks during build
    generateBundle(_outputOptions, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        // Track CSS assets
        if (fileName.endsWith(".css")) {
          cssAssets.add(`/${fileName}`);
        }

        // Track client entry
        if (
          chunk.type === "chunk" &&
          (chunk.name === "client" || chunk.name === "main")
        ) {
          clientEntry = `/${fileName}`;
        }

        // Track island chunks
        if (
          chunk.type === "chunk" &&
          (chunk.facadeModuleId?.includes("/islands/") ||
            chunk.name?.startsWith("islands/"))
        ) {
          const name = chunk.name?.replace("islands/", "") ?? fileName;
          const existingEntry = islands.get(name);

          if (existingEntry) {
            // Update with compiled path
            existingEntry.src = `/${fileName}`;
          } else {
            // Create new entry
            islands.set(name, {
              src: `/${fileName}`,
              framework: detectFrameworkFromChunk(chunk),
              css: [],
              preload: [],
              sourcePath: chunk.facadeModuleId ?? "",
              chunkName: name,
              contentHash: fileName.match(/\.([a-f0-9]+)\.js$/)?.[1] ?? "",
              preloadDeps: chunk.imports ?? [],
              usesStreaming: false,
            });
          }
        }
      }
    },

    // Write manifest after build
    async writeBundle(_options: unknown, bundle: Record<string, { type: string; source?: string | Uint8Array; code?: string }>) {
      // Generate asset metadata for Nitro's format (type, etag, mtime, size)
      const assetMetadata: Record<string, AssetMetadata> = {};
      const buildTime = new Date().toISOString();
      
      for (const [fileName, chunk] of Object.entries(bundle)) {
        // Get the content for size and etag calculation
        let content: string | Uint8Array | undefined;
        if (chunk.type === "asset" && chunk.source) {
          content = chunk.source;
        } else if (chunk.type === "chunk" && chunk.code) {
          content = chunk.code;
        }
        
        if (content) {
          const size = typeof content === "string" 
            ? new TextEncoder().encode(content).length 
            : content.length;
          const contentStr = typeof content === "string" 
            ? content 
            : new TextDecoder().decode(content);
          const etag = await generateContentHash(contentStr);
          
          // Determine MIME type from extension
          const ext = fileName.substring(fileName.lastIndexOf("."));
          const mimeTypes: Record<string, string> = {
            ".js": "application/javascript",
            ".mjs": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".html": "text/html",
            ".map": "application/json",
          };
          
          assetMetadata[`/${fileName}`] = {
            type: mimeTypes[ext] || "application/octet-stream",
            etag: `"${etag}"`,
            mtime: buildTime,
            size,
          };
        }
      }

      const manifest: BuildIslandManifest = {
        islands: Object.fromEntries(islands),
        clientEntry,
        css: Array.from(cssAssets),
        buildTime: Date.now(),
        buildHash: await generateContentHash(JSON.stringify(Object.fromEntries(islands))),
        avalonVersion: "1.0.0",
        cssAssets: Array.from(cssAssets),
        preloadHints: opts.generatePreloadHints
          ? generatePreloadHints({
              clientEntry,
              css: Array.from(cssAssets),
              islands: Object.fromEntries(islands),
            })
          : [],
        frameworkBundles: {},
        assetMetadata,
      };

      // Write manifest file
      const manifestJson = JSON.stringify(manifest, null, 2);
      
      if (opts.verbose) {
        console.log("📋 Island manifest generated:");
        console.log(`   Islands: ${islands.size}`);
        console.log(`   CSS assets: ${cssAssets.size}`);
        console.log(`   Client entry: ${clientEntry}`);
        console.log(`   Asset metadata entries: ${Object.keys(assetMetadata).length}`);
      }

      // Emit the manifest as an asset
      this.emitFile({
        type: "asset",
        fileName: "island-manifest.json",
        source: manifestJson,
      });
    },
  };
}

/**
 * Detects framework from a Rollup chunk
 *
 * @param chunk - Rollup output chunk
 * @returns Detected framework name
 */
function detectFrameworkFromChunk(chunk: {
  facadeModuleId?: string | null;
  code?: string;
}): string {
  const filePath = chunk.facadeModuleId ?? "";
  const content = chunk.code ?? "";

  return detectIslandFramework(filePath, content);
}

/**
 * Loads an existing island manifest from disk
 *
 * @param manifestPath - Path to the manifest file
 * @returns Loaded manifest or null if not found
 */
export async function loadIslandManifest(
  manifestPath: string = "dist/island-manifest.json"
): Promise<BuildIslandManifest | null> {
  try {
    const content = await Deno.readTextFile(manifestPath);
    return JSON.parse(content) as BuildIslandManifest;
  } catch {
    return null;
  }
}

/**
 * Gets the compiled asset path for an island
 *
 * @param islandName - Name of the island
 * @param manifest - Island manifest
 * @returns Compiled asset path or null if not found
 */
export function getIslandAssetPath(
  islandName: string,
  manifest: BuildIslandManifest | null
): string | null {
  if (!manifest) return null;

  const entry = manifest.islands[islandName];
  return entry?.src ?? null;
}

/**
 * Gets all CSS assets that should be injected for a page
 *
 * @param islandNames - Names of islands used on the page
 * @param manifest - Island manifest
 * @returns Array of CSS asset paths
 */
export function getPageCssAssets(
  islandNames: string[],
  manifest: BuildIslandManifest | null
): string[] {
  if (!manifest) return [];

  const cssAssets = new Set<string>();

  // Add global CSS
  for (const css of manifest.css) {
    cssAssets.add(css);
  }

  // Add island-specific CSS
  for (const name of islandNames) {
    const entry = manifest.islands[name];
    if (entry?.css) {
      for (const css of entry.css) {
        cssAssets.add(css);
      }
    }
  }

  return Array.from(cssAssets);
}

/**
 * Generates HTML preload tags for critical assets
 *
 * @param manifest - Island manifest
 * @returns HTML string with preload tags
 */
export function generatePreloadTags(manifest: BuildIslandManifest): string {
  const tags: string[] = [];

  for (const hint of manifest.preloadHints) {
    const attrs = [
      `rel="preload"`,
      `href="${hint.href}"`,
      `as="${hint.as}"`,
    ];

    if (hint.type) {
      attrs.push(`type="${hint.type}"`);
    }

    if (hint.crossorigin) {
      attrs.push(`crossorigin="${hint.crossorigin}"`);
    }

    tags.push(`<link ${attrs.join(" ")}>`);
  }

  return tags.join("\n");
}
