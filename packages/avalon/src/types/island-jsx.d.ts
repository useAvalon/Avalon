/**
 * JSX augmentation for the `island` prop.
 *
 * Automatically included via tsconfig.json `compilerOptions.types`.
 */

import type { IslandDirective } from './island-prop.d.ts';

declare module 'preact' {
  namespace JSX {
    interface IntrinsicAttributes {
      island?: IslandDirective;
    }
  }
}

// Augment the global JSX namespace so the `island` prop is accepted on
// non-Preact components (Svelte, Solid) when used in a Preact JSX context.
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      island?: IslandDirective;
    }
  }
}

// Augment Vue's ComponentCustomProps so Volar accepts `island` on all Vue SFCs.
declare module '@vue/runtime-core' {
  interface ComponentCustomProps {
    island?: IslandDirective;
  }
}

