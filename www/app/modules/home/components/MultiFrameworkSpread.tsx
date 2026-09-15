import { useState } from "preact/hooks";
import styles from "./MultiFrameworkSpread.module.css";

/* ============================================================================
   MultiFrameworkSpread
   ----------------------------------------------------------------------------
   Two paired static lists side by side:

     · Left — a filesystem view showing four islands with mixed extensions
       (.tsx, .vue, .svelte, .solid.tsx).
     · Right — the compiled bundle list: one line per island with its
       framework tag and a realistic gzipped runtime size.

   Hovering an item on either side highlights its pair on the other,
   making the "each island ships only its own runtime" point concrete.

   No animation beyond the hover crossfade. No loops.
   ============================================================================ */

interface Row {
	id: string;
	file: string;
	ext: string;
	framework: string;
	color: string;
	bundle: string;
	size: string;
}

const ROWS: Row[] = [
	{
		id: "counter",
		file: "Counter",
		ext: ".tsx",
		framework: "react",
		color: "#61DAFB",
		bundle: "counter.a7f2.js",
		size: "~44 KB",
	},
	{
		id: "chart",
		file: "Chart",
		ext: ".vue",
		framework: "vue",
		color: "#41B883",
		bundle: "chart.38bc.js",
		size: "~34 KB",
	},
	{
		id: "feed",
		file: "Feed",
		ext: ".svelte",
		framework: "svelte",
		color: "#FF3E00",
		bundle: "feed.9d01.js",
		size: "~8 KB",
	},
	{
		id: "search",
		file: "Search",
		ext: ".solid.tsx",
		framework: "solid",
		color: "#4F88C6",
		bundle: "search.c5e4.js",
		size: "~7 KB",
	},
];

export default function MultiFrameworkSpread() {
	const [active, setActive] = useState<string | null>(null);

	return (
		<div class={styles.root}>
			{/* ── File tree (left) ── */}
			<div class={styles.panel}>
				<header class={styles.panelHead}>
					<span class={styles.panelLabel}>Source</span>
					<span class={styles.panelPath}>src/components/</span>
				</header>
				<ul class={styles.list}>
					{ROWS.map((row) => (
						<li
							key={row.id}
							class={`${styles.item} ${active === row.id ? styles.itemActive : ""}`}
							onMouseEnter={() => setActive(row.id)}
							onMouseLeave={() => setActive(null)}
							onFocus={() => setActive(row.id)}
							onBlur={() => setActive(null)}
						>
							<span class={styles.itemDot} style={{ background: row.color }} />
							<span class={styles.itemFile}>
								<span>{row.file}</span>
								<span class={styles.itemExt}>{row.ext}</span>
							</span>
							<span class={styles.itemTag}>{row.framework}</span>
						</li>
					))}
				</ul>
			</div>

			{/* ── Bundles (right) ── */}
			<div class={styles.panel}>
				<header class={styles.panelHead}>
					<span class={styles.panelLabel}>Compiled</span>
					<span class={styles.panelPath}>dist/islands/</span>
				</header>
				<ul class={styles.list}>
					{ROWS.map((row) => (
						<li
							key={row.id}
							class={`${styles.item} ${active === row.id ? styles.itemActive : ""}`}
							onMouseEnter={() => setActive(row.id)}
							onMouseLeave={() => setActive(null)}
							onFocus={() => setActive(row.id)}
							onBlur={() => setActive(null)}
						>
							<span class={styles.itemDot} style={{ background: row.color }} />
							<span class={styles.itemFile}>
								<span>{row.bundle}</span>
							</span>
							<span class={styles.itemSize}>{row.size}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
