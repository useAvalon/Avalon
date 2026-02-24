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
			<h1 className={styles.title}>🎨 Multi-Framework Components</h1>

			<p className={styles.subtitle}>
				The same counter component implemented in different frameworks, all working together seamlessly.
			</p>

			<div className={styles.grid}>
				<div className={styles.card} style={{ '--card-accent': '#61dafb' } as any}>
					<h3 className={styles.cardTitle}>⚛️ React Counter</h3>
					<ReactCounter island={{ condition: 'on:interaction' }} initialCount={0} />
				</div>

				<div className={styles.card} style={{ '--card-accent': '#673ab7' } as any}>
					<h3 className={styles.cardTitle}>⚛️ Preact Counter</h3>
					<PreactCounter island={{ condition: 'on:interaction' }} />
				</div>

				<div className={styles.card} style={{ '--card-accent': '#ff6b6b' } as any}>
					<h3 className={styles.cardTitle}>🔥 Lit Counter</h3>
					<LitCounter island={{ condition: 'on:interaction' }} initialCount={0} />
				</div>

				<div className={styles.card} style={{ '--card-accent': '#4fc08d' } as any}>
					<h3 className={styles.cardTitle}>💚 Vue Counter</h3>
					<VueCounter island={{ condition: 'on:interaction' }} />
				</div>

				<div className={styles.card} style={{ '--card-accent': '#ff3e00' } as any}>
					<h3 className={styles.cardTitle}>🔥 Svelte Counter</h3>
					<SvelteCounter island={{ condition: 'on:interaction' }} />
				</div>

				<div className={styles.card} style={{ '--card-accent': '#2c4f7c' } as any}>
					<h3 className={styles.cardTitle}>💎 Solid Counter</h3>
					<SolidCounter island={{ condition: 'on:interaction' }} />
				</div>
			</div>

			<div className={styles.infoBox}>
				<h3 className={styles.infoTitle}>🔍 What's Happening Here?</h3>
				<ul className={styles.infoList}>
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
