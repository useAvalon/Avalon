import type { LayoutProps } from '@avalon/avalon';
import DocsSidebar from '../components/DocsSidebar.tsx';
import TableOfContents from '../components/TableOfContents.tsx';
import { getPrevNext } from '@shared/utils/sidebar.ts';
import styles from './_layout.module.css';

interface DocsFrontmatter {
	title?: string;
	description?: string;
	currentPath?: string;
	prev?: { title: string; href: string };
	next?: { title: string; href: string };
}

export default async function DocsLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const fm = frontmatter as DocsFrontmatter | undefined;
	const currentPath = fm?.currentPath ?? '';

	// Redirect bare /docs/ to /docs/introduction
	if (!currentPath || currentPath === '/docs' || currentPath === '/docs/') {
		return (
			<html lang="en">
				<head>
					<meta httpEquiv="refresh" content="0;url=/docs/introduction" />
					<link rel="canonical" href="/docs/introduction" />
					<title>Redirecting…</title>
				</head>
				<body>
					<p>Redirecting to <a href="/docs/introduction">Introduction</a>…</p>
				</body>
			</html>
		);
	}

	const prevNext = fm?.prev !== undefined || fm?.next !== undefined
		? { prev: fm?.prev, next: fm?.next }
		: getPrevNext(currentPath);

	return (
		<div className={styles.docsLayout}>
			<aside className={styles.sidebar}>
				<div>
					<DocsSidebar island={{ condition: 'on:interaction' }} currentPath={currentPath} />
				</div>
			</aside>
			<main className={styles.content}>
				{fm?.title && (
					<header className={styles.pageHeader}>
						<h1 className={styles.pageTitle}>{fm.title}</h1>
						{fm.description && <p className={styles.pageDesc}>{fm.description}</p>}
					</header>
				)}
				<div className={styles.prose} data-toc-content>
					{children}
				</div>
				{(prevNext.prev || prevNext.next) && (
					<nav className={styles.prevNext} aria-label="Page navigation">
						<div className={styles.prevNextInner}>
							{prevNext.prev ? (
								<a href={prevNext.prev.href} className={styles.prevLink}>
									<span className={styles.prevNextLabel}>← Previous</span>
									<span className={styles.prevNextTitle}>{prevNext.prev.title}</span>
								</a>
							) : <div />}
							{prevNext.next ? (
								<a href={prevNext.next.href} className={styles.nextLink}>
									<span className={styles.prevNextLabel}>Next →</span>
									<span className={styles.prevNextTitle}>{prevNext.next.title}</span>
								</a>
							) : <div />}
						</div>
					</nav>
				)}
			</main>
			<aside className={styles.tocSidebar}>
				<div>
					<TableOfContents island={{ condition: 'on:client' }} />
				</div>
			</aside>
		</div>
	);
}
