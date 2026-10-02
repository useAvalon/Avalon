import type { ProjectConfig } from "../types";

export function generateStylingFiles(config: ProjectConfig): Map<string, string> {
	const files = new Map<string, string>();

	// Common files for all styling options
	files.set("app/shared/styles/main.css", generateMainCss(config));
	// MDX rehype-highlight is always on; the theme lives in public/ so the
	// root layout can link /syntax-highlighting.css without a build step.
	files.set("public/syntax-highlighting.css", generateSyntaxHighlightingCss());

	// Only generate reset.css for css-modules — Tailwind's preflight handles resets
	if (config.styling === "css-modules") {
		files.set("app/shared/styles/reset.css", generateResetCss());
	}

	switch (config.styling) {
		case "css-modules":
			files.set("app/shared/styles/tokens.css", generateTokensCss());
			files.set("app/shared/layouts/_layout.module.css", generateLayoutModuleCss());
			files.set("app/modules/main/pages/index.module.css", generatePageModuleCss());
			files.set("app/modules/main/pages/404.module.css", generateNotFoundPageModuleCss());
			files.set("app/modules/about/pages/index.module.css", generateAboutPageModuleCss());
			break;

		case "tailwind":
			files.set("tailwind.config.js", generateTailwindConfig());
			files.set("app/shared/styles/global.css", generateTailwindGlobalCss(config));
			break;

		case "shadcn":
			files.set("tailwind.config.js", generateTailwindConfig());
			files.set("app/shared/styles/global.css", generateTailwindGlobalCss(config));
			files.set("components.json", generateShadcnComponentsJson(config));
			files.set("app/shared/utils/cn.ts", generateCnUtil());
			break;
	}

	return files;
}

function generateMainCss(config: ProjectConfig): string {
	const imports: string[] = [];

	if (config.styling === "css-modules") {
		imports.push(`@import './reset.css';`);
		imports.push(`@import './tokens.css';`);
	} else {
		imports.push(`@import './global.css';`);
	}

	return `${imports.join("\n")}\n`;
}

function generateResetCss(): string {
	return `/* CSS Reset */
*,
*::before,
*::after {
  box-sizing: border-box;
}

* {
  margin: 0;
  padding: 0;
}

body {
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

input,
button,
textarea,
select {
  font: inherit;
}

p,
h1,
h2,
h3,
h4,
h5,
h6 {
  overflow-wrap: break-word;
}
`;
}

function generateTokensCss(): string {
	return `:root {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --color-background: #ffffff;
  --color-text: #0f172a;
  --font-sans: system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, monospace;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
}
`;
}

function generateLayoutModuleCss(): string {
	return `.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.content {
  flex: 1;
  padding: 1rem;
}
`;
}

const LANDING_EYEBROW_CSS = `.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #818cf8;
  margin: 0 0 1.5rem;
  font-weight: 500;
}`;

const LANDING_LINK_CSS = `.link {
  color: #818cf8;
  text-decoration: none;
}`;

function generateScaffoldPageShellCss(): string {
	return `.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: #e2e8f0;
  font-family: system-ui, -apple-system, sans-serif;
  background:
    radial-gradient(ellipse 80% 80% at 10% 10%, rgba(99, 102, 241, 0.12), transparent 70%),
    radial-gradient(ellipse 60% 60% at 90% 90%, rgba(168, 85, 247, 0.08), transparent 70%),
    linear-gradient(145deg, #0a0a12 0%, #0d1117 40%, #111827 100%);
}`;
}

function generatePageModuleCss(): string {
	return `${generateScaffoldPageShellCss()}

.content {
  max-width: 640px;
}

${LANDING_EYEBROW_CSS}

.title {
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 700;
  line-height: 1.1;
  margin: 0 0 1.5rem;
  background: linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.lead {
  font-size: 1.15rem;
  line-height: 1.7;
  color: #94a3b8;
  margin: 0 auto 2.5rem;
  max-width: 480px;
}

.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btnPrimary,
.btnSecondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.2s;
}

.btnPrimary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
}

.btnPrimary:hover,
.btnSecondary:hover {
  opacity: 0.9;
}

.btnSecondary {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.getStarted {
  margin-top: 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.getStartedLabel {
  font-size: 0.75rem;
  color: #64748b;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin: 0;
}

.codeHint {
  display: block;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #a5b4fc;
  font-size: 0.85rem;
  font-family: ui-monospace, monospace;
}

.moduleHint {
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0.5rem 0 0;
}

${LANDING_LINK_CSS}

.footer {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  width: 100%;
  max-width: 640px;
}

.footerText {
  font-size: 0.8rem;
  color: #475569;
  margin: 0;
}
`;
}

