/**
 * JSX augmentation for the `island` prop.
 *
 * Reference this file in your project to get type support for the `island` prop:
 *   /// <reference types="@avalon/avalon/types/island-jsx" />
 *
 * Or add to your tsconfig.json compilerOptions.types array.
 */

import type { IslandDirective } from './island-prop.d.ts';

declare module 'preact' {
  namespace JSX {
    interface IntrinsicAttributes {
      island?: IslandDirective;
    }
  }
}
