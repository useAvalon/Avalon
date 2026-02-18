/**
 * Vue CSS Extractor
 * 
 * Utilities for extracting and processing CSS from Vue Single File Components.
 * Handles both scoped and global styles with proper attribute application.
 */

import { readFile } from "node:fs/promises";
import type { CSSExtractionOptions, StyleBlock } from "../types.ts";

/**
 * Extract CSS from Vue Single File Component
 * 
 * Parses <style> blocks from .vue files and applies scoping if needed.
 * Supports both scoped and global styles.
 * 
 * @param src - Path to the Vue component file
 * @param options - CSS extraction options
 * @returns Extracted and processed CSS string
 */
export async function extractCSS(
  src: string,
  options: CSSExtractionOptions = {},
) {
  // Try different path variations to find the Vue file
  const pathVariations = [
    // Standard framework paths
    src.startsWith("/") ? `src${src}` : src,
    src.replace("/islands/", "/src/islands/"),
    // Remove leading slash variations
    src.startsWith("/") ? src.substring(1) : src,
  ];

  let vueContent = "";
  
  for (const path of pathVariations) {
    try {
      vueContent = await readFile(path, "utf-8");
      break;
    } catch {
      continue;
    }
  }

  if (!vueContent) {
    throw new Error(
      `Vue file not found in any of the attempted paths: ${
        pathVariations.join(", ")
      }`,
    );
  }

  // Extract all style blocks
  const styleBlocks = extractStyleBlocks(vueContent);
  
  if (styleBlocks.length === 0) {
    return "";
  }

  // Generate scope ID if not provided
  const scopeId = options.scopeId || generateScopeId(src);

  // Process each style block
  let componentCSS = "";
  
  for (const block of styleBlocks) {
    if (block.scoped) {
      componentCSS += applyScopedCSS(block.content, scopeId);
    } else {
      componentCSS += block.content;
    }
  }

  return componentCSS;
}

/**
 * Apply scoped CSS transformation
 * 
 * Adds scope attributes to CSS selectors for Vue's scoped styles.
 * Skips at-rules like @media, @keyframes, etc.
 * 
 * @param css - CSS content to scope
 * @param scopeId - Scope identifier (e.g., "data-v-abc123")
 * @returns Scoped CSS string
 */
export function applyScopedCSS(css: string, scopeId: string) {
  return css.replace(/([^{}]+){/g, (match, selector) => {
    const trimmedSelector = selector.trim();
    
    // Skip at-rules (@media, @keyframes, @supports, etc.)
    if (trimmedSelector.startsWith("@")) {
      return match;
    }
    
    // Add scope attribute to each selector
    // Handle multiple selectors separated by commas
    const scopedSelectors = trimmedSelector
      .split(",")
      .map((s: string) => `${s.trim()}[${scopeId}]`)
      .join(", ");
    
    return `${scopedSelectors} {`;
  });
}

/**
 * Extract style blocks from Vue SFC content
 * 
 * Parses <style> tags and extracts their content and attributes.
 * 
 * @param vueContent - Vue SFC file content
 * @returns Array of style blocks with metadata
 */
function extractStyleBlocks(vueContent: string) {
  const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/gi;
  const blocks: StyleBlock[] = [];
  let match;

  while ((match = styleRegex.exec(vueContent)) !== null) {
    const attributes = match[1];
    const content = match[2].trim();
    const isScoped = attributes.includes("scoped");

    blocks.push({
      content,
      scoped: isScoped,
      attributes,
    });
  }

  return blocks;
}

/**
 * Generate a consistent scope ID for a component
 * 
 * Creates a deterministic scope ID based on the component path.
 * Format: "data-v-{hash}" where hash is derived from the path.
 * 
 * @param src - Component source path
 * @returns Scope ID string
 */
export function generateScopeId(src: string) {
  // Remove special characters and convert to lowercase for consistency
  const hash = src.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `data-v-${hash}`;
}

/**
 * Apply scope attributes to HTML elements
 * 
 * Adds scope attributes to HTML tags for matching with scoped CSS.
 * Skips closing tags and self-closing tags.
 * 
 * @param html - HTML string to process
 * @param scopeId - Scope identifier
 * @returns HTML with scope attributes
 */
export function applyScopeToHTML(html: string, scopeId: string) {
  return html.replace(/<([a-zA-Z][^>]*?)>/g, (match, tagContent) => {
    // Skip closing tags
    if (tagContent.startsWith("/")) {
      return match;
    }
    
    // Skip self-closing tags (already have /)
    if (tagContent.endsWith("/")) {
      return match;
    }
    
    // Add scope attribute
    return `<${tagContent} ${scopeId}>`;
  });
}
