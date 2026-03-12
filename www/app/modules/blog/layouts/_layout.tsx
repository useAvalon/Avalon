import type { LayoutProps } from '@avalon/avalon';
import styles from './_layout.module.css';

interface BlogFrontmatter {
	title?: string;
	description?: string;
	date?: string;
	excerpt?: string;
}

export default function BlogLayout({ children, frontmatter }: Readonly<LayoutProps>) {
	const fm = frontmatter as BlogFrontmatter | undefined;

	return (
		<div className={styles.wrapper}>
			<article className={styles.article}>
				{fm?.title && (
					<header className={styles.header}>
						{fm.date && <time className={styles.date}>{fm.date}</time>}
						<h1 className={styles.title}>{fm.title}</h1>
						{(fm.description || fm.excerpt) && (
							<p className={styles.excerpt}>{fm.description ?? fm.excerpt}</p>
						)}
					</header>
				)}
				<div className={styles.prose}>
					{children}
				</div>
			</article>
		</div>
	);
}
