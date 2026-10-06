import styles from "./index.module.css";

interface Post {
	slug: string;
	title: string;
	excerpt: string;
	date: string;
	published: string;
}

const POSTS: Post[] = [
	{
		slug: "getting-started",
		title: "Introducing Avalon",
		excerpt:
			"Avalon is an open source framework on Vite and Nitro. Pages render to HTML on the server; JavaScript ships only when you mark a component with the island prop.",
		date: "October 6, 2026",
		published: "2026-10-06",
	},
];

export const metadata = {
	title: "Blog · Avalon",
	description: "Release notes and essays from the Avalon team.",
};

export default async function BlogIndexPage() {
	return (
		<div class={styles.page}>
			<header class={styles.header}>
				<h1 class={styles.title}>Blog</h1>
				<p class={styles.lead}>Release notes and essays from the Avalon team.</p>
			</header>

			<ul class={styles.list}>
				{POSTS.map((post) => (
					<li key={post.slug} class={styles.item}>
						<article>
							<a href={`/blog/${post.slug}`} class={styles.postLink}>
								<time class={styles.date} datetime={post.published}>
									{post.date}
								</time>
								<h2 class={styles.postTitle}>{post.title}</h2>
								<p class={styles.excerpt}>{post.excerpt}</p>
							</a>
						</article>
					</li>
				))}
			</ul>
		</div>
	);
}
