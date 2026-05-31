export { extractLitProps } from "./lit.ts";
export { extractQwikProps } from "./qwik.ts";
export { extractSolidProps } from "./solid.ts";
export { extractSvelteProps } from "./svelte.ts";
export { extractVueProps, FALLBACK_PROPS, type PropExtractionResult } from "./vue.ts";

import { extractLitProps } from "./lit.ts";
import { extractQwikProps } from "./qwik.ts";
import { extractSolidProps } from "./solid.ts";
import { extractSvelteProps } from "./svelte.ts";
import type { PropExtractionResult } from "./vue.ts";
import { extractVueProps } from "./vue.ts";

/** Maps framework name to its prop extractor function */
export const EXTRACTOR_MAP: Record<string, (source: string) => PropExtractionResult> = {
	vue: extractVueProps,
	svelte: extractSvelteProps,
	lit: extractLitProps,
	solid: extractSolidProps,
	qwik: extractQwikProps,
};
