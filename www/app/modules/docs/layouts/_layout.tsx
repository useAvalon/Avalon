import { getPrevNext } from "@shared/utils/sidebar.ts";
import type { LayoutProps } from "@useavalon/avalon";
import DocsSidebar from "../components/DocsSidebar.tsx";
import TableOfContents from "../components/TableOfContents.tsx";
import styles from "./_layout.module.css";

interface DocsFrontmatter {
	title?: string;
	heading?: string;
	description?: string;
	currentPath?: string;
	prev?: { title: string; href: string };
	next?: { title: string; href: string };
}

export default async function DocsLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const fm = frontmatter as DocsFrontmatter | undefined;
	const currentPath = fm?.currentPath ?? "";

	// Redirect bare /docs/ to /docs/introduction
	if (!currentPath || currentPath === "/docs" || currentPath === "/docs/") {
		return (
			<html lang="en">
				<head>
					<meta httpEquiv="refresh" content="0;url=/docs/introduction" />
					<link rel="canonical" href="/docs/introduction" />
					<title>Redirecting…</title>
				</head>
				<body>
					<p>
						Redirecting to <a href="/docs/introduction">Introduction</a>…
					</p>
				</body>
			</html>
		);
	}

	const prevNext =
		fm?.prev !== undefined || fm?.next !== undefined
			? { prev: fm?.prev, next: fm?.next }
			: getPrevNext(currentPath);

	return (
		<div class={styles.docsLayout}>
			<aside class={styles.sidebar}>
				<div>
					<DocsSidebar island={{ condition: "on:interaction" }} currentPath={currentPath} />
				</div>
			</aside>
			<main class={styles.content} data-pagefind-body>
				{(fm?.heading || fm?.title) && (
					<header class={styles.pageHeader}>
						<h1 class={styles.pageTitle}>{fm.heading || fm.title}</h1>
						{fm.description && <p class={styles.pageDesc}>{fm.description}</p>}
					</header>
				)}
				<div class={styles.prose} data-toc-content>
					{children}
				</div>
				{(prevNext.prev || prevNext.next) && (
					<nav class={styles.prevNext} aria-label="Page navigation">
						<div class={styles.prevNextInner}>
							{prevNext.prev ? (
								<a href={prevNext.prev.href} class={styles.prevLink}>
									<span class={styles.prevNextLabel}>← Previous</span>
									<span class={styles.prevNextTitle}>{prevNext.prev.title}</span>
								</a>
							) : (
								<div />
							)}
							{prevNext.next ? (
								<a href={prevNext.next.href} class={styles.nextLink}>
									<span class={styles.prevNextLabel}>Next →</span>
									<span class={styles.prevNextTitle}>{prevNext.next.title}</span>
								</a>
							) : (
								<div />
							)}
						</div>
					</nav>
				)}
			</main>
			<aside class={styles.tocSidebar}>
				<div>
					<TableOfContents island={{ condition: "on:client" }} />
				</div>
			</aside>
		</div>
	);
}
