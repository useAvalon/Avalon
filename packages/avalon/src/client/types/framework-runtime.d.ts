/**
 * Type declarations for framework runtime imports
 * 
 * These are dynamic imports that are resolved by Vite at runtime in the browser.
 * The actual packages are provided by the user's project dependencies.
 */

declare module 'react' {
  export function createElement<P = Record<string, unknown>>(
    component: unknown,
    props: P | null,
    ...children: unknown[]
  ): unknown;
  export const version: string;
}

declare module 'react-dom/client' {
  export interface Root {
    render(element: unknown): void;
    unmount(): void;
  }
  
  export function hydrateRoot(
    container: HTMLElement,
    element: unknown,
    options?: {
      onRecoverableError?: (error: Error) => void;
    }
  ): Root;
  
  export function createRoot(container: HTMLElement): Root;
}

declare module 'vue' {
  export interface App {
    mount(rootContainer: HTMLElement | string, isHydrate?: boolean): unknown;
    unmount(): void;
    use(plugin: unknown, ...options: unknown[]): App;
    component(name: string, component: unknown): App;
    directive(name: string, directive: unknown): App;
    provide(key: string | symbol, value: unknown): App;
    config: {
      errorHandler?: (err: Error, instance: unknown, info: string) => void;
      warnHandler?: (msg: string, instance: unknown, trace: string) => void;
    };
  }
  
  export function createApp(rootComponent: unknown, rootProps?: Record<string, unknown>): App;
  export const version: string;
}


declare module 'svelte' {
  export interface SvelteComponent {
    new (options: {
      target: HTMLElement;
      props?: Record<string, unknown>;
      hydrate?: boolean;
      intro?: boolean;
      anchor?: Element | null;
      context?: Map<unknown, unknown>;
    }): {
      $set(props: Record<string, unknown>): void;
      $destroy(): void;
      $on?(event: string, handler: (...args: unknown[]) => void): () => void;
    };
  }
}
