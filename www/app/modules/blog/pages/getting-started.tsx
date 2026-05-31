export const frontmatter = {
	title: "Getting Started with Avalon",
	description: "Learn how to set up your first Avalon project with multi-framework support.",
	date: "January 15, 2024",
};

export default async function GettingStartedPage() {
	return (
		<>
			<h2>Installation</h2>
			<p>Create a new Avalon project using the CLI:</p>
			<pre>
				<code>{`bun create avalon my-app
cd my-app
bun install
bun run dev`}</code>
			</pre>

			<h2>Project Structure</h2>
			<p>
				Avalon uses a file-based routing system. Pages go in <code>src/pages/</code> and interactive
				components go in <code>src/islands/</code>.
			</p>
			<pre>
				<code>{`my-app/
├── src/
│   ├── pages/
│   │   └── index.tsx       # → /
│   ├── islands/
│   │   └── Counter.tsx     # interactive component
│   └── layouts/
│       └── _layout.tsx     # root layout
├── public/
├── vite.config.ts
└── package.json`}</code>
			</pre>

			<h2>Creating Your First Island</h2>
			<p>
				Islands are interactive components that hydrate on the client. Create one in{" "}
				<code>src/islands/</code>:
			</p>
			<pre>
				<code>{`// src/islands/Counter.tsx
/** @jsxImportSource preact */
import { useState } from 'preact/hooks';

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}`}</code>
			</pre>
			<p>
				Then use it in a page with the <code>island</code> prop to control hydration:
			</p>
			<pre>
				<code>{`import Counter from '../islands/Counter.tsx';

export default async function Page() {
  return (
    <div>
      <h1>My Page</h1>
      <Counter island={{ condition: 'on:visible' }} />
    </div>
  );
}`}</code>
			</pre>

			<h2>Running the Dev Server</h2>
			<p>Start the development server with hot module replacement:</p>
			<pre>
				<code>{`bun run dev`}</code>
			</pre>
			<p>
				Open <code>http://localhost:8012</code> to see your site.
			</p>
		</>
	);
}
