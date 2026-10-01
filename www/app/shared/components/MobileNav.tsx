import { useState } from "preact/hooks";
import styles from "./MobileNav.module.css";

interface MobileNavProps {
	currentPath?: string;
}

export default function MobileNav({ currentPath }: Readonly<MobileNavProps>) {
	const [isOpen, setIsOpen] = useState(false);

	function isActive(href: string) {
		if (!currentPath) return false;
		return currentPath === href || currentPath.startsWith(`${href}/`);
	}

	return (
		<div class={styles.wrapper}>
			<button
				type="button"
				class={styles.hamburger}
				onClick={() => setIsOpen((o) => !o)}
				aria-label={isOpen ? "Close menu" : "Open menu"}
				aria-expanded={isOpen}
			>
				<span class={`${styles.bar} ${isOpen ? styles.barOpen1 : ""}`} />
				<span class={`${styles.bar} ${isOpen ? styles.barOpen2 : ""}`} />
				<span class={`${styles.bar} ${isOpen ? styles.barOpen3 : ""}`} />
			</button>

			{isOpen && (
				<nav class={styles.mobileMenu} aria-label="Mobile navigation">
					<a
						href="/docs/introduction"
						class={`${styles.mobileLink} ${isActive("/docs") ? styles.mobileLinkActive : ""}`}
						onClick={() => setIsOpen(false)}
					>
						Docs
					</a>
					<a
						href="/blog"
						class={`${styles.mobileLink} ${isActive("/blog") ? styles.mobileLinkActive : ""}`}
						onClick={() => setIsOpen(false)}
					>
						Blog
					</a>
					<a
						href="https://github.com/useAvalon/Avalon"
						class={styles.mobileLink}
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
					<a href="/docs/introduction" class={styles.mobileCta} onClick={() => setIsOpen(false)}>
						Get Started
					</a>
				</nav>
			)}
		</div>
	);
}
