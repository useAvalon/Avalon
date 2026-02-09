/**
 * Type augmentation for the `island` prop on island components.
 *
 * When importing a component from the islands directory and using it in a page,
 * you can pass an `island` prop to control hydration behavior. The Vite transform
 * plugin intercepts this at build time and converts it to a renderIsland() call.
 *
 * Usage:
 *   import Counter from '../islands/Counter.tsx';
 *   <Counter island={{ condition: 'on:interaction' }} someProp={42} />
 */

export interface IslandDirective {
  /** Hydration condition */
  condition?: 'on:visible' | 'on:interaction' | 'on:idle' | 'on:client' | `media:${string}`;
  /** Force SSR-only rendering without client hydration */
  ssrOnly?: boolean;
  /** Whether to render server-side (default: true) */
  ssr?: boolean;
}
