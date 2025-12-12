/**
 * CSS Utilities Module
 * 
 * This module contains all CSS-related utilities for the Island system:
 * - Svelte SSR CSS collection and management
 * - CSS scoping for component isolation
 * - CSS optimization and minification
 * - CSS parsing and deduplication
 */

// Enhanced global CSS collector for SSR with scoping support
declare global {
  var __svelteSSRCSS: Map<string, SvelteSSRCSSEntry> | undefined;
}

interface SvelteSSRCSSEntry {
  css: string;
  scopeId: string;
  src: string;
  isGlobal: boolean;
  timestamp: number;
}

// Initialize enhanced global CSS collector
if (typeof globalThis !== "undefined" && !globalThis.__svelteSSRCSS) {
  globalThis.__svelteSSRCSS = new Map();
}

/**
 * Add CSS to the global Svelte SSR collection with scoping information
 */
export function addSvelteSSRCSS(
  css: string,
  scopeId: string,
  src: string,
  isGlobal = false,
): void {
  if (!globalThis.__svelteSSRCSS) {
    globalThis.__svelteSSRCSS = new Map();
  }

  const entry: SvelteSSRCSSEntry = {
    css: css.trim(),
    scopeId,
    src,
    isGlobal,
    timestamp: Date.now(),
  };

  // Use scopeId as key to prevent duplicates from the same component
  globalThis.__svelteSSRCSS.set(scopeId, entry);

  console.log(
    `📝 Added Svelte CSS to global collection: ${scopeId} (${css.length} chars, global: ${isGlobal})`,
  );
}

/**
 * Get collected Svelte SSR CSS with enhanced processing and deduplication
 * Enhanced version with better CSS management and document head injection support
 */
export function getSvelteSSRCSS(clear = false) {
  if (!globalThis.__svelteSSRCSS || globalThis.__svelteSSRCSS.size === 0) {
    return "";
  }

  const entries = Array.from(globalThis.__svelteSSRCSS.values());

  // Sort entries: global styles first, then component styles by timestamp
  entries.sort((a, b) => {
    if (a.isGlobal && !b.isGlobal) return -1;
    if (!a.isGlobal && b.isGlobal) return 1;
    return a.timestamp - b.timestamp;
  });

  // Separate global and component-scoped CSS for better organization
  const globalEntries = entries.filter((entry) => entry.isGlobal);
  const componentEntries = entries.filter((entry) => !entry.isGlobal);

  // Process global CSS
  const globalCSS = globalEntries.map((entry) => {
    const comment = `/* Global CSS from: ${entry.src} */`;
    return `${comment}\n${entry.css}`;
  }).join("\n\n");

  // Process component-scoped CSS
  const componentCSS = componentEntries.map((entry) => {
    const comment = `/* Component CSS: ${entry.src} (${entry.scopeId}) */`;
    return `${comment}\n${entry.css}`;
  }).join("\n\n");

  // Combine in proper order: global first, then component-specific
  const combinedCSS = [globalCSS, componentCSS].filter((css) => css.trim())
    .join("\n\n");

  // Apply enhanced CSS optimization and deduplication
  const optimizedCSS = optimizeSvelteSSRCSS(combinedCSS);

  if (clear) {
    globalThis.__svelteSSRCSS.clear();
    console.log(`🧹 Cleared Svelte SSR CSS collection`);
  }

  console.log(
    `📦 Retrieved Svelte SSR CSS: ${entries.length} components (${globalEntries.length} global, ${componentEntries.length} scoped), ${optimizedCSS.length} chars`,
  );
  return optimizedCSS;
}

/**
 * Get CSS formatted for document head injection during SSR
 * Returns CSS wrapped in appropriate style tags with metadata
 */
export function getSvelteSSRCSSForHead(clear = false) {
  const css = getSvelteSSRCSS(clear);

  if (!css.trim()) {
    return "";
  }

  // Wrap in style tag with metadata for identification and debugging
  const timestamp = new Date().toISOString();
  const styleTag =
    `<style data-svelte-ssr="true" data-generated="${timestamp}">\n${css}\n</style>`;

  console.log(
    `📝 Generated Svelte SSR CSS for document head: ${styleTag.length} chars`,
  );
  return styleTag;
}

