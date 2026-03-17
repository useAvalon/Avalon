import type { PropExtractionResult } from "./vue.ts";
import { FALLBACK_PROPS } from "./vue.ts";

/**
 * Extract props type from a Qwik component file.
 * Qwik components use component$(() => ...) — props are typed via the
 * generic parameter or a Props interface. For now we fall back to
 * Record<string, unknown> since Qwik's JSX types aren't Preact-compatible
 * and the sidecar just needs to expose the island prop.
 */
export function extractQwikProps(_source: string): PropExtractionResult {
	return {
    propsType: FALLBACK_PROPS,
    fallback: false
};
}
