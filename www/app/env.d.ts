/// <reference types="@avalon/avalon/types/island-jsx" />

// Treat cross-framework island files as Preact-compatible function components.
// The Avalon Vite transform handles these at build time — these declarations
// are purely for TypeScript's benefit so the `island` prop and component props
// work without manual casting.
declare module '*.vue' {
  import type { ComponentType } from 'preact';
  const component: ComponentType<Record<string, unknown>>;
  export default component;
}

declare module '*.svelte' {
  import type { ComponentType } from 'preact';
  const component: ComponentType<Record<string, unknown>>;
  export default component;
}

declare module '*.solid.tsx' {
  import type { ComponentType } from 'preact';
  const component: ComponentType<Record<string, unknown>>;
  export default component;
}

declare module '*.lit.ts' {
  import type { ComponentType } from 'preact';
  const component: ComponentType<Record<string, unknown>>;
  export default component;
}

declare module '*.qwik.tsx' {
  import type { ComponentType } from 'preact';
  const component: ComponentType<Record<string, unknown>>;
  export default component;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
