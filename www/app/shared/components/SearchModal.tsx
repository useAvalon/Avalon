import { useEffect, useRef } from "preact/hooks";
import { pagefindAssetUrl } from "../../../pagefind-assets.ts";

let pagefindAssetsPromise: Promise<void> | null = null;

function loadPagefindAssets(): Promise<void> {
	if (pagefindAssetsPromise) return pagefindAssetsPromise;

	pagefindAssetsPromise = (async () => {
		const uiJs = pagefindAssetUrl("/pagefind/pagefind-component-ui.js");
		const head = await fetch(uiJs, { method: "HEAD" });
		if (!head.ok) return;

		const cssHref = pagefindAssetUrl("/pagefind/pagefind-component-ui.css");
		let link = document.querySelector<HTMLLinkElement>(`link[href*="pagefind-component-ui.css"]`);
		if (!link) {
			link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = cssHref;
			document.head.appendChild(link);
		}
		link.dataset.routerPersist = "pagefind-ui";

		if (!document.querySelector('script[src*="pagefind-component-ui.js"]')) {
			const script = document.createElement("script");
			script.type = "module";
			script.src = uiJs;
			document.head.appendChild(script);
		}
	})().catch(() => {
		pagefindAssetsPromise = null;
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
		const openSearch = () => {
			void loadPagefindAssets().then(() => {
				const modal = containerRef.current?.querySelector<PagefindModalElement>("pagefind-modal");
				modal?.open?.();
			});
		};

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
