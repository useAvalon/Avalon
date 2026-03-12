/**
 * Page Island Transform Plugin
 *
 * Transforms components with an `island` prop in TSX/JSX page files so that developers
 * can use any component as an island by simply adding the `island` prop.
 *
 * Before (manual):
 *   import { renderIsland } from '@avalon/avalon';
 *   {await renderIsland({ src: '/src/components/Counter.tsx', condition: 'on:interaction', framework: 'preact' })}
 *
 * After (auto-wrapped):
 *   import Counter from '../components/Counter.tsx';
 *   <Counter island={{ condition: 'on:interaction' }} someProp={42} />
 *
 * How it works:
 *   The plugin rewrites each `<Component island={opts} ...props />` JSX usage
 *   into an `{await renderIsland({...})}` expression inline in the JSX.
 *   Any component can be an island - no special directory required.
 *
 *   Preact's renderToString does NOT support async child components in the JSX
 *   tree, so we cannot use async wrapper functions. Instead we directly replace
 *   the JSX element with an await expression.
 *
 * Only applies to files inside the configured pages or layouts directories.
 */

import type { Plugin } from 'vite';
import { dirname } from 'node:path';

export interface PageIslandTransformOptions {
  /** Directory containing page files (default: src/pages/) */
  pagesDir?: string;
  /** Directory containing layout files (default: src/layouts/) */
  layoutsDir?: string;
  /** Modules configuration for modular architecture */
  modules?: {
    dir: string;
    pagesDirName: string;
    layoutsDirName: string;
  } | null;
  /** Whether to enable verbose logging */
  verbose?: boolean;
}

interface ComponentImport {
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

/**
 * Find all default imports in the code (any component import, not filtered by path)
 */
function findAllDefaultImports(code: string): ComponentImport[] {
  const imports: ComponentImport[] = [];
  const re = /^[ \t]*import\s+([A-Z]\w*)\s+from\s+(['"][^'"]+['"])/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    imports.push({
      localName: m[1],
      importPath: m[2].slice(1, -1),
      fullMatch: m[0].trimStart(),
    });
  }
  return imports;
}

/**
 * Resolve an import path to an absolute src path for renderIsland
 */
function resolveIslandSrc(importPath: string, fileId: string): string {
  // Already absolute
  if (importPath.startsWith('/src/')) return importPath;
  if (importPath.startsWith('/app/')) return importPath;
  if (importPath.startsWith('/')) return importPath;
  
  // Handle aliases - convert to absolute paths
  if (importPath.startsWith('@/')) {
    return '/app/' + importPath.slice(2);
  }
  if (importPath.startsWith('@shared/')) {
    return '/app/shared/' + importPath.slice(8);
  }
  if (importPath.startsWith('@modules/')) {
    return '/app/modules/' + importPath.slice(9);
  }
  if (importPath.startsWith('$components/')) {
    return '/src/components/' + importPath.slice(12);
  }
  if (importPath.startsWith('$islands/')) {
    return '/src/islands/' + importPath.slice(9);
  }
  if (importPath.startsWith('~/')) {
    return '/src/' + importPath.slice(2);
  }
  
  // Relative import - resolve relative to the file
  if (importPath.startsWith('.')) {
    const normalized = fileId.replaceAll('\\', '/');
    
    // Try to find /app/ or /src/ in the path
    let baseIndex = normalized.indexOf('/app/');
    if (baseIndex === -1) baseIndex = normalized.indexOf('/src/');
    
    if (baseIndex !== -1) {
      const fileDir = dirname(normalized.slice(baseIndex));
      // Simple path resolution
      const parts = fileDir.split('/');
      const importParts = importPath.split('/');
      
      for (const part of importParts) {
        if (part === '..') {
          parts.pop();
        } else if (part !== '.') {
          parts.push(part);
        }
      }
      
      return parts.join('/');
    }
  }
  
  // Fallback: return as-is with /src/ prefix
  return '/src/' + importPath.split('/').pop();
}

function detectFramework(src: string): string | undefined {
  if (src.endsWith('.vue')) return 'vue';
  if (src.endsWith('.svelte')) return 'svelte';
  if (src.includes('.solid.')) return 'solid';
  if (src.includes('.lit.')) return 'lit';
  return undefined;
}

