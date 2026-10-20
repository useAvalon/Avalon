const ANNOUNCER_ID = "avalon-router-announce";

export function ensureRouteAnnouncer(doc: Document = document): HTMLElement {
	let el = doc.getElementById(ANNOUNCER_ID);
	if (el) return el;

	el = doc.createElement("p");
	el.id = ANNOUNCER_ID;
	el.setAttribute("aria-live", "polite");
	el.setAttribute("aria-atomic", "true");
	el.style.cssText =
		"position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
	doc.body.appendChild(el);
	return el;
}

export function announceRoute(title: string, doc: Document = document): void {
	const el = ensureRouteAnnouncer(doc);
	el.textContent = "";
	el.textContent = title;
}

export function restoreFocus(doc: Document = document): void {
	const autofocus = doc.querySelector<HTMLElement>("[autofocus]");
	if (autofocus) {
		autofocus.focus();
		return;
	}
	const main = doc.querySelector<HTMLElement>("main");
	if (main) {
		if (!main.hasAttribute("tabindex")) main.tabIndex = -1;
		main.focus({ preventScroll: true });
		return;
	}
	doc.body.tabIndex = -1;
	doc.body.focus({ preventScroll: true });
}

export interface ScrollPosition {
	x: number;
	y: number;
}

export function readScroll(): ScrollPosition {
	return { x: window.scrollX, y: window.scrollY };
}

function scrollWindow(x: number, y: number): void {
	const root = document.documentElement;
	const previousBehavior = root.style.scrollBehavior;
	root.style.scrollBehavior = "auto";
	try {
		window.scrollTo({ left: x, top: y, behavior: "instant" });
	} catch {
		window.scrollTo(x, y);
	} finally {
		root.style.scrollBehavior = previousBehavior;
	}
}

const SCROLL_RESTORE_KEY = "avalon:scroll-restore";

export function scrollRestorePath(): string {
	return `${location.pathname}${location.search}`;
}

/** Persist scroll for full reloads while `history.scrollRestoration` is manual. */
export function saveScrollForReload(): void {
	try {
		sessionStorage.setItem(
			SCROLL_RESTORE_KEY,
			JSON.stringify({ path: scrollRestorePath(), ...readScroll() }),
		);
	} catch {
		// sessionStorage unavailable
	}
}

function isReloadNavigation(): boolean {
	try {
		const entry = performance.getEntriesByType("navigation")[0] as
			| PerformanceNavigationTiming
			| undefined;
		return entry?.type === "reload";
	} catch {
		return false;
	}
}

/** Restore scroll after reload when the URL matches the saved entry. */
export function restoreScrollAfterReload(): void {
	try {
		const raw = sessionStorage.getItem(SCROLL_RESTORE_KEY);
		if (!raw) return;
		sessionStorage.removeItem(SCROLL_RESTORE_KEY);
		if (!isReloadNavigation()) return;
		const saved = JSON.parse(raw) as ScrollPosition & { path: string };
		if (saved.path !== scrollRestorePath()) return;
		const run = () => applyScroll({ x: saved.x, y: saved.y });
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", run, { once: true });
			return;
		}
		requestAnimationFrame(run);
	} catch {
		// ignore corrupt storage
	}
}

export function applyScroll(position: ScrollPosition | "top", hash?: string): void {
	if (hash) {
		const id = decodeURIComponent(hash.slice(1));
		const target = document.getElementById(id);
		if (target) {
			target.scrollIntoView({ behavior: "instant", block: "start" });
			return;
		}
	}
	if (position === "top") {
		scrollWindow(0, 0);
		return;
	}
	scrollWindow(position.x, position.y);
}
