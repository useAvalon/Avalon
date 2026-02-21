/**
 * SSR Pre-compilation System
 * 
 * This module provides build-time SSR compilation for island components.
 * It solves the issue where Vite's SSR module loading in Deno doesn't
 * properly apply framework plugin transforms (Vue, Solid, React, Svelte).
 * 
 * The approach:
 * 1. During dev server startup, pre-compile all island components using Vite's transform pipeline
 * 2. Store the compiled JavaScript in a cache (memory or disk)
 * 3. During SSR, load from cache instead of using runtime transforms
 * 
 * This bypasses the Vite/Deno SSR transform issue by doing transforms at startup time
 * when the full Vite plugin pipeline is available.
 */

import type { ViteDevServer } from 'vite';
import { join } from 'node:path';
import { readFile as fsReadFile, readdir, writeFile, rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

/**
 * Cache entry for a pre-compiled SSR module
 */
export interface SSRCacheEntry {
  /** Original source path */
  src: string;
  /** Compiled JavaScript code */
  code: string;
  /** Source map (if available) */
  map?: string;
  /** Framework that compiled this module */
  framework: string;
  /** Timestamp when compiled */
  compiledAt: number;
  /** Hash of source content for invalidation */
  sourceHash: string;
}

/**
 * SSR compilation cache
 */
export interface SSRCache {
  /** Map of source path to cache entry */
  entries: Map<string, SSRCacheEntry>;
  /** Whether the cache is initialized */
  initialized: boolean;
  /** Vite server reference for recompilation */
  viteServer?: ViteDevServer;
}

// Global SSR cache instance
let ssrCache: SSRCache = {
  entries: new Map(),
  initialized: false,
};

/**
 * Get the global SSR cache
 */
export function getSSRCache(): SSRCache {
  return ssrCache;
}

/**
 * Reset the SSR cache (useful for testing)
 */
export function resetSSRCache(): void {
  ssrCache = {
    entries: new Map(),
    initialized: false,
  };
}

/**
 * Generate a hash for source content
 */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Detect framework from file path and content
 */
function detectFramework(filePath: string, content: string): string {
  // Check file extension first
  if (filePath.endsWith('.vue')) return 'vue';
  if (filePath.endsWith('.svelte')) return 'svelte';
  if (filePath.includes('.solid.')) return 'solid';
  if (filePath.includes('.lit.')) return 'lit';
  
  // Check content for framework imports
  if (content.includes('solid-js')) return 'solid';
  if (content.includes('from "vue"') || content.includes("from 'vue'")) return 'vue';
  if (content.includes('from "react"') || content.includes("from 'react'")) return 'react';
  if (content.includes('from "preact"') || content.includes("from 'preact'")) return 'preact';
  if (content.includes('from "lit"') || content.includes("from 'lit'")) return 'lit';
  
  // Default to preact for JSX/TSX
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) return 'preact';
  
  return 'unknown';
}

/**
 * Normalize path for Vite transform
 */
function normalizePathForTransform(src: string): string {
  let normalized = src;
  
  // Ensure path starts with /
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // Convert /islands/ to /src/islands/ if needed
  if (normalized.startsWith('/islands/')) {
    normalized = normalized.replace('/islands/', '/src/islands/');
  }
  
  return normalized;
}

/**
 * Compile a Vue SFC directly using @vue/compiler-sfc
 * 
 * This bypasses the Vite plugin system and compiles the SFC directly.
 * The result is JavaScript code that can be executed for SSR.
 * 
 * @param source - The Vue SFC source code
 * @param filename - The filename for error reporting
 * @param id - The module ID for imports
 * @returns Compiled JavaScript code or null if compilation failed
 */
