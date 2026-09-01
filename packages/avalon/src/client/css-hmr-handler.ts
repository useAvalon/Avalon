/**
 * Apply Avalon-owned CSS HMR. Writes `textContent` on a `<style>` tag so
 * previous rules stay until the new ones are in the DOM.
 */

/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

export function normalizeCssHref(path: string): string {
	const noQuery = path.split("?")[0]?.split("#")[0] ?? path;
	const slash = noQuery.replaceAll("\\", "/");
	return slash.startsWith("/") ? slash : `/${slash}`;
}

function avalonCssId(el: Element): string | undefined {
	return (el as HTMLElement).dataset.avalonCss;
}

function findAvalonStyle(doc: Document, id: string): HTMLStyleElement | undefined {
	for (const el of doc.querySelectorAll("style[data-avalon-css]")) {
		if (avalonCssId(el) === id) return el as HTMLStyleElement;
	}
	return undefined;
}

/**
 * Cache-bust the matching `<link>` (`v=`, Vite strips `t=`) and write the
 * payload into a `<style>` tag so the change is visible before the refetch.
 */
export function applyDevCssHot(doc: Document, href: string, css: string): void {
	const id = normalizeCssHref(href);
	for (const el of doc.querySelectorAll("link[data-avalon-css]")) {
		if (avalonCssId(el) !== id) continue;
		(el as HTMLLinkElement).href = `${id}?direct&v=${Date.now()}`;
	}
	if (css) applyCssText(doc, href, css);
}

export function applyCssText(doc: Document, href: string, css: string): void {
	if (!css) return;
	if (css.includes("__vite__updateStyle") || css.includes("import.meta.hot")) return;
	const id = normalizeCssHref(href);
	let style = findAvalonStyle(doc, id);
	if (!style) {
		style = doc.createElement("style");
		style.dataset.avalonCss = id;
		doc.head.appendChild(style);
	}
	style.textContent = css;
}
