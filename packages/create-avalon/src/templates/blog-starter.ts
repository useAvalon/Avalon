import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectConfig } from "../types";

export async function writeBlogStarterFiles(
	config: ProjectConfig,
	targetDir: string,
): Promise<void> {
	const blogDir = join(targetDir, "app/modules/blog");
	await Promise.all([
		mkdir(join(blogDir, "pages"), { recursive: true }),
		mkdir(join(blogDir, "layouts"), { recursive: true }),
		mkdir(join(blogDir, "lib"), { recursive: true }),
		mkdir(join(targetDir, "public/media"), { recursive: true }),
	]);

	await Promise.all([
		writeFile(join(targetDir, ".pages.yml"), generatePagesCmsConfig()),
		writeFile(join(targetDir, "PAGES-CMS.md"), generatePagesCmsReadme(config.projectName)),
		writeFile(join(blogDir, "lib/posts.ts"), generatePostsLib()),
		writeFile(join(blogDir, "pages/index.tsx"), generateBlogIndexPage()),
		writeFile(join(blogDir, "pages/index.module.css"), generateBlogIndexCss()),
		writeFile(join(blogDir, "pages/welcome.mdx"), generateWelcomePost()),
		writeFile(join(blogDir, "pages/client-navigation.mdx"), generateClientNavigationPost()),
		writeFile(join(blogDir, "layouts/_layout.tsx"), generateBlogLayout()),
		writeFile(join(blogDir, "layouts/_layout.module.css"), generateBlogLayoutCss()),
		writeFile(
			join(targetDir, "app/shared/components/SiteNav.tsx"),
			generateSiteNav(config.projectName),
		),
		writeFile(join(targetDir, "app/shared/components/SiteNav.module.css"), generateSiteNavCss()),
		writeFile(join(blogDir, "components/CopyPostLink.tsx"), generateCopyPostLink()),
		writeFile(join(blogDir, "components/CopyPostLink.module.css"), generateCopyPostLinkCss()),
		writeFile(join(blogDir, "components/PostToc.tsx"), generatePostToc()),
		writeFile(join(blogDir, "components/PostToc.module.css"), generatePostTocCss()),
		writeFile(join(blogDir, "components/BlogFilters.tsx"), generateBlogFilters()),
		writeFile(join(blogDir, "components/BlogFilters.module.css"), generateBlogFiltersCss()),
	]);
}

function generatePagesCmsConfig(): string {
	return `# Pages CMS — https://pagescms.org/docs/configuration/
# Sign in at https://app.pagescms.org and install the GitHub App on this repo.

media:
  input: public/media
  output: /media

content:
  - name: posts
    label: Blog posts
    type: collection
    path: app/modules/blog/pages
    format: yaml-frontmatter
    extension: mdx
    filename: "{primary}.mdx"
    view:
      primary: title
      fields: [title, category, date, published]
      sort: [published, title]
      default:
        sort: published
        order: desc
    fields:
      - name: title
        label: Title
        type: string
        required: true
      - name: date
        label: Display date
        type: string
        required: true
        description: Shown on the post (e.g. March 4, 2026)
      - name: published
        label: Published (ISO)
        type: date
        required: true
      - name: description
        label: Description
        type: text
      - name: excerpt
        label: Excerpt
        type: text
      - name: category
        label: Category
        type: string
        description: Shown as a pill on the index (e.g. Product, Company)
      - name: author
        label: Author
        type: string
      - name: readMinutes
        label: Read time (minutes)
        type: number
      - name: body
        label: Body
        type: rich-text

settings:
  content:
    merge: true
`;
}

