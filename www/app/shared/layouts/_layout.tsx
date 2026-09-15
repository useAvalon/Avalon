import type { LayoutProps } from "@useavalon/avalon";
import MobileNav from "../components/MobileNav.tsx";
import SearchModal from "../components/SearchModal.tsx";
import ThemeToggle from "../components/ThemeToggle.tsx";
import styles from "./_layout.module.css";
import "../styles/main.css";

export default async function RootLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const title = (frontmatter?.title as string) || "Avalon";
	const description = frontmatter?.description as string | undefined;
	const currentPath = frontmatter?.currentPath as string | undefined;

	return (
		<html lang="en" data-theme="dark">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{title}</title>
				<link rel="icon" href="/favicon.ico" />
				{description && <meta name="description" content={description} />}
				<script
					dangerouslySetInnerHTML={{
						__html: [
							`(function(){`,
							`var d=document.documentElement;`,
							`try{var t=localStorage.getItem('avalon-theme')}catch(e){}`,
							`if(t==='light'){d.setAttribute('data-theme','light');d.style.colorScheme='light'}`,
							`else{d.style.colorScheme='dark'}`,
							`})()`,
						].join(""),
					}}
				/>
				<link rel="stylesheet" href="/syntax-highlighting.css" data-critical />
			</head>
			<body class={styles.body}>
				<header class={styles.nav} data-router-persist="site-nav">
					<div class={styles.navInner}>
						<a href="/" class={styles.navLogo}>
							<img
								src="/avalon-wordmark.svg"
								alt="Avalon"
								class={`${styles.navLogoImg} ${styles.logoDark}`}
								height={28}
							/>
							<img
								src="/avalon-wordmark-black.svg"
								alt="Avalon"
								class={`${styles.navLogoImg} ${styles.logoLight}`}
								height={28}
							/>
						</a>
						<div class={styles.navDivider} aria-hidden="true" />
						<nav class={styles.navLinks} aria-label="Main navigation">
							<a href="/docs/introduction" class={styles.navLink}>
								Docs
							</a>
							<a href="/blog" class={styles.navLink}>
								Blog
							</a>
						</nav>
						<div class={styles.navRight}>
							<button
								type="button"
								class={styles.navSearchBtn}
								aria-label="Search documentation"
								{...{ onclick: "document.querySelector('pagefind-modal')?.open?.()" }}
							>
								<svg
									class={styles.navSearchIcon}
									viewBox="0 0 16 16"
									fill="none"
									aria-hidden="true"
								>
									<circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
									<path
										d="M10.5 10.5L14 14"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
									/>
								</svg>
								<span class={styles.navSearchText}>Search docs...</span>
								<kbd class={styles.navSearchKbd}>⌘K</kbd>
							</button>
							<a
								href="https://github.com/useAvalon/Avalon"
								class={styles.navGithubBtn}
								target="_blank"
								rel="noopener noreferrer"
							>
								<svg
									class={styles.navGithubIcon}
									viewBox="0 0 24 24"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
								</svg>
								GitHub
							</a>
							<ThemeToggle island={{ condition: "on:idle", persist: "theme-toggle" }} />
						</div>
						<div class={styles.mobileNavWrapper}>
							<MobileNav island={{ condition: "on:interaction" }} currentPath={currentPath} />
						</div>
					</div>
				</header>
				<main>{children}</main>
				<footer id="site-footer" class={styles.footer}>
					<nav class={styles.footerCols} aria-label="Footer">
						<div>
							<p class={styles.footerColTitle}>Docs</p>
							<a class={styles.footerLink} href="/docs/introduction">
								Introduction
							</a>
							<a class={styles.footerLink} href="/docs/installation">
								Installation
							</a>
							<a class={styles.footerLink} href="/docs/quick-start">
								Quick start
							</a>
							<a class={styles.footerLink} href="/docs/islands-architecture">
								Islands
							</a>
							<a class={styles.footerLink} href="/docs/hydration-strategies">
								Hydration
							</a>
						</div>
						<div>
							<p class={styles.footerColTitle}>Frameworks</p>
							<a class={styles.footerLink} href="/docs/frameworks/react">
								React
							</a>
							<a class={styles.footerLink} href="/docs/frameworks/preact">
								Preact
							</a>
							<a class={styles.footerLink} href="/docs/frameworks/vue">
								Vue
							</a>
							<a class={styles.footerLink} href="/docs/frameworks/svelte">
								Svelte
							</a>
							<a class={styles.footerLink} href="/docs/frameworks/solid">
								Solid
							</a>
							<a class={styles.footerLink} href="/docs/frameworks/qwik">
								Qwik
							</a>
							<a class={styles.footerLink} href="/docs/frameworks/lit">
								Lit
							</a>
						</div>
						<div>
							<p class={styles.footerColTitle}>Guides</p>
							<a class={styles.footerLink} href="/docs/guides/deployment">
								Deployment
							</a>
							<a class={styles.footerLink} href="/docs/guides/prerendering">
								Prerendering
							</a>
							<a class={styles.footerLink} href="/docs/guides/data-loading">
								Data loading
							</a>
							<a class={styles.footerLink} href="/docs/api/file-conventions">
								File conventions
							</a>
						</div>
						<div>
							<p class={styles.footerColTitle}>Community</p>
							<a
								class={styles.footerLink}
								href="https://github.com/useAvalon/Avalon"
								target="_blank"
								rel="noopener noreferrer"
							>
								GitHub
							</a>
							<a
								class={styles.footerLink}
								href="https://discord.gg/avalon"
								target="_blank"
								rel="noopener noreferrer"
							>
								Discord
							</a>
							<a class={styles.footerLink} href="/blog">
								Blog
							</a>
						</div>
					</nav>
					<div class={styles.footerMark} aria-hidden="true">
						<svg viewBox="0 0 160 153" width="160" height="153" fill="none" aria-hidden="true">
							<path
								d="M113.322 69.3916C115.652 64.518 122.434 64.08 125.373 68.6152L156.891 117.245C158.212 119.284 158.363 121.866 157.289 124.045L145.982 146.979C144.822 149.332 142.426 150.827 139.797 150.835L86.9541 151C85.0689 151.006 83.2906 150.128 82.1514 148.63L79.791 145.526C78.7577 143.974 78.6154 141.994 79.4199 140.312L113.322 69.3916ZM91.1602 35.0996L107.854 60.3721C109.196 62.4052 109.367 64.9944 108.303 67.1855L69.6152 146.847C68.4553 149.235 66.0254 150.749 63.3643 150.739L40.0195 150.649H40.0049L10.418 150.755C8.19026 150.763 6.09554 149.699 4.79004 147.898L3.31445 145.863C1.82075 143.803 1.58179 141.091 2.69238 138.803L4.77734 134.507L4.77637 134.506L9.40039 125.032L9.40234 125.029L36.0811 70.0684L36.082 70.0674L53.1514 34.8096L53.1504 34.8086L68.6631 2.8916L91.1602 35.0996Z"
								stroke="currentColor"
								stroke-width="4"
							/>
						</svg>
						<span>Avalon</span>
					</div>
					<div class={styles.footerBottom}>
						<p>MIT License</p>
						<p>© 2026 Avalon</p>
					</div>
				</footer>
				<SearchModal island={{ condition: "on:idle", persist: "search-modal" }} />
			</body>
		</html>
	);
}
