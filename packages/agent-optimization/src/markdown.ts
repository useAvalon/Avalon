/**
 * HTML-to-markdown conversion and content negotiation utilities.
 *
 * Uses a lightweight regex-based approach to convert the subset of HTML
 * elements we care about into clean markdown suitable for AI agent consumption.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageMetadata {
  title?: string;
  description?: string;
  openGraph?: { title?: string; description?: string; image?: string };
  head?: any[];
}

// ---------------------------------------------------------------------------
// Content Negotiation
// ---------------------------------------------------------------------------

/**
 * Returns `true` if and only if the Accept header contains `text/markdown`
 * as a media type.
 */
export function shouldServeMarkdown(acceptHeader: string | undefined): boolean {
  if (!acceptHeader) return false;

  // Split on commas to get individual media types, then check each one.
  // Each media type may have parameters (e.g. `text/markdown; q=0.9`).
  return acceptHeader.split(',').some((part) => {
    const mediaType = part.split(';')[0].trim().toLowerCase();
    return mediaType === 'text/markdown';
  });
}

// ---------------------------------------------------------------------------
// Front Matter
// ---------------------------------------------------------------------------

/**
 * Produces a YAML front matter block with title and/or description.
 * Returns an empty string when metadata has neither title nor description.
 */
export function buildFrontMatter(metadata: PageMetadata): string {
  const lines: string[] = [];

  if (metadata.title) {
    lines.push(`title: "${escapeYamlString(metadata.title)}"`);
  }
  if (metadata.description) {
    lines.push(`description: "${escapeYamlString(metadata.description)}"`);
  }

  if (lines.length === 0) return '';

  return `---\n${lines.join('\n')}\n---\n`;
}

/** Escape characters that would break a YAML double-quoted string. */
function escapeYamlString(str: string): string {
  return str.replaceAll('\\', String.raw`\\`).replaceAll('"', String.raw`\"`);
}

// ---------------------------------------------------------------------------
// HTML-to-Markdown Conversion
// ---------------------------------------------------------------------------

/**
 * Convert an HTML string to markdown.
 *
 * Strips non-content elements (`<script>`, `<style>`, `<nav>`, `<header>`,
 * `<footer>`), extracts the `#app` div or `<main>` content (falling back to
 * `<body>`), and converts headings, paragraphs, links, lists, code blocks,
 * images, and emphasis to markdown.
 *
 * Returns an empty string when the HTML has no meaningful body content.
 */
export function htmlToMarkdown(html: string): string {
  // 1. Extract content from #app, <main>, or <body>
  let content = extractContent(html);
  if (!content.trim()) return '';

  // 2. Strip non-content elements
  content = stripElements(content, ['script', 'style', 'nav', 'header', 'footer']);

  // 3. Convert HTML elements to markdown
  content = convertToMarkdown(content);

  // 4. Clean up whitespace
  content = cleanWhitespace(content);

  return content;
}

// ---------------------------------------------------------------------------
// Content Extraction
// ---------------------------------------------------------------------------

/**
 * Extract the main content area from the HTML.
 * Priority: #app div > <main> element > <body> element.
 */
function extractContent(html: string): string {
  // Try #app div first
  const appMatch = extractTagById(html, 'div', 'app');
  if (appMatch) return appMatch;

  // Try <main> element
  const mainMatch = extractTagContent(html, 'main');
  if (mainMatch) return mainMatch;

  // Fall back to <body>
  const bodyMatch = extractTagContent(html, 'body');
  if (bodyMatch) return bodyMatch;

  return '';
}

/**
 * Extract inner content of a tag with a specific id attribute.
 */
function extractTagById(html: string, tag: string, id: string): string | null {
  const re = new RegExp(
    String.raw`<${tag}[^>]*\bid\s*=\s*["']${id}["'][^>]*>([\s\S]*?)<\/${tag}>`,
    'i',
  );
  const match = html.match(re);
  return match ? match[1] : null;
}

