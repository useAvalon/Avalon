import type { RenderParams, RenderResult } from "@useavalon/core/types";
import type { ComponentType, VNode } from "preact";

/**
 * Preact-specific component type
 */
export type PreactComponent = ComponentType<Record<string, unknown>>;

/**
 * Preact-specific render parameters
 * Extends base RenderParams with Preact-specific component type
 */
export interface PreactRenderParams extends Omit<RenderParams, "component"> {
	component?: PreactComponent;
}

/**
 * Preact-specific render result
 */
export interface PreactRenderResult extends RenderResult {
	vnode?: VNode;
}

/**
 * Preact component module structure
 */
export interface PreactComponentModule {
	default?: PreactComponent;
	[key: string]: unknown;
}

/**
 * Preact hydration options
 */
export interface PreactHydrationOptions {
	replaceNode?: boolean;
}
