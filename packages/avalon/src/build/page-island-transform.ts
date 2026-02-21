/**
 * Page Island Transform Plugin
 *
 * Transforms island component imports in TSX/JSX page files so that developers
 * can use island components as regular JSX elements with an `island` prop to
 * control hydration behavior, instead of manually calling renderIsland().
 *
 * Before (manual):
 *   import { renderIsland } from '@avalon/avalon';
 *   {await renderIsland({ src: '/src/islands/Counter.tsx', condition: 'on:interaction', framework: 'preact' })}
 *
 * After (auto-wrapped):
 *   import Counter from '../islands/Counter.tsx';
 *   <Counter island={{ condition: 'on:interaction' }} someProp={42} />
 *
 * How it works:
 *   The plugin rewrites each `<Component island={opts} ...props />` JSX usage
 *   into an `{await renderIsland({...})}` expression inline in the JSX.
 *   This works because page components are async functions whose return value
 *   is awaited by the SSR renderer.
 *
 *   Preact's renderToString does NOT support async child components in the JSX
 *   tree, so we cannot use async wrapper functions. Instead we directly replace
 *   the JSX element with an await expression.
 *
 * Only applies to files inside the configured pages directory.
 */

import type { Plugin } from 'vite';

export interface PageIslandTransformOptions {
  /** Glob patterns for page files (default: src/pages/) */
  pagesDir?: string;
  /** Patterns to match island import paths */
  islandPathPatterns?: RegExp[];
  /** Whether to enable verbose logging */
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
  fullMatch: string;
}

