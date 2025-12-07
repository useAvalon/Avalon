/**
 * Universal Head Content Collector for SSR
 * 
 * Collects head content (scripts, meta tags, etc.) from framework integrations
 * during SSR and injects them into the HTML head.
 * 
 * Similar to universal-css-collector.ts but for head content.
 */

interface HeadEntry {
  content: string;
  src: string;
  framework: string;
  type: 'script' | 'meta' | 'link' | 'other';
}

declare global {
  var __universalSSRHead: Map<string, HeadEntry>;
}

/**
 * Initialize the global head collector if it doesn't exist
 */
function initHeadCollector(): Map<string, HeadEntry> {
  if (!globalThis.__universalSSRHead) {
    globalThis.__universalSSRHead = new Map();
  }
  return globalThis.__universalSSRHead;
}

/**
 * Add head content to the universal collector
 * 
 * @param content - The head content (script, meta tag, etc.)
 * @param src - Source component path
 * @param framework - Framework name
 * @param type - Type of head content
 */
export function addUniversalHead(
  content: string,
  src: string,
  framework: string,
  type: 'script' | 'meta' | 'link' | 'other' = 'other'
): void {
  const collector = initHeadCollector();
  
  // Generate a unique key for this head entry
  const key = `${framework}-${src}-${type}`;
  
  collector.set(key, {
    content,
    src,
    framework,
    type,
  });
  
  console.log(`📄 [Head Collector] Added ${type} for ${framework}:${src} (${content.length} chars)`);
}

/**
 * Get all collected head content formatted for injection into HTML head
 * 
 * @param clear - Whether to clear the collector after getting content
 * @returns Formatted head content string
 */
export function getUniversalHeadForInjection(clear = false): string {
  const collector = initHeadCollector();
  
  if (collector.size === 0) {
    return '';
  }
  
  const entries = Array.from(collector.values());
  
  // Group by type for better organization
  const scripts = entries.filter(e => e.type === 'script');
  const metas = entries.filter(e => e.type === 'meta');
  const links = entries.filter(e => e.type === 'link');
  const others = entries.filter(e => e.type === 'other');
  
  const parts: string[] = [];
  
  // Add meta tags first
  if (metas.length > 0) {
    parts.push('<!-- Framework Meta Tags -->');
    parts.push(...metas.map(e => e.content));
  }
  
  // Add links
  if (links.length > 0) {
    parts.push('<!-- Framework Links -->');
    parts.push(...links.map(e => e.content));
  }
  
  // Add scripts
  if (scripts.length > 0) {
    parts.push('<!-- Framework Hydration Scripts -->');
    // Wrap script content in <script> tags if not already wrapped
    parts.push(...scripts.map(e => {
      const content = e.content.trim();
      // Check if already wrapped in script tags
      if (content.startsWith('<script')) {
        return content;
      }
      // Wrap in script tags
      return `<script>${content}</script>`;
    }));
  }
  
  // Add other content
  if (others.length > 0) {
    parts.push('<!-- Framework Head Content -->');
    parts.push(...others.map(e => e.content));
  }
  
  const result = parts.join('\n    ');
  
  console.log(`📄 [Head Collector] Generated head content (${result.length} chars, ${entries.length} entries)`);
  
  if (clear) {
    collector.clear();
    console.log(`📄 [Head Collector] Cleared collector`);
  }
  
  return result;
}

/**
 * Clear all collected head content
 */
export function clearUniversalHead(): void {
  const collector = initHeadCollector();
  collector.clear();
  console.log(`📄 [Head Collector] Cleared all head content`);
}

/**
 * Get the current size of the head collector
 */
export function getHeadCollectorSize(): number {
  const collector = initHeadCollector();
  return collector.size;
}
