/**
 * Client-safe utility for typing Qwik components as Preact-compatible islands.
 * This file has ZERO server dependencies (no node:path, no fs, etc).
 */

/**
 * Identity function that types a Qwik component for use in Preact page files.
 *
 * At runtime this is a no-op — it returns the component unchanged.
 * At the type level it erases Qwik's 3-arg `FunctionComponent` signature
 * so TypeScript accepts `<MyComponent />` in Preact JSX pages.
 *
 * ```tsx
 * import { defineQwikIsland } from '@avalon/qwik/island';
 * const Counter = component$(() => { ... });
 * export default defineQwikIsland(Counter);
 * ```
 */
export function defineQwikIsland<P extends Record<string, any> = Record<string, unknown>>(
  component: unknown,
): (props: P) => any {
  return component as unknown as (props: P) => any;
}
