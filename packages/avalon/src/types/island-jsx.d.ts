/**
 * JSX augmentation for the `island` prop.
 *
 * Automatically included via tsconfig.json `compilerOptions.types`.
 */

import type { IslandDirective } from './island-prop.d.ts';

/** Force TypeScript to expand the type inline on hover instead of showing the alias name */
type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

declare module 'preact' {
  namespace JSX {
    interface IntrinsicAttributes {
      island?: Expand<IslandDirective>;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      island?: Expand<IslandDirective>;
    }
  }
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProps {
    island?: Expand<IslandDirective>;
  }
}