async function compileVueSFC(
  source: string,
  filename: string,
  id: string
): Promise<{ code: string; map?: unknown } | null> {
  try {
    // Dynamically import @vue/compiler-sfc
    const { parse, compileScript, compileTemplate, rewriteDefault } = await import('@vue/compiler-sfc');
    
    // Parse the SFC
    const { descriptor, errors } = parse(source, {
      filename,
      sourceMap: true,
    });
    
    if (errors.length > 0) {
      console.error(`[vue-sfc] Parse errors:`, errors);
      return null;
    }
    
    const scopeId = `data-v-${hashId(id)}`;
    let code = '';
    
    // Compile the script block
    let scriptCode = '';
    let bindings: Record<string, unknown> = {};
    
    // Check if script uses TypeScript
    const isTS = descriptor.script?.lang === 'ts' || 
                 descriptor.script?.lang === 'tsx' ||
                 descriptor.scriptSetup?.lang === 'ts' ||
                 descriptor.scriptSetup?.lang === 'tsx';
    
    if (descriptor.script || descriptor.scriptSetup) {
      const scriptResult = compileScript(descriptor, {
        id: scopeId,
        inlineTemplate: true,
        templateOptions: {
          compilerOptions: {
            isCustomElement: (tag: string) => tag === 'is-land',
          },
        },
        // Enable TypeScript support
        babelParserPlugins: isTS ? ['typescript'] : undefined,
      });
      
      scriptCode = scriptResult.content;
      bindings = scriptResult.bindings || {};
      
      // Handle default export
      if (scriptCode.includes('export default')) {
        scriptCode = rewriteDefault(scriptCode, '__sfc_main__', isTS ? ['typescript'] : undefined);
      }
    } else {
      // No script block, create empty component
      scriptCode = 'const __sfc_main__ = {};';
    }
    
    code += scriptCode + '\n';
    
    // Compile the template if not inlined
    if (descriptor.template && !descriptor.scriptSetup) {
      const templateResult = compileTemplate({
        source: descriptor.template.content,
        filename,
        id: scopeId,
        scoped: descriptor.styles.some((s: { scoped?: boolean }) => s.scoped),
        compilerOptions: {
          bindingMetadata: bindings as Record<string, string>,
          isCustomElement: (tag: string) => tag === 'is-land',
        },
      });
      
      if (templateResult.errors.length > 0) {
        console.error(`[vue-sfc] Template compilation errors:`, templateResult.errors);
        return null;
      }
      
      code += templateResult.code + '\n';
      code += '__sfc_main__.render = render;\n';
    }
    
    // Add scoped styles marker
    if (descriptor.styles.some((s: { scoped?: boolean }) => s.scoped)) {
      code += `__sfc_main__.__scopeId = "${scopeId}";\n`;
    }
    
    // Export the component
    code += 'export default __sfc_main__;\n';
    
    return { code };
  } catch (error) {
    console.error(`[vue-sfc] Compilation failed:`, error);
    return null;
  }
}

/**
 * Generate a short hash for Vue scoped styles
 */
function hashId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

/**
 * Compile Solid JSX directly using Babel with babel-preset-solid
 * 
 * This bypasses the Vite plugin system and compiles Solid JSX directly.
 * The result is JavaScript code that uses Solid's SSR functions.
 * 
 * @param source - The Solid JSX source code
 * @param filename - The filename for error reporting
 * @returns Compiled JavaScript code or null if compilation failed
 */
async function compileSolidJSX(
  source: string,
  filename: string
): Promise<{ code: string; map?: unknown } | null> {
  try {
    // Dynamically import Babel and the Solid preset
    const { transformAsync } = await import('@babel/core');
    const solidPreset = (await import('babel-preset-solid')).default;
    const tsPreset = (await import('@babel/preset-typescript')).default;
    
    // Transform with Solid preset for SSR
    const result = await transformAsync(source, {
      filename,
      presets: [
        [tsPreset, { isTSX: true, allExtensions: true }],
        [solidPreset, { 
          generate: 'ssr',  // Generate SSR-compatible code
          hydratable: true  // Make it hydratable on the client
        }]
      ],
      sourceMaps: true,
    });
    
    if (!result || !result.code) {
      console.error(`[solid-jsx] Babel transform returned no code`);
      return null;
    }
    
    return { code: result.code, map: result.map };
  } catch (error) {
    console.error(`[solid-jsx] Compilation failed:`, error);
    return null;
  }
}

