/**
 * Client-safe utility for typing Lit web components as Preact-compatible islands.
 * This file has ZERO server dependencies (no node:path, no fs, etc).
 */

/**
 * Identity function that types a Lit element class for use in Preact page files.
 *
 * At runtime this is a no-op — it returns the class unchanged.
 * At the type level it erases Lit's `typeof LitElement` constructor signature
 * so TypeScript accepts `<MyComponent />` in Preact JSX pages.
 *
 * ```ts
 * import { defineLitIsland } from '@avalon/lit/island';
 * class MyCounter extends LitElement { ... }
 * customElements.define('my-counter', MyCounter);
 * export default defineLitIsland(MyCounter);
 * ```
 */
export function defineLitIsland<P extends Record<string, any> = Record<string, unknown>>(
  component: unknown,
): (props: P) => any {
  return component as unknown as (props: P) => any;
}
