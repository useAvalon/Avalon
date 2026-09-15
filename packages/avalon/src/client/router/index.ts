/**
 * Optional client-side navigation over Avalon SSR.
 *
 * Fetches the next server-rendered HTML document, swaps it into the current
 * page, disposes old islands, restores persist slots, and hydrates the rest.
 * On failure, falls back to a full browser navigation.
 */

import { disposeIslands, scanAndHydrate } from "../hydrate-runtime.ts";
import { bootServerIslands } from "../server-islands-boot.ts";
import { announceRoute, applyScroll, readScroll, restoreFocus } from "./a11y.ts";
import {
	clickModifiersFromEvent,
	eligibleNavigationUrl,
	linkAttributesFromAnchor,
} from "./eligibility.ts";
import {
	dispatchAfterSwap,
	dispatchBeforeNavigate,
	dispatchBeforeSwap,
	dispatchNavigationError,
	dispatchPageLoad,
	type HistoryKind,
	type NavigateOptions,
	setNavigating,
} from "./events.ts";
import { applyGetSearchParams, eligibleFormNavigation, formSubmitFromEvent } from "./forms.ts";
import {
	ClientNavigationDisabledError,
	currentDocumentDisablesClientNavigation,
	documentDisablesClientNavigation,
	headerDisablesClientNavigation,
	htmlDisablesClientNavigation,
} from "./opt-out.ts";
import {
	clearViewTransitionGeometry,
	extractPersisted,
	leftoverPersisted,
	restorePersisted,
} from "./persist.ts";
import {
	getCachedOrInflight,
	installPrefetchListeners,
	putCachedDocument,
	ROUTER_FETCH_HEADERS,
} from "./prefetch.ts";
import {
	copyHtmlAttributes,
	isHtmlResponse,
	parseHtmlDocument,
	reconcileHead,
	replaceBody,
	replaceOutlets,
} from "./swap.ts";
import {
	skipInFlightViewTransition,
	type ViewTransitionMode,
	viewTransitionFromDataset,
	withViewTransition,
} from "./transitions.ts";

export { disposeIslands, scanAndHydrate } from "../hydrate-runtime.ts";
export { eligibleNavigationUrl, isModifiedClick } from "./eligibility.ts";
export type { HistoryKind, NavigateOptions } from "./events.ts";
export { ROUTER_EVENTS } from "./events.ts";
export { prefetch } from "./prefetch.ts";
export { reconcileHead, replaceBody, replaceOutlets } from "./swap.ts";
export type { ViewTransitionMode } from "./transitions.ts";

interface HistoryState {
	avalon?: true;
	scroll?: { x: number; y: number };
}

let installed = false;
let navigating = false;
let abort: AbortController | null = null;
let swapGeneration = 0;
let applyChain = Promise.resolve();

function currentUrl(): string {
	return location.pathname + location.search + location.hash;
}

function saveScrollToHistory(): void {
	const state: HistoryState = {
		...(history.state as HistoryState | null),
		avalon: true,
		scroll: readScroll(),
	};
	history.replaceState(state, "");
}

function fragmentOf(nodes: HTMLElement[]): DocumentFragment {
	const fragment = document.createDocumentFragment();
	for (const el of nodes) fragment.appendChild(el);
	return fragment;
}

async function disposeUnrestored(
	saved: Map<string, HTMLElement>,
	restored: Set<string>,
): Promise<void> {
	const leftover = leftoverPersisted(saved, restored);
	if (leftover.length === 0) return;
	const fragment = document.createDocumentFragment();
	for (const el of leftover) fragment.appendChild(el);
	await disposeIslands(fragment);
}

function commitHistory(historyKind: HistoryKind, to: string, isPop: boolean): void {
	if (isPop) return;
	const state: HistoryState = { avalon: true, scroll: { x: 0, y: 0 } };
	if (historyKind === "replace") {
		history.replaceState(state, "", to);
		return;
	}
	history.pushState(state, "", to);
}

function resolveHistoryKind(options: NavigateOptions, isPop: boolean): HistoryKind {
	return options.history ?? (isPop ? "auto" : "push");
}

function viewTransitionFromTrigger(
	primary: HTMLElement,
	secondary?: HTMLElement | null,
): ViewTransitionMode | undefined {
	return (
		viewTransitionFromDataset(secondary?.dataset.routerTransition) ??
		viewTransitionFromDataset(primary.dataset.routerTransition)
	);
}

