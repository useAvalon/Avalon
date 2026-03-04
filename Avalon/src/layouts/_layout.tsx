import type { LayoutProps } from '@avalon/avalon';
import { AppProvider } from '../context/AppContext.tsx';
import styles from './_layout.module.css';
import '../styles/main.css';

export default function RootLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const pageTitle = frontmatter?.title || 'Avalon';
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{pageTitle}</title>
				{frontmatter?.description && <meta name="description" content={String(frontmatter.description)} />}
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link
					href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap"
					rel="stylesheet"
				/>
				<link rel="stylesheet" href="/syntax-highlighting.css" />
			</head>
			<body className={styles.body}>
				<AppProvider>
					<div className={styles.scene}>
						<header className={styles.header}>
							<a href="/" className={styles.logo}>Avalon</a>
							<nav className={styles.nav}>
								<a href="/frameworks" className={styles.navLink}>Frameworks</a>
								<a href="/islands" className={styles.navLink}>Islands</a>
								<a href="/layouts" className={styles.navLink}>Layouts</a>
								<a href="/api-demo" className={styles.navLink}>API</a>
								<a href="/blog" className={styles.navLink}>Blog</a>
							</nav>
						</header>
						<main className={styles.main}>
							<div className={styles.container}>
								{children}
							</div>
						</main>
					</div>
				</AppProvider>
			</body>
		</html>
	);
}
