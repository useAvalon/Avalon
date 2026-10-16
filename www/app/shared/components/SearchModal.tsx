import { useEffect, useRef } from "preact/hooks";
import { pagefindAssetUrl } from "../../../pagefind-assets.ts";

let pagefindAssetsPromise: Promise<void> | null = null;
let openGeneration = 0;
let documentHandlersInstalled = false;

function clearPendingSearch(): void {
	delete document.documentElement.dataset.avalonOpenSearchPending;
	try {
		sessionStorage.removeItem("avalon-open-search-pending");
	} catch {
		/* private mode */
	}
}

function hasPendingSearch(): boolean {
	if (document.documentElement.dataset.avalonOpenSearchPending === "1") return true;
	try {
		return sessionStorage.getItem("avalon-open-search-pending") === "1";
	} catch {
		return false;
	}
}

function openSearch(): void {
	clearPendingSearch();
	const generation = ++openGeneration;
	void loadPagefindAssets()
		.then(() => {
			if (generation !== openGeneration) return;
			const modal = findPagefindModal();
			if (!modal) return;
			closePagefindModal(modal);
			modal.open();
		})
		.catch(() => {});
}

function closeModal(): void {
	const modal = findPagefindModal();
	if (modal) closePagefindModal(modal);
}

function closeBeforeNavigation(): void {
	openGeneration += 1;
	closeModal();
}

function handleResultClick(e: MouseEvent): void {
	const target = e.target;
	if (!(target instanceof Element)) return;
	const anchor = target.closest("a[href]");
	if (!anchor?.closest("pagefind-modal")) return;
	closeModal();
}

/**
 * Router persist detaches this island during a body swap; Preact unmount runs
 * effect cleanup even though the island is restored and stays hydrated. Keep
 * document listeners at module scope so ⌘K still works after client navigation.
 */
function installDocumentHandlers(): void {
	if (documentHandlersInstalled) return;
	documentHandlersInstalled = true;

	document.addEventListener("avalon:open-search", openSearch);
	document.addEventListener("avalon:before-navigate", closeBeforeNavigation);
	document.addEventListener("avalon:before-swap", closeBeforeNavigation);
	document.addEventListener("click", handleResultClick, true);
	window.addEventListener("hashchange", closeModal);
}

function isPagefindUnavailableStatus(status: number): boolean {
	// Built output missing (local dev) — not a transient failure.
	return status === 404 || status === 405;
}

function loadPagefindModuleScript(src: string): Promise<void> {
	const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
	if (existing?.dataset.pagefindLoaded === "true") {
		return Promise.resolve();
	}

	return new Promise((resolve, reject) => {
		const script = existing ?? document.createElement("script");
		if (!existing) {
			script.type = "module";
			script.src = src;
			document.head.appendChild(script);
		}

		script.addEventListener(
			"load",
			() => {
				script.dataset.pagefindLoaded = "true";
				resolve();
			},
			{ once: true },
		);
		script.addEventListener("error", () => reject(new Error("Pagefind UI script failed to load")), {
			once: true,
		});
	});
}

/** Loads Pagefind Component UI assets once; rejects on retryable failures so later opens can retry. */
function loadPagefindAssets(): Promise<void> {
	if (pagefindAssetsPromise) return pagefindAssetsPromise;

	pagefindAssetsPromise = (async () => {
		const uiJs = pagefindAssetUrl("/pagefind/pagefind-component-ui.js");
		const head = await fetch(uiJs, { method: "HEAD" });
		if (!head.ok) {
			if (isPagefindUnavailableStatus(head.status)) return;
			throw new Error(`Pagefind HEAD failed: ${head.status}`);
		}

		const cssHref = pagefindAssetUrl("/pagefind/pagefind-component-ui.css");
		let link = document.querySelector<HTMLLinkElement>(`link[href*="pagefind-component-ui.css"]`);
		if (!link) {
			link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = cssHref;
			document.head.appendChild(link);
		}
		link.dataset.routerPersist = "pagefind-ui";

		await loadPagefindModuleScript(uiJs);
		await customElements.whenDefined("pagefind-modal");
	})().catch((error) => {
		pagefindAssetsPromise = null;
		throw error;
	});

	return pagefindAssetsPromise;
}

/** Live modal element (may move when the search island is router-persisted). */
function findPagefindModal(): PagefindModalElement | null {
	return document.querySelector("pagefind-modal");
}

/** Closes Pagefind and any open shadow `<dialog>` so backdrops do not linger. */
function closePagefindModal(modal: PagefindModalElement): void {
	try {
		modal.close();
	} catch {
		/* custom element may be mid-upgrade */
	}
	const dialog = modal.shadowRoot?.querySelector("dialog") ?? modal.querySelector("dialog");
	if (dialog instanceof HTMLDialogElement && dialog.open) {
		dialog.close();
	}
}

/**
 * Pagefind search modal — loads the Component UI on first open (⌘K or search button).
 * Gracefully handles missing Pagefind (dev mode without a build).
 */
export default function SearchModal() {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		installDocumentHandlers();
		if (hasPendingSearch()) openSearch();
	}, []);

	return (
		<div ref={containerRef} style={{ display: "contents" }}>
			<pagefind-modal />
		</div>
	);
}