function generateNotFoundPageModuleCss(): string {
	return `.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
}

.status {
  font-size: 4rem;
  margin: 0 0 1rem;
}

.message {
  font-size: 1.25rem;
  color: #64748b;
  margin: 0 0 2rem;
}

.homeLink {
  color: #6366f1;
  text-decoration: none;
  font-weight: 500;
}
`;
}

function generateAboutPageModuleCss(): string {
	return `${generateScaffoldPageShellCss()}

.content {
  max-width: 480px;
}

${LANDING_EYEBROW_CSS}

.title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  line-height: 1.1;
  margin: 0 0 1.5rem;
}

.body {
  font-size: 1.05rem;
  line-height: 1.7;
  color: #94a3b8;
  margin: 0 0 2rem;
}

.code {
  color: #a5b4fc;
  font-family: ui-monospace, monospace;
}

.homeLink {
  color: #818cf8;
  text-decoration: none;
  font-weight: 500;
}
`;
}

function generateTailwindConfig(): string {
	return `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
}

function generateTailwindGlobalCss(config: ProjectConfig): string {
	const lines = [`@import "tailwindcss";`];

	if (config.styling === "shadcn") {
		lines.push("");
		lines.push(`@theme inline {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-card: oklch(1 0 0);
  --color-card-foreground: oklch(0.145 0 0);
  --color-popover: oklch(1 0 0);
  --color-popover-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0 0);
  --color-primary-foreground: oklch(0.985 0 0);
  --color-secondary: oklch(0.97 0 0);
  --color-secondary-foreground: oklch(0.205 0 0);
  --color-muted: oklch(0.97 0 0);
  --color-muted-foreground: oklch(0.556 0 0);
  --color-accent: oklch(0.97 0 0);
  --color-accent-foreground: oklch(0.205 0 0);
  --color-destructive: oklch(0.577 0.245 27.325);
  --color-destructive-foreground: oklch(0.577 0.245 27.325);
  --color-border: oklch(0.922 0 0);
  --color-input: oklch(0.922 0 0);
  --color-ring: oklch(0.708 0 0);
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}`);
	}

	return `${lines.join("\n")}\n`;
}

function generateCnUtil(): string {
	return `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
}

function generateShadcnComponentsJson(_config: ProjectConfig): string {
	const componentsConfig = {
		$schema: "https://ui.shadcn.com/schema.json",
		style: "default",
		tailwind: {
			config: "tailwind.config.js",
			css: "app/shared/styles/global.css",
		},
		aliases: {
			components: "@shared/components",
			utils: "@shared/utils",
		},
	};

	return `${JSON.stringify(componentsConfig, null, 2)}\n`;
}

/** highlight.js GitHub Dark tokens used by Avalon's MDX rehype-highlight pipeline. */
function generateSyntaxHighlightingCss(): string {
	return `code.hljs { padding: 3px 5px; }
pre code.hljs { display: block; overflow-x: auto; padding: 1em; }
.hljs { color: #c9d1d9; background: transparent; }
.hljs-doctag, .hljs-keyword, .hljs-meta .hljs-keyword, .hljs-template-tag,
.hljs-template-variable, .hljs-type, .hljs-variable.language_ { color: #ff7b72; }
.hljs-title, .hljs-title.class_, .hljs-title.class_.inherited__,
.hljs-title.function_ { color: #d2a8ff; }
.hljs-attr, .hljs-attribute, .hljs-literal, .hljs-meta, .hljs-number,
.hljs-operator, .hljs-variable, .hljs-selector-attr, .hljs-selector-class,
.hljs-selector-id { color: #79c0ff; }
.hljs-regexp, .hljs-string, .hljs-meta .hljs-string { color: #a5d6ff; }
.hljs-built_in, .hljs-symbol { color: #ffa657; }
.hljs-comment, .hljs-code, .hljs-formula { color: #8b949e; }
.hljs-name, .hljs-quote, .hljs-selector-tag, .hljs-selector-pseudo { color: #7ee787; }
.hljs-subst { color: #c9d1d9; }
.hljs-section { color: #1f6feb; font-weight: bold; }
.hljs-bullet { color: #f2cc60; }
.hljs-emphasis { color: #c9d1d9; font-style: italic; }
.hljs-strong { color: #c9d1d9; font-weight: bold; }
.hljs-addition { color: #aff5b4; background-color: #033a16; }
.hljs-deletion { color: #ffdcd7; background-color: #67060c; }
`;
}
