# Quick Start: Build Your First App in 5 Minutes

Let's build a simple but functional Avalon application that demonstrates the core concepts: islands architecture, file-system routing, and multi-framework support.

## What We'll Build

A personal dashboard with:

- A welcome page with server-side rendering
- An interactive counter (island)
- A simple API endpoint
- Multiple framework examples

## Step 1: Create the Project Structure

First, let's set up the basic file structure:

```bash
mkdir my-avalon-app
cd my-avalon-app

# Create the directory structure
mkdir -p src/{pages,islands,api,layouts}
mkdir public
```

Your project should look like this:

```
my-avalon-app/
├── src/
│   ├── pages/          # Your app pages
│   ├── islands/        # Interactive components
│   ├── api/           # API endpoints
│   └── layouts/       # Layout components
├── public/            # Static assets
└── deno.json         # Configuration
```

## Step 2: Configure Your Project

Create `deno.json`:

```json
{
	"tasks": {
		"dev": "deno run --allow-all --unstable-detect-cjs src/server.ts",
		"build": "deno run --allow-all build.ts",
		"preview": "DENO_ENV=production deno run --allow-all src/server.ts"
	},
	"nodeModulesDir": "auto",
	"imports": {
		"@avalon/avalon": "npm:@avalon/avalon",
		"preact": "npm:preact@10.26.9",
		"preact/hooks": "npm:preact@10.26.9/hooks",
		"vue": "npm:vue@3.5.21",
		"svelte": "npm:svelte@^5.41.0"
	},
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "preact",
		"lib": ["dom", "dom.iterable", "deno.ns"]
	}
}
```

## Step 3: Create Your Server

Create `src/server.ts`:

```typescript
import { createServer } from '@avalon/avalon';

const server = createServer({
	srcDir: './src',
	port: 3000,
	frameworks: ['preact', 'vue', 'svelte'],
});

if (import.meta.main) {
	await server.start();
}
```

## Step 4: Create Your First Page

Create `src/pages/index.tsx`:

```tsx
import { PageProps } from '@avalon/avalon';

export default function HomePage({ url }: PageProps) {
	const currentTime = new Date().toLocaleString();

	return (
		<div
			style={{
				fontFamily: 'system-ui, sans-serif',
				maxWidth: '800px',
				margin: '0 auto',
				padding: '2rem',
			}}>
			<h1>🏔️ Welcome to Avalon!</h1>
			<p>
				Your app is running at: <code>{url.origin}</code>
			</p>
			<p>
				Server rendered at: <strong>{currentTime}</strong>
			</p>

			<div
				style={{
					background: '#f5f5f5',
					padding: '1rem',
					borderRadius: '8px',
					margin: '2rem 0',
				}}>
				<h2>🏝️ Interactive Island</h2>
				<p>This counter is hydrated on the client:</p>
				<Counter />
			</div>

			<div style={{ marginTop: '2rem' }}>
				<h2>🔗 Quick Links</h2>
				<ul>
					<li>
						<a href="/about">About Page</a>
					</li>
					<li>
						<a href="/api/hello">API Endpoint</a>
					</li>
				</ul>
			</div>
		</div>
	);
}

// This will be automatically detected as an island
function Counter() {
	return <div id="counter-island">Loading counter...</div>;
}
```

## Step 5: Create Your First Island

Create `src/islands/Counter.tsx`:

```tsx
import { useState } from 'preact/hooks';

export default function Counter() {
	const [count, setCount] = useState(0);

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: '1rem',
				padding: '1rem',
				border: '2px solid #007acc',
				borderRadius: '8px',
				background: 'white',
			}}>
			<button
				onClick={() => setCount(count - 1)}
				style={{
					padding: '0.5rem 1rem',
					fontSize: '1.2rem',
					border: 'none',
					borderRadius: '4px',
					background: '#ff6b6b',
					color: 'white',
					cursor: 'pointer',
				}}>
				-
			</button>

			<span
				style={{
					fontSize: '1.5rem',
					fontWeight: 'bold',
					minWidth: '3rem',
					textAlign: 'center',
				}}>
				{count}
			</span>

			<button
				onClick={() => setCount(count + 1)}
				style={{
					padding: '0.5rem 1rem',
					fontSize: '1.2rem',
					border: 'none',
					borderRadius: '4px',
					background: '#51cf66',
					color: 'white',
					cursor: 'pointer',
				}}>
				+
			</button>

			<div style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#666' }}>🏝️ This is a Preact island!</div>
		</div>
	);
}
```

## Step 6: Create an About Page

Create `src/pages/about.tsx`:

