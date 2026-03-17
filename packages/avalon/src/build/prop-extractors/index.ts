export { type PropExtractionResult, FALLBACK_PROPS, extractVueProps } from "./vue.ts";
export { extractSvelteProps } from "./svelte.ts";
export { extractLitProps } from "./lit.ts";
export { extractSolidProps } from "./solid.ts";
export { extractQwikProps } from "./qwik.ts";

import type { PropExtractionResult } from "./vue.ts";
import { extractVueProps } from "./vue.ts";
import { extractSvelteProps } from "./svelte.ts";
import { extractLitProps } from "./lit.ts";
import { extractSolidProps } from "./solid.ts";
import { extractQwikProps } from "./qwik.ts";

/** Maps framework name to its prop extractor function */
export const EXTRACTOR_MAP: Record<string, (source: string) => PropExtractionResult> = {
	vue: extractVueProps,
	svelte: extractSvelteProps,
	lit: extractLitProps,
	solid: extractSolidProps,
	qwik: extractQwikProps,
};
