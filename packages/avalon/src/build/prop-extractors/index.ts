export { type PropExtractionResult, FALLBACK_PROPS, extractVueProps } from "./vue";
export { extractSvelteProps } from "./svelte";
export { extractLitProps } from "./lit";
export { extractSolidProps } from "./solid";
export { extractQwikProps } from "./qwik";

import type { PropExtractionResult } from "./vue";
import { extractVueProps } from "./vue";
import { extractSvelteProps } from "./svelte";
import { extractLitProps } from "./lit";
import { extractSolidProps } from "./solid";
import { extractQwikProps } from "./qwik";

/** Maps framework name to its prop extractor function */
export const EXTRACTOR_MAP: Record<string, (source: string) => PropExtractionResult> = {
	vue: extractVueProps,
	svelte: extractSvelteProps,
	lit: extractLitProps,
	solid: extractSolidProps,
	qwik: extractQwikProps,
};
