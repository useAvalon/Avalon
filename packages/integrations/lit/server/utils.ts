/**
 * Lit Server Utilities
 */

import { LitElement } from "lit";
import type { CSSResult } from "lit";
import { join } from "node:path";

/**
 * Extract custom element tag name from a Lit component
 */
export function getTagName(ElementClass: typeof LitElement): string {
  // deno-lint-ignore no-explicit-any
  const tagName = (ElementClass as any).elementName || 
                  // deno-lint-ignore no-explicit-any
                  (ElementClass as any).tagName ||
                  // deno-lint-ignore no-explicit-any
                  (ElementClass as any)._tagName;
  
  if (tagName && typeof tagName === "string") {
    return tagName;
  }
  
  // Convert PascalCase to kebab-case
  const className = ElementClass.name;
  if (className) {
    return className.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  }
  
  throw new Error("Could not determine tag name for Lit component");
}

function escapeAttributeValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Serialize props to HTML attributes
 */
export function serializeAttributes(props: Record<string, unknown>): string {
  const attributes: string[] = [];
  
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    
    const attrName = key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
    
    if (typeof value === "boolean") {
      if (value) attributes.push(attrName);
    } else if (typeof value === "string") {
      attributes.push(`${attrName}="${escapeAttributeValue(value)}"`);
    } else if (typeof value === "number") {
      attributes.push(`${attrName}="${value}"`);
    } else if (typeof value === "object") {
      try {
        attributes.push(`${attrName}='${escapeAttributeValue(JSON.stringify(value))}'`);
      } catch { /* skip */ }
    }
  }
  
  return attributes.join(" ");
}

/**
 * Collect styles from Lit component
 */
export function collectStyles(ElementClass: typeof LitElement): string {
  try {
    // deno-lint-ignore no-explicit-any
    const styles = (ElementClass as any).styles;
    if (!styles) return "";
    
    if (Array.isArray(styles)) {
      return styles.map(extractCssFromStyle).filter(Boolean).join("\n");
    }
    return extractCssFromStyle(styles);
  } catch {
    return "";
  }
}

function extractCssFromStyle(style: CSSResult | string | unknown): string {
  if (!style) return "";
  if (typeof style === "string") return style;
  if (typeof style === "object" && "cssText" in style) {
    return (style as CSSResult).cssText;
  }
  if (typeof style === "object" && "toString" in style) {
    return String(style);
  }
  return "";
}

function resolveIslandPath(src: string): string {
  if (src.startsWith("/islands/")) {
    return src.replace("/islands/", "/src/islands/");
  }
  return src;
}

/**
 * Extract tag name from source code (avoids decorator issues)
 */
export async function extractTagNameFromSource(src: string): Promise<string | null> {
  try {
    const resolvedSrc = resolveIslandPath(src);
    const componentPath = resolvedSrc.startsWith("/") 
      ? join(Deno.cwd(), resolvedSrc.slice(1))
      : resolvedSrc;
    
    const content = await Deno.readTextFile(componentPath);
    
    // Try different quote styles
    const patterns = [
      /@customElement\s*\(\s*"([^"]+)"\s*\)/,
      /@customElement\s*\(\s*'([^']+)'\s*\)/,
      /@customElement\s*\(\s*`([^`]+)`\s*\)/,
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match?.[1]) return match[1];
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Load a Lit component from file path
 */
export async function loadComponent(
  src: string,
  viteServer?: { ssrLoadModule: (path: string) => Promise<Record<string, unknown>> }
): Promise<typeof LitElement> {
  const resolvedSrc = resolveIslandPath(src);
  let module: Record<string, unknown>;
  
  if (viteServer) {
    module = await viteServer.ssrLoadModule(resolvedSrc);
  } else {
    const componentPath = resolvedSrc.startsWith("/")
      ? join(Deno.cwd(), resolvedSrc.slice(1))
      : resolvedSrc;
    module = await import(componentPath);
  }
  
  const Component = module.default || module[Object.keys(module)[0]];
  
  if (!Component || typeof Component !== "function") {
    throw new Error(`Invalid Lit component in ${src}`);
  }
  
  return Component as typeof LitElement;
}
