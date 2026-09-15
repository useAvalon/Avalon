/** @jsxImportSource preact */

import styles from "./DocsLive.module.css";

const POSTS = [
	{
		id: 1,
		title: "sunt aut facere repellat provident occaecati excepturi optio reprehenderit",
		body: "quia et suscipit suscipit recusandae consequuntur expedita et cum reprehenderit molestiae ut ut quas totam",
	},
	{
		id: 2,
		title: "qui est esse",
		body: "est rerum tempore vitae sequi sint nihil reprehenderit dolor beatae ea dolores neque fugiat blanditiis voluptate",
	},
	{
		id: 3,
		title: "ea molestias quasi exercitationem repellat qui ipsa sit aut",
		body: "et iusto sed quo iure voluptatem occaecati omnis eligendi aut ad voluptatem doloribus vel accusantium quis pariatur",
	},
];

/** Static stand-in for server-rendered fetch HTML. The page cannot await a child. */
export default function PostsLive() {
	return (
		<ul class={styles.list}>
			{POSTS.map((post) => (
				<li key={post.id} class={styles.item}>
					<strong>{post.title}</strong>
					<p>{post.body}</p>
				</li>
			))}
		</ul>
	);
}
