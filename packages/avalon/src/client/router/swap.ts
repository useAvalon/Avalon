/**
 * Head reconciliation and body replacement for client navigation.
 *
 * Stylesheets already present (same href) are reused to avoid FOUC.
 * Page-specific SSR `<style>` tags (`data-universal-ssr`, `data-avalon-ssr-css`,
 * hashed `style[data-avalon-css]`) are copied from the next document.
 * Framework/dev markers (`data-avalon-*`, Vite client) are kept.
 * Script tags in the next document are not executed — server islands are
 * booted by the shared runtime after the swap.
 */

const PRESERVED_SCRIPT = /\/@vite\/client|\/src\/client\/main|entry-client|client\/router/;
const AUX_LINK_RELS = new Set(["icon", "canonical", "alternate", "preload"]);
const SSR_STYLE_SELECTOR = "style[data-universal-ssr], style[data-avalon-ssr-css]";
const SKIP_HTML_ATTRS = new Set([
	"lang",
	"data-router-navigating",
	"style",
	"data-router-transition",
]);

function attr(el: Element, name: string): string | null {
	return el.getAttribute(name);
}

function stylesheetKey(link: Element): string {
	return link.getAttribute("href") || (link as HTMLLinkElement).href;
}

function linkRel(link: Element): string {
	return (attr(link, "rel") || "").toLowerCase();
}

function isHtml(el: Element): el is HTMLElement {
	return el instanceof HTMLElement;
}

function dataAvalonCss(el: Element): string {
	if (!("dataset" in el)) return "";
	return (el as HTMLElement).dataset.avalonCss ?? "";
}

function isPreservedHeadNode(el: Element): boolean {
	if (isHtml(el) && (el.dataset.avalonCss != null || el.dataset.avalonBase != null)) return true;
	if (el.tagName === "SCRIPT") {
		const src = attr(el, "src") ?? "";
		return PRESERVED_SCRIPT.test(src);
	}
	return el.tagName === "STYLE" && isHtml(el) && el.dataset.avalonSsrCss != null;
}

function metaKey(meta: HTMLMetaElement): string {
	const charset = attr(meta, "charset");
	if (charset) return "charset";
	const name = attr(meta, "name");
	if (name) return `name:${name}`;
	const property = attr(meta, "property");
	if (property) return `property:${property}`;
	const httpEquiv = attr(meta, "http-equiv");
	if (httpEquiv) return `http-equiv:${httpEquiv}`;
	return `misc:${meta.outerHTML}`;
}

function reconcileMeta(current: Document, next: Document): void {
	const currentMetas = current.head.querySelectorAll("meta");
	const nextMetas = [...next.head.querySelectorAll("meta")];
	const nextMetaKeys = new Set(nextMetas.map((m) => metaKey(m)));

	for (const meta of currentMetas) {
		if (attr(meta, "charset")) continue;
		if (!nextMetaKeys.has(metaKey(meta))) meta.remove();
	}

	const existingMetaKeys = new Set(
		[...current.head.querySelectorAll("meta")].map((m) => metaKey(m)),
	);
	for (const meta of nextMetas) {
		if (attr(meta, "charset")) continue;
		const key = metaKey(meta);
		if (existingMetaKeys.has(key)) {
			const old = [...current.head.querySelectorAll("meta")].find((m) => metaKey(m) === key);
			old?.replaceWith(current.importNode(meta, true));
			continue;
		}
		current.head.appendChild(current.importNode(meta, true));
	}
}

function collectNextLinks(next: Document): {
	nextStyles: Map<string, HTMLLinkElement>;
	nextOther: HTMLLinkElement[];
	nextLinks: HTMLLinkElement[];
} {
	const nextLinks = [...next.head.querySelectorAll("link")] as HTMLLinkElement[];
	const nextStyles = new Map<string, HTMLLinkElement>();
	const nextOther: HTMLLinkElement[] = [];
	for (const link of nextLinks) {
		const rel = linkRel(link);
		if (rel === "stylesheet" || (rel === "preload" && attr(link, "as") === "style")) {
			nextStyles.set(stylesheetKey(link), link);
		} else {
			nextOther.push(link);
		}
	}
	return { nextStyles, nextOther, nextLinks };
}

function pruneStylesheetIfStale(link: Element, nextStyles: Map<string, HTMLLinkElement>): void {
	if (isHtml(link) && link.dataset.avalonCss != null) return;
	if (!nextStyles.has(stylesheetKey(link))) link.remove();
}

function hasMatchingModulepreload(href: string, nextLinks: HTMLLinkElement[]): boolean {
	return nextLinks.some((n) => linkRel(n) === "modulepreload" && stylesheetKey(n) === href);
}

function pruneStaleLinks(
	current: Document,
	nextStyles: Map<string, HTMLLinkElement>,
	nextLinks: HTMLLinkElement[],
): void {
	for (const link of current.head.querySelectorAll("link")) {
		const rel = linkRel(link);
		if (rel === "stylesheet") {
			pruneStylesheetIfStale(link, nextStyles);
			continue;
		}
		if (isPreservedHeadNode(link)) continue;
		if (rel === "modulepreload" && !hasMatchingModulepreload(stylesheetKey(link), nextLinks)) {
			link.remove();
		}
	}
}

function appendMissingStylesheets(
	current: Document,
	nextStyles: Map<string, HTMLLinkElement>,
): void {
	const existing = new Set(
		[...current.head.querySelectorAll('link[rel="stylesheet"]')].map((l) => stylesheetKey(l)),
	);
	for (const [key, link] of nextStyles) {
		if (existing.has(key)) continue;
		current.head.appendChild(current.importNode(link, true));
	}
}