/**
 * Compile React JSX directly using Babel with @babel/preset-react
 * 
 * This bypasses the Vite plugin system and compiles React JSX directly.
 * The result is JavaScript code that uses React's createElement/jsx functions.
 * 
 * @param source - The React JSX source code
 * @param filename - The filename for error reporting
 * @returns Compiled JavaScript code or null if compilation failed
 */
async function compileReactJSX(
  source: string,
  filename: string
): Promise<{ code: string; map?: unknown } | null> {
  try {
    // Dynamically import Babel and the React preset
    const { transformAsync } = await import('@babel/core');
    const reactPreset = (await import('@babel/preset-react')).default;
    const tsPreset = (await import('@babel/preset-typescript')).default;
    
    // Transform with React preset
    const result = await transformAsync(source, {
      filename,
      presets: [
        [tsPreset, { isTSX: true, allExtensions: true }],
        [reactPreset, { 
          runtime: 'automatic',  // Use the new JSX transform
          development: false     // Use production mode for SSR
        }]
      ],
      sourceMaps: true,
    });
    
    if (!result || !result.code) {
      console.error(`[react-jsx] Babel transform returned no code`);
      return null;
    }
    
    return { code: result.code, map: result.map };
  } catch (error) {
    console.error(`[react-jsx] Compilation failed:`, error);
    return null;
  }
}

/**
 * Plugin container interface with load and transform hooks
 */
interface PluginContainer {
  load: (id: string, options?: { ssr?: boolean }) => Promise<{ code: string; map?: unknown } | string | null>;
  transform: (code: string, id: string, options?: { ssr?: boolean }) => Promise<{ code: string; map?: unknown } | null>;
  resolveId: (id: string, importer?: string, options?: { ssr?: boolean }) => Promise<{ id: string } | string | null>;
}

/**
 * Pre-compile a single island component for SSR
 * 
 * Uses Vite's plugin container to transform the file directly.
 * This bypasses the environment-based transform pipeline.
 * 
 * For Vue SFCs, we need to use the `load` hook first (which compiles the SFC),
 * then apply `transform` to the result.
 * 
 * @param src - Source path to the component
 * @param viteServer - Vite dev server instance
 * @returns Cache entry or null if compilation failed
 */