function generatePagesCmsReadme(projectName: string): string {
	return `# Pages CMS

This project includes a [\`.pages.yml\`](./.pages.yml) config so editors can manage blog posts in [Pages CMS](https://pagescms.org/) without leaving GitHub.

## Setup

1. Push **${projectName}** to a GitHub repository.
2. Open [app.pagescms.org](https://app.pagescms.org) and sign in with GitHub.
3. Install the Pages CMS GitHub App on the account or org that owns the repo.
4. Open the repository in Pages CMS — posts live under **Blog posts** (\`app/modules/blog/pages/*.mdx\`).
5. Upload images to **Media** (\`public/media/\`); they are served at \`/media/...\`.

New \`.mdx\` files become routes at \`/blog/<filename>\`. The index at \`/blog\` lists every \`.mdx\` file in that folder (sorted by \`published\`).

Docs: [Pages CMS quick start](https://pagescms.org/docs/quick-start/)
`;
}

function generatePostsLib(): string {
	return String.raw`export interface BlogPostMeta {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  published: string;
  category: string;
  author: string;
  readMinutes: string;
}

type MdxPageModule = {
  frontmatter?: Record<string, unknown>;
};

const postModules = import.meta.glob('../pages/*.mdx', {
  eager: true,
}) as Record<string, MdxPageModule>;

export function getBlogPosts(): BlogPostMeta[] {
  return Object.entries(postModules)
    .map(([path, mod]) => {
      const slug = path.replace(/^\.\.\/pages\//, '').replace(/\.mdx$/, '');
      const fm = mod.frontmatter ?? {};
      const title = typeof fm.title === 'string' ? fm.title : slug;
      const excerpt =
        typeof fm.excerpt === 'string'
          ? fm.excerpt
          : typeof fm.description === 'string'
            ? fm.description
            : '';
      const date = typeof fm.date === 'string' ? fm.date : '';
      const published = typeof fm.published === 'string' ? fm.published : '';
      const category = typeof fm.category === 'string' ? fm.category : 'Updates';
      const author = typeof fm.author === 'string' ? fm.author : '';
      const readMinutes =
        typeof fm.readMinutes === 'number'
          ? String(fm.readMinutes)
          : typeof fm.readMinutes === 'string'
            ? fm.readMinutes
            : '';
      return { slug, title, excerpt, date, published, category, author, readMinutes };
    })
    .sort((a, b) => b.published.localeCompare(a.published));
}
`;
}

function generateBlogIndexPage(): string {
	return `import BlogFilters from '../components/BlogFilters.tsx';
import { getBlogPosts, type BlogPostMeta } from '../lib/posts.ts';
import styles from './index.module.css';

export const metadata = {
  title: 'Blog',
  description: 'Read about our latest announcements.',
};

function PostMetaLine({ post }: { post: BlogPostMeta }) {
  return (
    <p class={styles.metaLine}>
      {post.date ? (
        <time datetime={post.published}>{post.date}</time>
      ) : null}
      {post.readMinutes ? (
        <>
          <span class={styles.metaSep} aria-hidden="true">
            ·
          </span>
          <span>{post.readMinutes} min read</span>
        </>
      ) : null}
    </p>
  );
}

function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <a
      href={\`/blog/\${post.slug}\`}
      class={styles.cardLink}
      data-router-transition="slide-forward"
      data-blog-category={post.category}
    >
      <span class={styles.category}>{post.category}</span>
      <h2 class={styles.cardTitle}>{post.title}</h2>
      {post.excerpt ? <p class={styles.cardExcerpt}>{post.excerpt}</p> : null}
      <PostMetaLine post={post} />
    </a>
  );
}

export default async function BlogIndexPage() {
  const posts = getBlogPosts();
  const [featured, ...rest] = posts;
  const categories = [...new Set(posts.map((post) => post.category))];

  return (
    <div class={styles.page}>
      <header class={styles.header}>
        <h1 class={styles.title}>Blog</h1>
        <p class={styles.lead}>Read about our latest announcements.</p>
      </header>

      {featured ? (
        <section class={styles.featured} aria-label="Featured post">
          <a
            href={\`/blog/\${featured.slug}\`}
            class={styles.featuredLink}
            data-router-transition="slide-forward"
            data-blog-category={featured.category}
          >
            <span class={styles.category}>{featured.category}</span>
            <h2 class={styles.featuredTitle}>{featured.title}</h2>
            {featured.excerpt ? <p class={styles.featuredExcerpt}>{featured.excerpt}</p> : null}
            <PostMetaLine post={featured} />
          </a>
        </section>
      ) : null}

      {categories.length > 0 ? (
        <BlogFilters island={{ condition: 'on:idle' }} categories={categories} />
      ) : null}

      {rest.length > 0 ? (
        <ul class={styles.list}>
          {rest.map((post) => (
            <li key={post.slug} class={styles.item} data-blog-category={post.category}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
`;
}

