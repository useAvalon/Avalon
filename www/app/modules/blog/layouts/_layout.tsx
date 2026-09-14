import type { LayoutProps } from "@useavalon/avalon";
import styles from "./_layout.module.css";

interface BlogFrontmatter {
	title?: string;
	description?: string;
	date?: string;
	excerpt?: string;
	currentPath?: string;
}

export default function BlogLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const fm = frontmatter as BlogFrontmatter | undefined;
	// Index exports metadata.title for <title>; only dated posts get article chrome.
	if (!fm?.date) {
		return <div class={styles.catalogue}>{children}</div>;
	}

	return (
		<div class={styles.wrapper}>
			<article class={styles.article} data-pagefind-body>
				<p class={styles.back}>
					<a href="/blog">All posts</a>
				</p>
				<header class={styles.header}>
					<time class={styles.date}>{fm.date}</time>
					<h1 class={styles.title}>{fm.title}</h1>
					{(fm.description || fm.excerpt) && (
						<p class={styles.excerpt}>{fm.description ?? fm.excerpt}</p>
					)}
				</header>
				<div class={styles.prose}>{children}</div>
			</article>
		</div>
	);
}
