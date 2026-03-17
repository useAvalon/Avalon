import type { ProjectConfig } from '../types';

export function generateStylingFiles(config: ProjectConfig): Map<string, string> {
  const files = new Map<string, string>();

  // Common files for all styling options
  files.set('app/shared/styles/main.css', generateMainCss(config));
  files.set('app/shared/styles/reset.css', generateResetCss());

  switch (config.styling) {
    case 'css-modules':
      files.set('app/shared/styles/tokens.css', generateTokensCss());
      files.set('app/shared/layouts/_layout.module.css', generateLayoutModuleCss());
      files.set('app/modules/home/pages/index.module.css', generatePageModuleCss());
      files.set('app/modules/home/layouts/_layout.module.css', generateLayoutModuleCss());
      break;

    case 'tailwind':
      files.set('tailwind.config.js', generateTailwindConfig());
      files.set('app/shared/styles/global.css', generateTailwindGlobalCss());
      break;

    case 'shadcn':
      files.set('tailwind.config.js', generateTailwindConfig());
      files.set('app/shared/styles/global.css', generateTailwindGlobalCss());
      files.set('components.json', generateShadcnComponentsJson(config));
      break;
  }

  return files;
}

function generateMainCss(config: ProjectConfig): string {
  const imports: string[] = [`@import './reset.css';`];

  if (config.styling === 'css-modules') {
    imports.push(`@import './tokens.css';`);
  } else {
    imports.push(`@import './global.css';`);
  }

  return imports.join('\n') + '\n';
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

function generateTailwindGlobalCss(): string {
  return `@import "tailwindcss";
`;
}

function generateShadcnComponentsJson(config: ProjectConfig): string {
  const componentsConfig = {
    $schema: 'https://ui.shadcn.com/schema.json',
    style: 'default',
    tailwind: {
      config: 'tailwind.config.js',
      css: 'app/shared/styles/global.css',
    },
    aliases: {
      components: '@shared/components',
      utils: '@shared/utils',
    },
  };

  return JSON.stringify(componentsConfig, null, 2) + '\n';
}
