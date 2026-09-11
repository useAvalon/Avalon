/**
 * Route-level client navigation opt-out.
 *
 * Pages export `clientNavigation = false` (or MDX `clientNavigation: false`
 * in frontmatter). SSR stamps `data-client-navigation="false"` on `<html>`
 * and sends `Avalon-Client-Navigation: false` so the client router falls
 * back to a full load instead of swapping that document.
 */

export const CLIENT_NAVIGATION_HEADER = "Avalon-Client-Navigation";
export const CLIENT_NAVIGATION_ATTR = "data-client-navigation";

export class ClientNavigationDisabledError extends Error {
	constructor(url: string) {
		super(`Client navigation disabled for ${url}`);
		this.name = "ClientNavigationDisabledError";
	}
}

export function isClientNavigationDisabled(pageModule: {
	clientNavigation?: boolean;
	frontmatter?: Record<string, unknown>;
}): boolean {
	if (pageModule.clientNavigation === false) return true;
	return pageModule.frontmatter?.clientNavigation === false;
}

export function headerDisablesClientNavigation(headers: {
	get(name: string): string | null;
}): boolean {
	const value = headers.get(CLIENT_NAVIGATION_HEADER);
	if (value == null) return false;
	return value.trim().toLowerCase() === "false";
}

export function htmlDisablesClientNavigation(html: string): boolean {
	const openTag = /<html\b[^>]*>/i.exec(html)?.[0];
	if (!openTag) return false;
	return /\sdata-client-navigation\s*=\s*(['"]?)false\1/i.test(openTag);
}

export function documentDisablesClientNavigation(doc: {
	documentElement: { dataset: DOMStringMap };
}): boolean {
	return doc.documentElement.dataset.clientNavigation === "false";
}

/** True when the live document opted this route out of client navigation. */
export function currentDocumentDisablesClientNavigation(): boolean {
	if (typeof document === "undefined") return false;
	return documentDisablesClientNavigation(document);
}

export function stampClientNavigationOptOut(html: string): string {
	if (htmlDisablesClientNavigation(html)) return html;
	return html.replace(/<html\b/i, `<html ${CLIENT_NAVIGATION_ATTR}="false"`);
}

export function clientNavigationResponseHeaders(disabled: boolean): Record<string, string> {
	if (!disabled) return {};
	return { [CLIENT_NAVIGATION_HEADER]: "false" };
}
