import styles from "./index.module.css";

type Topic = "tutorial" | "deep-dive" | "engineering";

interface Post {
	slug: string;
	title: string;
	excerpt: string;
	date: string;
	published: string;
	topic: Topic;
	topicLabel: string;
}

const POSTS: Post[] = [
	{
		slug: "getting-started",
		title: "Getting started with Avalon",
		excerpt:
			"Stand up a project, add your first island, and learn how file-based routing and hydration fit together.",
		date: "January 15, 2024",
		published: "2024-01-15",
		topic: "tutorial",
		topicLabel: "Tutorial",
	},
	{
		slug: "advanced-features",
		title: "Selective hydration and nested layouts",
		excerpt:
			"Defer JavaScript with on:visible, on:interaction, and media queries, and compose layouts by directory.",
		date: "January 20, 2024",
		published: "2024-01-20",
		topic: "deep-dive",
		topicLabel: "Deep dive",
	},
	{
		slug: "image-test",
		title: "Responsive images in Avalon",
		excerpt:
			"How vite-imagetools and the Image component produce srcset, modern formats, and sized assets.",
		date: "March 4, 2024",
		published: "2024-03-04",
		topic: "engineering",
		topicLabel: "Engineering",
	},
];

const TOPICS: Array<{ id: Topic | "all"; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "tutorial", label: "Tutorial" },
	{ id: "deep-dive", label: "Deep dive" },
	{ id: "engineering", label: "Engineering" },
];

const featured = POSTS[0];

const COVER: Record<Topic, string> = {
	tutorial: styles.coverTutorial,
	"deep-dive": styles.coverDeep,
	engineering: styles.coverEng,
};

export const metadata = {
	title: "Blog · Avalon",
	description: "Updates, tutorials, and deep dives from the Avalon team.",
};

export default async function BlogIndexPage() {
	return (
		<div class={styles.page}>
			<div class={styles.hero}>
				<header>
					<h1 class={styles.heroTitle}>Notes from the team that builds Avalon.</h1>
					<p class={styles.heroLead}>Tutorials, hydration, and architecture. Filter by topic.</p>
				</header>

				<a href={`/blog/${featured.slug}`} class={styles.featured}>
					<div class={styles.featuredCopy}>
						<h2 class={styles.featuredTitle}>{featured.title}</h2>
						<p class={styles.featuredExcerpt}>{featured.excerpt}</p>
						<p class={styles.featuredMeta}>
							<time datetime={featured.published}>{featured.date}</time>
							<span aria-hidden="true"> · </span>
							{featured.topicLabel}
						</p>
						<span class={styles.cta}>Read post</span>
					</div>
					<div
						class={`${styles.cover} ${styles.coverFeatured} ${COVER[featured.topic]}`}
						aria-hidden="true"
					>
						<p class={styles.coverMark}>{featured.title}</p>
					</div>
				</a>
			</div>

			<section class={styles.catalogue} aria-labelledby="all-posts-heading">
				<div class={styles.catalogueHead}>
					<h2 id="all-posts-heading" class={styles.catalogueTitle}>
						All posts
					</h2>
					<p class={styles.catalogueLead}>
						Every write-up in one place. Topic filters work without JavaScript.
					</p>
				</div>

				<div class={styles.catalogueBody}>
					{TOPICS.map((topic, index) => (
						<input
							key={topic.id}
							id={`blog-topic-${topic.id}`}
							class={styles.filterCtrl}
							type="radio"
							name="blog-topic"
							value={topic.id}
							defaultChecked={index === 0}
						/>
					))}

					<aside class={styles.filters} aria-label="Filter posts by topic">
						{TOPICS.map((topic) => (
							<label key={topic.id} class={styles.filterChip} for={`blog-topic-${topic.id}`}>
								{topic.label}
							</label>
						))}
					</aside>

					<div class={styles.list}>
						{POSTS.map((post) => (
							<a
								key={post.slug}
								href={`/blog/${post.slug}`}
								class={styles.row}
								data-topic={post.topic}
							>
								<div class={styles.rowCopy}>
									<h3 class={styles.rowTitle}>{post.title}</h3>
									<p class={styles.rowExcerpt}>{post.excerpt}</p>
									<p class={styles.rowMeta}>
										<time datetime={post.published}>{post.date}</time>
									</p>
									<span class={styles.cta}>Read post</span>
								</div>
								<div
									class={`${styles.cover} ${styles.coverRow} ${COVER[post.topic]}`}
									aria-hidden="true"
								>
									<p class={styles.coverMark}>{post.title}</p>
								</div>
							</a>
						))}
					</div>
				</div>
			</section>
		</div>
	);
}