async function applyDocument(
	next: Document,
	url: URL,
	historyKind: HistoryKind,
	isPop: boolean,
	viewTransition?: ViewTransitionMode,
): Promise<void> {
	const from = currentUrl();
	const to = url.pathname + url.search + url.hash;

	if (documentDisablesClientNavigation(next)) {
		throw new ClientNavigationDisabledError(to);
	}

	const generation = ++swapGeneration;
	skipInFlightViewTransition();

	let release!: () => void;
	const previous = applyChain;
	applyChain = new Promise<void>((resolve) => {
		release = resolve;
	});

	try {
		await previous;
		if (generation !== swapGeneration) return;
		await swapDocument(next, { from, to, historyKind, isPop, viewTransition, generation });
	} finally {
		release();
	}
}

async function swapDocument(
	next: Document,
	ctx: {
		from: string;
		to: string;
		historyKind: HistoryKind;
		isPop: boolean;
		viewTransition?: ViewTransitionMode;
		generation: number;
	},
): Promise<void> {
	const { from, to, historyKind, isPop, viewTransition, generation } = ctx;
	dispatchBeforeSwap({ from, to, newDocument: next });
	if (generation !== swapGeneration) return;

	let outgoing: ParentNode | HTMLElement[] | null = null;
	await withViewTransition(() => {
		if (generation !== swapGeneration) return;
		// Keep this callback synchronous. Awaiting unmounts here aborts the
		// View Transition before the browser can animate.
		reconcileHead(document, next);
		copyHtmlAttributes(document, next);
		const replaced = replaceOutlets(document, next);
		if (replaced) {
			outgoing = replaced;
		} else {
			outgoing = document.body;
			const persisted = extractPersisted(document.body);
			replaceBody(document, next);
			void disposeUnrestored(persisted, restorePersisted(document.body, persisted));
		}
		commitHistory(historyKind, to, isPop);
	}, viewTransition);
	if (generation !== swapGeneration) return;
	if (outgoing) {
		const root = Array.isArray(outgoing) ? fragmentOf(outgoing) : outgoing;
		await disposeIslands(root);
	}
	clearViewTransitionGeometry(document.body);

	dispatchAfterSwap({ from, to });
	scanAndHydrate(document.body);
	await bootServerIslands(document.body);
	announceRoute(document.title);
	restoreFocus();
	dispatchPageLoad(to);
}

async function fetchDocument(
	url: string,
	signal: AbortSignal,
): Promise<{ doc: Document; finalUrl: URL }> {
	const requested = new URL(url, location.href);
	const cachedOrInflight = getCachedOrInflight(requested);
	const cached = cachedOrInflight instanceof Promise ? await cachedOrInflight : cachedOrInflight;
	if (cached) {
		if (htmlDisablesClientNavigation(cached.html)) {
			throw new ClientNavigationDisabledError(cached.finalUrl);
		}
		return {
			doc: parseHtmlDocument(cached.html),
			finalUrl: new URL(cached.finalUrl, location.href),
		};
	}

	const response = await fetch(url, {
		cache: "no-store",
		headers: ROUTER_FETCH_HEADERS,
		redirect: "follow",
		signal,
	});
	const html = await requireHtmlBody(response);
	const finalUrl = new URL(response.url || url, location.href);
	putCachedDocument(requested, html, finalUrl.href);
	return { doc: parseHtmlDocument(html), finalUrl };
}

async function fetchPostDocument(
	url: URL,
	body: FormData,
	signal: AbortSignal,
): Promise<{ doc: Document; finalUrl: URL }> {
	const response = await fetch(url.href, {
		method: "POST",
		body,
		headers: ROUTER_FETCH_HEADERS,
		redirect: "follow",
		signal,
	});
	const html = await requireHtmlBody(response);
	const finalUrl = new URL(response.url || url.href, location.href);
	return { doc: parseHtmlDocument(html), finalUrl };
}

async function requireHtmlBody(response: Response): Promise<string> {
	if (headerDisablesClientNavigation(response.headers)) {
		throw new ClientNavigationDisabledError(response.url);
	}
	if (!isHtmlResponse(response.headers.get("content-type"))) {
		throw new Error(`Non-HTML response (${response.headers.get("content-type") ?? "unknown"})`);
	}
	const html = await response.text();
	if (htmlDisablesClientNavigation(html)) {
		throw new ClientNavigationDisabledError(response.url);
	}
	return html;
}

