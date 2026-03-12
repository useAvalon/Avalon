/**
 * Auto-Discovery for Avalon Vite Plugin
 *
 * This module handles automatic discovery of framework integrations
 * based on island prop usage in pages and layouts. It scans for components
 * used with the `island` prop and detects their framework from file extensions
 * and content.
 */

import type { IntegrationName } from "./types.ts";
import { resolve } from "node:path";
import { stat as fsStat, readdir, readFile } from "node:fs/promises";
import { openSync, readSync, closeSync } from "node:fs";

/**
 * File extension to integration name mapping
 * Maps file extensions and naming conventions to their corresponding integration
 */
const EXTENSION_TO_INTEGRATION: Record<string, IntegrationName> = {
  // Vue
  ".vue": "vue",
  // Svelte
  ".svelte": "svelte",
};

/**
 * Framework-specific naming patterns (e.g., .solid.tsx, .lit.ts)
 * These take priority over generic extensions
 */
const FRAMEWORK_NAMING_PATTERNS: Array<{
  pattern: RegExp;
  integration: IntegrationName;
}> = [
  { pattern: /\.solid\.(tsx|jsx)$/, integration: "solid" },
  { pattern: /\.react\.(tsx|jsx)$/, integration: "react" },
  { pattern: /\.lit\.(ts|js)$/, integration: "lit" },
  { pattern: /\.preact\.(tsx|jsx)$/, integration: "preact" },
];

/**
 * Content-based detection patterns for JSX/TSX files
 * These patterns detect framework usage from file content
 */