function reconcileAuxiliaryLinks(current: Document, nextOther: HTMLLinkElement[]): void {
	for (const el of current.head.querySelectorAll("link")) {
		const rel = linkRel(el);
		if (rel === "stylesheet" || rel === "modulepreload") continue;
		if (isPreservedHeadNode(el)) continue;
		if (AUX_LINK_RELS.has(rel)) el.remove();
	}

	for (const link of nextOther) {
		const rel = linkRel(link);
		if (rel === "modulepreload") {
			const href = stylesheetKey(link);
			const exists = [...current.head.querySelectorAll('link[rel="modulepreload"]')].some(
				(n) => stylesheetKey(n) === href,
			);
			if (!exists) current.head.appendChild(current.importNode(link, true));
			continue;
		}
		if (AUX_LINK_RELS.has(rel)) {
			current.head.appendChild(current.importNode(link, true));
		}
	}
}

export function reconcileHead(current: Document, next: Document): void {
	current.title = next.title;
	reconcileMeta(current, next);
	const { nextStyles, nextOther, nextLinks } = collectNextLinks(next);
	pruneStaleLinks(current, nextStyles, nextLinks);
	appendMissingStylesheets(current, nextStyles);
	reconcileAuxiliaryLinks(current, nextOther);
	reconcileStyleTags(current, next);
}

/**
 * Copy page-specific SSR `<style>` tags. Vue/Svelte island CSS lives in
 * `data-universal-ssr`; Vite module CSS uses `data-avalon-ssr-css` /
 * `style[data-avalon-css]`. Links are handled above by href.
 */
function reconcileStyleTags(current: Document, next: Document): void {
	for (const el of current.head.querySelectorAll(SSR_STYLE_SELECTOR)) {
		el.remove();
	}
	for (const el of next.head.querySelectorAll(SSR_STYLE_SELECTOR)) {
		current.head.appendChild(current.importNode(el, true));
	}

	const existingHashed = new Set(
		[...current.head.querySelectorAll("style[data-avalon-css]")].map((el) => dataAvalonCss(el)),
	);
	for (const el of next.head.querySelectorAll("style[data-avalon-css]")) {
		const href = dataAvalonCss(el);
		if (!href || existingHashed.has(href)) continue;
		current.head.appendChild(current.importNode(el, true));
		existingHashed.add(href);
	}
}

export function copyHtmlAttributes(current: Document, next: Document): void {
	const from = next.documentElement;
	const to = current.documentElement;
	to.lang = from.lang;
	for (const name of from.getAttributeNames()) {
		if (SKIP_HTML_ATTRS.has(name)) continue;
		const value = from.getAttribute(name);
		if (value !== null) to.setAttribute(name, value);
	}
	if (from.dataset.clientNavigation !== "false") {
		delete to.dataset.clientNavigation;
	}
}

/**
 * Attach leftover `<template shadowrootmode>` nodes (older browsers, or a
 * parser that did not instantiate Declarative Shadow DOM). Native DSD already
 * consumed those templates; this is a no-op when `host.shadowRoot` exists.
 */
export function attachDeclarativeShadowRoots(root: ParentNode): void {
	const templates = [...root.querySelectorAll("template[shadowrootmode]")];
	for (const template of templates) {
		const host = template.parentElement;
		if (!host) continue;
		if (host.shadowRoot) {
			template.remove();
			continue;
		}
		const mode = template.getAttribute("shadowrootmode") === "closed" ? "closed" : "open";
		try {
			const shadow = host.attachShadow({ mode });
			shadow.appendChild((template as HTMLTemplateElement).content);
			template.remove();
		} catch {
			// Host does not support shadow DOM
		}
	}
}

const OUTLET_SELECTOR = "[data-router-outlet]";

export function outletKeyOf(el: HTMLElement): string | null {
	const raw = el.dataset.routerOutlet;
	if (raw == null) return null;
	const key = raw.trim();
	return key.length > 0 ? key : null;
}

function outletMap(root: ParentNode): Map<string, HTMLElement> | null {
	const map = new Map<string, HTMLElement>();
	for (const el of root.querySelectorAll<HTMLElement>(OUTLET_SELECTOR)) {
		const key = outletKeyOf(el);
		if (!key || map.has(key)) return null;
		map.set(key, el);
	}
	return map.size > 0 ? map : null;
}

/**
 * Swap `[data-router-outlet]` regions when both documents share the same keys.
 * Shared chrome (sidebar, header) stays in place so view transitions can
 * crossfade only the page. Returns the detached outgoing nodes, or `null`
 * when a full body replace is required.
 */
export function replaceOutlets(current: Document, next: Document): HTMLElement[] | null {
	const from = outletMap(current);
	const to = outletMap(next.body);
	if (!from || !to || from.size !== to.size) return null;
	for (const key of from.keys()) {
		if (!to.has(key)) return null;
	}

	const outgoing: HTMLElement[] = [];
	for (const [key, live] of from) {
		const incoming = to.get(key);
		if (!incoming) return null;
		outgoing.push(live);
		live.replaceWith(current.adoptNode(incoming));
	}
	attachDeclarativeShadowRoots(current.body);
	return outgoing;
}

export function replaceBody(current: Document, next: Document): void {
	// Adopt the parsed `<body>` instead of importNode/cloneNode. Cloning drops
	// Declarative Shadow DOM (Lit island styles live in the shadow root) unless
	// every root is marked clonable. Moving the nodes keeps live shadow roots.
	current.body.replaceWith(current.adoptNode(next.body));
	attachDeclarativeShadowRoots(current.body);
}

export function parseHtmlDocument(html: string): Document {
	return new DOMParser().parseFromString(html, "text/html");
}

export function isHtmlResponse(contentType: string | null): boolean {
	if (!contentType) return false;
	return contentType.toLowerCase().includes("text/html");
}
