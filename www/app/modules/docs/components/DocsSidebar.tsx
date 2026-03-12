/** @jsxImportSource preact */
import { useState } from 'preact/hooks';
import { SIDEBAR, getSidebarState } from '@shared/utils/sidebar.ts';
import styles from './DocsSidebar.module.css';

interface DocsSidebarProps {
	currentPath: string;
}

export default function DocsSidebar({ currentPath }: DocsSidebarProps) {
	const { activeHref, expandedCategory } = getSidebarState(currentPath);
	const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
		Object.fromEntries(SIDEBAR.map(c => [c.label, c.label === expandedCategory]))
	);
	const [isOpen, setIsOpen] = useState(false);

	function toggleCategory(label: string) {
		setOpenCategories(prev => ({ ...prev, [label]: !prev[label] }));
	}

	return (
		<div className={styles.wrapper}>
			<button
				className={styles.mobileToggle}
				onClick={() => setIsOpen(o => !o)}
				aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
				aria-expanded={isOpen}
			>
				<span className={styles.toggleIcon}>{isOpen ? '✕' : '☰'}</span>
				<span>Menu</span>
			</button>

			<nav
				className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}
				aria-label="Documentation navigation"
			>
				{SIDEBAR.map(category => {
					const isExpanded = openCategories[category.label] ?? false;
					return (
						<div key={category.label} className={styles.category}>
							<button
								className={styles.categoryBtn}
								onClick={() => toggleCategory(category.label)}
								aria-expanded={isExpanded}
							>
								<span className={styles.categoryLabel}>{category.label}</span>
								<span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>›</span>
							</button>
							{isExpanded && (
								<ul className={styles.itemList}>
									{category.items.map(item => (
										<li key={item.href}>
											<a
												href={item.href}
												className={`${styles.item} ${item.href === activeHref ? styles.itemActive : ''}`}
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