export async function precompileIsland(
  src: string,
  viteServer: ViteDevServer
): Promise<SSRCacheEntry | null> {
  const normalizedPath = normalizePathForTransform(src);
  const logPrefix = `[ssr-precompile:${src}]`;
  
  console.error(`${logPrefix} Starting pre-compilation...`);
  
  try {
    // Read the source file
    let absolutePath = src;
    if (src.startsWith('/')) {
      absolutePath = src.substring(1);
    }
    if (absolutePath.startsWith('islands/')) {
      absolutePath = 'src/' + absolutePath;
    }
    
    let sourceContent: string;
    let fullPath: string;
    try {
      fullPath = absolutePath;
      sourceContent = await fsReadFile(absolutePath, 'utf-8');
    } catch {
      // Try with src/ prefix
      fullPath = 'src/' + absolutePath.replace('src/', '');
      sourceContent = await fsReadFile(fullPath, 'utf-8');
    }
    
    const sourceHash = await hashContent(sourceContent);
    const framework = detectFramework(src, sourceContent);
    
    console.error(`${logPrefix} Detected framework: ${framework}`);
    
    // Get the absolute path for the transform
    const cwd = process.cwd();
    const absoluteId = `${cwd}/${fullPath}`;
    
    // Debug: Log plugin information
    const pluginNames = viteServer.config.plugins?.map(p => p?.name).filter(Boolean) || [];
    console.error(`${logPrefix} Available plugins: ${pluginNames.slice(0, 10).join(', ')}...`);
    
    // Get the plugin container
    const pluginContainer = (viteServer as unknown as { pluginContainer?: PluginContainer }).pluginContainer;
    
    let result: { code: string; map?: unknown } | null = null;
    
    // For Vue SFCs, compile directly using @vue/compiler-sfc
    // The Vue plugin's load hook doesn't work with direct pluginContainer calls
    if (framework === 'vue') {
      console.error(`${logPrefix} Compiling Vue SFC directly with @vue/compiler-sfc`);
      try {
        const vueResult = await compileVueSFC(sourceContent, fullPath, absoluteId);
        if (vueResult) {
          result = vueResult;
          console.error(`${logPrefix} Vue SFC compilation succeeded (${result.code.length} chars)`);
        }
      } catch (vueError) {
        console.warn(`${logPrefix} Vue SFC compilation failed:`, vueError);
      }
    }
    
    // For Solid files, compile directly using Babel with babel-preset-solid
    // This generates SSR-compatible code with proper Solid SSR functions
    if (framework === 'solid' && !result) {
      console.error(`${logPrefix} Compiling Solid JSX directly with Babel`);
      try {
        const solidResult = await compileSolidJSX(sourceContent, fullPath);
        if (solidResult) {
          result = solidResult;
          console.error(`${logPrefix} Solid JSX compilation succeeded (${result.code.length} chars)`);
        }
      } catch (solidError) {
        console.warn(`${logPrefix} Solid JSX compilation failed:`, solidError);
      }
    }
    
    // For React files, compile directly using Babel with @babel/preset-react
    // This generates proper React JSX runtime imports
    if (framework === 'react' && !result) {
      console.error(`${logPrefix} Compiling React JSX directly with Babel`);
      try {
        const reactResult = await compileReactJSX(sourceContent, fullPath);
        if (reactResult) {
          result = reactResult;
          console.error(`${logPrefix} React JSX compilation succeeded (${result.code.length} chars)`);
        }
      } catch (reactError) {
        console.warn(`${logPrefix} React JSX compilation failed:`, reactError);
      }
    }
    
    // For non-Vue files or if Vue load failed, try transform directly
    if (!result && pluginContainer?.transform) {
      console.error(`${logPrefix} Using pluginContainer.transform directly`);
      try {
        // Transform with SSR mode disabled to use client-side transforms
        result = await pluginContainer.transform(sourceContent, absoluteId, { ssr: false });
        if (result) {
          console.error(`${logPrefix} pluginContainer.transform succeeded`);
        }
      } catch (transformError) {
        console.warn(`${logPrefix} pluginContainer.transform failed:`, transformError);
      }
    }
    
    // Fallback to transformRequest (works for most files)
    if (!result) {
      console.error(`${logPrefix} Falling back to transformRequest`);
      try {
        result = await viteServer.transformRequest(normalizedPath);
      } catch (transformError) {
        console.warn(`${logPrefix} transformRequest failed:`, transformError);
      }
    }
    
    if (!result || !result.code) {
      console.warn(`${logPrefix} All transform methods failed`);
      return null;
    }
    
    // Debug: Log a snippet of the compiled code
    console.error(`${logPrefix} Compiled code snippet: ${result.code.substring(0, 500)}...`);
    
    console.error(`${logPrefix} ✅ Pre-compiled successfully (${result.code.length} chars)`);
    
    const entry: SSRCacheEntry = {
      src,
      code: result.code,
      map: result.map ? JSON.stringify(result.map) : undefined,
      framework,
      compiledAt: Date.now(),
      sourceHash,
    };
    
    // Store in cache
    ssrCache.entries.set(src, entry);
    
    return entry;
  } catch (error) {
    console.error(`${logPrefix} ❌ Pre-compilation failed:`, error);
    return null;
  }
}

/**
 * Pre-compile all islands in a directory
 * 
 * @param islandsDir - Directory containing island components
 * @param viteServer - Vite dev server instance
 * @returns Number of successfully compiled islands
 */
