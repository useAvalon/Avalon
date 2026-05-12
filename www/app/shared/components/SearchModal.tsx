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

					// Load Pagefind Component UI CSS
					const link = document.createElement("link");
					link.rel = "stylesheet";
					link.href = "/pagefind/pagefind-component-ui.css";
					document.head.appendChild(link);

					// Load Pagefind Component UI JS
					const script = document.createElement("script");
					script.type = "module";
					script.src = "/pagefind/pagefind-component-ui.js";
					document.head.appendChild(script);
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
