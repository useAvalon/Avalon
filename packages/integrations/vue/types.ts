/**
 * Vue Integration Types
 *
 * Type definitions specific to the Vue integration package.
 */

import type { RenderParams, RenderResult } from "@useavalon/core/types";

/**
 * Vue-specific render parameters
 */
export interface VueRenderParams extends RenderParams {
	/**
	 * Vue app context for SSR
	 */
	context?: Map<string, unknown>;
}

/**
 * Vue-specific render result with CSS extraction
 */
export interface VueRenderResult extends RenderResult {
	/**
	 * Extracted CSS from Vue SFC <style> blocks
	 */
	css?: string;

	/**
	 * Head content (e.g., meta tags, title)
	 */
	head?: string;

	/**
	 * Scope ID for scoped styles
	 */
	scopeId?: string;
}

/**
 * Vue component module structure
 */
export interface VueComponentModule {
	default?: unknown;
	[key: string]: unknown;
}

/**
 * CSS extraction options
 */
export interface CSSExtractionOptions {
	/**
	 * Whether to apply scoping to CSS
	 */
	scoped?: boolean;

	/**
	 * Custom scope ID (generated if not provided)
	 */
	scopeId?: string;
}

/**
 * Style block metadata from Vue SFC
 */
export interface StyleBlock {
	/**
	 * CSS content
	 */
	content: string;

	/**
	 * Whether the style is scoped
	 */
	scoped: boolean;

	/**
	 * Style attributes (e.g., lang, scoped)
	 */
	attributes: string;
}
