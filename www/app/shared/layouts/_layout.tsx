import type { LayoutProps } from "@useavalon/avalon";
import MobileNav from "../components/MobileNav.tsx";
import SearchModal from "../components/SearchModal.tsx";
import ThemeToggle from "../components/ThemeToggle.tsx";
import styles from "./_layout.module.css";
import "../styles/main.css";

export default async function RootLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const title = typeof frontmatter?.title === "string" ? frontmatter.title : null;
	const description = typeof frontmatter?.description === "string" ? frontmatter.description : null;
	const pageTitle = title ? `${title} — Avalon` : "Avalon";
	const currentPath = (frontmatter as Record<string, unknown>)?.currentPath as string | undefined;

	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{pageTitle}</title>
				<link rel="icon" href="/favicon.ico" />
				{description && <meta name="description" content={description} />}
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){try{var t=localStorage.getItem('avalon-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
					}}
				/>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link
					href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
					rel="stylesheet"
				/>
				<link rel="stylesheet" href="/syntax-highlighting.css" />
			</head>
			<body class={styles.body}>
				<header class={styles.header}>
					<div class={styles.headerInner}>
						<a href="/" class={styles.logo}>
							<img src="/logo.svg" alt="Avalon" class={styles.logoImg} width={24} height={24} />
							<span class={styles.logoText}>Avalon</span>
						</a>
						<div class={styles.logoDivider} aria-hidden="true" />
						<nav class={styles.nav} aria-label="Main navigation">
							<a href="/docs/introduction" class={styles.navLink}>
								Docs
							</a>
							<a href="/blog" class={styles.navLink}>
								Blog
							</a>
							<a href="/demo" class={styles.navLink}>
								Demo
							</a>
						</nav>
						<div class={styles.navRight}>
							<button
								type="button"
								class={styles.searchBtn}
								aria-label="Search documentation"
								{...{ onclick: "document.querySelector('pagefind-modal')?.open?.()" }}
							>
								<svg class={styles.searchIcon} viewBox="0 0 16 16" fill="none" aria-hidden="true">
									<circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
									<path
										d="M10.5 10.5L14 14"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
								</svg>
								<span class={styles.searchText}>Search docs...</span>
								<kbd class={styles.searchKbd}>⌘K</kbd>
							</button>
							<a
								href="https://github.com/useAvalon/Avalon"
								class={styles.githubBtn}
								target="_blank"
								rel="noopener noreferrer"
							>
								<svg
									class={styles.githubIcon}
									viewBox="0 0 24 24"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
								</svg>
								GitHub
							</a>
							<ThemeToggle island={{ condition: "on:idle" }} />
						</div>
						<div class={styles.mobileNavWrapper}>
							<MobileNav island={{ condition: "on:interaction" }} currentPath={currentPath} />
						</div>
					</div>
				</header>
				<main class={styles.main}>{children}</main>
				<footer class={styles.footer}>
					<div class={styles.footerInner}>
						<div class={styles.footerBrand}>
							<img src="/logo.svg" alt="" class={styles.footerLogoImg} width={20} height={20} />
							<span>Avalon</span>
						</div>
						<nav class={styles.footerCols} aria-label="Footer navigation">
							<div>
								<p class={styles.footerColTitle}>Docs</p>
								<a href="/docs/introduction">Introduction</a>
								<a href="/docs/installation">Installation</a>
								<a href="/docs/quick-start">Quick start</a>
								<a href="/docs/islands-architecture">Islands</a>
								<a href="/docs/hydration-strategies">Hydration</a>
							</div>
							<div>
								<p class={styles.footerColTitle}>Frameworks</p>
								<a href="/docs/frameworks/react">React</a>
								<a href="/docs/frameworks/vue">Vue</a>
								<a href="/docs/frameworks/svelte">Svelte</a>
								<a href="/docs/frameworks/solid">Solid</a>
								<a href="/docs/frameworks/qwik">Qwik</a>
							</div>
							<div>
								<p class={styles.footerColTitle}>Community</p>
								<a
									href="https://github.com/useAvalon/Avalon"
									target="_blank"
									rel="noopener noreferrer"
								>
									GitHub
								</a>
								<a href="https://discord.gg/avalon" target="_blank" rel="noopener noreferrer">
									Discord
								</a>
								<a href="/blog">Blog</a>
							</div>
						</nav>
					</div>
					<div class={styles.footerBottom}>
						<p>MIT License · © 2026 Avalon</p>
					</div>
				</footer>
				<SearchModal island={{ condition: "on:idle" }} />
			</body>
		</html>
	);
}