const CONTENT_DETECTION_PATTERNS: Array<{
  pattern: RegExp;
  integration: IntegrationName;
}> = [
  // React detection: imports from 'react' or @jsxImportSource react
  { pattern: /from\s+['"]react['"]/, integration: "react" },
  { pattern: /@jsxImportSource\s+react/, integration: "react" },
  // Solid detection: imports from 'solid-js' or @jsxImportSource solid-js
  { pattern: /from\s+['"]solid-js['"]/, integration: "solid" },
  { pattern: /@jsxImportSource\s+solid-js/, integration: "solid" },
  // Preact detection: imports from 'preact' or @jsxImportSource preact
  { pattern: /from\s+['"]preact['"]/, integration: "preact" },
  { pattern: /@jsxImportSource\s+preact/, integration: "preact" },
];

/**
 * Default integration for generic JSX/TSX files
 * When a .tsx or .jsx file doesn't have a framework-specific naming convention
 * or detectable imports, we default to preact as per Avalon's conventions
 */
const DEFAULT_JSX_INTEGRATION: IntegrationName = "preact";

/**
 * Supported file extensions for island components
 */
const SUPPORTED_EXTENSIONS = [
  ".tsx",
  ".jsx",
  ".ts",
  ".js",
  ".vue",
  ".svelte",
];

/**
 * Discover integrations from files in the islands directory
 *
 * Scans the specified directory for component files and determines
 * which framework integrations are needed based on file extensions
 * and naming conventions.
 *
 * @param islandsDir - Path to the islands directory (relative or absolute)
 * @param projectRoot - Optional project root for resolving relative paths
 * @returns Set of discovered integration names
 *
 * @example
 * ```ts
 * const integrations = await discoverIntegrationsFromFiles("src/islands");
 * // Returns Set { "vue", "svelte", "preact" } based on files found
 * ```
 */
export async function discoverIntegrationsFromFiles(
  islandsDir: string,
  projectRoot?: string
): Promise<Set<IntegrationName>> {
  // Resolve the islands directory path
  const resolvedDir = projectRoot
    ? resolve(projectRoot, islandsDir)
    : resolve(islandsDir);

  // Check if directory exists
  try {
    const statResult = await fsStat(resolvedDir);
    if (!statResult.isDirectory()) {
      return new Set();
    }
  } catch {
    return new Set();
  }

  const discovered = new Set<IntegrationName>();
  await scanDirectoryForIntegrations(resolvedDir, discovered);
  return discovered;
}

/**
 * Recursively scan a directory for component files
 *
 * @param dirPath - Directory path to scan
 * @param discovered - Set to add discovered integrations to
 */
async function scanDirectoryForIntegrations(
  dirPath: string,
  discovered: Set<IntegrationName>
): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectoryForIntegrations(fullPath, discovered);
      } else if (entry.isFile()) {
        // Check if this is a supported component file
        const integration = await detectIntegrationFromFile(fullPath, entry.name);
        if (integration) {
          discovered.add(integration);
        }
      }
    }
  } catch (error) {
    // Log but don't fail on permission errors or other issues
    if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== 'EACCES') {
      console.warn(`Warning: Could not scan directory ${dirPath}:`, error);
    }
  }
}

function detectIntegrationFromContent(filePath: string): IntegrationName {
  try {
    const fd = openSync(filePath, 'r');
    const buffer = Buffer.alloc(500);
    readSync(fd, buffer, 0, 500, 0);
    closeSync(fd);
    const content = buffer.toString('utf-8');
    for (const { pattern, integration } of CONTENT_DETECTION_PATTERNS) {
      if (pattern.test(content)) return integration;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_JSX_INTEGRATION;
}

/**
 * Detect the integration from a file by checking name patterns and content
 *
 * @param filePath - Full path to the file
 * @param fileName - The file name
 * @returns The integration name or null if not a supported component file
 */
async function detectIntegrationFromFile(
  filePath: string,
  fileName: string
): Promise<IntegrationName | null> {
  const normalizedName = fileName.toLowerCase();

  // First, check for framework-specific naming patterns (highest priority)
  for (const { pattern, integration } of FRAMEWORK_NAMING_PATTERNS) {
    if (pattern.test(normalizedName)) {
      return integration;
    }
  }

  // Second, check for unique file extensions (.vue, .svelte)
  for (const [ext, integration] of Object.entries(EXTENSION_TO_INTEGRATION)) {
    if (normalizedName.endsWith(ext)) {
      return integration;
    }
  }

  // Third, for JSX/TSX files, read content to detect framework
  if (normalizedName.endsWith(".tsx") || normalizedName.endsWith(".jsx")) {
    return detectIntegrationFromContent(filePath);
  }

  // Fourth, check for Lit components (.ts/.js files with PascalCase names)
  if (
    (normalizedName.endsWith(".ts") || normalizedName.endsWith(".js")) &&
    !normalizedName.endsWith(".d.ts")
  ) {
    // Check if the original filename (not lowercased) starts with uppercase
    // This indicates a component file (PascalCase convention)
    if (/^[A-Z]/.test(fileName)) {
      return "lit";
    }
  }

  // Not a supported component file
  return null;
}

/**
 * Detect the integration name from a file name
 *
 * Uses file extensions and naming conventions to determine
 * which framework integration a component file belongs to.
 *
 * @param fileName - The file name to analyze
 * @returns The integration name or null if not a supported component file
 *
 * @example
 * ```ts
 * detectIntegrationFromFileName("Counter.vue") // "vue"
 * detectIntegrationFromFileName("Button.svelte") // "svelte"
 * detectIntegrationFromFileName("Card.solid.tsx") // "solid"
 * detectIntegrationFromFileName("Form.tsx") // "preact" (default)
 * detectIntegrationFromFileName("styles.css") // null
 * ```
 */
export function detectIntegrationFromFileName(
  fileName: string
): IntegrationName | null {
  const normalizedName = fileName.toLowerCase();

  // First, check for framework-specific naming patterns (highest priority)
  for (const { pattern, integration } of FRAMEWORK_NAMING_PATTERNS) {
    if (pattern.test(normalizedName)) {
      return integration;
    }
  }

  // Second, check for unique file extensions (.vue, .svelte)
  for (const [ext, integration] of Object.entries(EXTENSION_TO_INTEGRATION)) {
    if (normalizedName.endsWith(ext)) {
      return integration;
    }
  }

  // Third, check for generic JSX/TSX files (default to preact)
  if (normalizedName.endsWith(".tsx") || normalizedName.endsWith(".jsx")) {
    return DEFAULT_JSX_INTEGRATION;
  }

  // Fourth, check for Lit components (.ts/.js files with PascalCase names)
  if (
    (normalizedName.endsWith(".ts") || normalizedName.endsWith(".js")) &&
    !normalizedName.endsWith(".d.ts")
  ) {
    // Check if the original filename (not lowercased) starts with uppercase
    // This indicates a component file (PascalCase convention)
    if (/^[A-Z]/.test(fileName)) {
      return "lit";
    }
  }

  // Not a supported component file
  return null;
}

/**
 * Check if a file extension is supported for island components
 *
 * @param extension - The file extension (including the dot)
 * @returns True if the extension is supported
 */
export function isSupportedExtension(extension: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(extension.toLowerCase());
}

/**
 * Get all supported file extensions
 *
 * @returns Array of supported file extensions
 */
export function getSupportedExtensions(): readonly string[] {
  return SUPPORTED_EXTENSIONS;
}

/**
 * Discover integrations by scanning pages and layouts for island prop usage.
 * 
 * This function scans page and layout files for components used with the `island` prop,
 * then resolves the import paths to detect which frameworks are needed.
 * 
 * @param pagesDir - Path to the pages directory
 * @param layoutsDir - Path to the layouts directory
 * @param projectRoot - Optional project root for resolving relative paths
 * @returns Set of discovered integration names
 */
export async function discoverIntegrationsFromIslandUsage(
  pagesDir: string,
  layoutsDir: string,
  projectRoot?: string
): Promise<Set<IntegrationName>> {
  const discovered = new Set<IntegrationName>();
  const root = projectRoot ?? process.cwd();
  
  // Scan both pages and layouts directories
  const dirsToScan = [
    resolve(root, pagesDir),
    resolve(root, layoutsDir),
  ];
  
  for (const dir of dirsToScan) {
    try {
      const statResult = await fsStat(dir);
      if (statResult.isDirectory()) {
        await scanForIslandUsage(dir, root, discovered);
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }
  
  return discovered;
}

/**
 * Recursively scan a directory for files that use the island prop
 */
async function scanForIslandUsage(
  dirPath: string,
  projectRoot: string,
  discovered: Set<IntegrationName>
): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = resolve(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        await scanForIslandUsage(fullPath, projectRoot, discovered);
      } else if (entry.isFile() && isPageOrLayoutFile(entry.name)) {
        await extractIslandIntegrations(fullPath, projectRoot, discovered);
      }
    }
  } catch (error) {
    // Log but don't fail
    if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== 'EACCES') {
      // Silently skip inaccessible directories
    }
  }
}

/**
 * Check if a file is a page or layout file that might contain island usage
 */
function isPageOrLayoutFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith('.tsx') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.mdx')
  );
}

