// Type definitions for React integration

import type { ComponentType, ReactElement } from "react";

/**
 * Hydration condition types
 */
export type HydrationCondition =
  | "on:client"
  | "on:visible"
  | "on:interaction"
  | "on:idle"
  | `media:${string}`;

/**
 * Base render parameters interface
 */
export interface RenderParams {
  /** Component source path */
  src: string;
  /** Component props */
  props: Record<string, unknown>;
  /** Hydration condition */
  condition?: HydrationCondition;
  /** Whether this is SSR-only (no hydration) */
  ssrOnly?: boolean;
}

/**
 * Base render result interface
 */
export interface RenderResult {
  /** Rendered HTML string */
  html: string;
  /** CSS styles */
  css?: string;
  /** Hydration data for client */
  hydrationData?: HydrationData;
}

/**
 * Hydration data structure
 */
export interface HydrationData extends Record<string, unknown> {
  /** Framework identifier */
  framework: string;
  /** Component source path */
  src: string;
  /** Serialized props */
  props: Record<string, unknown>;
  /** Hydration condition */
  condition?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * React-specific render parameters
 */
export interface ReactRenderParams extends RenderParams {
  /** React component or element */
  component?: ComponentType<Record<string, unknown>> | ReactElement;
  /** Whether this is a Server Component */
  isServerComponent?: boolean;
  /** Whether to use streaming SSR */
  streaming?: boolean;
}

/**
 * React-specific render result
 */
export interface ReactRenderResult extends RenderResult {
  /** React element (for debugging) */
  element?: ReactElement;
  /** Whether component is a Server Component */
  isServerComponent?: boolean;
}

/**
 * React hydration options
 */
export interface ReactHydrationOptions {
  /** Hydration mode */
  mode?: "hydrate" | "render";
  /** Error recovery callback */
  onRecoverableError?: (error: unknown, errorInfo: import("react").ErrorInfo) => void;
}

/**
 * Component metadata for RSC classification
 */
export interface ComponentMetadata {
  /** Component file path */
  path: string;
  /** Whether component has "use client" directive */
  isClientComponent: boolean;
  /** Whether component has "use server" directive */
  isServerComponent: boolean;
  /** Detected async functions */
  hasAsyncRender: boolean;
  /** Import dependencies */
  dependencies: string[];
}
