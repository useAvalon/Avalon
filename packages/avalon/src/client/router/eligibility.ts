/**
 * Click / URL eligibility for client navigation.
 * Pure functions so they can be unit-tested without a DOM.
 */

export interface ClickModifiers {
	defaultPrevented: boolean;
	button: number;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
}

export interface LinkAttributes {
	href: string | null;
	download: boolean;
	target: string | null;
	reload: boolean;
}

export interface LocationLike {
	origin: string;
	href: string;
	pathname: string;
	search: string;
}

export function isModifiedClick(event: ClickModifiers): boolean {
	if (event.defaultPrevented) return true;
	if (event.button !== 0) return true;
	return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * Returns the destination URL when this link may use client navigation,
 * or null when the browser should handle it.
 */
export function eligibleNavigationUrl(
	link: LinkAttributes,
	click: ClickModifiers,
	location: LocationLike,
): URL | null {
	if (isModifiedClick(click)) return null;
	if (link.reload) return null;
	if (link.download) return null;
	const target = link.target;
	if (target && target !== "" && target !== "_self") return null;
	const href = link.href;
	if (!href || href.startsWith("#")) return null;

	let url: URL;
	try {
		url = new URL(href, location.href);
	} catch {
		return null;
	}

	if (url.origin !== location.origin) return null;
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	if (url.pathname === location.pathname && url.search === location.search && url.hash) {
		return null;
	}

	return url;
}

export function linkAttributesFromAnchor(anchor: HTMLAnchorElement): LinkAttributes {
	return {
		href: anchor.getAttribute("href"),
		download: anchor.hasAttribute("download"),
		target: anchor.getAttribute("target"),
		reload: anchor.dataset.routerReload != null,
	};
}

export function clickModifiersFromEvent(event: MouseEvent): ClickModifiers {
	return {
		defaultPrevented: event.defaultPrevented,
		button: event.button,
		metaKey: event.metaKey,
		ctrlKey: event.ctrlKey,
		shiftKey: event.shiftKey,
		altKey: event.altKey,
	};
}