function generateWelcomePost(): string {
	return `---
title: Welcome to your Avalon blog
date: October 10, 2026
published: 2026-10-10
category: Product
author: Your team
readMinutes: 3
description: MDX posts in app/modules/blog/pages become routes under /blog.
excerpt: Edit this post in Pages CMS or locally. Add more .mdx files to publish new entries.
---

Your blog runs on [Avalon](https://useavalon.dev): pages and layouts are Preact, posts are **MDX** with YAML frontmatter.

## Edit in Pages CMS

Push this repo to GitHub, connect it in [Pages CMS](https://pagescms.org/), and edit posts under **Blog posts**. See \`PAGES-CMS.md\` in the project root.

## Add a post locally

Create \`app/modules/blog/pages/my-topic.mdx\`:

\`\`\`mdx
---
title: My topic
date: October 10, 2026
published: 2026-10-10
excerpt: A short summary for the index page.
---

Hello, world.
\`\`\`

The file is served at \`/blog/my-topic\` and appears on [\`/blog\`](/blog) automatically.

## Islands (optional)

Interactive UI ships only when you add an \`island\` prop:

\`\`\`tsx
<NewsletterForm island={{ condition: 'on:visible' }} />
\`\`\`

The rest of the page stays static HTML.
`;
}

function generateClientNavigationPost(): string {
	return `---
title: Client navigation in your blog template
date: October 8, 2026
published: 2026-10-08
category: Product
author: Your team
readMinutes: 2
excerpt: Internal links swap SSR HTML with View Transitions — the same model as on devin.ai/blog.
---

This template ships with \`clientRouter: true\`, slide-forward View Transitions, and a persistent site nav.

## Try it

Open another post from the index, then use **Back to blog**. The document swaps without a full reload.

## Table of contents

This sidebar is built at runtime from \`h2\` and \`h3\` headings in the post body.
`;
}

function generateBlogLayout(): string {
	return `import type { LayoutProps } from '@useavalon/avalon';
import CopyPostLink from '../components/CopyPostLink.tsx';
import PostToc from '../components/PostToc.tsx';
import styles from './_layout.module.css';

interface BlogFrontmatter {
  title?: string;
  description?: string;
  date?: string;
  published?: string;
  excerpt?: string;
  author?: string;
  readMinutes?: number | string;
  category?: string;
}

export default function BlogLayout({ children, frontmatter }: Readonly<LayoutProps>) {
  const fm = frontmatter as BlogFrontmatter | undefined;
  if (!fm?.date) {
    return <div class={styles.shell}>{children}</div>;
  }

  const readMinutes =
    typeof fm.readMinutes === 'number' ? String(fm.readMinutes) : fm.readMinutes ?? '';

  return (
    <div class={styles.wrapper}>
      <div class={styles.articleLayout}>
        <article class={styles.article}>
          <a class={styles.back} href="/blog" data-router-transition="slide-forward">
            ← Back to blog
          </a>
          <header class={styles.header}>
            <h1 class={styles.title}>{fm.title}</h1>
            <div class={styles.metaBar}>
              {fm.author ? <span class={styles.metaItem}>{fm.author}</span> : null}
              {fm.author && fm.date ? <span class={styles.metaSep} aria-hidden="true">|</span> : null}
              <time class={styles.metaItem} datetime={fm.published ?? fm.date}>
                {fm.date}
              </time>
              {readMinutes ? (
                <>
                  <span class={styles.metaSep} aria-hidden="true">|</span>
                  <span class={styles.metaItem}>{readMinutes} min read</span>
                </>
              ) : null}
              <CopyPostLink island={{ condition: 'on:idle' }} />
            </div>
            {(fm.description || fm.excerpt) && (
              <p class={styles.lede}>{fm.description ?? fm.excerpt}</p>
            )}
          </header>
          <div class={styles.prose} data-post-prose>
            {children}
          </div>
        </article>
        <aside class={styles.tocAside}>
          <PostToc island={{ condition: 'on:idle' }} />
        </aside>
      </div>
    </div>
  );
}
`;
}