/**
 * Get CSS statistics for debugging and monitoring
 */
export function getSvelteSSRCSSStats() {
  if (!globalThis.__svelteSSRCSS || globalThis.__svelteSSRCSS.size === 0) {
    return {
      totalComponents: 0,
      globalComponents: 0,
      scopedComponents: 0,
      totalCSSSize: 0,
      averageCSSSize: 0,
      oldestTimestamp: 0,
      newestTimestamp: 0,
    };
  }

  const entries = Array.from(globalThis.__svelteSSRCSS.values());
  const globalEntries = entries.filter((entry) => entry.isGlobal);
  const scopedEntries = entries.filter((entry) => !entry.isGlobal);
  const totalCSSSize = entries.reduce(
    (sum, entry) => sum + entry.css.length,
    0,
  );
  const timestamps = entries.map((entry) => entry.timestamp);

  return {
    totalComponents: entries.length,
    globalComponents: globalEntries.length,
    scopedComponents: scopedEntries.length,
    totalCSSSize,
    averageCSSSize: entries.length > 0
      ? Math.round(totalCSSSize / entries.length)
      : 0,
    oldestTimestamp: Math.min(...timestamps),
    newestTimestamp: Math.max(...timestamps),
  };
}

/**
 * Get CSS for specific component scope
 */
export function getSvelteComponentCSS(scopeId: string) {
  if (!globalThis.__svelteSSRCSS) {
    return null;
  }

  const entry = globalThis.__svelteSSRCSS.get(scopeId);
  return entry ? entry.css : null;
}

/**
 * Clear CSS for specific component scope
 */
export function clearSvelteComponentCSS(scopeId: string) {
  if (!globalThis.__svelteSSRCSS) {
    return false;
  }

  const deleted = globalThis.__svelteSSRCSS.delete(scopeId);
  if (deleted) {
    console.log(`🧹 Cleared CSS for component scope: ${scopeId}`);
  }
  return deleted;
}

/**
 * Optimize collected Svelte SSR CSS by removing duplicates and minifying
 * Enhanced version with better deduplication and cross-component optimization
 */
function optimizeSvelteSSRCSS(css: string) {
  try {
    // Use the enhanced CSS optimization functions
    const optimizedCSS = optimizeComponentCSS(css);

    // Additional optimizations specific to SSR CSS collection
    const finalCSS = optimizeSSRCSSCollection(optimizedCSS);

    console.log(
      `🔧 Optimized Svelte SSR CSS: ${css.length} → ${finalCSS.length} chars (${
        Math.round((1 - finalCSS.length / css.length) * 100)
      }% reduction)`,
    );

    return finalCSS;
  } catch (error) {
    console.warn(`⚠️ Failed to optimize Svelte SSR CSS:`, error);
    return css;
  }
}

/**
 * Apply SSR-specific CSS optimizations across multiple components
 */
function optimizeSSRCSSCollection(css: string) {
  try {
    // Remove duplicate comments
    const withoutDuplicateComments = removeDuplicateComments(css);

    // Optimize cross-component CSS patterns
    const crossOptimized = optimizeCrossComponentCSS(withoutDuplicateComments);

    // Apply final formatting based on environment
    const isDev = Deno.env.get("DENO_ENV") !== "production";
    if (!isDev) {
      return minifyCSS(crossOptimized);
    }

    // Keep readable format in development with proper indentation
    return formatDevelopmentCSS(crossOptimized);
  } catch (error) {
    console.warn(`⚠️ Failed to apply SSR CSS collection optimizations:`, error);
    return css;
  }
}

/**
 * Remove duplicate CSS comments while preserving important ones
 */
function removeDuplicateComments(css: string) {
  const seenComments = new Set<string>();

  return css.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, (comment) => {
    // Keep important comments (those with specific markers)
    if (
      comment.includes("!important") || comment.includes("@preserve") ||
      comment.includes("license")
    ) {
      return comment;
    }

    // Remove duplicate comments
    if (seenComments.has(comment)) {
      return "";
    }

    seenComments.add(comment);
    return comment;
  });
}

/**
 * Optimize CSS patterns that appear across multiple components
 */
