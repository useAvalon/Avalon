/**
 * Build-time source for `virtual:avalon/html-post-process-register`.
 *
 * Vite plugins (e.g. @useavalon/seo) register module source here so Nitro's
 * server bundle can import the same registration side effect.
 */

export type HtmlPostProcessRegisterSource = () => string;

const GLOBAL_PROVIDER_KEY = "__avalonHtmlPostProcessRegisterProvider";

let sourceProvider: HtmlPostProcessRegisterSource | null = null;

function getGlobalProvider(): HtmlPostProcessRegisterSource | null {
	const value = (globalThis as Record<string, unknown>)[GLOBAL_PROVIDER_KEY];
	if (typeof value === "function") {
		return value as HtmlPostProcessRegisterSource;
	}
	return null;
}

/** Register the module source evaluated into the Nitro server bundle. */
export function setHtmlPostProcessRegisterModuleSource(
	provider: HtmlPostProcessRegisterSource,
): void {
	sourceProvider = provider;
	(globalThis as Record<string, unknown>)[GLOBAL_PROVIDER_KEY] = provider;
}

/** Resolve register module source; no-op when nothing registered. */
export function getHtmlPostProcessRegisterModuleSource(): string {
	const provider = getGlobalProvider() ?? sourceProvider;
	if (!provider) return "// html post-process: no-op\n";
	return provider();
}

/** Clear provider (tests). */
export function clearHtmlPostProcessRegisterModuleSource(): void {
	sourceProvider = null;
	delete (globalThis as Record<string, unknown>)[GLOBAL_PROVIDER_KEY];
}