async function runNavigation(
	url: URL,
	options: NavigateOptions,
	isPop: boolean,
	loader?: (signal: AbortSignal) => Promise<{ doc: Document; finalUrl: URL }>,
): Promise<void> {
	if (navigating) {
		abort?.abort();
	}

	if (currentDocumentDisablesClientNavigation()) {
		throw new ClientNavigationDisabledError(url.href);
	}

	const historyKind = resolveHistoryKind(options, isPop);
	const from = currentUrl();
	const to = url.pathname + url.search + url.hash;

	if (!isPop && !dispatchBeforeNavigate({ from, to, history: historyKind })) {
		return;
	}

	if (!isPop) saveScrollToHistory();

	navigating = true;
	setNavigating(true);
	abort = new AbortController();
	const signal = abort.signal;

	try {
		const { doc, finalUrl } = await (loader ? loader(signal) : fetchDocument(url.href, signal));
		if (signal.aborted) return;
		await applyDocument(
			doc,
			finalUrl,
			historyKind === "auto" ? "push" : historyKind,
			isPop,
			options.viewTransition,
		);
		if (signal.aborted) return;
		applyNavigationScroll(url, isPop, options.scroll);
	} catch (error) {
		if (signal.aborted) return;
		if (!(error instanceof ClientNavigationDisabledError)) {
			dispatchNavigationError(to, error);
		}
		throw error;
	} finally {
		if (!signal.aborted) {
			navigating = false;
			setNavigating(false);
		}
	}
}

function applyNavigationScroll(url: URL, isPop: boolean, scroll?: boolean): void {
	if (isPop) {
		const state = history.state as HistoryState | null;
		applyScroll(state?.scroll ?? "top", url.hash);
		return;
	}
	if (scroll !== false) applyScroll("top", url.hash);
}

function fallback(url: string): void {
	location.assign(url);
}

/**
 * Programmatic client navigation. Falls back to a full page load on failure.
 */
export async function navigate(url: string | URL, options: NavigateOptions = {}): Promise<void> {
	const dest = typeof url === "string" ? new URL(url, location.href) : url;
	if (dest.origin !== location.origin) {
		fallback(dest.href);
		return;
	}
	try {
		await runNavigation(dest, options, false);
	} catch {
		fallback(dest.href);
	}
}

function onClick(event: MouseEvent): void {
	if (event.defaultPrevented) return;
	if (currentDocumentDisablesClientNavigation()) return;
	const target = event.target;
	if (!(target instanceof Element)) return;
	const anchor = target.closest("a");
	if (!(anchor instanceof HTMLAnchorElement)) return;
	if (anchor.closest("svg")) return;

	const dest = eligibleNavigationUrl(
		linkAttributesFromAnchor(anchor),
		clickModifiersFromEvent(event),
		location,
	);
	if (!dest) return;

	event.preventDefault();
	navigate(dest, { viewTransition: viewTransitionFromTrigger(anchor) }).catch(() =>
		fallback(dest.href),
	);
}

function onSubmit(event: SubmitEvent): void {
	if (event.defaultPrevented) return;
	if (currentDocumentDisablesClientNavigation()) return;
	const form = event.target;
	if (!(form instanceof HTMLFormElement)) return;

	const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
	const eligible = eligibleFormNavigation(formSubmitFromEvent(form, submitter), location);
	if (!eligible) return;

	event.preventDefault();
	const viewTransition = viewTransitionFromTrigger(form, submitter);

	if (eligible.method === "GET") {
		const dest = applyGetSearchParams(eligible.url, form, submitter);
		navigate(dest, { viewTransition }).catch(() => {
			form.submit();
		});
		return;
	}

	const body =
		submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
			? new FormData(form, submitter)
			: new FormData(form);
	runNavigation(eligible.url, { history: "push", viewTransition }, false, (signal) =>
		fetchPostDocument(eligible.url, body, signal),
	).catch(() => {
		form.submit();
	});
}

function onPopState(): void {
	const dest = new URL(location.href);
	runNavigation(dest, { history: "auto" }, true).catch(() => fallback(dest.href));
}

function prefetchEligibleUrl(anchor: HTMLAnchorElement): URL | null {
	return eligibleNavigationUrl(
		linkAttributesFromAnchor(anchor),
		{
			defaultPrevented: false,
			button: 0,
			metaKey: false,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
		},
		location,
	);
}

export function installClientRouter(): void {
	if (installed || typeof document === "undefined") return;
	installed = true;
	history.scrollRestoration = "manual";
	document.addEventListener("click", onClick);
	document.addEventListener("submit", onSubmit);
	window.addEventListener("popstate", onPopState);
	installPrefetchListeners(prefetchEligibleUrl);
}

installClientRouter();
