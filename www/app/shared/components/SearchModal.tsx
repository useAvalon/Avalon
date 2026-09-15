/** @jsxImportSource preact */
import { useEffect, useRef } from "preact/hooks";

/**
 * Pagefind search modal — loads the Component UI on the client.
 * The modal opens when the trigger button is clicked (⌘K).
 * Gracefully handles missing Pagefind (dev mode without a build).
 */
export default function SearchModal() {
	const containerRef = useRef<HTMLDivElement>(null);
	const loaded = useRef(false);

	useEffect(() => {
		if (!loaded.current) {
			loaded.current = true;

			// Check if Pagefind assets exist before loading
			fetch("/pagefind/pagefind-component-ui.js", { method: "HEAD" })
				.then((res) => {
					if (!res.ok) return;

					const cssHref = "/pagefind/pagefind-component-ui.css";
					let link = document.querySelector<HTMLLinkElement>(
						`link[href*="pagefind-component-ui.css"]`,
					);
					if (!link) {
						link = document.createElement("link");
						link.rel = "stylesheet";
						link.href = cssHref;
						document.head.appendChild(link);
					}
					// Survive client-router head reconcile — this href is not in SSR HTML.
					link.dataset.routerPersist = "pagefind-ui";

					if (!document.querySelector('script[src*="pagefind-component-ui.js"]')) {
						const script = document.createElement("script");
						script.type = "module";
						script.src = "/pagefind/pagefind-component-ui.js";
						document.head.appendChild(script);
					}
				})
				.catch(() => {
					// Pagefind not available (dev mode) — silently skip
				});
		}

		// Always register keyboard handler (survives StrictMode remount)
		const handleKeydown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				const modal = containerRef.current?.querySelector<PagefindModalElement>("pagefind-modal");
				if (modal?.open) modal.open();
			}
		};
		document.addEventListener("keydown", handleKeydown);
		return () => document.removeEventListener("keydown", handleKeydown);
	}, []);

	return (
		<div ref={containerRef} style={{ display: "contents" }}>
			<pagefind-modal />
		</div>
	);
}