function generateSiteNav(projectName: string): string {
	const brandLabel = JSON.stringify(projectName);

	return `import styles from './SiteNav.module.css';

export default function SiteNav() {
  return (
    <header class={styles.bar} data-router-persist="site-nav">
      <a class={styles.brand} href="/" data-router-transition="slide-forward">
        {${brandLabel}}
      </a>
      <nav class={styles.nav} aria-label="Primary">
        <a class={styles.link} href="/" data-router-transition="slide-forward">
          Home
        </a>
        <a class={styles.link} href="/blog" data-router-transition="slide-forward">
          Blog
        </a>
      </nav>
    </header>
  );
}
`;
}

function generateSiteNavCss(): string {
	return `.bar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  max-width: var(--blog-max-width);
  margin: 0 auto;
  padding: 0.875rem clamp(1.25rem, 4vw, 2rem);
  background: color-mix(in srgb, var(--color-background) 88%, transparent);
  backdrop-filter: blur(10px);
}

.brand {
  font-weight: 500;
  font-size: 0.875rem;
  letter-spacing: -0.02em;
  color: var(--color-text);
  text-decoration: none;
}

.brand:hover {
  opacity: 0.75;
}

.nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.link {
  color: var(--blog-text-muted);
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: color 0.15s ease;
}

.link:hover {
  color: var(--color-text);
}
`;
}

function generateBlogIndexCss(): string {
	return `.page {
  width: 100%;
  max-width: var(--blog-max-width);
  margin: 0 auto;
  padding: clamp(2.5rem, 8vh, 4.5rem) clamp(1.25rem, 4vw, 2rem) 4rem;
  min-height: 60vh;
  box-sizing: border-box;
}

.header {
  margin-bottom: 2.5rem;
}

.title {
  margin: 0 0 0.5rem;
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--color-text);
}

.lead {
  margin: 0;
  max-width: 28rem;
  line-height: 1.5;
  font-size: 1.0625rem;
  color: var(--blog-text-muted);
}

.featured {
  margin-bottom: 2.5rem;
  border-radius: var(--blog-radius-lg);
  background: var(--blog-surface);
  transition: background 0.15s ease;
}

.featured:hover {
  background: var(--blog-surface-hover);
}

.featuredLink {
  display: block;
  padding: clamp(1.5rem, 4vw, 2rem);
  text-decoration: none;
  color: inherit;
}

.featuredTitle {
  margin: 0.75rem 0;
  font-size: clamp(1.5rem, 3.5vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: var(--color-text);
}

.featuredExcerpt {
  margin: 0 0 1rem;
  max-width: 42rem;
  line-height: 1.6;
  color: var(--blog-text-muted);
}

.category {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--blog-text-muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item {
  border-radius: var(--blog-radius-md);
}

.item:hover {
  background: var(--blog-surface);
}

.cardLink {
  display: block;
  padding: 1.25rem 1rem;
  border-radius: inherit;
  text-decoration: none;
  color: inherit;
}

.cardLink:hover .cardTitle {
  color: var(--blog-text-muted);
}

.cardTitle {
  margin: 0.5rem 0;
  font-size: clamp(1.125rem, 2.5vw, 1.375rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--color-text);
  transition: color 0.15s ease;
}

.cardExcerpt {
  margin: 0 0 0.75rem;
  max-width: 42rem;
  line-height: 1.6;
  font-size: 0.9375rem;
  color: var(--blog-text-muted);
}

.metaLine {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: var(--blog-text-subtle);
}

.metaSep {
  color: var(--blog-text-subtle);
}
`;
}

