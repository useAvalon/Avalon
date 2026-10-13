/**
 * HTML post-process hooks for production SSR.
 *
 * Vite plugins (e.g. @useavalon/seo) register transforms that run after the
 * page shell is finalized and before the response is sent.
 */

export type HtmlPostProcessFn = (html: string, pathname: string) => string;

const hooks: HtmlPostProcessFn[] = [];

/** Register a transform to run on every HTML document response. */
export function registerHtmlPostProcess(fn: HtmlPostProcessFn): void {
	hooks.push(fn);
}

/** Apply all registered HTML post-process hooks. */
export function applyHtmlPostProcess(html: string, pathname: string): string {
	let out = html;
	for (const fn of hooks) {
		out = fn(out, pathname);
	}
	return out;
}

/** Clear hooks (tests). */
export function clearHtmlPostProcessHooks(): void {
	hooks.length = 0;
}