export async function precompileAllIslands(
  islandsDir: string,
  viteServer: ViteDevServer
): Promise<number> {
  console.error(`[ssr-precompile] Starting pre-compilation of islands in ${islandsDir}...`);
  
  ssrCache.viteServer = viteServer;
  
  // Extensions that we can compile (skip .svelte if Svelte plugin not loaded)
  const extensions = ['.tsx', '.jsx', '.ts', '.js', '.vue'];
  
  // Check if Svelte plugin is available by looking at the config
  // We'll add .svelte only if the plugin is registered
  try {
    // Try to check if svelte plugin is in the config
    const plugins = viteServer.config.plugins || [];
    const hasSveltePlugin = plugins.some(p => p && p.name && p.name.includes('svelte'));
    if (hasSveltePlugin) {
      extensions.push('.svelte');
      console.error(`[ssr-precompile] Svelte plugin detected, including .svelte files`);
    } else {
      console.error(`[ssr-precompile] Svelte plugin not detected, skipping .svelte files`);
    }
  } catch {
    console.error(`[ssr-precompile] Could not detect Svelte plugin, skipping .svelte files`);
  }
  
  let compiled = 0;
  let failed = 0;
  let skipped = 0;
  
  async function scanDirectory(dir: string, relativePath: string = ''): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          await scanDirectory(fullPath, relPath);
        } else if (entry.isFile()) {
          const hasValidExtension = extensions.some(ext => entry.name.endsWith(ext));
          if (hasValidExtension) {
            const src = `/islands/${relPath}`;
            const result = await precompileIsland(src, viteServer);
            if (result) {
              compiled++;
            } else {
              failed++;
            }
          } else if (entry.name.endsWith('.svelte')) {
            // Svelte file but plugin not loaded
            skipped++;
          }
        }
      }
    } catch (error) {
      console.warn(`[ssr-precompile] Failed to scan directory ${dir}:`, error);
    }
  }
  
  await scanDirectory(islandsDir);
  
  ssrCache.initialized = true;
  
  console.error(`[ssr-precompile] ✅ Pre-compilation complete: ${compiled} succeeded, ${failed} failed, ${skipped} skipped`);
  
  return compiled;
}

/**
 * Get a pre-compiled module from cache
 * 
 * @param src - Source path to the component
 * @returns Cache entry or null if not found
 */
export function getCachedModule(src: string): SSRCacheEntry | null {
  return ssrCache.entries.get(src) || null;
}

/**
 * Check if a module needs recompilation (source changed)
 * 
 * @param src - Source path to the component
 * @returns True if recompilation is needed
 */
export async function needsRecompilation(src: string): Promise<boolean> {
  const cached = ssrCache.entries.get(src);
  if (!cached) return true;
  
  try {
    let absolutePath = src;
    if (src.startsWith('/')) {
      absolutePath = src.substring(1);
    }
    if (absolutePath.startsWith('islands/')) {
      absolutePath = 'src/' + absolutePath;
    }
    
    const sourceContent = await fsReadFile(absolutePath, 'utf-8');
    const currentHash = await hashContent(sourceContent);
    
    return currentHash !== cached.sourceHash;
  } catch {
    return true;
  }
}

/**
 * Invalidate cache entry for a source file
 * 
 * @param src - Source path to invalidate
 */
export function invalidateCache(src: string): void {
  ssrCache.entries.delete(src);
  console.error(`[ssr-precompile] Invalidated cache for: ${src}`);
}

/**
 * Recompile a module if needed
 * 
 * @param src - Source path to the component
 * @returns Cache entry or null if compilation failed
 */
export async function recompileIfNeeded(src: string): Promise<SSRCacheEntry | null> {
  if (!ssrCache.viteServer) {
    console.warn(`[ssr-precompile] No Vite server available for recompilation`);
    return getCachedModule(src);
  }
  
  const needsUpdate = await needsRecompilation(src);
  if (needsUpdate) {
    console.error(`[ssr-precompile] Recompiling ${src} (source changed)`);
    return await precompileIsland(src, ssrCache.viteServer);
  }
  
  return getCachedModule(src);
}