function generateBlogLayoutCss(): string {
	return `.shell {
  width: 100%;
  min-height: 50vh;
  box-sizing: border-box;
}

.wrapper {
  max-width: var(--blog-max-width);
  margin: 0 auto;
  padding: clamp(1.5rem, 5vh, 2.5rem) clamp(1.25rem, 4vw, 2rem) 4rem;
  box-sizing: border-box;
}

.articleLayout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}

@media (min-width: 960px) {
  .articleLayout {
    grid-template-columns: minmax(0, 1fr) 12rem;
    gap: 3rem;
  }
}

.article {
  min-width: 0;
}

.back {
  display: inline-block;
  margin: 0 0 1.5rem;
  font-size: 0.875rem;
  color: var(--blog-text-muted);
  text-decoration: none;
}

.back:hover {
  color: var(--color-text);
}

.header {
  margin-bottom: 2rem;
}

.title {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  color: var(--color-text);
  line-height: 1.15;
}

.metaBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.65rem;
  font-size: 0.8125rem;
  color: var(--blog-text-subtle);
}

.metaItem {
  color: var(--blog-text-muted);
}

.metaSep {
  color: var(--blog-text-subtle);
  user-select: none;
}

.lede {
  margin: 1.25rem 0 0;
  max-width: 40rem;
  line-height: 1.6;
  font-size: 1.0625rem;
  color: var(--blog-text-muted);
}

.tocAside {
  display: none;
}

@media (min-width: 960px) {
  .tocAside {
    display: block;
    position: sticky;
    top: 1.5rem;
  }
}

.prose {
  max-width: 42rem;
  color: var(--blog-text-muted);
  line-height: 1.75;
  font-size: 1.0625rem;
}

.prose h2,
.prose h3,
.prose h4 {
  color: var(--color-text);
  font-weight: 600;
  letter-spacing: -0.02em;
  scroll-margin-top: 1.5rem;
}

.prose h2 {
  font-size: 1.5rem;
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
}

.prose h3 {
  font-size: 1.25rem;
  margin-top: 2rem;
  margin-bottom: 0.5rem;
}

.prose p {
  margin-bottom: 1.25rem;
}

.prose a {
  color: var(--color-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.prose a:hover {
  color: var(--blog-text-muted);
}

.prose :not(pre) > code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--blog-surface);
  border: 1px solid var(--blog-border);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--color-text);
}

.prose pre {
  background: var(--blog-surface);
  border: 1px solid var(--blog-border);
  color: var(--color-text);
  border-radius: var(--blog-radius-md);
  padding: 1rem 1.125rem;
  overflow-x: auto;
  margin-bottom: 1.25rem;
  font-family: var(--font-mono);
  font-size: 0.875rem;
}

.prose pre code {
  background: transparent;
  padding: 0;
  border: 0;
  color: inherit;
}
`;
}

function generateCopyPostLink(): string {
	return `import { useState } from 'preact/hooks';
import styles from './CopyPostLink.module.css';

export default function CopyPostLink() {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" class={styles.button} onClick={onCopy}>
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}
`;
}

function generateCopyPostLinkCss(): string {
	return `.button {
  margin-left: auto;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--color-text);
  background: var(--blog-surface);
  border: 1px solid var(--blog-border-strong);
  border-radius: 6px;
  cursor: pointer;
}

.button:hover {
  background: var(--blog-surface-hover);
}
`;
}

