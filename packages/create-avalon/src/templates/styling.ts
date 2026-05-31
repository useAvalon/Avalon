import type { ProjectConfig } from "../types";

export function generateStylingFiles(config: ProjectConfig): Map<string, string> {
	const files = new Map<string, string>();

	// Common files for all styling options
	files.set("app/shared/styles/main.css", generateMainCss(config));

	// Only generate reset.css for css-modules — Tailwind's preflight handles resets
	if (config.styling === "css-modules") {
		files.set("app/shared/styles/reset.css", generateResetCss());
	}

	switch (config.styling) {
		case "css-modules":
			files.set("app/shared/styles/tokens.css", generateTokensCss());
			files.set("app/shared/layouts/_layout.module.css", generateLayoutModuleCss());
			files.set("app/modules/main/pages/index.module.css", generatePageModuleCss());
			files.set("app/modules/main/layouts/_layout.module.css", generateLayoutModuleCss());
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

	return imports.join("\n") + "\n";
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

function generatePageModuleCss(): string {
	return `.page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
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

	return lines.join("\n") + "\n";
}

function generateCnUtil(): string {
	return `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
}

function generateShadcnComponentsJson(config: ProjectConfig): string {
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

	return JSON.stringify(componentsConfig, null, 2) + "\n";
}
