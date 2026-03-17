/**
 * Type definitions for Lit integration
 */

import type { LitElement } from "lit";
import type { RenderParams, RenderResult } from '@useavalon/core/types';

/**
 * Lit-specific render parameters
 */
export interface LitRenderParams extends Omit<RenderParams, 'component'> {
  /** Lit element class (may be null if integration loads it) */
  component?: typeof LitElement | null;
  /** Element tag name */
  tagName?: string;
}

/**
 * Lit-specific render result
 */
export interface LitRenderResult extends RenderResult {
  /** Shadow DOM content */
  shadowContent?: string;
  /** Scoped styles */
  styles?: string;
}

/**
 * Lit-specific hydration options
 */
export interface LitHydrationOptions {
  /** Whether to defer hydration */
  defer?: boolean;
}

// Re-export shared types for convenience
export type { RenderParams, RenderResult } from '@useavalon/core/types';
