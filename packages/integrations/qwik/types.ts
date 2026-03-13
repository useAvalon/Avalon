/**
 * Qwik-specific types for the Avalon integration
 */

/**
 * Qwik component type
 * Components created with component$() are functions that return JSX
 */
export type QwikComponent<P extends Record<string, any> = Record<string, unknown>> = (props: P) => unknown;

/**
 * Qwik component props
 */
export type QwikProps = Record<string, unknown>;

/**
 * Qwik render result with resumability data
 */
export interface QwikRenderResult {
  html: string;
  /** Qwik serializes state into the HTML itself via q:container */
  hydrationData: {
    src: string;
    props: QwikProps;
    framework: "qwik";
    containerId: string;
  };
}

/**
 * Qwik resumability options
 * Qwik doesn't hydrate — it resumes from serialized state in the DOM
 */
export interface QwikResumabilityOptions {
  /**
   * Base path for Qwik's lazy-loaded chunks
   * Corresponds to q:base attribute on the container
   */
  qBase?: string;

  /**
   * Whether to include the Qwikloader script inline
   * The Qwikloader (~1KB) sets up global event delegation
   */
  includeQwikloader?: boolean;
}

/**
 * Type guard to check if a value is a Qwik component
 */
export function isQwikComponent(value: unknown): value is QwikComponent {
  if (typeof value !== "function") return false;
  const comp = value as Record<string, unknown>;
  return !!(comp.__brand === "QwikComponent" || comp.__qrl);
}
