/** @jsxImportSource preact */

import ReactCounter from '../islands/ReactCounter.tsx';
import PreactCounter from '../islands/PreactCounter.tsx';
import LitCounter from '../islands/Counter.lit.ts';
import VueCounter from '../islands/VueCounter.vue';
import SvelteCounter from '../islands/SvelteCounter.svelte';
import SolidCounter from '../islands/SolidCounter.solid.tsx';
import styles from './frameworks.module.css';

export default async function FrameworksPage() {
	return (
		<div>
			<h1 class={styles.title}>🎨 Multi-Framework Components</h1>

			<p class={styles.subtitle}>
				The same counter component implemented in different frameworks, all working together seamlessly.
			</p>

			<div class={styles.grid}>
				<div class={styles.card} style={{ '--card-accent': '#61dafb' } as any}>
					<h3 class={styles.cardTitle}>⚛️ React Counter</h3>
					<ReactCounter island={{ condition: 'on:interaction' }} initialCount={0} />
				</div>

				<div class={styles.card} style={{ '--card-accent': '#673ab7' } as any}>
					<h3 class={styles.cardTitle}>⚛️ Preact Counter</h3>
					<PreactCounter island={{ condition: 'on:interaction' }} />
				</div>

				<div class={styles.card} style={{ '--card-accent': '#ff6b6b' } as any}>
					<h3 class={styles.cardTitle}>🔥 Lit Counter</h3>
					<LitCounter island={{ condition: 'on:interaction' }} initialCount={0} />
				</div>

				<div class={styles.card} style={{ '--card-accent': '#4fc08d' } as any}>
					<h3 class={styles.cardTitle}>💚 Vue Counter</h3>
					<VueCounter island={{ condition: 'on:interaction' }} />
				</div>

				<div class={styles.card} style={{ '--card-accent': '#ff3e00' } as any}>
					<h3 class={styles.cardTitle}>🔥 Svelte Counter</h3>
					<SvelteCounter island={{ condition: 'on:interaction' }} />
				</div>

				<div class={styles.card} style={{ '--card-accent': '#2c4f7c' } as any}>
					<h3 class={styles.cardTitle}>💎 Solid Counter</h3>
					<SolidCounter island={{ condition: 'on:interaction' }} />
				</div>
			</div>

			<div class={styles.infoBox}>
				<h3 class={styles.infoTitle}>🔍 What's Happening Here?</h3>
				<ul class={styles.infoList}>
					<li>Each counter is a separate framework component</li>
					<li>They're hydrated independently using islands architecture</li>
					<li>The page itself is server-rendered with Preact</li>
					<li>Each island loads only when needed (lazy loading)</li>
					<li>Framework-specific bundles are automatically generated</li>
				</ul>
			</div>
		</div>
	);
}
