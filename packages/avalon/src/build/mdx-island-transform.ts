/**
 * MDX Island Transform Plugin
 *
 * Transforms island component imports in MDX files into Island() wrapper calls.
 *
 * Problem: MDX files import island components directly and render them as raw JSX.
 * After MDX compilation, these become jsxDEV(ComponentName, ...) calls. Non-Preact
 * components are module objects (not valid JSX elements) and even Preact components
 * miss the island hydration wrapper (<is-land> with data attributes).
 *
 * Solution: Detects imports from the islands directory in compiled MDX output and
 * replaces the imported bindings with wrapper functions that call the synchronous
 * Island() component to produce proper <is-land> custom elements for hydration.
 */

import type { Plugin } from 'vite';

export interface MDXIslandTransformOptions {
  islandPathPatterns?: RegExp[];
  verbose?: boolean;
}

const DEFAULT_ISLAND_PATTERNS = [
  /['"]\.\.\/islands\//,
  /['"]\.\/islands\//,
  /['"]\.\.\/\.\.\/islands\//,
  /['"]\$islands\//,
  /['"]@\/islands\//,
  /['"]\/src\/islands\//,
];

interface IslandImport {
  localName: string;
  importPath: string;
}

function findIslandImports(
  code: string,
  patterns: RegExp[],
): IslandImport[] {
  const imports: IslandImport[] = [];
  const re = /import\s+(\w+)\s+from\s+(['"][^'"]+['"])/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const localName = m[1];
    const quotedPath = m[2];
    const importPath = quotedPath.slice(1, -1);
    if (patterns.some((p) => p.test(quotedPath))) {
      imports.push({ localName, importPath });
    }
  }
  return imports;
}

function resolveIslandSrc(importPath: string): string {
  if (importPath.startsWith('/src/islands/')) return importPath;
  const parts = importPath.split('/');
  return '/src/islands/' + parts[parts.length - 1];
}

function detectFramework(src: string): string | undefined {
  if (src.endsWith('.vue')) return 'vue';
  if (src.endsWith('.svelte')) return 'svelte';
  if (src.includes('.solid.')) return 'solid';
  if (src.includes('.lit.')) return 'lit';
  if (src.endsWith('.tsx') || src.endsWith('.jsx')) return 'preact';
  return undefined;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, function (ch) {
    return '\\' + ch;
  });
}

function replaceImportBinding(
  code: string,
  originalName: string,
  importPath: string,
  newName: string,
): string {
  const escaped = escapeRegex(importPath);
  const re = new RegExp(
    'import\\s+' + originalName + "\\s+from\\s+['\"]" + escaped + "['\"]",
    'g',
  );
  return code.replace(re, "import " + newName + " from '" + importPath + "'");
}

function findLastImportIndex(code: string): number {
  const lines = code.split('\n');
  let lastImportLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
      lastImportLine = i;
    }
  }
  let pos = 0;
  for (let i = 0; i <= lastImportLine; i++) {
    pos += lines[i].length + 1;
  }
  return pos;
}

export function mdxIslandTransform(
  options: MDXIslandTransformOptions = {},
): Plugin {
  const {
    islandPathPatterns = DEFAULT_ISLAND_PATTERNS,
    verbose = false,
  } = options;

  return {
    name: 'avalon:mdx-island-transform',
    enforce: 'post',

    transform(code: string, id: string) {
      if (!id.endsWith('.mdx') && !id.includes('.mdx?')) {
        return null;
      }

      const islandImports = findIslandImports(code, islandPathPatterns);
      if (islandImports.length === 0) {
        return null;
      }

      if (verbose) {
        console.log(
          '[mdx-island-transform] Found ' +
            islandImports.length +
            ' island import(s) in ' +
            id,
        );
      }

      let transformed = code;

      // Add the Island component import
      const hasAvalonImport =
        transformed.includes('from "@avalon/avalon"') ||
        transformed.includes("from '@avalon/avalon'");

      if (!hasAvalonImport) {
        const firstImport = transformed.match(/^(import\s.+?from\s+.+?\n)/m);
        if (firstImport) {
          const pos =
            transformed.indexOf(firstImport[0]) + firstImport[0].length;
          const line =
            'import { Island as __AvalonIsland } from "@avalon/avalon";\n';
          transformed =
            transformed.slice(0, pos) + line + transformed.slice(pos);
        }
      }

      // Build wrapper assignments for each island import
      const wrappers: string[] = [];

      for (const island of islandImports) {
        const srcPath = resolveIslandSrc(island.importPath);
        const fw = detectFramework(srcPath);
        const fwLiteral = fw ? '"' + fw + '"' : 'undefined';

        // Rename the original import so it does not conflict
        const origName = '__orig_' + island.localName;
        transformed = replaceImportBinding(
          transformed,
          island.localName,
          island.importPath,
          origName,
        );

        // Wrapper function that the compiled JSX runtime will call
        wrappers.push(
          'const ' +
            island.localName +
            ' = function ' +
            island.localName +
            '(props) {\n' +
            '  return __AvalonIsland({\n' +
            '    src: "' +
            srcPath +
            '",\n' +
            '    condition: "on:visible",\n' +
            '    props: props || {},\n' +
            '    framework: ' +
            fwLiteral +
            ',\n' +
            '    ssr: false,\n' +
            '  });\n' +
            '};',
        );
      }

      // Insert wrappers after all imports
      const insertAt = findLastImportIndex(transformed);
      const block = '\n' + wrappers.join('\n') + '\n';
      transformed =
        transformed.slice(0, insertAt) + block + transformed.slice(insertAt);

      if (verbose) {
        console.log('[mdx-island-transform] Transformed ' + id);
      }

      return { code: transformed, map: null };
    },
  };
}
