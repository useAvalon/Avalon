import styles from './PatternHero.module.css';

export default function PatternHero() {
	return (
		<section className={styles.hero}>
			<div className={styles.fade} />
			<div className={styles.content}>
				<p className={styles.label}>The JavaScript Meta-Framework</p>
				<h1 className={styles.title}>Avalon</h1>
				<p className={styles.subtitle}>
					Ship interactive islands with any framework. Zero JS by default.
				</p>
				<p className={styles.subtitle}>
					Blazing fast SSR with Bun + Nitro.
				</p>
				<div className={styles.actions}>
					<a href="/docs/introduction" className={styles.primaryBtn}>Get Started</a>
					<a href="/docs/installation" className={styles.cliBtn}>npx create-avalon</a>
				</div>
			</div>
		</section>
	);
}
