/**
 * Universal CSS Collector
 * 
 * Collects and manages CSS from all framework integrations (Vue, Svelte, Solid, Preact)
 * during SSR rendering. Provides a unified interface for CSS injection into the document head.
 */

declare global {
  var __universalSSRCSS: Map<string, UniversalCSSEntry> | undefined;
}

export interface UniversalCSSEntry {
  css: string;
  scopeId: string;
  src: string;
  framework: string;
  timestamp: number;
}

// Initialize global CSS collector
if (typeof globalThis !== "undefined" && !globalThis.__universalSSRCSS) {
  globalThis.__universalSSRCSS = new Map();
}

/**
 * Add CSS from any framework integration to the global collection
 */
export function addUniversalCSS(
  css: string,
  src: string,
  framework: string,
  scopeId?: string,
): void {
  if (!css || !css.trim()) {
    return;
  }

  if (!globalThis.__universalSSRCSS) {
    globalThis.__universalSSRCSS = new Map();
  }

  // Generate a unique key for this CSS entry
  const key = scopeId || `${framework}-${src}`;

  const entry: UniversalCSSEntry = {
    css: css.trim(),
    scopeId: key,
    src,
    framework,
    timestamp: Date.now(),
  };

  globalThis.__universalSSRCSS.set(key, entry);

  console.log(
    `📝 [UniversalCSS] Added ${framework} CSS to universal collection: ${key} (${css.length} chars)`,
  );
  console.log(
    `📝 [UniversalCSS] Current collection size: ${globalThis.__universalSSRCSS.size} entries`,
  );
}

/**
 * Get all collected CSS from all frameworks
 */
export function getUniversalCSS(clear = false): string {
  if (!globalThis.__universalSSRCSS || globalThis.__universalSSRCSS.size === 0) {
    return "";
  }

  const entries = Array.from(globalThis.__universalSSRCSS.values());

  // Sort by timestamp to maintain render order
  entries.sort((a, b) => a.timestamp - b.timestamp);

  // Group by framework for better organization
  const cssByFramework = entries.reduce((acc, entry) => {
    if (!acc[entry.framework]) {
      acc[entry.framework] = [];
    }
    acc[entry.framework].push(entry);
    return acc;
  }, {} as Record<string, UniversalCSSEntry[]>);

  // Build CSS string with framework sections
  const cssBlocks: string[] = [];

  for (const [framework, frameworkEntries] of Object.entries(cssByFramework)) {
    const frameworkCSS = frameworkEntries.map((entry) => {
      const comment = `/* ${framework}: ${entry.src} (${entry.scopeId}) */`;
      return `${comment}\n${entry.css}`;
    }).join("\n\n");

    cssBlocks.push(frameworkCSS);
  }

  const combinedCSS = cssBlocks.join("\n\n");

  if (clear) {
    globalThis.__universalSSRCSS.clear();
    console.log(`🧹 Cleared universal SSR CSS collection`);
  }

  console.log(
    `📦 Retrieved universal SSR CSS: ${entries.length} components from ${
      Object.keys(cssByFramework).length
    } frameworks, ${combinedCSS.length} chars`,
  );

  return combinedCSS;
}

/**
 * Get CSS formatted for document head injection
 */
export function getUniversalCSSForHead(clear = false): string {
  console.log(`🎨 [UniversalCSS] getUniversalCSSForHead called (clear: ${clear})`);
  const css = getUniversalCSS(clear);

  if (!css.trim()) {
    console.log(`⚠️ [UniversalCSS] No CSS to inject into head`);
    return "";
  }

  const timestamp = new Date().toISOString();
  const styleTag =
    `<style data-universal-ssr="true" data-generated="${timestamp}">\n${css}\n</style>`;

  console.log(
    `✅ [UniversalCSS] Generated universal SSR CSS for document head: ${styleTag.length} chars`,
  );
  console.log(
    `📝 [UniversalCSS] Style tag preview:`, styleTag.substring(0, 200)
  );

  return styleTag;
}

/**
 * Clear all collected CSS
 */
export function clearUniversalCSS(): void {
  if (globalThis.__universalSSRCSS) {
    globalThis.__universalSSRCSS.clear();
    console.log(`🧹 Cleared all universal SSR CSS`);
  }
}

/**
 * Get CSS statistics
 */
export function getUniversalCSSStats(): {
  totalComponents: number;
  byFramework: Record<string, number>;
  totalCSSSize: number;
  averageCSSSize: number;
} {
  if (!globalThis.__universalSSRCSS || globalThis.__universalSSRCSS.size === 0) {
    return {
      totalComponents: 0,
      byFramework: {},
      totalCSSSize: 0,
      averageCSSSize: 0,
    };
  }

  const entries = Array.from(globalThis.__universalSSRCSS.values());
  const byFramework = entries.reduce((acc, entry) => {
    acc[entry.framework] = (acc[entry.framework] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalCSSSize = entries.reduce((sum, entry) => sum + entry.css.length, 0);

  return {
    totalComponents: entries.length,
    byFramework,
    totalCSSSize,
    averageCSSSize: entries.length > 0 ? Math.round(totalCSSSize / entries.length) : 0,
  };
}
