/** @jsxImportSource preact */

type Post = {
	id: number;
	title: string;
	body: string;
};

export const metadata = {
	title: "Data Fetching Demo",
	description: "Demo showing async data fetching in server-rendered pages",
};

async function loadPosts(): Promise<Post[]> {
	try {
		const res = await fetch("https://jsonplaceholder.typicode.com/posts?_limit=10");
		if (!res.ok) return [];
		const data: unknown = await res.json();
		return Array.isArray(data) ? (data as Post[]) : [];
	} catch {
		return [];
	}
}

export default async function DataFetchingDemo() {
	const posts = await loadPosts();

	return (
		<div
			style={{
				minHeight: "80vh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				padding: "3rem 2rem",
				gap: "2rem",
			}}
		>
			<div style={{ textAlign: "center", maxWidth: "700px" }}>
				<h1
					style={{
						fontSize: "2rem",
						color: "#e0e0e0",
						fontFamily: "system-ui, sans-serif",
						marginBottom: "0.5rem",
					}}
				>
					Server-Side Data Fetching
				</h1>
				<p style={{ color: "#888", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
					This page fetches data from JSONPlaceholder during SSR. The HTML arrives fully rendered —
					zero client-side JavaScript.
				</p>
			</div>

			{posts.length === 0 ? (
				<p style={{ color: "#888", fontFamily: "system-ui, sans-serif" }}>
					No posts loaded (upstream fetch failed or returned an empty list).
				</p>
			) : (
				<ul
					style={{
						listStyle: "none",
						padding: 0,
						width: "100%",
						maxWidth: "700px",
						display: "flex",
						flexDirection: "column",
						gap: "0.75rem",
					}}
				>
					{posts.map((post) => (
						<li
							key={post.id}
							style={{
								padding: "1rem 1.25rem",
								background: "rgba(255,255,255,0.03)",
								border: "1px solid rgba(255,255,255,0.06)",
								borderRadius: "8px",
							}}
						>
							<strong
								style={{
									color: "#e0e0e0",
									fontFamily: "system-ui, sans-serif",
									fontSize: "0.95rem",
								}}
							>
								{post.title}
							</strong>
							<p
								style={{
									color: "#666",
									fontFamily: "system-ui, sans-serif",
									fontSize: "0.85rem",
									margin: "0.5rem 0 0",
									lineHeight: 1.5,
								}}
							>
								{post.body.slice(0, 120)}...
							</p>
						</li>
					))}
				</ul>
			)}

			<p
				style={{
					color: "#666",
					fontFamily: "system-ui, sans-serif",
					fontSize: "0.85rem",
					textAlign: "center",
					maxWidth: "600px",
				}}
			>
				View source — this page ships 0 KB of JavaScript. All data was fetched on the server.
			</p>
		</div>
	);
}
