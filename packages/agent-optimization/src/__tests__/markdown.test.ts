import { describe, it, expect } from 'vitest';
import { shouldServeMarkdown, htmlToMarkdown, buildFrontMatter } from '../markdown.ts';
import type { PageMetadata } from '../markdown.ts';

// ---------------------------------------------------------------------------
// shouldServeMarkdown
// ---------------------------------------------------------------------------

describe('shouldServeMarkdown', () => {
  it('returns false for undefined', () => {
    expect(shouldServeMarkdown(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(shouldServeMarkdown('')).toBe(false);
  });

  it('returns true for exact text/markdown', () => {
    expect(shouldServeMarkdown('text/markdown')).toBe(true);
  });

  it('returns true when text/markdown is among multiple types', () => {
    expect(shouldServeMarkdown('text/html, text/markdown, application/json')).toBe(true);
  });

  it('returns true when text/markdown has quality parameter', () => {
    expect(shouldServeMarkdown('text/html, text/markdown; q=0.9')).toBe(true);
  });

  it('returns false when text/markdown is not present', () => {
    expect(shouldServeMarkdown('text/html, application/json')).toBe(false);
  });

  it('returns false for partial match like text/markdown-extra', () => {
    // The media type must be exactly text/markdown, not a prefix
    expect(shouldServeMarkdown('text/markdown-extra')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(shouldServeMarkdown('Text/Markdown')).toBe(true);
    expect(shouldServeMarkdown('TEXT/MARKDOWN')).toBe(true);
  });

  it('returns true with leading/trailing whitespace around type', () => {
    expect(shouldServeMarkdown('  text/markdown  ')).toBe(true);
  });

  it('returns false for */* wildcard (not explicit text/markdown)', () => {
    expect(shouldServeMarkdown('*/*')).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// htmlToMarkdown — element conversion
// ---------------------------------------------------------------------------

describe('htmlToMarkdown', () => {
  describe('content extraction', () => {
    it('extracts content from #app div', () => {
      const html = '<html><body><div id="app"><p>Hello world</p></div></body></html>';
      expect(htmlToMarkdown(html)).toContain('Hello world');
    });

    it('extracts content from <main> when no #app', () => {
      const html = '<html><body><main><p>Main content</p></main></body></html>';
      expect(htmlToMarkdown(html)).toContain('Main content');
    });

    it('falls back to <body> when no #app or <main>', () => {
      const html = '<html><body><p>Body content</p></body></html>';
      expect(htmlToMarkdown(html)).toContain('Body content');
    });

    it('returns empty string for empty body', () => {
      const html = '<html><body></body></html>';
      expect(htmlToMarkdown(html)).toBe('');
    });

    it('returns empty string for whitespace-only body', () => {
      const html = '<html><body>   \n  </body></html>';
      expect(htmlToMarkdown(html)).toBe('');
    });

    it('returns empty string when no body at all', () => {
      const html = '<html><head><title>Test</title></head></html>';
      expect(htmlToMarkdown(html)).toBe('');
    });

    it('returns empty string for empty string input', () => {
      expect(htmlToMarkdown('')).toBe('');
    });

    it('prefers #app over <main>', () => {
      const html = '<html><body><main><p>Main</p></main><div id="app"><p>App</p></div></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('App');
      expect(result).not.toContain('Main');
    });
  });

  describe('stripping non-content elements', () => {
    it('strips <script> elements', () => {
      const html = '<html><body><main><p>Content</p><script>alert("xss")</script></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('alert');
      expect(result).toContain('Content');
    });

    it('strips <style> elements', () => {
      const html = '<html><body><main><p>Content</p><style>.foo { color: red; }</style></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('color');
      expect(result).toContain('Content');
    });

    it('strips <nav> elements', () => {
      const html = '<html><body><main><nav><a href="/">Home</a></nav><p>Content</p></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('Home');
      expect(result).toContain('Content');
    });

    it('strips <header> elements', () => {
      const html = '<html><body><main><header><h1>Site Title</h1></header><p>Content</p></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('Site Title');
      expect(result).toContain('Content');
    });

    it('strips <footer> elements', () => {
      const html = '<html><body><main><p>Content</p><footer>Copyright 2024</footer></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('Copyright');
      expect(result).toContain('Content');
    });

    it('strips multiple non-content elements at once', () => {
      const html = `<html><body><main>
        <script>var x = 1;</script>
        <style>body{}</style>
        <nav>Nav</nav>
        <header>Header</header>
        <p>Real content</p>
        <footer>Footer</footer>
      </main></body></html>`;
      const result = htmlToMarkdown(html);
      expect(result).not.toContain('var x');
      expect(result).not.toContain('body{}');
      expect(result).not.toContain('Nav');
      expect(result).not.toContain('Header');
      expect(result).not.toContain('Footer');
      expect(result).toContain('Real content');
    });
  });

  describe('headings', () => {
    it('converts h1 to # heading', () => {
      const html = '<html><body><main><h1>Title</h1></main></body></html>';
      expect(htmlToMarkdown(html)).toContain('# Title');
    });

    it('converts h2 to ## heading', () => {
      const html = '<html><body><main><h2>Subtitle</h2></main></body></html>';
      expect(htmlToMarkdown(html)).toContain('## Subtitle');
    });

    it('converts h3 through h6', () => {
      const html = '<html><body><main><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('### H3');
      expect(result).toContain('#### H4');
      expect(result).toContain('##### H5');
      expect(result).toContain('###### H6');
    });
  });

  describe('paragraphs', () => {
    it('converts paragraphs to plain text with newlines', () => {
      const html = '<html><body><main><p>First paragraph</p><p>Second paragraph</p></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('First paragraph');
      expect(result).toContain('Second paragraph');
    });
  });

  describe('links', () => {
    it('converts links to markdown format', () => {
      const html = '<html><body><main><a href="https://example.com">Example</a></main></body></html>';
      expect(htmlToMarkdown(html)).toContain('[Example](https://example.com)');
    });

    it('handles links with nested inline elements', () => {
      const html = '<html><body><main><a href="/about"><strong>About</strong></a></main></body></html>';
      expect(htmlToMarkdown(html)).toContain('[About](/about)');
    });
  });

  describe('lists', () => {
    it('converts unordered lists', () => {
      const html = '<html><body><main><ul><li>Item 1</li><li>Item 2</li></ul></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    it('converts ordered lists', () => {
      const html = '<html><body><main><ol><li>First</li><li>Second</li></ol></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('1. First');
      expect(result).toContain('2. Second');
    });
  });

  describe('code blocks', () => {
    it('converts pre/code to fenced code blocks', () => {
      const html = '<html><body><main><pre><code>const x = 1;</code></pre></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('```');
      expect(result).toContain('const x = 1;');
    });

    it('preserves language hint from class', () => {
      const html = '<html><body><main><pre><code class="language-js">const x = 1;</code></pre></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('```js');
    });
  });

  describe('images', () => {
    it('converts images to markdown format', () => {
      const html = '<html><body><main><img src="/photo.jpg" alt="A photo" /></main></body></html>';
      expect(htmlToMarkdown(html)).toContain('![A photo](/photo.jpg)');
    });

    it('handles images without alt text', () => {
      const html = '<html><body><main><img src="/photo.jpg" /></main></body></html>';
      expect(htmlToMarkdown(html)).toContain('![](/photo.jpg)');
    });
  });

  describe('emphasis', () => {
    it('converts <strong> to bold', () => {
      const html = '<html><body><main><p><strong>Bold text</strong></p></main></body></html>';
      expect(htmlToMarkdown(html)).toContain('**Bold text**');
    });

    it('converts <em> to italic', () => {
      const html = '<html><body><main><p><em>Italic text</em></p></main></body></html>';
      expect(htmlToMarkdown(html)).toContain('*Italic text*');
    });
  });

  describe('HTML entities', () => {
    it('decodes common HTML entities', () => {
      const html = '<html><body><main><p>A &amp; B &lt; C &gt; D</p></main></body></html>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('A & B < C > D');
    });
  });
});

// ---------------------------------------------------------------------------
// buildFrontMatter
// ---------------------------------------------------------------------------

describe('buildFrontMatter', () => {
  it('produces front matter with title only', () => {
    const meta: PageMetadata = { title: 'My Page' };
    const result = buildFrontMatter(meta);
    expect(result).toBe('---\ntitle: "My Page"\n---\n');
  });

  it('produces front matter with description only', () => {
    const meta: PageMetadata = { description: 'A description' };
    const result = buildFrontMatter(meta);
    expect(result).toBe('---\ndescription: "A description"\n---\n');
  });

  it('produces front matter with both title and description', () => {
    const meta: PageMetadata = { title: 'My Page', description: 'A description' };
    const result = buildFrontMatter(meta);
    expect(result).toBe('---\ntitle: "My Page"\ndescription: "A description"\n---\n');
  });

  it('returns empty string when metadata has no title or description', () => {
    const meta: PageMetadata = {};
    expect(buildFrontMatter(meta)).toBe('');
  });

  it('returns empty string for metadata with only openGraph', () => {
    const meta: PageMetadata = { openGraph: { title: 'OG Title' } };
    expect(buildFrontMatter(meta)).toBe('');
  });

  it('escapes quotes in title', () => {
    const meta: PageMetadata = { title: 'He said "hello"' };
    const result = buildFrontMatter(meta);
    expect(result).toContain(String.raw`title: "He said \"hello\""`);
  });

  it('starts with --- and ends with ---', () => {
    const meta: PageMetadata = { title: 'Test' };
    const result = buildFrontMatter(meta);
    expect(result.startsWith('---\n')).toBe(true);
    expect(result.endsWith('---\n')).toBe(true);
  });
});
