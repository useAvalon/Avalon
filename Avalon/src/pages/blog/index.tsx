/** @jsxImportSource preact */

import styles from './index.module.css';

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
		},
		{
			slug: 'getting-started',
			title: 'Multi-Framework Support',
			excerpt: 'Use React, Vue, Svelte, Solid, and Lit in the same project.',
			date: 'JANUARY 18, 2024',
		},
		{
			slug: 'advanced-features',
			title: 'Selective Hydration',
			excerpt: 'Control when and how your components become interactive.',
			date: 'JANUARY 12, 2024',
		},
	];

	const tabs = ['All Posts', 'Tutorials', 'Updates', 'Deep Dives'];

	return (
		<div className={styles.container}>
			<h1 className={styles.pageTitle}>Blog</h1>

			{/* Featured Post */}
			<a href={`/blog/${featuredPost.slug}`} className={styles.featured}>
				<div className={styles.featuredImage}>
					<div className={styles.featuredDecorative}>
						<div className={styles.featuredBox} />
						<div className={styles.featuredBoxLines}>
							<div className={styles.featuredLine} />
							<div className={styles.featuredLineShort} />
						</div>
					</div>
				</div>
				<div className={styles.featuredContent}>
					<div>
						<h2 className={styles.featuredTitle}>{featuredPost.title}</h2>
						<p className={styles.featuredExcerpt}>{featuredPost.excerpt}</p>
					</div>
					<div className={styles.featuredMeta}>
						<div className={styles.avatar} />
						<span className={styles.date}>{featuredPost.date}</span>
					</div>
				</div>
			</a>

			{/* Tabs */}
			<div className={styles.tabs}>
				<div className={styles.tabList}>
					{tabs.map((tab, i) => (
						<button
							key={tab}
							className={i === 0 ? styles.tabActive : styles.tab}
						>
							{tab}
						</button>
					))}
				</div>
				<button className={styles.tabAction}>⊕</button>
			</div>

			{/* Posts Grid */}
			<div className={styles.postsGrid}>
				{posts.map((post) => (
					<a
						key={post.title}
						href={`/blog/${post.slug}`}
						className={styles.postCard}
					>
						<h3 className={styles.postTitle}>{post.title}</h3>
						<p className={styles.postExcerpt}>{post.excerpt}</p>
						<div className={styles.postMeta}>
							<div className={styles.avatarSmall} />
							<span className={styles.dateSmall}>{post.date}</span>
						</div>
					</a>
				))}
			</div>
		</div>
	);
}
