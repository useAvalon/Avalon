import styles from "./CompatibilityStrip.module.css";

const FRAMEWORKS = [
	{
		name: "Preact",
		file: "Counter.tsx",
		href: "/docs/frameworks/preact",
		icon: "/frameworks/preact.svg",
	},
	{
		name: "React",
		file: "Counter.react.tsx",
		href: "/docs/frameworks/react",
		icon: "/frameworks/react.svg",
	},
	{ name: "Vue", file: "Counter.vue", href: "/docs/frameworks/vue", icon: "/frameworks/vue.svg" },
	{
		name: "Svelte",
		file: "Counter.svelte",
		href: "/docs/frameworks/svelte",
		icon: "/frameworks/svelte.svg",
	},
	{
		name: "Solid",
		file: "Counter.solid.tsx",
		href: "/docs/frameworks/solid",
		icon: "/frameworks/solid.svg",
	},
	{
		name: "Qwik",
		file: "Counter.qwik.tsx",
		href: "/docs/frameworks/qwik",
		icon: "/frameworks/qwik.svg",
	},
	{
		name: "Lit",
		file: "Counter.lit.ts",
		href: "/docs/frameworks/lit",
		icon: "/frameworks/lit.svg",
	},
];

export default function CompatibilityStrip() {
	return (
		<section class={styles.section} aria-labelledby="stack-heading">
			<div class={styles.inner}>
				<h2 id="stack-heading" class={styles.title}>
					Use any supported framework, <span class={styles.titleMark}>side by side.</span>
				</h2>
				<p class={styles.lead}>React, Vue, Svelte, Solid, Preact, Qwik, and Lit on one route.</p>

				<div class={styles.panel}>
					<p class={styles.panelLabel}>Islands</p>
					<ul class={styles.chips}>
						{FRAMEWORKS.map((fw) => (
							<li key={fw.name}>
								<a href={fw.href} class={styles.chip} title={fw.file}>
									<img src={fw.icon} alt="" width={18} height={18} />
									<span>{fw.name}</span>
								</a>
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
