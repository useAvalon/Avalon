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
			<header className={styles.header}>
				<div className={styles.pill}>6 frameworks supported</div>
				<h1 className={styles.title}>Multi-Framework Components</h1>
				<p className={styles.subtitle}>
					The same counter component implemented in different frameworks, all working together seamlessly.
				</p>
			</header>

			<div className={styles.grid}>
				<ReactCounter island={{ condition: 'on:interaction' }} initialCount={0} />
				<PreactCounter island={{ condition: 'on:interaction' }} />
				<LitCounter island={{ condition: 'on:interaction' }} initialCount={0} />
				<VueCounter island={{ condition: 'on:interaction' }} />
				<SvelteCounter island={{ condition: 'on:interaction' }} />
				<SolidCounter island={{ condition: 'on:interaction' }} />
			</div>

			<div className={styles.infoBox}>
				<h3 className={styles.infoTitle}>How It Works</h3>
				<ul className={styles.infoList}>
					<li><strong>Islands Architecture:</strong> Each counter is an independent island that hydrates on interaction</li>
					<li><strong>Framework Isolation:</strong> Each framework runs in its own runtime, no conflicts</li>
					<li><strong>Selective Hydration:</strong> JavaScript only loads when you interact with a component</li>
					<li><strong>SSR First:</strong> All components render on the server for instant display</li>
				</ul>
			</div>
		</div>
	);
}
