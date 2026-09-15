/** @jsxImportSource preact */
import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./TableOfContents.module.css";

interface TocItem {
	id: string;
	text: string;
	level: number;
}

interface TocBranch {
	id: string;
	text: string;
	children: TocItem[];
}

function nestHeadings(items: TocItem[]): TocBranch[] {
	const branches: TocBranch[] = [];
	for (const item of items) {
		if (item.level === 2 || branches.length === 0) {
			branches.push({ id: item.id, text: item.text, children: [] });
			continue;
		}
		branches.at(-1)?.children.push(item);
	}
	return branches;
}

export default function TableOfContents() {
	const [items, setItems] = useState<TocItem[]>([]);
	const [activeId, setActiveId] = useState<string>("");
	const [thumb, setThumb] = useState({ top: 0, height: 0 });
	const clickLockRef = useRef<number | null>(null);
	const trackRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const prose = document.querySelector("[data-toc-content]");
		if (!prose) return;

		const headings = prose.querySelectorAll("h2, h3");
		const tocItems: TocItem[] = [];

		headings.forEach((el) => {
			const heading = el as HTMLElement;
			if (!heading.id) {
				heading.id =
					heading.textContent
						?.toLowerCase()
						.replaceAll(/[^a-z0-9]+/g, "-")
						.replaceAll(/(^-|-$)/g, "") ?? "";
			}
			if (heading.id) {
				tocItems.push({
					id: heading.id,
					text: heading.textContent ?? "",
					level: heading.tagName === "H3" ? 3 : 2,
				});
			}
		});

		setItems(tocItems);
		if (tocItems.length > 0) setActiveId(tocItems[0].id);

		function onScroll() {
			if (tocItems.length === 0) return;
			if (clickLockRef.current) return;

			const atBottom =
				window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40;
			if (atBottom) {
				const last = tocItems.at(-1);
				if (last) setActiveId(last.id);
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

		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();

		return () => {
			window.removeEventListener("scroll", onScroll);
			if (clickLockRef.current) clearTimeout(clickLockRef.current);
		};
	}, []);

	useEffect(() => {
		const track = trackRef.current;
		if (!track || !activeId || items.length === 0) return;
		const active = track.querySelector("[data-toc-active]");
		if (!(active instanceof HTMLElement)) return;
		const trackBox = track.getBoundingClientRect();
		const itemBox = active.getBoundingClientRect();
		setThumb({
			top: itemBox.top - trackBox.top + track.scrollTop,
			height: itemBox.height,
		});
	}, [activeId, items]);

	function handleClick(e: Event, id: string) {
		e.preventDefault();
		if (clickLockRef.current) clearTimeout(clickLockRef.current);
		setActiveId(id);
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
		clickLockRef.current = window.setTimeout(() => {
			clickLockRef.current = null;
		}, 800);
	}

	if (items.length === 0) return null;

	const branches = nestHeadings(items);

	return (
		<nav class={styles.toc} aria-label="Table of contents">
			<p class={styles.tocLabel}>On this page</p>
			<div class={styles.tocTrack} ref={trackRef}>
				<span
					class={styles.tocThumb}
					style={{
						transform: `translateY(${thumb.top}px)`,
						height: `${thumb.height}px`,
					}}
					aria-hidden="true"
				/>
				<ul class={styles.tocList}>
					{branches.map((branch) => {
						const childActive = branch.children.some((child) => child.id === activeId);
						const open = branch.id === activeId || childActive;
						return (
							<li key={branch.id}>
								<a
									href={`#${branch.id}`}
									class={`${styles.tocLink} ${branch.id === activeId ? styles.tocLinkActive : ""} ${open ? styles.tocLinkOpen : ""}`}
									data-toc-active={branch.id === activeId ? "" : undefined}
									onClick={(e) => handleClick(e, branch.id)}
								>
									{branch.text}
								</a>
								{branch.children.length > 0 && (
									<ul class={styles.tocKids}>
										{branch.children.map((child) => (
											<li key={child.id}>
												<a
													href={`#${child.id}`}
													class={`${styles.tocLink} ${styles.tocLinkNested} ${child.id === activeId ? styles.tocLinkActive : ""}`}
													data-toc-active={child.id === activeId ? "" : undefined}
													onClick={(e) => handleClick(e, child.id)}
												>
													{child.text}
												</a>
											</li>
										))}
									</ul>
								)}
							</li>
						);
					})}
				</ul>
			</div>
		</nav>
	);
}
