/** @jsxImportSource preact */
import { useEffect, useRef, useState } from 'preact/hooks';
import styles from './TableOfContents.module.css';

interface TocItem {
	id: string;
	text: string;
	level: number;
}

export default function TableOfContents() {
	const [items, setItems] = useState<TocItem[]>([]);
	const [activeId, setActiveId] = useState<string>('');
	const clickLockRef = useRef<number | null>(null);

	useEffect(() => {
		const prose = document.querySelector('[data-toc-content]');
		if (!prose) return;

		const headings = prose.querySelectorAll('h2, h3');
		const tocItems: TocItem[] = [];

		headings.forEach((el) => {
			const heading = el as HTMLElement;
			if (!heading.id) {
				heading.id = heading.textContent
					?.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/(^-|-$)/g, '') ?? '';
			}
			if (heading.id) {
				tocItems.push({
					id: heading.id,
					text: heading.textContent ?? '',
					level: heading.tagName === 'H3' ? 3 : 2,
				});
			}
		});

		setItems(tocItems);
		if (tocItems.length > 0) setActiveId(tocItems[0].id);

		function onScroll() {
			if (tocItems.length === 0) return;
			if (clickLockRef.current) return;

			const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40;
			if (atBottom) {
				setActiveId(tocItems[tocItems.length - 1].id);
				return;
			}

			let current = tocItems[0].id;
			for (const item of tocItems) {
				const el = document.getElementById(item.id);
				if (el) {
					const top = el.getBoundingClientRect().top;
					if (top <= 120) {
						current = item.id;
					} else {
						break;
					}
				}
			}
			setActiveId(current);
		}

		window.addEventListener('scroll', onScroll, { passive: true });
		onScroll();

		return () => {
			window.removeEventListener('scroll', onScroll);
			if (clickLockRef.current) clearTimeout(clickLockRef.current);
		};
	}, []);

	function handleClick(e: Event, id: string) {
		e.preventDefault();
		if (clickLockRef.current) clearTimeout(clickLockRef.current);
		setActiveId(id);
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
		clickLockRef.current = window.setTimeout(() => {
			clickLockRef.current = null;
		}, 800);
	}

	if (items.length === 0) return null;

	return (
		<nav className={styles.toc} aria-label="Table of contents">
			<p className={styles.tocLabel}>On this page</p>
			<ul className={styles.tocList}>
				{items.map((item) => (
					<li key={item.id}>
						<a
							href={`#${item.id}`}
							className={`${styles.tocLink} ${item.level === 3 ? styles.tocLinkNested : ''} ${item.id === activeId ? styles.tocLinkActive : ''}`}
							onClick={(e) => handleClick(e, item.id)}
						>
							{item.text}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