function isPageFile(id: string, pagesDir: string, modules?: PageIslandTransformOptions['modules']): boolean {
  const normalized = id.replaceAll('\\', '/');
  
  // Check traditional pages directory
  const dir = pagesDir.replace(/^\//, '');
  if (normalized.includes('/' + dir + '/') && /\.(tsx|jsx)$/.test(normalized)) {
    return true;
  }
  
  // Check modular pages directories
  if (modules) {
    const modulesDir = modules.dir.replace(/^\//, '');
    // Pattern: /modules/*/pages/
    const modulePagePattern = new RegExp('/' + modulesDir + '/[^/]+/' + modules.pagesDirName + '/');
    if (modulePagePattern.test(normalized) && /\.(tsx|jsx)$/.test(normalized)) {
      return true;
    }
  }
  
  return false;
}

/** Check whether a file is inside the layouts directory */
function isLayoutFile(id: string, layoutsDir: string, modules?: PageIslandTransformOptions['modules']): boolean {
  const normalized = id.replaceAll('\\', '/');
  
  // Check traditional layouts directory
  const dir = layoutsDir.replace(/^\//, '');
  if (normalized.includes('/' + dir + '/') && /\.(tsx|jsx)$/.test(normalized)) {
    return true;
  }
  
  // Check modular layouts directories
  if (modules) {
    const modulesDir = modules.dir.replace(/^\//, '');
    // Pattern: /modules/*/layouts/
    const moduleLayoutPattern = new RegExp('/' + modulesDir + '/[^/]+/' + modules.layoutsDirName + '/');
    if (moduleLayoutPattern.test(normalized) && /\.(tsx|jsx)$/.test(normalized)) {
      return true;
    }
  }
  
  return false;
}

function hasIslandPropUsage(code: string, componentNames: string[]): boolean {
  return componentNames.some((name) => {
    const pattern = new RegExp('<' + name + String.raw`[\s][^>]*island[\s]*[={]`);
    return pattern.test(code);
  });
}

/**
 * Build metadata for components that are used with island prop
 */
function buildIslandMeta(
  code: string,
  imports: ComponentImport[],
  fileId: string,
): Map<string, { srcPath: string; framework: string | undefined; importPath: string }> {
  const meta = new Map<string, { srcPath: string; framework: string | undefined; importPath: string }>();
  for (const imp of imports) {
    const pattern = new RegExp('<' + imp.localName + String.raw`[\s][^>]*island[\s]*[={]`);
    if (pattern.test(code)) {
      const srcPath = resolveIslandSrc(imp.importPath, fileId);
      meta.set(imp.localName, {
        srcPath,
        framework: detectFramework(srcPath),
        importPath: imp.importPath,
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
    layoutsDir = 'src/layouts',
    modules = null,
    verbose = false,
  } = options;

  return {
    name: 'avalon:page-island-transform',
    enforce: 'pre',

    transform(code: string, id: string) {
      const isLayout = isLayoutFile(id, layoutsDir, modules);
      if (!isPageFile(id, pagesDir, modules) && !isLayout) return null;

      // Find all component imports (PascalCase default imports)
      const componentImports = findAllDefaultImports(code);
      if (componentImports.length === 0) return null;

      const componentNames = componentImports.map((i) => i.localName);
      if (!hasIslandPropUsage(code, componentNames)) return null;

      // Build metadata only for components actually used with island prop
      const islandMeta = buildIslandMeta(code, componentImports, id);
      if (islandMeta.size === 0) return null;

      if (verbose) {
        console.log(
          '[page-island-transform] Transforming ' +
            islandMeta.size + ' island component(s) in ' + id,
        );
      }

      let transformed =
        "import { renderIsland as __pageRenderIsland } from '@avalon/avalon';\n" + code;

      for (const [name, meta] of islandMeta) {
        transformed = replaceIslandJSX(transformed, name, meta.srcPath, meta.framework);
      }

      // Update imports for components used as islands
      for (const imp of componentImports) {
        if (islandMeta.has(imp.localName)) {
          if (isLayout) {
            // In layouts, keep the import as a side-effect-only import so the
            // island module (and its CSS) stays in Vite's module graph for CSS
            // collection. Only the default binding is removed.
            transformed = transformed.replace(
              imp.fullMatch,
              "import '" + imp.importPath + "'; // [page-island-transform] kept for CSS graph: " + imp.localName,
            );
          } else {
            transformed = transformed.replace(
              imp.fullMatch,
              '// [page-island-transform] removed: ' + imp.localName,
            );
          }
        }
      }

      if (verbose) {
        console.log('[page-island-transform] Transformed ' + id);
      }

      return { code: transformed, map: null };
    },
  };
}