```tsx
import { PageProps } from '@avalon/avalon';

export default function AboutPage({ url }: PageProps) {
	return (
		<div
			style={{
				fontFamily: 'system-ui, sans-serif',
				maxWidth: '800px',
				margin: '0 auto',
				padding: '2rem',
			}}>
			<h1>About This App</h1>
			<p>This is a simple Avalon application demonstrating:</p>

			<ul>
				<li>
					<strong>Server-Side Rendering:</strong> This page is rendered on the server
				</li>
				<li>
					<strong>File-System Routing:</strong> URL matches file structure
				</li>
				<li>
					<strong>Islands Architecture:</strong> Only interactive parts load JavaScript
				</li>
				<li>
					<strong>Multi-Framework Support:</strong> Mix different frameworks as needed
				</li>
			</ul>

			<div
				style={{
					background: '#e3f2fd',
					padding: '1rem',
					borderRadius: '8px',
					margin: '2rem 0',
				}}>
				<h3>🎯 Key Benefits</h3>
				<ul>
					<li>Fast initial page loads</li>
					<li>Minimal JavaScript bundle</li>
					<li>SEO-friendly by default</li>
					<li>Progressive enhancement</li>
				</ul>
			</div>

			<p>
				<a href="/">← Back to Home</a>
			</p>
		</div>
	);
}
```

## Step 7: Create an API Endpoint

Create `src/api/hello.ts`:

```typescript
import { APIHandler } from '@avalon/avalon';

export const GET: APIHandler = async request => {
	const url = new URL(request.url);
	const name = url.searchParams.get('name') || 'World';

	return new Response(
		JSON.stringify({
			message: `Hello, ${name}!`,
			timestamp: new Date().toISOString(),
			method: request.method,
		}),
		{
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			},
		}
	);
};

export const POST: APIHandler = async request => {
	const body = await request.json();

	return new Response(
		JSON.stringify({
			message: 'Data received!',
			received: body,
			timestamp: new Date().toISOString(),
		}),
		{
			headers: {
				'Content-Type': 'application/json',
			},
		}
	);
};
```

## Step 8: Create a Build Script

Create `build.ts`:

```typescript
import { build } from '@avalon/avalon';

await build({
	srcDir: './src',
	outDir: './dist',
	frameworks: ['preact', 'vue', 'svelte'],
});

console.log('✅ Build complete!');
```

## Step 9: Start Your App

Now let's run your application:

```bash
# Install dependencies
deno install

# Start the development server
deno task dev
```

You should see:

```
🏔️ Avalon server starting...
📁 Source directory: ./src
🏝️ Frameworks: preact, vue, svelte
🔍 Discovering routes...
✅ Found 2 pages, 1 island, 1 API route
🚀 Server running at http://localhost:3000
```

## Step 10: Test Your App

Open your browser to `http://localhost:3000` and you should see:

1. **Home Page**: Server-rendered content with an interactive counter
2. **Counter Island**: Click the +/- buttons to see client-side interactivity
3. **Navigation**: Click "About Page" to see file-system routing in action
4. **API**: Visit `http://localhost:3000/api/hello?name=YourName` to test the API

## What Just Happened?

Congratulations! You've just built a full-stack application with:

### 🏝️ Islands Architecture

- The `Counter` component is automatically detected as an island
- Only the interactive parts load JavaScript
- The rest of the page is static HTML

### 📁 File-System Routing

- `src/pages/index.tsx` → `/`
- `src/pages/about.tsx` → `/about`
- `src/api/hello.ts` → `/api/hello`

### ⚡ Performance Benefits

- Fast initial page load (mostly static HTML)
- Minimal JavaScript bundle (only the counter)
- SEO-friendly (server-rendered content)

### 🎯 Developer Experience

- TypeScript support out of the box
- Hot module replacement in development
- Automatic route discovery

## Next Steps

Now that you have a working app, explore these concepts:

1. **[Project Structure](./project-structure.md)** - Understand how Avalon organizes files
2. **[First Island](./first-island.md)** - Learn more about creating interactive components
3. **[Deployment](./deployment.md)** - Get your app online

## Troubleshooting

**Counter not working?**

- Make sure the island file is in `src/islands/Counter.tsx`
- Check that the component is default exported
- Verify the browser console for JavaScript errors

**Routes not found?**

- Ensure files are in the correct `src/pages/` directory
- Check that components are default exported
- Restart the dev server after adding new files

**API not responding?**

- Verify the file is in `src/api/` directory
- Check that you're exporting named functions (GET, POST, etc.)
- Test the endpoint directly in your browser or with curl

Ready to dive deeper? Let's explore the [project structure](./project-structure.md) next!
