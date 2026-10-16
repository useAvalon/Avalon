import { useEffect, useRef } from "preact/hooks";
import { pagefindAssetUrl } from "../../../pagefind-assets.ts";

let pagefindAssetsPromise: Promise<void> | null = null;

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

/**
 * Pagefind search modal — loads the Component UI on first open (⌘K or search button).
 * Gracefully handles missing Pagefind (dev mode without a build).
 */
export default function SearchModal() {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const clearPendingSearch = () => {
			delete document.documentElement.dataset.avalonOpenSearchPending;
			try {
				sessionStorage.removeItem("avalon-open-search-pending");
			} catch {
				/* private mode */
			}
		};

		const hasPendingSearch = () => {
			if (document.documentElement.dataset.avalonOpenSearchPending === "1") return true;
			try {
				return sessionStorage.getItem("avalon-open-search-pending") === "1";
			} catch {
				return false;
			}
		};

		const openSearch = () => {
			clearPendingSearch();
			void loadPagefindAssets()
				.then(() => {
					const modal = containerRef.current?.querySelector<PagefindModalElement>("pagefind-modal");
					modal?.open?.();
				})
				.catch(() => {});
		};

		if (hasPendingSearch()) openSearch();

		const handleKeydown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				openSearch();
			}
		};
		document.addEventListener("keydown", handleKeydown);

		const handleOpenSearch = () => openSearch();
		document.addEventListener("avalon:open-search", handleOpenSearch);

		const modalElement = () =>
			containerRef.current?.querySelector<PagefindModalElement>("pagefind-modal");

		const closeModal = () => {
			const modal = modalElement();
			if (modal?.isOpen) modal.close();
		};

		const handleResultClick = (e: MouseEvent) => {
			const target = e.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest("a[href]");
			if (!anchor?.closest("pagefind-modal")) return;
			closeModal();
		};

		const handleHashChange = () => closeModal();

		document.addEventListener("click", handleResultClick, true);
		window.addEventListener("hashchange", handleHashChange);

		return () => {
			document.removeEventListener("keydown", handleKeydown);
			document.removeEventListener("avalon:open-search", handleOpenSearch);
			document.removeEventListener("click", handleResultClick, true);
			window.removeEventListener("hashchange", handleHashChange);
		};
	}, []);

	return (
		<div ref={containerRef} style={{ display: "contents" }}>
			<pagefind-modal />
		</div>
	);
}
