/** @jsxImportSource preact */

import BrowserCounter from "../components/BrowserCounter.tsx";
import LitCounter from "../components/Counter.lit.ts";
import PreactCounter from "../components/Counter.preact.tsx";
import QwikCounter from "../components/Counter.qwik.tsx";
import ReactCounter from "../components/Counter.react.tsx";
import SolidCounter from "../components/Counter.solid.tsx";
import SvelteCounter from "../components/Counter.svelte";
import VueCounter from "../components/Counter.vue";
import DelayedCounter from "../components/DelayedCounter.tsx";
import styles from "./index.module.css";

export const metadata = {
	title: "Islands Demo — Avalon",
	description: "Demo page showing multi-framework islands with lazy loading",
};

export default async function DemoPage() {
	return (
		<div class={styles.page}>
			<header class={styles.header}>
				<h1 class={styles.title}>Multi-Framework Islands</h1>
				<p class={styles.desc}>
					Each island loads its JavaScript only when you interact with it. Watch the network panel
					to see the lazy loading in action. Most counters are SSR'd — the HTML is visible
					immediately. The amber card is <code class={styles.code}>clientOnly</code>: no server
					HTML, mounted in the browser.
				</p>
			</header>

			<div class={styles.grid}>
				<ReactCounter island={{ condition: "on:interaction" }} />
				<PreactCounter island={{ condition: "on:interaction" }} />
				<VueCounter island={{ condition: "on:interaction" }} />
				<SvelteCounter island={{ condition: "on:interaction" }} />
				<SolidCounter island={{ condition: "on:interaction" }} />
				<LitCounter island={{ condition: "on:interaction" }} />
				<QwikCounter />
				<DelayedCounter island={{ condition: "on:countdown", conditionArg: "5" }} />
				<div class={styles.clientOnlySlot}>
					<BrowserCounter island={{ clientOnly: true }} />
				</div>
			</div>

			<p class={styles.tip}>
				<strong>Tip:</strong> Click on any counter to load its JavaScript. The network panel shows
				the actual load time and file size.
			</p>
		</div>
	);
}
