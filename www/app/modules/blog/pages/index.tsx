import styles from './index.module.css';
import cardStyles from '@shared/styles/cards.module.css';
import badgeStyles from '@shared/styles/badges.module.css';

export default async function BlogIndexPage() {
	const featuredPost = {
		slug: 'getting-started',
		title: 'Getting Started with Avalon',
		excerpt: 'Learn how to set up your first Avalon project with multi-framework islands architecture.',
		date: 'JANUARY 15, 2024',
	};

	const posts = [
		{
			slug: 'advanced-features',
			title: 'Advanced Features',
			excerpt: 'Explore islands architecture, selective hydration, and nested layouts.',
			date: 'JANUARY 20, 2024',
			tag: 'Deep Dive',
		},
	];

	return (
		<div className={styles.container}>
			<div className={styles.pageHeader}>
				<h1 className={styles.pageTitle}>Blog</h1>
				<p className={styles.pageSubtitle}>Updates, tutorials, and deep dives from the Avalon team.</p>
			</div>

			{/* Featured Post */}
			<a href={`/blog/${featuredPost.slug}`} className={`${cardStyles.cardHover} ${styles.featured}`}>
				<div className={styles.featuredImage}>
					<div className={styles.featuredDecor} aria-hidden="true">
						<div className={styles.decorBox} />
						<div className={styles.decorLines}>
							<div className={styles.decorLine} />
							<div className={styles.decorLineShort} />
						</div>
					</div>
				</div>
				<div className={styles.featuredContent}>
					<div>
						<span className={badgeStyles.badge}>Featured</span>
						<h2 className={styles.featuredTitle}>{featuredPost.title}</h2>
						<p className={styles.featuredExcerpt}>{featuredPost.excerpt}</p>
					</div>
					<div className={styles.postMeta}>
						<div className={styles.avatar} aria-hidden="true" />
						<time className={styles.date}>{featuredPost.date}</time>
					</div>
				</div>
			</a>

			{/* Posts Grid */}
			<div className={styles.postsGrid}>
				{posts.map(post => (
					<a key={post.slug} href={`/blog/${post.slug}`} className={`${cardStyles.cardHover} ${styles.postCard}`}>
						{post.tag && <span className={badgeStyles.pill}>{post.tag}</span>}
						<h3 className={styles.postTitle}>{post.title}</h3>
						<p className={styles.postExcerpt}>{post.excerpt}</p>
						<div className={styles.postMeta}>
							<div className={styles.avatarSmall} aria-hidden="true" />
							<time className={styles.dateSmall}>{post.date}</time>
						</div>
					</a>
				))}
			</div>
		</div>
	);
}
