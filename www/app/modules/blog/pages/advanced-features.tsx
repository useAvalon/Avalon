export const frontmatter = {
	title: "Advanced Features",
	description: "Explore islands architecture, selective hydration, and nested layouts.",
	date: "January 20, 2024",
};

export default async function AdvancedFeaturesPage() {
	return (
		<>
			<h2>Hydration Strategies</h2>
			<p>Avalon supports multiple hydration strategies to optimize performance:</p>
			<ul>
				<li>
					<strong>on:client</strong> — Hydrate immediately on page load
				</li>
				<li>
					<strong>on:visible</strong> — Hydrate when scrolled into view
				</li>
				<li>
					<strong>on:interaction</strong> — Hydrate on click or hover
				</li>
				<li>
					<strong>on:idle</strong> — Hydrate during browser idle time
				</li>
				<li>
					<strong>media:</strong> — Hydrate based on a CSS media query
				</li>
			</ul>
			<pre>
				<code>{`// Hydrate when visible in viewport
<Chart island={{ condition: 'on:visible' }} />

// Hydrate on first click or hover
<Feed island={{ condition: 'on:interaction' }} />

// Hydrate only on wide screens
<Sidebar island={{ condition: 'media:(min-width: 1024px)' }} />`}</code>
			</pre>

			<h2>Multi-Framework Support</h2>
			<p>
				Use React, Preact, Vue, Svelte, Solid, or Lit components in the same project. Each
				framework's islands are bundled separately for optimal code splitting.
			</p>
			<pre>
				<code>{`import ReactCounter from '../islands/ReactCounter.tsx';
import VueChart from '../islands/VueChart.vue';
import SvelteFeed from '../islands/SvelteFeed.svelte';

export default async function Page() {
  return (
    <div>
      <ReactCounter island={{ condition: 'on:interaction' }} />
      <VueChart island={{ condition: 'on:visible' }} />
      <SvelteFeed island={{ condition: 'on:idle' }} />
    </div>
  );
}`}</code>
			</pre>

			<h2>Nested Layouts</h2>
			<p>
				Layouts compose automatically based on directory structure. A layout in{" "}
				<code>src/layouts/blog/_layout.tsx</code> wraps all pages in <code>src/pages/blog/</code>,
				and the root <code>src/layouts/_layout.tsx</code> wraps everything.
			</p>
			<pre>
				<code>{`src/layouts/
├── _layout.tsx          # wraps all pages
└── blog/
    └── _layout.tsx      # wraps /blog/* pages only`}</code>
			</pre>
			<p>
				Use <code>layoutConfig.skipLayouts</code> to opt out of specific layouts when needed:
			</p>
			<pre>
				<code>{`export const layoutConfig = {
  skipLayouts: ['_layout'],
};`}</code>
			</pre>

			<h2>API Routes</h2>
			<p>
				Drop a file in <code>routes/api/</code> to create a server-side API endpoint. Handlers
				receive an H3 event and can return any serializable value.
			</p>
			<pre>
				<code>{`// routes/api/hello.ts
export default defineEventHandler((event) => {
  return { message: 'Hello from Avalon!' };
});`}</code>
			</pre>
		</>
	);
}
