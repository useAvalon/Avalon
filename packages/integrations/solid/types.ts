/**
 * Solid-specific types for the Avalon integration
 */

import type { Component, JSX } from "solid-js";

/**
 * Solid component type
 */
export type SolidComponent<P extends Record<string, any> = Record<string, unknown>> = Component<P>;

/**
 * Solid component props
 */
export type SolidProps = Record<string, unknown>;

/**
 * Solid render result with hydration data
 */
export interface SolidRenderResult {
  html: string;
  hydrationData: {
    src: string;
    props: SolidProps;
    framework: "solid";
    containerId: string;
  };
}

/**
 * Solid hydration options
 */
export interface SolidHydrationOptions {
  /**
   * Whether to use progressive hydration
   */
  progressive?: boolean;
  
  /**
   * Custom hydration root selector
   */
  rootSelector?: string;
}

/**
 * Type guard to check if a value is a Solid component
 */
export function isSolidComponent(value: unknown): value is SolidComponent {
  return typeof value === "function";
}
