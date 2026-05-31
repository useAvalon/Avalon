/** @jsxImportSource preact */

import { getSidebarState, SIDEBAR } from "@shared/utils/sidebar.ts";
import { useState } from "preact/hooks";
import styles from "./DocsSidebar.module.css";

interface DocsSidebarProps {
	currentPath: string;
}

export default function DocsSidebar({ currentPath }: DocsSidebarProps) {
	const { activeHref, expandedCategory } = getSidebarState(currentPath);
	const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
		Object.fromEntries(SIDEBAR.map((c) => [c.label, c.label === expandedCategory])),
	);
	const [isOpen, setIsOpen] = useState(false);

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
												class={`${styles.item} ${item.href === activeHref ? styles.itemActive : ""}`}
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