/**
 * Extract integrations from a file by finding island prop usage and resolving imports
 */
async function extractIslandIntegrations(
  filePath: string,
  projectRoot: string,
  discovered: Set<IntegrationName>
): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf-8');
    
    // Find all imports
    const importMap = parseImports(content);
    
    // Find components used with island prop
    const islandComponents = findIslandPropUsage(content);
    
    // For each island component, resolve its import and detect framework
    for (const componentName of islandComponents) {
      const importPath = importMap.get(componentName);
      if (!importPath) continue;
      
      // Resolve the import path to an actual file
      const resolvedPath = resolveImportPath(importPath, filePath, projectRoot);
      if (!resolvedPath) continue;
      
      // Detect framework from the resolved file
      const integration = await detectIntegrationFromResolvedPath(resolvedPath);
      if (integration) {
        discovered.add(integration);
      }
    }
  } catch {
    // Skip files that can't be read
  }
}

/**
 * Parse import statements from file content
 * Returns a map of component name -> import path
 */
function parseImports(content: string): Map<string, string> {
  const imports = new Map<string, string>();
  
  // Match: import ComponentName from 'path'
  const defaultImportRe = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = defaultImportRe.exec(content)) !== null) {
    imports.set(match[1], match[2]);
  }
  
  // Match: import { ComponentName } from 'path' or import { ComponentName as Alias } from 'path'
  const namedImportRe = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  
  while ((match = namedImportRe.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim());
    const importPath = match[2];
    
    for (const name of names) {
      // Handle "Name as Alias" syntax
      const asMatch = name.match(/(\w+)\s+as\s+(\w+)/);
      if (asMatch) {
        imports.set(asMatch[2], importPath); // Use alias as key
      } else if (name) {
        imports.set(name, importPath);
      }
    }
  }
  
  return imports;
}

/**
 * Find component names that are used with the island prop
 */
function findIslandPropUsage(content: string): Set<string> {
  const components = new Set<string>();
  
  // Match: <ComponentName ... island={...} or <ComponentName ... island ...
  // This regex finds JSX elements with an island prop
  const islandUsageRe = /<([A-Z]\w*)\s+[^>]*\bisland\b/g;
  let match;
  
  while ((match = islandUsageRe.exec(content)) !== null) {
    components.add(match[1]);
  }
  
  return components;
}

/**
 * Resolve an import path to an actual file path
 */
function resolveImportPath(
  importPath: string,
  fromFile: string,
  projectRoot: string
): string | null {
  // Handle relative imports
  if (importPath.startsWith('.')) {
    const dir = resolve(fromFile, '..');
    return resolve(dir, importPath);
  }
  
  // Handle alias imports (common patterns)
  const aliasPatterns: Array<{ prefix: string; replacement: string }> = [
    { prefix: '@/', replacement: 'src/' },
    { prefix: '$components/', replacement: 'src/components/' },
    { prefix: '$islands/', replacement: 'src/islands/' },
    { prefix: '~/', replacement: 'src/' },
  ];
  
  for (const { prefix, replacement } of aliasPatterns) {
    if (importPath.startsWith(prefix)) {
      const relativePath = importPath.slice(prefix.length);
      return resolve(projectRoot, replacement, relativePath);
    }
  }
  
  // Handle absolute imports from src
  if (importPath.startsWith('/src/')) {
    return resolve(projectRoot, importPath.slice(1));
  }
  
  // Can't resolve - might be a node_modules import
  return null;
}

/**
 * Detect integration from a resolved file path
 */
async function detectIntegrationFromResolvedPath(
  filePath: string
): Promise<IntegrationName | null> {
  // Try with common extensions if no extension provided
  const extensions = ['', '.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte'];
  
  for (const ext of extensions) {
    const fullPath = filePath + ext;
    try {
      const statResult = await fsStat(fullPath);
      if (statResult.isFile()) {
        const fileName = fullPath.split('/').pop() || '';
        return detectIntegrationFromFile(fullPath, fileName);
      }
    } catch {
      // Try next extension
    }
  }
  
  return null;
}
