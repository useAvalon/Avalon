/**
 * Type declarations for Vite virtual modules
 * 
 * These modules are resolved by Vite at runtime in the browser.
 * They don't exist as actual files but are provided by Vite's plugin system.
 */

declare module '/@avalon/preact/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@avalon/react/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@avalon/vue/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@avalon/svelte/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@avalon/solid/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}

declare module '/@avalon/lit/client' {
  export function hydrate(
    container: Element,
    component: unknown,
    props?: Record<string, unknown>
  ): void;
  export function getHydrationScript(): string;
}
