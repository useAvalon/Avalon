import type { LayoutProps } from '@useavalon/avalon';
import MobileNav from '@shared/components/MobileNav.tsx';
import styles from './home-layout.module.css';
import '@shared/styles/main.css';

// Skip the shared root layout since this layout provides its own HTML shell
export const layoutConfig = {
	skipLayouts: ['_layout'],
};

/**
 * Home module layout - provides the HTML shell for landing pages.
 * Uses a different nav style than the docs layout.
 */
export default async function HomeLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const rawTitle = frontmatter?.title as string | undefined;
	const title = rawTitle 
		? (rawTitle.includes('Avalon') ? rawTitle : `${rawTitle} — Avalon`)
		: 'Avalon — Islands Architecture for the Modern Web';
	const description = frontmatter?.description as string | undefined;
	const currentPath = (frontmatter as Record<string, unknown>)?.currentPath as string | undefined;

	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{title}</title>
				{description && <meta name="description" content={description} />}
				{frontmatter?.ogTitle && <meta property="og:title" content={String(frontmatter.ogTitle)} />}
				{frontmatter?.ogDescription && <meta property="og:description" content={String(frontmatter.ogDescription)} />}
				{frontmatter?.ogImage && <meta property="og:image" content={String(frontmatter.ogImage)} />}
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link
					href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
					rel="stylesheet"
				/>
				<link rel="stylesheet" href="/syntax-highlighting.css" />
			</head>
			<body className={styles.body}>
				<header className={styles.nav}>
					<div className={styles.navInner}>
						<a href="/" className={styles.navLogo}>
							<img src="/logo.svg" alt="Avalon" className={styles.navLogoImg} />
							<span className={styles.navLogoText}>Avalon</span>
						</a>
						<div className={styles.navDivider} aria-hidden="true" />
						<nav className={styles.navLinks} aria-label="Main navigation">
							<a href="/docs/introduction" className={styles.navLink}>Docs</a>
							<a href="/blog" className={styles.navLink}>Blog</a>
						</nav>
						<div className={styles.navRight}>
							<a href="/docs/introduction" className={styles.navSearchBtn} aria-label="Search documentation">
								<svg className={styles.navSearchIcon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
									<circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
									<path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
								</svg>
								<span className={styles.navSearchText}>Search docs...</span>
								<kbd className={styles.navSearchKbd}>⌘K</kbd>
							</a>
							<a
								href="https://github.com/useAvalon/Avalon"
								className={styles.navGithubBtn}
								target="_blank"
								rel="noopener noreferrer"
							>
								<svg className={styles.navGithubIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
								</svg>
								GitHub
							</a>
						</div>
						<div className={styles.mobileNavWrapper}>
							<MobileNav island={{ condition: 'on:interaction' }} currentPath={currentPath} />
						</div>
					</div>
				</header>
				<main>
					{children}
				</main>
			</body>
		</html>
	);
}
