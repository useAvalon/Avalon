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

interface ParsedJSXElement {
  endIdx: number;
  islandProp: string | null;
  otherProps: string[];
}

interface ParsedAttribute {
  name: string;
  value: string | null;
  endIdx: number;
}

// ─── Import Discovery ────────────────────────────────────────────────

function findIslandImports(code: string, patterns: RegExp[]): IslandImport[] {
  const imports: IslandImport[] = [];
  const re = /^[ \t]*import\s+(\w+)\s+from\s+(['"][^'"]+['"])/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    const quotedPath = m[2];
    if (patterns.some((p) => p.test(quotedPath))) {
      imports.push({
        localName: m[1],
        importPath: quotedPath.slice(1, -1),
        fullMatch: m[0].trimStart(),
      });
    }
  }
  return imports;
}

function resolveIslandSrc(importPath: string): string {
  if (importPath.startsWith('/src/islands/')) return importPath;
  return '/src/islands/' + importPath.split('/').at(-1);
}

function detectFramework(src: string): string | undefined {
  if (src.endsWith('.vue')) return 'vue';
  if (src.endsWith('.svelte')) return 'svelte';
  if (src.includes('.solid.')) return 'solid';
  if (src.includes('.lit.')) return 'lit';
  return undefined;
}

function isPageFile(id: string, pagesDir: string): boolean {
  const normalized = id.replaceAll('\\', '/');
  const dir = pagesDir.replace(/^\//, '');
  const isInDir = normalized.includes('/' + dir + '/');
  return isInDir && /\.(tsx|jsx)$/.test(normalized);
}

function hasIslandPropUsage(code: string, islandNames: string[]): boolean {
  return islandNames.some((name) => {
    const pattern = new RegExp('<' + name + String.raw`[\s][^>]*island[\s]*[={]`);
    return pattern.test(code);
  });
}

function buildIslandMeta(
  code: string,
  islandImports: IslandImport[],
): Map<string, { srcPath: string; framework: string | undefined; importPath: string }> {
  const meta = new Map<string, { srcPath: string; framework: string | undefined; importPath: string }>();
  for (const island of islandImports) {
    const pattern = new RegExp('<' + island.localName + String.raw`[\s][^>]*island[\s]*[={]`);
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

// ─── Low-level string scanning helpers ───────────────────────────────

function skipWhitespace(code: string, pos: number): number {
  while (pos < code.length && /\s/.test(code[pos])) pos++;
  return pos;
}

/** Skip a string literal (single, double, or backtick). Returns index after closing quote. */
function skipStringLiteral(code: string, pos: number): number {
  const quote = code[pos];
  pos++;
  while (pos < code.length && code[pos] !== quote) {
    if (code[pos] === '\\') pos++; // skip escaped char
    pos++;
  }
  return pos < code.length ? pos + 1 : pos;
}

/** Skip a template literal including ${...} expressions. Returns index after closing backtick. */
function skipTemplateLiteral(code: string, pos: number): number {
  pos++; // skip opening backtick
  while (pos < code.length && code[pos] !== '`') {
    if (code[pos] === '\\') {
      pos += 2;
      continue;
    }
    if (code[pos] === '$' && code[pos + 1] === '{') {
      pos = skipBracedExpression(pos + 1, code);
      continue;
    }
    pos++;
  }
  return pos < code.length ? pos + 1 : pos;
}

/** Skip a brace-delimited expression `{...}`, handling nested braces and strings. */
function skipBracedExpression(openBraceIdx: number, code: string): number {
  let pos = openBraceIdx + 1;
  let depth = 1;
  while (pos < code.length && depth > 0) {
    const ch = code[pos];
    if (ch === '{') { depth++; pos++; }
    else if (ch === '}') { depth--; if (depth > 0) pos++; }
    else if (ch === "'" || ch === '"' || ch === '`') { pos = skipStringLiteral(code, pos); }
    else { pos++; }
  }
  return pos < code.length ? pos + 1 : pos;
}

// ─── JSX Attribute Parsing ───────────────────────────────────────────

/** Parse a JSX expression value `{...}`. Returns the inner expression and end index (after `}`). */
function parseJSXExpressionValue(code: string, pos: number): { value: string; endIdx: number } {
  const exprStart = pos + 1;
  const endIdx = skipBracedExpression(pos, code);
  // endIdx is after the closing }, inner content is between { and }
  return { value: code.slice(exprStart, endIdx - 1), endIdx };
}

/** Parse a quoted string value `"..."` or `'...'`. Returns the value (with double quotes) and end index. */
function parseQuotedValue(code: string, pos: number): { value: string; endIdx: number } {
  const quote = code[pos];
  let i = pos + 1;
  while (i < code.length && code[i] !== quote) {
    if (code[i] === '\\') i++;
    i++;
  }
  const value = '"' + code.slice(pos + 1, i) + '"';
  return { value, endIdx: i + 1 };
}

/** Parse a single JSX attribute (name + optional value). Returns null on failure. */
function parseAttribute(code: string, pos: number): ParsedAttribute | null {
  const nameStart = pos;
  let i = pos;
  while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++;
  const name = code.slice(nameStart, i);
  if (!name) return null;

  i = skipWhitespace(code, i);

  // Boolean attribute (no `=`)
  if (code[i] !== '=') {
    return { name, value: null, endIdx: i };
  }
  i = skipWhitespace(code, i + 1); // skip `=` and whitespace

  // Expression value: {expr}
  if (code[i] === '{') {
    const parsed = parseJSXExpressionValue(code, i);
    return { name, value: parsed.value, endIdx: parsed.endIdx };
  }

  // Quoted string value
  if (code[i] === '"' || code[i] === "'") {
    const parsed = parseQuotedValue(code, i);
    return { name, value: parsed.value, endIdx: parsed.endIdx };
  }

  return null; // unexpected token
}

// ─── JSX Element Parsing ─────────────────────────────────────────────

/** Find the end of a JSX tag — either self-closing `/>` or `>...</Component>`. */
function findTagEnd(
  code: string,
  pos: number,
  componentName: string,
): { endIdx: number; selfClosing: boolean } | null {
  if (code[pos] === '/' && code[pos + 1] === '>') {
    return { endIdx: pos + 2, selfClosing: true };
  }
  if (code[pos] === '>') {
    const closeTag = '</' + componentName + '>';
    const closeIdx = code.indexOf(closeTag, pos + 1);
    if (closeIdx === -1) return null;
    return { endIdx: closeIdx + closeTag.length, selfClosing: false };
  }
  return null;
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
  let i = skipWhitespace(code, startIdx + 1 + componentName.length);

  let islandProp: string | null = null;
  const otherProps: string[] = [];

  while (i < code.length) {
    i = skipWhitespace(code, i);

    // Check for end of opening tag
    const tagEnd = findTagEnd(code, i, componentName);
    if (tagEnd) {
      return { endIdx: tagEnd.endIdx, islandProp, otherProps };
    }

    // Parse next attribute
    const attr = parseAttribute(code, i);
    if (!attr) return null;
    i = attr.endIdx;

    if (attr.name === 'island') {
      islandProp = attr.value ?? '{}';
    } else {
      const propValue = attr.value === null
        ? attr.name + ': true'
        : attr.name + ': ' + attr.value;
      otherProps.push(propValue);
    }
  }

  return null;
}

// ─── JSX Replacement ─────────────────────────────────────────────────

/** Build the `{await __pageRenderIsland({...})}` call from parsed element data. */
function buildRenderCall(
  parsed: ParsedJSXElement,
  srcPath: string,
  framework: string | undefined,
): string {
  const islandValue = parsed.islandProp!;
  const fwArg = framework ? ', framework: "' + framework + '"' : '';
  const propsArg = parsed.otherProps.length > 0
    ? ', props: { ' + parsed.otherProps.join(', ') + ' }'
    : '';

  return '{await __pageRenderIsland({ src: "' + srcPath + '"' + fwArg
    + ', ...(' + islandValue + ')'
    + propsArg
    + ', ssr: (' + islandValue + ').ssr !== undefined ? (' + islandValue + ').ssr : true'
    + ' })}';
}

/** Check if position `i` is the start of a `<ComponentName` tag (not a longer identifier). */
function isComponentTagStart(code: string, pos: number, tag: string): boolean {
  if (!code.startsWith(tag, pos)) return false;
  const afterTag = pos + tag.length;
  return afterTag >= code.length || !/[a-zA-Z0-9_$]/.test(code[afterTag]);
}

/**
 * Replace all `<Component island={...} />` JSX usages with `{await __pageRenderIsland({...})}`.
 */
function replaceIslandJSX(
  code: string,
  componentName: string,
  srcPath: string,
  framework: string | undefined,
): string {
  const tag = '<' + componentName;
  let result = '';
  let i = 0;

  while (i < code.length) {
    // Skip template literals to avoid transforming code examples
    if (code[i] === '`') {
      const start = i;
      i = skipTemplateLiteral(code, i);
      result += code.slice(start, i);
      continue;
    }

    // Check for component tag
    if (!isComponentTagStart(code, i, tag)) {
      result += code[i];
      i++;
      continue;
    }

    const parsed = parseJSXElement(code, i, componentName);
    if (!parsed?.islandProp) {
      // Not parseable or no island prop — emit as-is
      const end = parsed ? parsed.endIdx : i + 1;
      result += code.slice(i, end);
      i = end;
      continue;
    }

    result += buildRenderCall(parsed, srcPath, framework);
    i = parsed.endIdx;
  }

  return result;
}

// ─── Vite Plugin ─────────────────────────────────────────────────────

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
      if (!isPageFile(id, pagesDir)) return null;

      const islandImports = findIslandImports(code, islandPathPatterns);
      if (islandImports.length === 0) return null;

      const islandNames = islandImports.map((i) => i.localName);
      if (!hasIslandPropUsage(code, islandNames)) return null;

      if (verbose) {
        console.log(
          '[page-island-transform] Transforming ' +
            islandImports.length + ' island component(s) in ' + id,
        );
      }

      const islandMeta = buildIslandMeta(code, islandImports);
      if (islandMeta.size === 0) return null;

      let transformed =
        "import { renderIsland as __pageRenderIsland } from '@avalon/avalon';\n" + code;

      for (const [name, meta] of islandMeta) {
        transformed = replaceIslandJSX(transformed, name, meta.srcPath, meta.framework);
      }

      for (const island of islandImports) {
        if (islandMeta.has(island.localName)) {
          transformed = transformed.replace(
            island.fullMatch,
            '// [page-island-transform] removed: ' + island.localName,
          );
        }
      }

      if (verbose) {
        console.log('[page-island-transform] Transformed ' + id);
      }

      return { code: transformed, map: null };
    },
  };
}
