/**
 * Prefetch cache for client navigation.
 *
 * Hover/focus on an eligible link fetches the SSR HTML document so a later
 * click can swap without waiting on the network. Honors Save-Data and
 * `data-router-prefetch="false"`.
 */

import {
	currentDocumentDisablesClientNavigation,
	headerDisablesClientNavigation,
	htmlDisablesClientNavigation,
} from "./opt-out.ts";
import { isHtmlResponse } from "./swap.ts";

const DEFAULT_TTL_MS = 30_000;
const HOVER_DELAY_MS = 80;
const SLOW_CONNECTION = new Set(["slow-2g", "2g"]);

export const ROUTER_FETCH_HEADERS = {
	Accept: "text/html",
	"Avalon-Router": "1",
} as const;

export interface PrefetchCacheEntry {
	html: string;
	expiresAt: number;
	finalUrl: string;
}

const cache = new Map<string, PrefetchCacheEntry>();
const inflight = new Map<string, Promise<PrefetchCacheEntry | null>>();

export function cacheKeyFromUrl(url: URL): string {
	return `${url.origin}${url.pathname}${url.search}`;
}

export function clearPrefetchCache(): void {
	cache.clear();
	inflight.clear();
}

function connectionAllowsPrefetch(): boolean {
	const connection = (
		navigator as Navigator & {
			connection?: { saveData?: boolean; effectiveType?: string };
		}
	).connection;
	if (!connection) return true;
	if (connection.saveData) return false;
	return !SLOW_CONNECTION.has(connection.effectiveType ?? "");
}

export function getCachedDocument(url: URL, now = Date.now()): PrefetchCacheEntry | null {
	const key = cacheKeyFromUrl(url);
	const entry = cache.get(key);
	if (!entry) return null;
	if (entry.expiresAt <= now) {
		cache.delete(key);
		return null;
	}
	return entry;
}

/** Cache hit, or the in-flight prefetch for this URL (if any). */
export function getCachedOrInflight(
	url: URL,
): PrefetchCacheEntry | Promise<PrefetchCacheEntry | null> | null {
	const cached = getCachedDocument(url);
	if (cached) return cached;
	return inflight.get(cacheKeyFromUrl(url)) ?? null;
}

export function putCachedDocument(
	url: URL,
	html: string,
	finalUrl: string,
	ttlMs = DEFAULT_TTL_MS,
	now = Date.now(),
): void {
	const entry: PrefetchCacheEntry = { html, expiresAt: now + ttlMs, finalUrl };
	cache.set(cacheKeyFromUrl(url), entry);
	if (finalUrl && finalUrl !== url.href) {
		try {
			cache.set(cacheKeyFromUrl(new URL(finalUrl)), entry);
		} catch {
			// ignore invalid final URLs
		}
	}
}

async function fetchAndCache(url: URL, signal?: AbortSignal): Promise<PrefetchCacheEntry | null> {
	const key = cacheKeyFromUrl(url);
	const existing = getCachedDocument(url);
	if (existing) return existing;

	const pending = inflight.get(key);
	if (pending !== undefined) return pending;

	const request = (async () => {
		try {
			const response = await fetch(url.href, {
				headers: ROUTER_FETCH_HEADERS,
				redirect: "follow",
				signal,
			});
			if (!isHtmlResponse(response.headers.get("content-type"))) return null;
			if (headerDisablesClientNavigation(response.headers)) return null;
			const html = await response.text();
			if (htmlDisablesClientNavigation(html)) return null;
			const finalUrl = response.url || url.href;
			putCachedDocument(url, html, finalUrl);
			return getCachedDocument(url);
		} catch {
			return null;
		} finally {
			inflight.delete(key);
		}
	})();

	inflight.set(key, request);
	return request;
}

/** Programmatic prefetch of a same-origin HTML document. */
export async function prefetch(url: string | URL): Promise<void> {
	if (currentDocumentDisablesClientNavigation()) return;
	if (!connectionAllowsPrefetch()) return;
	const dest = typeof url === "string" ? new URL(url, location.href) : url;
	if (dest.origin !== location.origin) return;
	await fetchAndCache(dest);
}

function shouldPrefetchAnchor(anchor: HTMLAnchorElement): boolean {
	if (anchor.dataset.routerPrefetch === "false") return false;
	if (anchor.dataset.routerReload != null) return false;
	return true;
}

function anchorFromEvent(event: Event): HTMLAnchorElement | null {
	const target = event.target;
	if (!(target instanceof Element)) return null;
	const anchor = target.closest("a");
	return anchor instanceof HTMLAnchorElement ? anchor : null;
}

export function installPrefetchListeners(
	eligibleUrl: (anchor: HTMLAnchorElement) => URL | null,
): () => void {
	let hoverTimer: ReturnType<typeof setTimeout> | undefined;
	let hoverAbort: AbortController | null = null;

	function schedule(anchor: HTMLAnchorElement): void {
		if (currentDocumentDisablesClientNavigation()) return;
		if (!connectionAllowsPrefetch()) return;
		if (!shouldPrefetchAnchor(anchor)) return;
		const dest = eligibleUrl(anchor);
		if (!dest) return;

		hoverAbort?.abort();
		if (hoverTimer !== undefined) clearTimeout(hoverTimer);
		hoverAbort = new AbortController();
		const signal = hoverAbort.signal;
		hoverTimer = setTimeout(() => {
			fetchAndCache(dest, signal);
		}, HOVER_DELAY_MS);
	}

	function cancel(): void {
		if (hoverTimer !== undefined) clearTimeout(hoverTimer);
		hoverTimer = undefined;
		hoverAbort?.abort();
		hoverAbort = null;
	}

	function onEnter(event: Event): void {
		const anchor = anchorFromEvent(event);
		if (anchor) schedule(anchor);
	}

	function onLeave(event: PointerEvent): void {
		const anchor = anchorFromEvent(event);
		if (!anchor) return;
		const related = event.relatedTarget;
		if (related instanceof Node && anchor.contains(related)) return;
		cancel();
	}

	document.addEventListener("pointerenter", onEnter, true);
	document.addEventListener("focusin", onEnter, true);
	document.addEventListener("pointerleave", onLeave, true);

	return () => {
		cancel();
		document.removeEventListener("pointerenter", onEnter, true);
		document.removeEventListener("focusin", onEnter, true);
		document.removeEventListener("pointerleave", onLeave, true);
	};
}
