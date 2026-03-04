/** @jsxImportSource preact */

import Counter from '../islands/Counter.tsx';
import PreactCounter from '../islands/PreactCounter.tsx';
import PersistentCounterDemo from '../islands/PersistentCounterDemo.tsx';
import styles from './islands.module.css';

export default async function IslandsPage() {
	return (
		<div>
			<header className={styles.header}>
				<div className={styles.pill}>Selective Hydration</div>
				<h1 className={styles.title}>Islands Architecture</h1>
				<p className={styles.subtitle}>
					Interactive components hydrate independently. Click or hover on a counter to activate it.
				</p>
			</header>

			<div className={styles.demoGrid}>
				<div className={styles.demoCard}>
					<h2 className={styles.demoCardTitle}>⚡ on:client</h2>
					<p className={styles.demoCardDesc}>Hydrates immediately when the page loads.</p>
					<Counter island={{ condition: 'on:client' }} />
				</div>

				<div className={styles.demoCard}>
					<h2 className={styles.demoCardTitle}>🖱️ on:interaction</h2>
					<p className={styles.demoCardDesc}>Hydrates when you interact with the component.</p>
					<PreactCounter island={{ condition: 'on:interaction' }} />
				</div>

				<div className={styles.demoCard}>
					<h2 className={styles.demoCardTitle}>👁️ on:visible</h2>
					<p className={styles.demoCardDesc}>Hydrates when scrolled into the viewport.</p>
					<Counter island={{ condition: 'on:visible' }} />
				</div>

				<div className={styles.demoCard}>
					<h2 className={styles.demoCardTitle}>⏱️ on:idle</h2>
					<p className={styles.demoCardDesc}>Hydrates during browser idle time.</p>
					<PreactCounter island={{ condition: 'on:idle' }} />
				</div>
			</div>

			<div className={styles.demoCard} style={{ marginBottom: '48px' }}>
				<h2 className={styles.demoCardTitle}>💾 Persistence</h2>
				<p className={styles.demoCardDesc}>
					State survives page navigations via sessionStorage. Change the count, navigate away, and come back.
				</p>
				<PersistentCounterDemo island={{ condition: 'on:client' }} />
			</div>

			<div className={styles.infoBox}>
				<h3 className={styles.infoTitle}>Why Islands?</h3>
				<div className={styles.infoGrid}>
					<div className={styles.infoItem}>
						<strong>Minimal JavaScript</strong>
						<p>Only interactive parts load JS</p>
					</div>
					<div className={styles.infoItem}>
						<strong>Fast Initial Load</strong>
						<p>Static HTML renders instantly</p>
					</div>
					<div className={styles.infoItem}>
						<strong>Progressive Enhancement</strong>
						<p>Content works without JS</p>
					</div>
					<div className={styles.infoItem}>
						<strong>Framework Freedom</strong>
						<p>Mix React, Vue, Svelte in one page</p>
					</div>
				</div>
			</div>
		</div>
	);
}