function optimizeCrossComponentCSS(css: string) {
  // This could be extended to merge similar rules across components
  // For now, just clean up whitespace and formatting
  return css
    .replace(/\n\s*\n\s*\n/g, "\n\n") // Collapse multiple empty lines
    .replace(/^\s*\n/gm, "") // Remove empty lines at start of sections
    .trim();
}

/**
 * Format CSS for development with proper indentation and spacing
 */
function formatDevelopmentCSS(css: string) {
  return css
    .replace(/\{/g, " {\n  ")
    .replace(/;/g, ";\n  ")
    .replace(/\}/g, "\n}\n")
    .replace(/\n {2}\n/g, "\n")
    .replace(/\n\n+/g, "\n\n")
    .trim();
}

/**
 * Apply CSS scoping to selectors with advanced logic
 * Enhanced version with better selector parsing and scoping rules
 */
export function applyCSSScoping(cssContent: string, scopeId: string) {
  return cssContent.replace(/([^{}]+){/g, (match, selector) => {
    const trimmedSelector = selector.trim();

    // Skip at-rules (@media, @keyframes, @import, etc.)
    if (trimmedSelector.startsWith("@")) {
      return match;
    }

    // Skip selectors that already have scoping
    if (trimmedSelector.includes(`[data-${scopeId}]`)) {
      return match;
    }

    // Skip :global() selectors (remove the wrapper)
    if (trimmedSelector.includes(":global(")) {
      const globalSelector = trimmedSelector.replace(
        /:global\(([^)]+)\)/g,
        "$1",
      );
      return `${globalSelector} {`;
    }

    // Apply scoping to each selector in a comma-separated list
    const scopedSelectors = trimmedSelector
      .split(",")
      .map((sel: string) => applySelectorScoping(sel.trim(), scopeId))
      .join(", ");

    return `${scopedSelectors} {`;
  });
}

/**
 * Apply scoping to a single CSS selector with comprehensive logic
 */
export function applySelectorScoping(selector: string, scopeId: string) {
  // Handle empty or invalid selectors
  if (!selector || selector.length === 0) {
    return selector;
  }

  // Skip already scoped selectors
  if (selector.includes(`[data-${scopeId}]`)) {
    return selector;
  }

  // Handle complex selectors with combinators (>, +, ~, space)
  const combinatorRegex = /(\s*[>+~]\s*|\s+)/;
  const parts = selector.split(combinatorRegex);

  if (parts.length > 1) {
    // Complex selector with combinators - scope the first part only
    const firstPart = parts[0].trim();
    const rest = parts.slice(1).join("");
    return applySingleSelectorScoping(firstPart, scopeId) + rest;
  }

  // Simple selector
  return applySingleSelectorScoping(selector, scopeId);
}

/**
 * Apply scoping to a single, simple CSS selector
 */
function applySingleSelectorScoping(selector: string, scopeId: string) {
  // Handle pseudo-elements (::before, ::after)
  const pseudoElementMatch = selector.match(/^([^:]+)(::.*)?$/);
  if (pseudoElementMatch) {
    const [, baseSelector, pseudoElement] = pseudoElementMatch;
    return `${baseSelector}[data-${scopeId}]${pseudoElement || ""}`;
  }

  // Handle pseudo-classes (:hover, :focus, :nth-child, etc.)
  const pseudoClassMatch = selector.match(/^([^:]+)(:.*)?$/);
  if (pseudoClassMatch) {
    const [, baseSelector, pseudoClass] = pseudoClassMatch;
    return `${baseSelector}[data-${scopeId}]${pseudoClass || ""}`;
  }

  // Simple selector without pseudo-classes/elements
  return `${selector}[data-${scopeId}]`;
}

/**
 * Optimize component CSS by removing duplicates and applying minification
 * Enhanced version with better deduplication and optimization strategies
 */
export function optimizeComponentCSS(css: string) {
  try {
    // Parse CSS into rules with better handling
    const rules = parseCSRules(css);
    const optimizedRules = deduplicateCSRules(rules);

    // Reconstruct CSS
    const optimizedCSS = optimizedRules.join("\n");

    // Apply environment-specific optimizations
    const isDev = Deno.env.get("DENO_ENV") !== "production";
    if (!isDev) {
      return minifyCSS(optimizedCSS);
    }

    return optimizedCSS;
  } catch (error) {
    console.warn(`⚠️ Failed to optimize component CSS:`, error);
    return css;
  }
}

