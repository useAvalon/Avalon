import styles from "./index.module.css";

export default async function BlogIndexPage() {
	const featuredPost = {
		slug: "getting-started",
		title: "Getting Started with Avalon",
		excerpt:
			"Learn how to set up your first Avalon project with multi-framework islands architecture.",
		date: "JANUARY 15, 2024",
	};

	const posts = [
		{
			slug: "advanced-features",
			title: "Advanced Features",
			excerpt: "Explore islands architecture, selective hydration, and nested layouts.",
			date: "JANUARY 20, 2024",
			tag: "Deep Dive",
		},
	];

	return (
		<div class={styles.container}>
			<div class={styles.pageHeader}>
				<h1 class={styles.pageTitle}>Blog</h1>
				<p class={styles.pageSubtitle}>Updates, tutorials, and deep dives from the Avalon team.</p>
			</div>

			{/* Featured Post */}
			<a href={`/blog/${featuredPost.slug}`} class={styles.featured}>
				<div class={styles.featuredContent}>
					<div>
						<time class={styles.date}>{featuredPost.date}</time>
						<h2 class={styles.featuredTitle}>{featuredPost.title}</h2>
						<p class={styles.featuredExcerpt}>{featuredPost.excerpt}</p>
					</div>
				</div>
			</a>

			{/* Posts List */}
			<div class={styles.postsGrid}>
				{posts.map((post) => (
					<a key={post.slug} href={`/blog/${post.slug}`} class={styles.postCard}>
						<time class={styles.dateSmall}>{post.date}</time>
						<div>
							<h3 class={styles.postTitle}>{post.title}</h3>
							<p class={styles.postExcerpt}>{post.excerpt}</p>
						</div>
					</a>
				))}
			</div>
		</div>
	);
}
