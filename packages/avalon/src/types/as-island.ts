import type { IslandDirective } from './island-prop.d.ts';
import type { ComponentType } from 'preact';

/**
 * Cast a cross-framework component (Vue, Svelte, Lit, Solid) to be usable
 * in Preact JSX with the `island` prop and correct prop types.
 *
 * The Vite transform handles these components at build time — this cast is
 * purely for TypeScript's benefit.
 *
 * @example
 * import _VueCounter from '../islands/VueCounter.vue';
 * const VueCounter = asIsland<{ initialCount?: number }>(_VueCounter);
 * // Now usable as: <VueCounter island={{ condition: 'on:visible' }} initialCount={0} />
 */
export function asIsland<P extends Record<string, unknown> = Record<string, unknown>>(
  _component: unknown,
): ComponentType<P & { island?: IslandDirective }> {
  return _component as ComponentType<P & { island?: IslandDirective }>;
}