/**
 * Rewrite Vite's pre-bundled dependency imports to npm package imports
 * 
 * Vite transforms imports like `solid-js` to `/.vite/deps/solid-js.js?v=xxx`
 * We need to rewrite these back to npm package imports for Deno to resolve.
 * 
 * @param code - The compiled code with Vite imports
 * @returns Code with npm package imports
 */
function rewriteViteImports(code: string): string {
  // Pattern to match Vite's pre-bundled imports
  // e.g., from "/.vite/deps/solid-js_jsx-dev-runtime.js?v=27549c87"
  // e.g., from "/.vite/deps/solid-js.js?v=27549c87"
  // e.g., from "/.vite/deps/react_jsx-dev-runtime.js?v=27549c87"
  // e.g., from "/.vite/deps/preact_jsx-dev-runtime.js?v=27549c87"
  
  let rewritten = code;
  
  // Rewrite standard imports: from "/.vite/deps/xxx.js?v=xxx"
  rewritten = rewritten.replace(
    /from\s+["']\/\.vite\/deps\/([^"'?]+)\.js\?[^"']*["']/g,
    (_match, depPath) => {
      // Convert underscore-separated paths back to slash-separated
      // e.g., solid-js_jsx-dev-runtime -> solid-js/jsx-dev-runtime
      // e.g., react_jsx-dev-runtime -> react/jsx-dev-runtime
      // e.g., preact_hooks -> preact/hooks
      const npmPath = depPath.replace(/_/g, '/');
      console.error(`[rewrite-imports] Rewriting: ${depPath} -> ${npmPath}`);
      return `from "${npmPath}"`;
    }
  );
  
  // Also handle __vite__cjsImport patterns
  // e.g., import __vite__cjsImport0_react_jsxDevRuntime from "/.vite/deps/react_jsx-dev-runtime.js?v=xxx"
  rewritten = rewritten.replace(
    /import\s+(__vite__cjsImport\d+_\w+)\s+from\s+["']\/\.vite\/deps\/([^"'?]+)\.js\?[^"']*["']/g,
    (_match, varName, depPath) => {
      const npmPath = depPath.replace(/_/g, '/');
      console.error(`[rewrite-imports] Rewriting CJS import: ${depPath} -> ${npmPath}`);
      return `import ${varName} from "${npmPath}"`;
    }
  );
  
  return rewritten;
}

/**
 * Execute a pre-compiled SSR module and return its exports
 * 
 * This creates a module from the compiled code and executes it.
 * We use Vite's virtual module system to properly resolve imports.
 * 
 * @param entry - Cache entry with compiled code
 * @param viteServer - Vite dev server for module resolution
 * @returns Module exports
 */
export async function executeCompiledModule(
  entry: SSRCacheEntry,
  viteServer?: ViteDevServer
): Promise<Record<string, unknown>> {
  const logPrefix = `[ssr-execute:${entry.src}]`;
  
  console.error(`${logPrefix} Executing pre-compiled module (framework: ${entry.framework})...`);
  console.error(`${logPrefix} viteServer available: ${!!viteServer}`);
  console.error(`${logPrefix} Framework check: solid=${entry.framework === 'solid'}, react=${entry.framework === 'react'}`);
  
  // For frameworks that produce SSR-ready code (Solid, React with Babel),
  // we need to use Vite's module runner to properly resolve imports
  if (viteServer && (entry.framework === 'solid' || entry.framework === 'react')) {
    console.error(`${logPrefix} Using Vite virtual module for ${entry.framework} SSR code`);
    
    try {
      // Create a virtual module ID for the pre-compiled code
      const virtualId = `\0avalon-ssr:${entry.src}`;
      
      // Store the pre-compiled code in a map that the core plugin can access
      const ssrModuleCache = (globalThis as unknown as { __avalon_ssr_modules?: Map<string, string> }).__avalon_ssr_modules;
      console.error(`${logPrefix} SSR module cache exists: ${!!ssrModuleCache}`);
      
      if (ssrModuleCache) {
        ssrModuleCache.set(virtualId, entry.code);
        console.error(`${logPrefix} Stored pre-compiled code in virtual module cache (${entry.code.length} chars), virtualId: ${virtualId}`);
        
        // Use Vite's ssrLoadModule to load the virtual module
        // This will properly resolve npm imports
        console.error(`${logPrefix} Calling viteServer.ssrLoadModule(${virtualId})...`);
        const module = await viteServer.ssrLoadModule(virtualId);
        console.error(`${logPrefix} ✅ Module executed via Vite virtual module`);
        return module as Record<string, unknown>;
      } else {
        console.warn(`${logPrefix} SSR module cache not initialized`);
      }
    } catch (viteError) {
      console.warn(`${logPrefix} Vite virtual module failed:`, viteError);
      // Fall through to temp file approach
    }
  }
  
  // Fallback: Write to temp file and import directly
  // This works for Preact/Lit which don't need special SSR transforms
  try {
    // Rewrite Vite's pre-bundled imports to npm package imports
    const rewrittenCode = rewriteViteImports(entry.code);
    
    // Write the compiled code to a temp file and then import it
    const tempDir = await mkdtemp(join(tmpdir(), 'avalon-ssr-'));
    const fileName = entry.src.split('/').pop() || 'module.js';
    const tempFile = `${tempDir}/${fileName.replace(/\.(vue|tsx|jsx|ts|svelte)$/, '.js')}`;
    
    // Write the rewritten code to the temp file
    await writeFile(tempFile, rewrittenCode);
    
    console.error(`${logPrefix} Rewritten imports, temp file: ${tempFile}`);
    
    try {
      // Import the temp file
      const module = await import(`file://${tempFile}`);
      console.error(`${logPrefix} ✅ Module executed successfully from temp file`);
      return module as Record<string, unknown>;
    } finally {
      // Clean up temp file
      try {
        await rm(tempFile);
        await rm(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.error(`${logPrefix} ❌ Module execution failed:`, error);
    throw error;
  }
}

/**
 * Load an SSR module using pre-compilation cache
 * 
 * This is the main entry point for loading SSR modules.
 * It first checks the cache, recompiles if needed, then executes.
 * 
 * @param src - Source path to the component
 * @param viteServer - Vite dev server (optional, for recompilation)
 * @returns Module exports or null if loading failed
 */
export async function loadPrecompiledSSRModule(
  src: string,
  viteServer?: ViteDevServer
): Promise<Record<string, unknown> | null> {
  const logPrefix = `[ssr-precompile:${src}]`;
  
  // Update vite server reference if provided
  if (viteServer) {
    ssrCache.viteServer = viteServer;
  }
  
  // Check if we have a cached entry
  let entry = getCachedModule(src);
  
  // If not cached or needs recompilation, compile now
  if (!entry) {
    if (ssrCache.viteServer) {
      console.error(`${logPrefix} Not in cache, compiling...`);
      entry = await precompileIsland(src, ssrCache.viteServer);
    } else {
      console.warn(`${logPrefix} Not in cache and no Vite server available`);
      return null;
    }
  } else {
    // Check if source changed
    const needsUpdate = await needsRecompilation(src);
    if (needsUpdate && ssrCache.viteServer) {
      console.error(`${logPrefix} Source changed, recompiling...`);
      entry = await precompileIsland(src, ssrCache.viteServer);
    }
  }
  
  if (!entry) {
    console.error(`${logPrefix} Failed to get compiled module`);
    return null;
  }
  
  // Execute the compiled module
  try {
    return await executeCompiledModule(entry, ssrCache.viteServer);
  } catch (error) {
    console.error(`${logPrefix} Failed to execute compiled module:`, error);
    return null;
  }
}
