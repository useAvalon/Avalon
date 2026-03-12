/** @jsxImportSource preact */
import { useState } from 'preact/hooks';
import styles from './MobileNav.module.css';

interface MobileNavProps {
	currentPath?: string;
}

export default function MobileNav({ currentPath }: MobileNavProps) {
	const [isOpen, setIsOpen] = useState(false);

	function isActive(href: string) {
		if (!currentPath) return false;
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	return (
		<div className={styles.wrapper}>
			<button
				className={styles.hamburger}
				onClick={() => setIsOpen(o => !o)}
				aria-label={isOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={isOpen}
			>
				<span className={`${styles.bar} ${isOpen ? styles.barOpen1 : ''}`} />
				<span className={`${styles.bar} ${isOpen ? styles.barOpen2 : ''}`} />
				<span className={`${styles.bar} ${isOpen ? styles.barOpen3 : ''}`} />
			</button>

			{isOpen && (
				<nav className={styles.mobileMenu} aria-label="Mobile navigation">
					<a
						href="/docs/introduction"
						className={`${styles.mobileLink} ${isActive('/docs') ? styles.mobileLinkActive : ''}`}
						onClick={() => setIsOpen(false)}
					>
						Docs
					</a>
					<a
						href="/blog"
						className={`${styles.mobileLink} ${isActive('/blog') ? styles.mobileLinkActive : ''}`}
						onClick={() => setIsOpen(false)}
					>
						Blog
					</a>
					<a
						href="https://github.com/useAvalon/Avalon"
						className={styles.mobileLink}
						target="_blank"
						rel="noopener noreferrer"
					>
						GitHub
					</a>
					<a href="/docs/introduction" className={styles.mobileCta} onClick={() => setIsOpen(false)}>
						Get Started
					</a>
				</nav>
			)}
		</div>
	);
}
