/**
 * Type declarations for Vite virtual modules
 * 
 * These modules are resolved by Vite at runtime in the browser.
 * They don't exist as actual files but are provided by Vite's plugin system.
 */

declare module '/@useavalon/preact/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@useavalon/react/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@useavalon/vue/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@useavalon/svelte/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@useavalon/solid/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@useavalon/lit/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}
