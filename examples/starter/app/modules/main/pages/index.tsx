export const metadata = {
	title: "Avalon — Islands Architecture",
	description: "A multi-framework islands architecture project powered by Avalon.",
};

import styles from "./index.module.css";

export default async function HomePage() {
	return (
		<div className={styles.shell}>
			<div className={styles.content}>
				<p className={styles.eyebrow}>Islands Architecture</p>

				<h1 className={styles.title}>Avalon</h1>

				<p className={styles.lead}>
					Multi-framework islands. Zero JS by default. Ship interactive components with any
					framework you love.
				</p>

				<div className={styles.actions}>
					<a
						className={styles.btnPrimary}
						href="https://useavalon.dev/docs/introduction"
						target="_blank"
						rel="noopener noreferrer"
					>
						Documentation
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M7 17L17 7" />
							<path d="M7 7h10v10" />
						</svg>
					</a>
					<a
						className={styles.btnSecondary}
						href="https://github.com/useAvalon/Avalon"
						target="_blank"
						rel="noopener noreferrer"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
						</svg>
						GitHub
					</a>
				</div>
			</div>

			<div className={styles.getStarted}>
				<p className={styles.getStartedLabel}>Get started</p>
				<code className={styles.codeHint}>Edit app/modules/main/pages/index.tsx</code>
				<p className={styles.moduleHint}>
					<a className={styles.link} href="/about">
						About
					</a>{" "}
					is the about module — app/modules/about/pages/index.tsx → /about
				</p>
			</div>

			<footer className={styles.footer}>
				<p className={styles.footerText}>
					Powered by{" "}
					<a
						className={styles.link}
						href="https://useavalon.dev"
						target="_blank"
						rel="noopener noreferrer"
					>
						Avalon
					</a>
				</p>
			</footer>
		</div>
	);
}
