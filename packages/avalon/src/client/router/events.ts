import type { ViewTransitionMode } from "./transitions.ts";

export const ROUTER_EVENTS = {
	beforeNavigate: "avalon:before-navigate",
	beforeSwap: "avalon:before-swap",
	afterSwap: "avalon:after-swap",
	pageLoad: "avalon:page-load",
	navigationError: "avalon:navigation-error",
} as const;

export type RouterEventName = (typeof ROUTER_EVENTS)[keyof typeof ROUTER_EVENTS];

export type HistoryKind = "push" | "replace" | "auto";

export interface NavigateOptions {
	history?: HistoryKind;
	scroll?: boolean;
	/** `false` skips the animation. A string is a type name for CSS selectors. */
	viewTransition?: ViewTransitionMode;
}

export interface BeforeNavigateDetail {
	from: string;
	to: string;
	history: HistoryKind;
}

export interface SwapDetail {
	from: string;
	to: string;
}

function dispatch(name: RouterEventName, detail: unknown, cancelable = false): boolean {
	return document.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, cancelable }));
}

export function dispatchBeforeNavigate(detail: BeforeNavigateDetail): boolean {
	return dispatch(ROUTER_EVENTS.beforeNavigate, detail, true);
}

export function dispatchBeforeSwap(detail: SwapDetail & { newDocument: Document }): void {
	dispatch(ROUTER_EVENTS.beforeSwap, detail);
}

export function dispatchAfterSwap(detail: SwapDetail): void {
	dispatch(ROUTER_EVENTS.afterSwap, detail);
}

export function dispatchPageLoad(url: string): void {
	dispatch(ROUTER_EVENTS.pageLoad, { url });
}

export function dispatchNavigationError(url: string, error: unknown): void {
	dispatch(ROUTER_EVENTS.navigationError, { url, error });
}

export function setNavigating(active: boolean): void {
	if (active) {
		document.documentElement.dataset.routerNavigating = "true";
		return;
	}
	delete document.documentElement.dataset.routerNavigating;
}