/**
 * Parse CSS into individual rules with proper handling of nested structures
 */
function parseCSRules(css: string) {
  const rules: string[] = [];
  let currentRule = "";
  let braceDepth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    const prevChar = i > 0 ? css[i - 1] : "";

    // Handle string literals
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = "";
      }
    }

    if (!inString) {
      if (char === "{") {
        braceDepth++;
      } else if (char === "}") {
        braceDepth--;

        if (braceDepth === 0) {
          // End of a complete rule
          currentRule += char;
          const trimmedRule = currentRule.trim();
          if (trimmedRule && !isEmptyRule(trimmedRule)) {
            rules.push(trimmedRule);
          }
          currentRule = "";
          continue;
        }
      }
    }

    currentRule += char;
  }

  // Handle any remaining content
  if (currentRule.trim()) {
    rules.push(currentRule.trim());
  }

  return rules;
}

/**
 * Deduplicate CSS rules while preserving order and handling specificity
 */
function deduplicateCSRules(rules: string[]) {
  const seenRules = new Map<string, { rule: string; index: number }>();
  const result: string[] = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const ruleKey = extractRuleKey(rule);

    if (ruleKey) {
      const existing = seenRules.get(ruleKey);
      if (existing) {
        // Replace earlier rule with later one (cascade order)
        result[existing.index] = rule;
        seenRules.set(ruleKey, { rule, index: existing.index });
      } else {
        // New rule
        const index = result.length;
        result.push(rule);
        seenRules.set(ruleKey, { rule, index });
      }
    } else {
      // Non-standard rule (at-rules, etc.) - keep as-is
      result.push(rule);
    }
  }

  return result.filter((rule) => rule !== null);
}

/**
 * Extract a key for rule deduplication (selector + property combination)
 */
function extractRuleKey(rule: string) {
  const match = rule.match(/^([^{]+)\{([^}]+)\}/);
  if (!match) return null;

  const selector = match[1].trim();
  const declarations = match[2].trim();

  // For deduplication, we consider rules with the same selector as duplicates
  // Later rules will override earlier ones (CSS cascade)
  return selector;
}

/**
 * Check if a CSS rule is effectively empty
 */
function isEmptyRule(rule: string) {
  const match = rule.match(/^[^{]+\{([^}]*)\}/);
  if (!match) return true;

  const declarations = match[1].trim();
  return declarations.length === 0 || declarations === ";";
}

/**
 * Minify CSS for production builds
 */
export function minifyCSS(css: string) {
  return css
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // Remove unnecessary whitespace
    .replace(/\s+/g, " ")
    // Remove whitespace around braces and semicolons
    .replace(/\s*{\s*/g, "{")
    .replace(/\s*}\s*/g, "}")
    .replace(/\s*;\s*/g, ";")
    .replace(/;\s*}/g, "}")
    // Remove trailing semicolons before closing braces
    .replace(/;}/g, "}")
    // Trim
    .trim();
}

/**
 * Generate consistent scope ID for any component framework
 * Provides unified scoping across Vue, Svelte, and other frameworks
 */
export function generateComponentScopeId(
  src: string,
  framework: string = "component",
) {
  const cleanPath = src
    .replace(/^\/+/, "") // Remove leading slashes
    .replace(/\.(svelte|tsx|jsx|vue|ts|js)$/, "") // Remove file extensions
    .replace(/[^a-zA-Z0-9\/]/g, "-") // Replace special chars with hyphens
    .replace(/\/+/g, "-") // Replace path separators with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, "") // Remove leading/trailing hyphens
    .toLowerCase();

  // Add framework prefix and hash for collision resistance
  const hash = simpleHash(src);
  return `${framework}-${cleanPath}-${hash}`;
}

/**
 * Simple hash function for generating consistent short hashes
 */
export function simpleHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}

// Note: processSvelteSSRCSS, extractRawCSSFromHead, and applySvelteComponentScoping
// were removed as they are not used anywhere in the codebase.
// They were originally intended for Svelte SSR CSS processing but are superseded
// by the Svelte 5 render() function which handles CSS differently.