function generatePostToc(): string {
	return `import { useEffect, useState } from 'preact/hooks';
import styles from './PostToc.module.css';

interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replaceAll(/[^\\w\\s-]/g, '')
    .replaceAll(/\\s+/g, '-');
}

export default function PostToc() {
  const [items, setItems] = useState<TocItem[]>([]);

  function scrollToHeading(event: Event, id: string) {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', \`#\${id}\`);
  }

  useEffect(() => {
    const prose = document.querySelector('[data-post-prose]');
    if (!prose) return;

    const next: TocItem[] = [];
    for (const heading of prose.querySelectorAll('h2, h3')) {
      const el = heading as HTMLElement;
      const text = el.textContent?.trim() ?? '';
      if (!text) continue;
      if (!el.id) {
        el.id = slugify(text);
      }
      const depth = el.tagName === 'H2' ? 2 : 3;
      next.push({ id: el.id, text, depth });
    }
    setItems(next);
  }, []);

  if (items.length === 0) return null;

  return (
    <nav class={styles.toc} aria-label="Table of contents">
      <p class={styles.label}>Table of contents</p>
      <ul class={styles.list}>
        {items.map((item) => (
          <li key={item.id} class={item.depth === 3 ? styles.nested : undefined}>
            <a href={\`#\${item.id}\`} onClick={(event) => scrollToHeading(event, item.id)}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
`;
}

function generatePostTocCss(): string {
	return `.toc {
  font-size: 0.8125rem;
}

.label {
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--blog-text-subtle);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list a {
  color: var(--blog-text-muted);
  text-decoration: none;
  line-height: 1.4;
}

.list a:hover {
  color: var(--color-text);
}

.nested {
  padding-left: 0.75rem;
}
`;
}

function generateBlogFilters(): string {
	return `import { useState } from 'preact/hooks';
import styles from './BlogFilters.module.css';

interface Props {
  categories: string[];
}

export default function BlogFilters({ categories }: Props) {
  const [active, setActive] = useState('All');

  function applyFilter(category: string) {
    setActive(category);
    for (const node of document.querySelectorAll('[data-blog-category]')) {
      const el = node as HTMLElement;
      const match = category === 'All' || el.dataset.blogCategory === category;
      el.hidden = !match;
    }
  }

  return (
    <nav class={styles.filters} aria-label="Filter posts by category">
      <button
        type="button"
        class={active === 'All' ? styles.active : styles.chip}
        onClick={() => applyFilter('All')}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          class={active === category ? styles.active : styles.chip}
          onClick={() => applyFilter(category)}
        >
          {category}
        </button>
      ))}
    </nav>
  );
}
`;
}

function generateBlogFiltersCss(): string {
	return `.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.chip,
.active {
  padding: 0.35rem 0.75rem;
  font-size: 0.8125rem;
  font-family: inherit;
  border-radius: 999px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.chip {
  color: var(--blog-text-muted);
}

.chip:hover {
  color: var(--color-text);
}

.active {
  color: var(--color-text);
  background: var(--blog-surface);
}
`;
}

/** Dark editorial theme — Inter + IBM Plex Mono, Vercel/Devin-style contrast */
export function generateBlogThemeCss(): string {
	return `html.blog-theme {
  color-scheme: dark;
  scroll-behavior: smooth;
}

html.blog-theme {
  --color-background: #000000;
  --color-text: #ededed;
  --color-primary: #ededed;
  --color-secondary: #888888;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --blog-max-width: 64rem;
  --blog-surface: #0a0a0a;
  --blog-surface-hover: #111111;
  --blog-border: rgba(255, 255, 255, 0.06);
  --blog-border-strong: rgba(255, 255, 255, 0.12);
  --blog-text-muted: #888888;
  --blog-text-subtle: #666666;
  --blog-btn-fg: #000000;
  --blog-btn-bg: #ededed;
  --blog-radius-md: 0.5rem;
  --blog-radius-lg: 0.625rem;
}

html.blog-theme,
html.blog-theme body {
  background: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

@media (prefers-reduced-motion: reduce) {
  html.blog-theme {
    scroll-behavior: auto;
  }
}
`;
}

