/** @jsxImportSource react */
// This is a React Server Component (no "use client" directive)
// It fetches data on the server and renders without client-side JavaScript

interface Post {
  id: number;
  title: string;
  body: string;
}

async function fetchPosts(): Promise<Post[]> {
  // Simulate async data fetching
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return [
    {
      id: 1,
      title: "Understanding React Server Components",
      body: "React Server Components allow you to render components on the server without sending JavaScript to the client.",
    },
    {
      id: 2,
      title: "Islands Architecture",
      body: "Islands architecture enables selective hydration, sending JavaScript only for interactive components.",
    },
    {
      id: 3,
      title: "Performance Benefits",
      body: "By rendering on the server, you reduce bundle size and improve initial page load times.",
    },
  ];
}

export default async function ReactServerComponent() {
  const posts = await fetchPosts();
  const timestamp = new Date().toISOString();

  return (
    <div style={{
      padding: "20px",
      border: "2px solid #61dafb",
      borderRadius: "8px",
      backgroundColor: "#f8f9fa",
      color: "#282c34",
      fontFamily: "system-ui, sans-serif",
    }}>
      <h2 style={{ margin: "0 0 8px 0", color: "#61dafb" }}>React Server Component</h2>
      <p style={{ 
        fontSize: "12px", 
        color: "#666", 
        margin: "0 0 16px 0",
        fontStyle: "italic",
      }}>
        Rendered on server at: {timestamp}
      </p>
      <p style={{ marginBottom: "16px" }}>
        This component fetches data on the server and renders without client-side JavaScript.
        No hydration needed! 🚀
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {posts.map(post => (
          <div
            key={post.id}
            style={{
              padding: "12px",
              backgroundColor: "white",
              borderRadius: "4px",
              border: "1px solid #e0e0e0",
            }}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#61dafb" }}>
              {post.title}
            </h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
              {post.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
