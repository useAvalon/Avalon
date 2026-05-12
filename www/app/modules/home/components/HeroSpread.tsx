import { useEffect, useRef } from "preact/hooks";
import styles from "./HeroSpread.module.css";

/* ============================================================================
   HeroSpread
   ----------------------------------------------------------------------------
   The hero visual. Not a canvas animation — a real piece of an Avalon page,
   presented like an editorial screenshot.

   A file header sits at the top. Below it, a code sample imports components
   from four different frameworks (React, Vue, Svelte, Solid). Each import
   line has a small label pinned to its right edge identifying the framework
   — lines that would appear in a real annotated design spread.

   The only motion is a one-shot fade-in on the four labels, staggered on
   mount. After the initial reveal the frame holds still.
   ============================================================================ */

interface Line {
	framework: "react" | "vue" | "svelte" | "solid";
	name: string;
	path: string;
	color: string;
}

const LINES: Line[] = [
	{ framework: "react", name: "Counter", path: "Counter.tsx", color: "#61DAFB" },
	{ framework: "vue", name: "Chart", path: "Chart.vue", color: "#41B883" },
	{ framework: "svelte", name: "Feed", path: "Feed.svelte", color: "#FF3E00" },
	{ framework: "solid", name: "Search", path: "Search.solid.tsx", color: "#4F88C6" },
];

export default function HeroSpread() {
	const rootRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		// Trigger the reveal on next frame so the initial paint is stable.
		const raf = requestAnimationFrame(() => {
			el.classList.add(styles.revealed);
		});
		return () => cancelAnimationFrame(raf);
	}, []);

	return (
		<figure
			ref={rootRef}
			class={styles.root}
			aria-label="Avalon page file importing four framework components"
		>
			<div class={styles.card}>
				<header class={styles.cardHead}>
					<span class={styles.cardDot} />
					<span class={styles.cardDot} />
					<span class={styles.cardDot} />
					<span class={styles.cardPath}>src/pages/dashboard.tsx</span>
				</header>

				<div class={styles.codeBody}>
					{LINES.map((line, i) => (
						<div
							key={line.framework}
							class={styles.codeLine}
							style={{ transitionDelay: `${240 + i * 90}ms` }}
						>
							<span class={styles.codeNum}>{String(i + 1).padStart(2, "0")}</span>
							<span class={styles.codeText}>
								<span class={styles.kw}>import</span> <span class={styles.cls}>{line.name}</span>{" "}
								<span class={styles.kw}>from</span>{" "}
								<span class={styles.str}>'../islands/{line.path}'</span>
								<span>;</span>
							</span>
							<span class={styles.pin} style={{ ["--pin-color" as string]: line.color }}>
								<span class={styles.pinDot} />
								<span class={styles.pinLabel}>{line.framework}</span>
							</span>
						</div>
					))}

					<div
						class={`${styles.codeLine} ${styles.blankLine}`}
						style={{ transitionDelay: "680ms" }}
					>
						<span class={styles.codeNum}>05</span>
						<span class={styles.codeText}>&nbsp;</span>
					</div>

					<div class={styles.codeLine} style={{ transitionDelay: "760ms" }}>
						<span class={styles.codeNum}>06</span>
						<span class={styles.codeText}>
							<span class={styles.cmt}>// Four frameworks, one page, one build.</span>
						</span>
					</div>
				</div>

				<footer class={styles.cardFoot}>
					<span>dashboard.tsx</span>
					<span class={styles.cardFootKbd}>·</span>
					<span>4 islands</span>
					<span class={styles.cardFootKbd}>·</span>
					<span>0 KB baseline</span>
				</footer>
			</div>
		</figure>
	);
}