function findIslandImports(
  code: string,
  patterns: RegExp[],
): IslandImport[] {
  const imports: IslandImport[] = [];
  // Use ^ with multiline flag to only match actual import statements at line start,
  // not "import ..." text inside string literals or template literals
  const re = /^[ \t]*import\s+(\w+)\s+from\s+(['"][^'"]+['"])/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    const localName = m[1];
    const quotedPath = m[2];
    const importPath = quotedPath.slice(1, -1);
    if (patterns.some((p) => p.test(quotedPath))) {
      imports.push({ localName, importPath, fullMatch: m[0].trimStart() });
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
  // For .tsx/.jsx we can't reliably distinguish React from Preact by extension alone.
  // Return undefined to let renderIsland's runtime detection handle it.
  // Users can explicitly set framework in the island prop if needed.
  return undefined;
}

/**
 * Checks if a file is inside the pages directory
 */
function isPageFile(id: string, pagesDir: string): boolean {
  const normalized = id.replace(/\\/g, '/');
  if (
    normalized.includes('/' + pagesDir + '/') ||
    normalized.includes('/' + pagesDir.replace(/^\//, '') + '/')
  ) {
    return /\.(tsx|jsx)$/.test(normalized);
  }
  return false;
}

/**
 * Checks if the code contains any island imports that use the `island` prop pattern.
 */
function hasIslandPropUsage(code: string, islandNames: string[]): boolean {
  for (const name of islandNames) {
    const pattern = new RegExp(
      '<' + name + '[\\s][^>]*island[\\s]*[={]',
      'g',
    );
    if (pattern.test(code)) return true;
  }
  return false;
}

/**
 * Build a map of island component names to their resolved metadata.
 * Only includes islands that actually use the `island` prop in the source.
 */
function buildIslandMeta(
  code: string,
  islandImports: IslandImport[],
): Map<string, { srcPath: string; framework: string | undefined; importPath: string }> {
  const meta = new Map<string, { srcPath: string; framework: string | undefined; importPath: string }>();
  for (const island of islandImports) {
    const pattern = new RegExp(
      '<' + island.localName + '[\\s][^>]*island[\\s]*[={]',
      'g',
    );
    if (pattern.test(code)) {
      const srcPath = resolveIslandSrc(island.importPath);
      meta.set(island.localName, {
        srcPath,
        framework: detectFramework(srcPath),
        importPath: island.importPath,
      });
    }
  }
  return meta;
}

/**
 * Replace JSX elements like `<Counter island={{ condition: 'on:visible' }} foo={1} />`
 * with `{await __pageRenderIsland({ src: "...", condition: "on:visible", props: { foo: 1 }, framework: "..." })}`
 *
 * This handles both self-closing and open/close tags (without children for now).
 * The replacement is done as a string transform on the raw JSX source.
 */
function replaceIslandJSX(
  code: string,
  componentName: string,
  srcPath: string,
  framework: string | undefined,
): string {
  // Match self-closing: <Counter island={{ ... }} foo={bar} />
  // Match opening tag without children: <Counter island={{ ... }} foo={bar}></Counter>
  // We need to handle nested braces in the island prop value.
  //
  // Strategy: find `<ComponentName ` then parse forward to find the matching `/>` or `>`
  // extracting the island prop and other props along the way.

  let result = '';
  let i = 0;

  while (i < code.length) {
    // Skip template literals (backtick strings) — they may contain JSX-like
    // code examples that should not be transformed
    if (code[i] === '`') {
      const tlStart = i;
      i++; // skip opening backtick
      while (i < code.length && code[i] !== '`') {
        if (code[i] === '\\') i++; // skip escaped char
        else if (code[i] === '$' && code[i + 1] === '{') {
          // Skip template expression ${...}
          i += 2;
          let depth = 1;
          while (i < code.length && depth > 0) {
            if (code[i] === '{') depth++;
            else if (code[i] === '}') depth--;
            if (depth > 0) i++;
          }
          if (i < code.length) i++; // skip closing }
          continue;
        }
        i++;
      }
      if (i < code.length) i++; // skip closing backtick
      result += code.slice(tlStart, i);
      continue;
    }

    // Check if we're at a `<ComponentName` boundary
    const tag = '<' + componentName;
    if (!code.startsWith(tag, i)) {
      result += code[i];
      i++;
      continue;
    }

    // Check that the character after the component name is whitespace or > or /
    const afterTag = i + tag.length;
    if (afterTag < code.length && /[a-zA-Z0-9_$]/.test(code[afterTag])) {
      // Not our component (e.g. CounterButton when looking for Counter)
      result += code[i];
      i++;
      continue;
    }

    // Now parse the JSX element starting at i

    // Now parse the JSX element starting at i
    const parsed = parseJSXElement(code, i, componentName);
    if (!parsed) {
      // Couldn't parse — leave as-is
      result += code[i];
      i++;
      continue;
    }

    // Check if this element has the island prop
    if (!parsed.islandProp) {
      // No island prop — leave as-is
      result += code.slice(i, parsed.endIdx);
      i = parsed.endIdx;
      continue;
    }

    // Build the renderIsland call
    const fwArg = framework ? ', framework: "' + framework + '"' : '';
    const propsArg = parsed.otherProps.length > 0
      ? ', props: { ' + parsed.otherProps.join(', ') + ' }'
      : '';

    // Parse the island directive to extract condition, ssr, ssrOnly
    const islandValue = parsed.islandProp;
    let renderCall = '{await __pageRenderIsland({ src: "' + srcPath + '"' + fwArg;

    // The island prop value is a JS expression (e.g. `{ condition: 'on:interaction' }`)
    // We spread it into the renderIsland options
    renderCall += ', ...(' + islandValue + ')';

    // Add non-island props
    renderCall += propsArg;

    // Default ssr to true if not specified in the island directive
    renderCall += ', ssr: (' + islandValue + ').ssr !== undefined ? (' + islandValue + ').ssr : true';

    renderCall += ' })}';

    result += renderCall;
    i = parsed.endIdx;
  }

  return result;
}

interface ParsedJSXElement {
  endIdx: number;
  islandProp: string | null; // The raw JS expression for the island prop value
  otherProps: string[];       // Other props as "key: value" strings
}

/**
 * Parse a JSX element starting at `<ComponentName`.
 * Returns the end index and extracted props, or null if parsing fails.
 */
function parseJSXElement(
  code: string,
  startIdx: number,
  componentName: string,
): ParsedJSXElement | null {
  let i = startIdx + 1 + componentName.length; // skip `<ComponentName`

  // Skip whitespace
  while (i < code.length && /\s/.test(code[i])) i++;

  let islandProp: string | null = null;
  const otherProps: string[] = [];

  // Parse attributes until we hit /> or >
  while (i < code.length) {
    // Skip whitespace
    while (i < code.length && /\s/.test(code[i])) i++;

    // Check for end of tag
    if (code[i] === '/' && code[i + 1] === '>') {
      // Self-closing
      return { endIdx: i + 2, islandProp, otherProps };
    }
    if (code[i] === '>') {
      // Opening tag — look for closing tag
      const closeTag = '</' + componentName + '>';
      const closeIdx = code.indexOf(closeTag, i + 1);
      if (closeIdx === -1) return null;
      return { endIdx: closeIdx + closeTag.length, islandProp, otherProps };
    }

    // Parse attribute name
    const nameStart = i;
    while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++;
    const attrName = code.slice(nameStart, i);
    if (!attrName) return null; // unexpected character

    // Skip whitespace
    while (i < code.length && /\s/.test(code[i])) i++;

    // Check for = sign
    if (code[i] !== '=') {
      // Boolean attribute (no value)
      if (attrName === 'island') {
        islandProp = '{}'; // bare `island` means empty options
      } else {
        otherProps.push(attrName + ': true');
      }
      continue;
    }
    i++; // skip =

    // Skip whitespace
    while (i < code.length && /\s/.test(code[i])) i++;

    // Parse attribute value
    let value: string;
    if (code[i] === '{') {
      // JSX expression: find matching }
      const exprStart = i + 1;
      i++; // skip opening {
      let depth = 1;
      while (i < code.length && depth > 0) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') depth--;
        else if (code[i] === "'" || code[i] === '"' || code[i] === '`') {
          // Skip string literals
          const quote = code[i];
          i++;
          while (i < code.length && code[i] !== quote) {
            if (code[i] === '\\') i++; // skip escaped char
            i++;
          }
        }
        if (depth > 0) i++;
      }
      value = code.slice(exprStart, i);
      i++; // skip closing }
    } else if (code[i] === '"' || code[i] === "'") {
      // String literal
      const quote = code[i];
      i++;
      const strStart = i;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++;
        i++;
      }
      value = '"' + code.slice(strStart, i) + '"';
      i++; // skip closing quote
    } else {
      return null; // unexpected
    }

    if (attrName === 'island') {
      islandProp = value;
    } else {
      otherProps.push(attrName + ': ' + value);
    }
  }

  return null; // reached end of code without closing tag
}

export function pageIslandTransform(
  options: PageIslandTransformOptions = {},
): Plugin {
  const {
    pagesDir = 'src/pages',
    islandPathPatterns = DEFAULT_ISLAND_PATTERNS,
    verbose = false,
  } = options;

  return {
    name: 'avalon:page-island-transform',
    enforce: 'pre',

    transform(code: string, id: string) {
      // Only process TSX/JSX page files
      if (!isPageFile(id, pagesDir)) {
        return null;
      }

      // Find island imports
      const islandImports = findIslandImports(code, islandPathPatterns);
      if (islandImports.length === 0) {
        return null;
      }

      // Only transform if the code uses the `island` prop pattern
      const islandNames = islandImports.map((i) => i.localName);
      if (!hasIslandPropUsage(code, islandNames)) {
        return null;
      }

      if (verbose) {
        console.log(
          '[page-island-transform] Transforming ' +
            islandImports.length +
            ' island component(s) in ' + id,
        );
      }

      // Build metadata for islands that use the `island` prop
      const islandMeta = buildIslandMeta(code, islandImports);
      if (islandMeta.size === 0) {
        return null;
      }

      let transformed = code;

      // Step 1: Add the renderIsland import at the top
      transformed =
        "import { renderIsland as __pageRenderIsland } from '@avalon/avalon';\n" +
        transformed;

      // Step 2: For each island component, replace JSX usages with await renderIsland() calls
      for (const [name, meta] of islandMeta) {
        transformed = replaceIslandJSX(
          transformed,
          name,
          meta.srcPath,
          meta.framework,
        );
      }

      // Step 3: Remove the original island imports (they're no longer needed since
      // we replaced all JSX usages with renderIsland calls)
      for (const island of islandImports) {
        if (islandMeta.has(island.localName)) {
          // Remove the import line
          transformed = transformed.replace(island.fullMatch, '// [page-island-transform] removed: ' + island.localName);
        }
      }

      if (verbose) {
        console.log('[page-island-transform] Transformed ' + id);
      }

      return { code: transformed, map: null };
    },
  };
}
