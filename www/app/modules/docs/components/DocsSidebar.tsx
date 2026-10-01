import { getSidebarState, SIDEBAR } from "@shared/utils/sidebar.ts";
import { useEffect, useState } from "preact/hooks";
import styles from "./DocsSidebar.module.css";

interface DocsSidebarProps {
	currentPath: string;
}

function pathFromRouterUrl(url: string): string {
	const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
	return path.split("#")[0] || "/";
}

export default function DocsSidebar({ currentPath }: Readonly<DocsSidebarProps>) {
	const [path, setPath] = useState(currentPath);
	const { activeHref, expandedCategory } = getSidebarState(path);
	const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
		Object.fromEntries(SIDEBAR.map((c) => [c.label, c.label === expandedCategory])),
	);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		function applyTo(url: string | undefined) {
			if (url) setPath(pathFromRouterUrl(url));
		}
		function onBeforeNavigate(event: Event) {
			applyTo((event as CustomEvent<{ to?: string }>).detail?.to);
		}
		function onBeforeSwap(event: Event) {
			applyTo((event as CustomEvent<{ to?: string }>).detail?.to);
			setIsOpen(false);
		}
		document.addEventListener("avalon:before-navigate", onBeforeNavigate);
		document.addEventListener("avalon:before-swap", onBeforeSwap);
		return () => {
			document.removeEventListener("avalon:before-navigate", onBeforeNavigate);
			document.removeEventListener("avalon:before-swap", onBeforeSwap);
		};
	}, []);

	useEffect(() => {
		if (!expandedCategory) return;
		setOpenCategories((prev) =>
			prev[expandedCategory] ? prev : { ...prev, [expandedCategory]: true },
		);
	}, [expandedCategory]);

	function toggleCategory(label: string) {
		setOpenCategories((prev) => ({ ...prev, [label]: !prev[label] }));
	}

	return (
		<div class={styles.wrapper}>
			<button
				class={styles.mobileToggle}
				onClick={() => setIsOpen((o) => !o)}
				aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
				aria-expanded={isOpen}
			>
				<span class={styles.toggleIcon}>{isOpen ? "✕" : "☰"}</span>
				<span>Menu</span>
			</button>

			<nav
				class={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}
				aria-label="Documentation navigation"
			>
				{SIDEBAR.map((category) => {
					const isExpanded = openCategories[category.label] ?? false;
					return (
						<div key={category.label} class={styles.category}>
							<button
								class={styles.categoryBtn}
								onClick={() => toggleCategory(category.label)}
								aria-expanded={isExpanded}
							>
								<span class={styles.categoryLabel}>{category.label}</span>
								<span class={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}>›</span>
							</button>
							{isExpanded && (
								<ul class={styles.itemList}>
									{category.items.map((item) => (
										<li key={item.href}>
											<a
												href={item.href}
												class={`${styles.item} ${item.href === activeHref ? styles.itemActive : styles.itemIdle}`}
											>
												{item.title}
											</a>
										</li>
									))}
								</ul>
							)}
						</div>
					);
				})}
			</nav>
		</div>
	);
}
