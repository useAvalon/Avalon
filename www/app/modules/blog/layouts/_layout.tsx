import type { LayoutProps } from "@useavalon/avalon";
import styles from "./_layout.module.css";

interface BlogFrontmatter {
	title?: string;
	description?: string;
	date?: string;
	excerpt?: string;
}

export default function BlogLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const fm = frontmatter as BlogFrontmatter | undefined;

	return (
		<div class={styles.wrapper}>
			<article class={styles.article} data-pagefind-body>
				{fm?.title && (
					<header class={styles.header}>
						{fm.date && <time class={styles.date}>{fm.date}</time>}
						<h1 class={styles.title}>{fm.title}</h1>
						{(fm.description || fm.excerpt) && (
							<p class={styles.excerpt}>{fm.description ?? fm.excerpt}</p>
						)}
					</header>
				)}
				<div class={styles.prose}>{children}</div>
			</article>
		</div>
	);
}
