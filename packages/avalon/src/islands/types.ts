import type { JSX } from "preact";
import type { AnalyzerOptions } from "../core/components/component-analyzer.ts";

/**
 * Framework type for island components
 * Represents the supported UI frameworks for island architecture
 */
export type Framework =
  | "solid"
  | "vue"
  | "svelte"
  | "preact"
  | "react"
  | "lit"
  | "unknown";

/**
 * Props for the Island component
 * Defines the configuration for rendering an interactive island component
 */
export interface IslandProps {
  /** Path to the island component (e.g., "/islands/Counter.tsx") */
  src: string;
  /** Hydration condition */
  condition?:
    | "on:visible"
    | "on:interaction"
    | "on:idle"
    | "on:client"
    | `media:${string}`;
  /** Props to pass to the island component */
  props?: Record<string, unknown>;
  /** Children to render inside the island (for SSR) */
  children?: JSX.Element | JSX.Element[] | string;
  /** Whether to render server-side (default: true unless condition is 'on:client') */
  ssr?: boolean;
  /** Framework hint for client hydration */
  framework?: "solid" | "vue" | "preact" | "react" | "svelte" | "lit";
  /** Force SSR-only rendering without hydration */
  ssrOnly?: boolean;
  /** Component render options for intelligent detection */
  renderOptions?: AnalyzerOptions;
}

/**
 * Parameters for framework-specific render functions
 * Used by all framework renderers to maintain consistent interface
 */
export interface RenderParams {
  /** Path to the island component */
  src: string;
  /** Hydration condition */
  condition: IslandProps["condition"];
  /** Props to pass to the component */
  props: Record<string, unknown>;
  /** Whether to render server-side */
  ssr: boolean;
  /** Component render options for intelligent detection */
  renderOptions?: AnalyzerOptions;
  /** Force SSR-only rendering without hydration */
  ssrOnly?: boolean;
}

/**
 * Entry in the Svelte SSR CSS collection
 * Tracks CSS for Svelte components during server-side rendering
 */
export interface SvelteSSRCSSEntry {
  /** The CSS content */
  css: string;
  /** Unique scope identifier for the component */
  scopeId: string;
  /** Source path of the component */
  src: string;
  /** Whether this is global CSS */
  isGlobal: boolean;
  /** Timestamp when the CSS was added */
  timestamp: number;
}