export function generateBlogHomePage(config: ProjectConfig): string {
	const metadata = `export const metadata = {
  title: 'Home',
  description: 'Avalon blog starter — MDX posts and optional Pages CMS editing.',
};`;

	if (config.styling === "css-modules") {
		return `${metadata}

import styles from './index.module.css';

export default async function HomePage() {
  return (
    <div class={styles.shell}>
      <div class={styles.content}>
        <h1 class={styles.title}>Writing for the web</h1>
        <p class={styles.lead}>
          MDX posts, optional{' '}
          <a class={styles.inlineLink} href="https://pagescms.org/" target="_blank" rel="noopener noreferrer">
            Pages CMS
          </a>
          , and client navigation out of the box.
        </p>
        <div class={styles.actions}>
          <a class={styles.btnPrimary} href="/blog" data-router-transition="slide-forward">
            View posts
          </a>
          <a
            class={styles.btnSecondary}
            href="https://useavalon.dev/docs/mdx"
            target="_blank"
            rel="noopener noreferrer"
          >
            MDX
          </a>
        </div>
      </div>
    </div>
  );
}
`;
	}

	return `${metadata}

export default async function HomePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-4 text-xs font-medium uppercase tracking-widest text-slate-400">Blog starter</p>
      <h1 className="mb-4 text-4xl font-bold text-slate-100">Write in MDX</h1>
      <p className="mb-8 max-w-lg text-slate-300">
        Posts live under{' '}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-slate-200">
          app/modules/blog/pages
        </code>
        . Connect{' '}
        <a className="text-blue-400 underline" href="https://pagescms.org/" target="_blank" rel="noopener noreferrer">
          Pages CMS
        </a>{' '}
        for a free editor on GitHub.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white no-underline"
          href="/blog"
          data-router-transition="slide-forward"
        >
          Read the blog
        </a>
        <a
          className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-200 no-underline"
          href="https://useavalon.dev/docs/mdx"
          target="_blank"
          rel="noopener noreferrer"
        >
          MDX docs
        </a>
      </div>
    </div>
  );
}
`;
}

export function generateBlogHomePageCssModules(): string {
	return `.shell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: calc(100vh - 4rem);
  max-width: var(--blog-max-width);
  margin: 0 auto;
  padding: clamp(2rem, 10vh, 5rem) clamp(1.25rem, 4vw, 2rem);
  box-sizing: border-box;
}

.content {
  max-width: 32rem;
}

.title {
  margin: 0 0 1rem;
  font-size: clamp(2.25rem, 6vw, 3.25rem);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1.05;
  color: var(--color-text);
}

.lead {
  margin: 0 0 2rem;
  line-height: 1.6;
  font-size: 1.0625rem;
  color: var(--blog-text-muted);
}

.inlineLink {
  color: var(--color-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.inlineLink:hover {
  opacity: 0.8;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.btnPrimary,
.btnSecondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: 0 1.125rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.15s ease, background 0.15s ease;
}

.btnPrimary {
  background: var(--blog-btn-bg);
  color: var(--blog-btn-fg);
}

.btnPrimary:hover {
  opacity: 0.92;
}

.btnSecondary {
  background: transparent;
  border: 1px solid var(--blog-border-strong);
  color: var(--color-text);
}

.btnSecondary:hover {
  background: var(--blog-surface);
}
`;
}

/** View Transition styles for clientRouter (matches useavalon.dev/docs/client-navigation). */
export function generateClientRouterStylesCss(): string {
	return `@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slide-out-left {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-1.25rem);
  }
}

@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(1.25rem);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

::view-transition-old(root) {
  animation: 160ms ease-in both fade-out;
}

::view-transition-new(root) {
  animation: 160ms ease-out both fade-in;
}

html[data-router-transition="slide-forward"]::view-transition-old(root) {
  animation: 180ms ease-in both slide-out-left;
}

html[data-router-transition="slide-forward"]::view-transition-new(root) {
  animation: 180ms ease-out both slide-in-right;
}

html:active-view-transition-type(slide-forward)::view-transition-old(root) {
  animation: 180ms ease-in both slide-out-left;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }
}
`;
}
