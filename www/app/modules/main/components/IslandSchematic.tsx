import { useEffect, useRef } from "preact/hooks";
import styles from "./IslandSchematic.module.css";

/* ============================================================================
   IslandSchematic
   ----------------------------------------------------------------------------
   A static, diagrammatic rendering of a web page showing three rectangular
   regions marked as islands. Static text lines fill the rest of the page
   to represent the HTML shell.

   No loops. On first mount, the three island regions fade + slide in one
   after another, and their dashed callouts draw in. The frame then holds.
   ============================================================================ */

const ISLANDS = [
	{ x: 18, y: 22, w: 38, h: 20, label: "Counter", condition: "on:client" },
	{ x: 60, y: 52, w: 22, h: 26, label: "Chart", condition: "on:visible" },
	{ x: 20, y: 68, w: 30, h: 14, label: "Search", condition: "on:interaction" },
];

export default function IslandSchematic() {
	const rootRef = useRef<SVGSVGElement | null>(null);

	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		const raf = requestAnimationFrame(() => {
			el.classList.add(styles.revealed);
		});
		return () => cancelAnimationFrame(raf);
	}, []);

	return (
		<figure class={styles.figure}>
			<svg
				ref={rootRef}
				class={styles.svg}
				viewBox="0 0 120 110"
				role="img"
				aria-label="Schematic of a web page with three island regions"
			>
				<title>Island schematic</title>

				{/* Page frame */}
				<rect x={2} y={2} width={96} height={104} rx={3} class={styles.pageFrame} />

				{/* Static content lines — represent HTML shell */}
				{LINES.map((line) => (
					<rect
						key={`ln-${line.x}-${line.y}`}
						x={line.x}
						y={line.y}
						width={line.w}
						height={1.5}
						rx={0.5}
						class={styles.staticLine}
					/>
				))}

				{/* Islands */}
				{ISLANDS.map((isl, i) => {
					const ix = isl.x;
					const iy = isl.y;
					const icx = ix + isl.w / 2;
					const icy = iy + isl.h / 2;

					// Callout line endpoint on the right margin
					const tx = 110;
					const ty = 12 + i * 36;

					return (
						<g
							key={isl.label}
							class={styles.islandGroup}
							style={{ transitionDelay: `${200 + i * 160}ms` }}
						>
							{/* Island block */}
							<rect x={ix} y={iy} width={isl.w} height={isl.h} rx={1.5} class={styles.island} />
							{/* Mini content */}
							<rect
								x={ix + 2}
								y={iy + 2}
								width={isl.w * 0.4}
								height={1.5}
								rx={0.5}
								class={styles.islandLineA}
							/>
							<rect
								x={ix + 2}
								y={iy + 5}
								width={isl.w * 0.7}
								height={1}
								rx={0.5}
								class={styles.islandLineB}
							/>
							<rect
								x={ix + 2}
								y={iy + 7.5}
								width={isl.w * 0.55}
								height={1}
								rx={0.5}
								class={styles.islandLineB}
							/>

							{/* Callout line (dashed) from island corner to label */}
							<path
								d={`M ${icx} ${icy} L ${tx - 2} ${icy} L ${tx - 2} ${ty + 2}`}
								class={styles.callout}
								fill="none"
							/>

							{/* Callout anchor dot */}
							<circle cx={icx} cy={icy} r={0.9} class={styles.calloutDot} />

							{/* Label */}
							<g class={styles.labelGroup} transform={`translate(${tx}, ${ty})`}>
								<text x={0} y={0} class={styles.labelName}>
									{isl.label}
								</text>
								<text x={0} y={4} class={styles.labelCond}>
									{isl.condition}
								</text>
							</g>
						</g>
					);
				})}
			</svg>
			<figcaption class={styles.caption}>
				Fig. 01 · Three islands on a static page. The rest is HTML.
			</figcaption>
		</figure>
	);
}

/* Static-content lines on the page frame — not islands */
const LINES = (() => {
	const out: { x: number; y: number; w: number }[] = [];
	// Header area
	out.push({ x: 6, y: 7, w: 30 });
	out.push({ x: 6, y: 11, w: 50 });

	// Paragraph between island 1 and island 2
	for (let i = 0; i < 4; i++) {
		out.push({ x: 6, y: 46 + i * 3, w: 60 - i * 2 });
	}

	// Between/around island 3
	out.push({ x: 56, y: 80, w: 36 });
	out.push({ x: 56, y: 84, w: 28 });
	out.push({ x: 56, y: 88, w: 32 });

	// Footer
	out.push({ x: 6, y: 99, w: 20 });

	return out;
})();
