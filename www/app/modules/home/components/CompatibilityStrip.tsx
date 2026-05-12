import styles from "./CompatibilityStrip.module.css";

/* ============================================================================
   CompatibilityStrip
   ----------------------------------------------------------------------------
   A quiet, single-row band of the seven supported framework marks.
   Static — no marquee, no hover dance. A label reads "COMPATIBLE WITH" at
   the left, then a row of logos with consistent sizing.

   Server-rendered, zero JS.
   ============================================================================ */

const FRAMEWORKS = [
	{ name: "React", icon: "react" },
	{ name: "Preact", icon: "preact" },
	{ name: "Vue", icon: "vue" },
	{ name: "Svelte", icon: "svelte" },
	{ name: "Solid", icon: "solid" },
	{ name: "Qwik", icon: "qwik" },
	{ name: "Lit", icon: "lit" },
];

export default function CompatibilityStrip() {
	return (
		<section class={styles.strip} aria-label="Supported frameworks">
			<div class={styles.stripInner}>
				<span class={styles.label}>Compatible with</span>
				<div class={styles.line} aria-hidden="true" />
				<ul class={styles.list}>
					{FRAMEWORKS.map((fw) => (
						<li key={fw.name} class={styles.item}>
							<img
								src={`/frameworks/${fw.icon}.svg`}
								alt={fw.name}
								width={22}
								height={22}
								loading="lazy"
							/>
							<span>{fw.name}</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