/**
 * Extract inner content of the first occurrence of a tag.
 * Uses a balanced-matching approach for nested tags.
 */
function extractTagContent(html: string, tag: string): string | null {
  const openRe = new RegExp(String.raw`<${tag}(?:\s[^>]*)?>`, 'i');
  const openMatch = html.match(openRe);
  if (!openMatch || openMatch.index === undefined) return null;

  const startInner = openMatch.index + openMatch[0].length;
  const closeTag = `</${tag}>`;
  const closeIdx = html.toLowerCase().indexOf(closeTag.toLowerCase(), startInner);
  if (closeIdx === -1) return null;

  return html.slice(startInner, closeIdx);
}

// ---------------------------------------------------------------------------
// Element Stripping
// ---------------------------------------------------------------------------

/**
 * Remove all occurrences of the specified HTML elements and their content.
 */
function stripElements(html: string, tags: string[]): string {
  let result = html;
  for (const tag of tags) {
    // Match both self-closing and content-bearing variants
    const re = new RegExp(String.raw`<${tag}(?:\s[^>]*)?>[\s\S]*?<\/${tag}>`, 'gi');
    result = result.replaceAll(re, '');
    // Also strip self-closing variants
    const selfClosingRe = new RegExp(String.raw`<${tag}(?:\s[^>]*)?\s*\/?>(?!.*<\/${tag}>)`, 'gi');
    result = result.replaceAll(selfClosingRe, '');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Markdown Conversion
// ---------------------------------------------------------------------------

/**
 * Convert HTML elements to their markdown equivalents.
 */
function convertToMarkdown(html: string): string {
  let md = html;

  // Pre/code blocks — must be handled before inline code
  md = convertCodeBlocks(md);

  // Headings (h1–h6)
  for (let level = 1; level <= 6; level++) {
    const prefix = '#'.repeat(level);
    const re = new RegExp(
      String.raw`<h${level}(?:\s[^>]*)?>([\s\S]*?)<\/h${level}>`,
      'gi',
    );
    md = md.replaceAll(re, (_match, inner: string) => {
      return `\n${prefix} ${stripInlineTags(inner).trim()}\n`;
    });
  }

  // Images — must be before links to avoid <a><img></a> conflicts
  md = md.replaceAll(
    /<img\s[^>]*?src\s*=\s*["']([^"']+)["'][^>]*?alt\s*=\s*["']([^"']*)["'][^>]*?\/?>/gi,
    (_match, src: string, alt: string) => `![${alt}](${src})`,
  );
  md = md.replaceAll(
    /<img\s[^>]*?alt\s*=\s*["']([^"']*)["'][^>]*?src\s*=\s*["']([^"']+)["'][^>]*?\/?>/gi,
    (_match, alt: string, src: string) => `![${alt}](${src})`,
  );
  // img with src only (no alt)
  md = md.replaceAll(
    /<img\s[^>]*?src\s*=\s*["']([^"']+)["'][^>]*?\/?>/gi,
    (_match, src: string) => `![](${src})`,
  );

  // Links
  md = md.replaceAll(
    /<a\s[^>]*?href\s*=\s*["']([^"']+)["'][^>]*?>([\s\S]*?)<\/a>/gi,
    (_match, href: string, inner: string) => `[${stripInlineTags(inner).trim()}](${href})`,
  );

  // Bold / strong
  md = md.replaceAll(/<(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**');

  // Italic / em
  md = md.replaceAll(/<(?:em|i)(?:\s[^>]*)?>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*');

  // Inline code
  md = md.replaceAll(/<code(?:\s[^>]*)?>([\s\S]*?)<\/code>/gi, '`$1`');

  // Unordered lists
  md = convertLists(md, 'ul', 'unordered');

  // Ordered lists
  md = convertLists(md, 'ol', 'ordered');

  // Paragraphs
  md = md.replaceAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi, (_match, inner: string) => {
    return `\n${stripInlineTags(inner).trim()}\n`;
  });

  // Blockquotes
  md = md.replaceAll(/<blockquote(?:\s[^>]*)?>([\s\S]*?)<\/blockquote>/gi, (_match, inner: string) => {
    const lines = stripInlineTags(inner).trim().split('\n');
    return '\n' + lines.map((l: string) => `> ${l.trim()}`).join('\n') + '\n';
  });

  // Horizontal rules
  md = md.replaceAll(/<hr\s*\/?>/gi, '\n---\n');

  // Line breaks
  md = md.replaceAll(/<br\s*\/?>/gi, '\n');

  // Strip remaining HTML tags
  md = md.replaceAll(/<[^>]+>/g, '');

  // Decode common HTML entities
  md = decodeEntities(md);

  return md;
}

/**
 * Convert <pre><code> blocks to fenced code blocks.
 * Split into two passes to reduce regex complexity.
 */
function convertCodeBlocks(html: string): string {
  // Pass 1: <pre><code class="language-xxx">...</code></pre>
  const langCodeRe = /<pre(?:\s[^>]*)?>\s*<code\s[^>]*class\s*=\s*["'](?:language-)?(\w+)["'][^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;
  let result = html.replaceAll(langCodeRe, (_match, lang: string, code: string) => {
    const decoded = decodeEntities(code.replaceAll(/<[^>]+>/g, ''));
    return `\n\`\`\`${lang}\n${decoded.trim()}\n\`\`\`\n`;
  });

  // Pass 2: <pre><code>...</code></pre> (no language)
  const plainCodeRe = /<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)<\/code>\s*<\/pre>/gi;
  result = result.replaceAll(plainCodeRe, (_match, code: string) => {
    const decoded = decodeEntities(code.replaceAll(/<[^>]+>/g, ''));
    return `\n\`\`\`\n${decoded.trim()}\n\`\`\`\n`;
  });

  // Pass 3: <pre>...</pre> without <code>
  const preOnlyRe = /<pre(?:\s[^>]*)?>([\s\S]*?)<\/pre>/gi;
  result = result.replaceAll(preOnlyRe, (_match, code: string) => {
    const decoded = decodeEntities(code.replaceAll(/<[^>]+>/g, ''));
    return `\n\`\`\`\n${decoded.trim()}\n\`\`\`\n`;
  });

  return result;
}

/**
 * Convert list elements to markdown.
 */
function convertLists(html: string, tag: 'ul' | 'ol', type: 'unordered' | 'ordered'): string {
  const re = new RegExp(String.raw`<${tag}(?:\s[^>]*)?>([\s\S]*?)<\/${tag}>`, 'gi');
  return html.replaceAll(re, (_match, inner: string) => {
    return '\n' + convertListItems(inner, type) + '\n';
  });
}

/**
 * Convert <li> elements within a list to markdown list items.
 */
function convertListItems(html: string, type: 'unordered' | 'ordered'): string {
  const items: string[] = [];
  const liRe = /<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  let index = 1;

  while ((match = liRe.exec(html)) !== null) {
    const content = stripInlineTags(match[1]).trim();
    const prefix = type === 'ordered' ? `${index}. ` : '- ';
    items.push(`${prefix}${content}`);
    index++;
  }

  return items.join('\n');
}

/**
 * Strip HTML tags but keep text content (for inline elements inside headings, etc.).
 */
function stripInlineTags(html: string): string {
  return html.replaceAll(/<[^>]+>/g, '');
}

/**
 * Decode common HTML entities.
 */
function decodeEntities(html: string): string {
  return html
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&nbsp;', ' ');
}

// ---------------------------------------------------------------------------
// Whitespace Cleanup
// ---------------------------------------------------------------------------

/**
 * Normalize whitespace in the converted markdown.
 */
function cleanWhitespace(md: string): string {
  return md
    // Collapse 3+ consecutive newlines into 2
    .replaceAll(/\n{3,}/g, '\n\n')
    // Trim leading/trailing whitespace
    .trim()
    // Ensure trailing newline
    + '\n';
}
