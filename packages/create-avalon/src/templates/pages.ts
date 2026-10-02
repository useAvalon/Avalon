import type { ProjectConfig } from "../types";

const METADATA = `export const metadata = {
  title: 'Avalon — Islands Architecture',
  description: 'A multi-framework islands architecture project powered by Avalon.',
};`;

const TAILWIND_PAGE_SHELL =
	"flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_80%_80%_at_10%_10%,rgba(99,102,241,0.12),transparent_70%),radial-gradient(ellipse_60%_60%_at_90%_90%,rgba(168,85,247,0.08),transparent_70%),linear-gradient(145deg,#0a0a12_0%,#0d1117_40%,#111827_100%)] px-8 py-8 text-center font-sans text-slate-200";

function generateMainPageCssModules(): string {
	return `${METADATA}

import styles from './index.module.css';

export default async function HomePage() {
  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>Islands Architecture</p>

        <h1 className={styles.title}>Avalon</h1>

        <p className={styles.lead}>
          Multi-framework islands. Zero JS by default. Ship interactive components with any framework you love.
        </p>

        <div className={styles.actions}>
          <a className={styles.btnPrimary} href="https://useavalon.dev/docs/introduction" target="_blank" rel="noopener noreferrer">
            Documentation
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
          </a>
          <a className={styles.btnSecondary} href="https://github.com/useAvalon/Avalon" target="_blank" rel="noopener noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </div>

      <div className={styles.getStarted}>
        <p className={styles.getStartedLabel}>Get started</p>
        <code className={styles.codeHint}>Edit app/modules/main/pages/index.tsx</code>
        <p className={styles.moduleHint}>
          <a className={styles.link} href="/about">About</a>
          {' '}is the about module — app/modules/about/pages/index.tsx → /about
        </p>
      </div>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Powered by{' '}
          <a className={styles.link} href="https://useavalon.dev" target="_blank" rel="noopener noreferrer">Avalon</a>
        </p>
      </footer>
    </div>
  );
}
`;
}

function generateMainPageTailwind(): string {
	return `${METADATA}

export default async function HomePage() {
  return (
    <div className="${TAILWIND_PAGE_SHELL}">
      <div className="max-w-[640px]">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.15em] text-indigo-400">Islands Architecture</p>

        <h1 className="mb-6 bg-gradient-to-br from-slate-50 to-slate-400 bg-clip-text text-[clamp(2.5rem,6vw,4rem)] font-bold leading-tight text-transparent">
          Avalon
        </h1>

        <p className="mx-auto mb-10 max-w-[480px] text-lg leading-relaxed text-slate-400">
          Multi-framework islands. Zero JS by default. Ship interactive components with any framework you love.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <a
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 px-6 py-2.5 text-sm font-medium text-white no-underline transition-opacity hover:opacity-90"
            href="https://useavalon.dev/docs/introduction"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
          </a>
          <a
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-medium text-slate-200 no-underline transition-opacity hover:opacity-90"
            href="https://github.com/useAvalon/Avalon"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </div>

      <div className="mt-16 flex flex-col items-center gap-3">
        <p className="text-xs uppercase tracking-widest text-slate-500">Get started</p>
        <code className="block rounded-md border border-white/10 bg-white/5 px-5 py-2.5 font-mono text-sm text-indigo-300">
          Edit app/modules/main/pages/index.tsx
        </code>
        <p className="mt-2 text-sm text-slate-400">
          <a className="text-indigo-400 no-underline" href="/about">About</a>
          {' '}is the about module — app/modules/about/pages/index.tsx → /about
        </p>
      </div>

      <footer className="mt-16 w-full max-w-[640px] border-t border-white/10 pt-8">
        <p className="text-sm text-slate-600">
          Powered by{' '}
          <a className="text-indigo-400 no-underline" href="https://useavalon.dev" target="_blank" rel="noopener noreferrer">Avalon</a>
        </p>
      </footer>
    </div>
  );
}
`;
}

export function generateMainPage(config: ProjectConfig): string {
	if (config.styling === "css-modules") {
		return generateMainPageCssModules();
	}
	return generateMainPageTailwind();
}

const ABOUT_METADATA = `export const metadata = {
  title: 'About',
  description: 'The about module maps to the /about route.',
};`;

function generateAboutPageCssModules(): string {
	return `${ABOUT_METADATA}

import styles from './index.module.css';

export default function AboutPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>Module route</p>
        <h1 className={styles.title}>About</h1>
        <p className={styles.body}>
          This page is <code className={styles.code}>app/modules/about/pages/index.tsx</code>.
          A module name is a URL prefix, so the about module is{' '}
          <code className={styles.code}>/about</code>.
          The main module is the site root.
        </p>
        <a className={styles.homeLink} href="/">Home</a>
      </div>
    </div>
  );
}
`;
}

function generateAboutPageTailwind(): string {
	return `${ABOUT_METADATA}

export default function AboutPage() {
  return (
    <div className="${TAILWIND_PAGE_SHELL}">
      <div className="max-w-[480px]">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.15em] text-indigo-400">Module route</p>
        <h1 className="mb-6 text-[clamp(2rem,5vw,3rem)] font-bold leading-tight text-slate-100">About</h1>
        <p className="mb-8 text-[1.05rem] leading-relaxed text-slate-400">
          This page is <code className="font-mono text-indigo-300">app/modules/about/pages/index.tsx</code>.
          A module name is a URL prefix, so the about module is{' '}
          <code className="font-mono text-indigo-300">/about</code>.
          The main module is the site root.
        </p>
        <a className="font-medium text-indigo-400 no-underline" href="/">Home</a>
      </div>
    </div>
  );
}
`;
}

export function generateAboutPage(config: ProjectConfig): string {
	if (config.styling === "css-modules") {
		return generateAboutPageCssModules();
	}
	return generateAboutPageTailwind();
}

const NOT_FOUND_METADATA = `export const metadata = {
  title: '404 - Page Not Found',
  description: 'The page you are looking for does not exist.',
  robots: 'noindex, nofollow',
};`;

function generate404PageCssModules(): string {
	return `${NOT_FOUND_METADATA}

import styles from './404.module.css';

export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.status}>404</h1>
      <p className={styles.message}>Page not found</p>
      <a className={styles.homeLink} href="/">Go Home</a>
    </div>
  );
}
`;
}

function generate404PageTailwind(): string {
	return `${NOT_FOUND_METADATA}

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-8 py-8 text-center font-sans">
      <h1 className="mb-4 text-6xl">404</h1>
      <p className="mb-8 text-xl text-slate-500">Page not found</p>
      <a className="font-medium text-indigo-500 no-underline" href="/">Go Home</a>
    </div>
  );
}
`;
}

export function generate404Page(config: ProjectConfig): string {
	if (config.styling === "css-modules") {
		return generate404PageCssModules();
	}
	return generate404PageTailwind();
}
