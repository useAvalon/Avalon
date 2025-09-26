# Project Structure

Understanding how Avalon organizes your application files is key to building maintainable and scalable applications. This guide explains the file structure conventions and how they map to your application's functionality.

## Overview

Avalon follows a **convention-over-configuration** approach, where the file structure directly determines your application's behavior:

```
my-avalon-app/
├── src/                    # Source code directory
│   ├── pages/             # 📄 App pages (file-system routing)
│   ├── islands/           # 🏝️ Interactive components
│   ├── layouts/           # 🎨 Layout components
│   ├── api/              # 🔌 API endpoints
│   ├── middleware/       # 🛡️ Middleware functions
│   └── server.ts         # 🚀 Server entry point
├── public/               # 📁 Static assets
├── dist/                 # 📦 Build output (generated)
├── deno.json            # ⚙️ Deno configuration
├── vite.config.ts       # ⚡ Vite configuration
└── build.ts             # 🔨 Build script
```

## Core Directories

### 📄 Pages Directory (`src/pages/`)

The pages directory defines your application's routes using **file-system routing**. Each file becomes a route in your application.

```
src/pages/
├── index.tsx              # → / (home page)
├── about.tsx              # → /about
├── contact.tsx            # → /contact
├── blog/                  # Blog section
│   ├── index.tsx          # → /blog
│   ├── [slug].tsx         # → /blog/my-post (dynamic route)
│   └── categories/
│       ├── index.tsx      # → /blog/categories
│       └── [category].tsx # → /blog/categories/tech
├── products/
│   ├── index.tsx          # → /products
│   ├── [id].tsx          # → /products/123
│   └── [id]/
│       └── reviews.tsx    # → /products/123/reviews
└── admin/
    ├── index.tsx          # → /admin
    ├── users.tsx          # → /admin/users
    └── settings.tsx       # → /admin/settings
```

**Key Conventions:**

- `index.tsx` files map to the directory path
- `[param].tsx` creates dynamic routes with parameters
- Nested directories create nested URL paths
- All page components must be **default exports**

**Example Page Component:**

```tsx
// src/pages/blog/[slug].tsx
import { PageProps } from '@avalon/avalon';

interface BlogPageProps extends PageProps {
	params: { slug: string };
}

export default function BlogPost({ params, url }: BlogPageProps) {
	return (
		<article>
			<h1>Blog Post: {params.slug}</h1>
			<p>URL: {url.pathname}</p>
		</article>
	);
}
```

### 🏝️ Islands Directory (`src/islands/`)

Islands are **interactive components** that run on the client. They're automatically detected and bundled separately for optimal performance.

```
src/islands/
├── Counter.tsx            # Preact counter component
├── TodoList.vue           # Vue todo list
├── Chart.svelte          # Svelte chart component
├── SearchBox.solid.tsx    # Solid search component
├── UserProfile.tsx        # User profile widget
└── components/           # Shared island components
    ├── Button.tsx
    └── Modal.tsx
```

**Key Conventions:**

- Must be **default exports**
- Can use any supported framework (Preact, Vue, Svelte, Solid)
- Framework is detected by file extension or naming convention
- Automatically code-split and lazy-loaded

**Example Island Component:**

```tsx
// src/islands/SearchBox.tsx
import { useState } from 'preact/hooks';

export default function SearchBox() {
	const [query, setQuery] = useState('');
	const [results, setResults] = useState([]);

	const handleSearch = async () => {
		const response = await fetch(`/api/search?q=${query}`);
		const data = await response.json();
		setResults(data.results);
	};

	return (
		<div className="search-box">
			<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." />
			<button onClick={handleSearch}>Search</button>
			<ul>
				{results.map(result => (
					<li key={result.id}>{result.title}</li>
				))}
			</ul>
		</div>
	);
}
```

### 🎨 Layouts Directory (`src/layouts/`)

Layouts provide shared structure and styling for your pages. They support **nested layouts** and **error boundaries**.

```
src/layouts/
├── _layout.tsx            # Root layout (applies to all pages)
├── blog/
│   └── _layout.tsx        # Blog layout (applies to /blog/*)
├── admin/
│   └── _layout.tsx        # Admin layout (applies to /admin/*)
└── components/
    ├── Header.tsx
    ├── Footer.tsx
    └── Sidebar.tsx
```

**Key Conventions:**

- Layout files must be named `_layout.tsx`
- Layouts are applied hierarchically based on directory structure
- Must accept `children` prop
- Can load data and handle errors

**Example Layout Component:**

```tsx
// src/layouts/_layout.tsx
import { LayoutProps } from '@avalon/avalon';

export default function RootLayout({ children, url }: LayoutProps) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>My Avalon App</title>
			</head>
			<body>
				<header>
					<nav>
						<a href="/">Home</a>
						<a href="/blog">Blog</a>
						<a href="/about">About</a>
					</nav>
				</header>

				<main>{children}</main>

				<footer>
					<p>&copy; 2024 My Avalon App</p>
				</footer>
			</body>
		</html>
	);
}
```

### 🔌 API Directory (`src/api/`)

API routes handle server-side logic and data operations. They support **REST methods** and **middleware**.

```
src/api/
├── _middleware.ts         # API middleware (applies to all API routes)
├── hello.ts              # → GET/POST /api/hello
├── time.ts               # → GET /api/time
├── users/
│   ├── _middleware.ts    # User API middleware
│   ├── index.ts          # → GET/POST /api/users
│   ├── [id].ts          # → GET/PUT/DELETE /api/users/123
│   └── [id]/
│       └── posts.ts      # → GET /api/users/123/posts
└── auth/
    ├── login.ts          # → POST /api/auth/login
    ├── logout.ts         # → POST /api/auth/logout
    └── refresh.ts        # → POST /api/auth/refresh
```

**Key Conventions:**

- Export named functions for HTTP methods (`GET`, `POST`, `PUT`, `DELETE`)
- Support dynamic routes with `[param]` syntax
- Can include middleware at any level
- Return `Response` objects

**Example API Route:**

```typescript
// src/api/users/[id].ts
import { APIHandler } from '@avalon/avalon';

export const GET: APIHandler = async (request, { params }) => {
	const userId = params.id;

	// Fetch user data
	const user = await getUserById(userId);

	if (!user) {
		return new Response('User not found', { status: 404 });
	}

	return Response.json(user);
};

export const PUT: APIHandler = async (request, { params }) => {
	const userId = params.id;
	const updates = await request.json();

	const updatedUser = await updateUser(userId, updates);

	return Response.json(updatedUser);
};
```

### 🛡️ Middleware Directory (`src/middleware/`)

Middleware functions run before pages and API routes, enabling **authentication**, **logging**, **CORS**, and more.

```
src/middleware/
├── _middleware.ts         # Global middleware (all routes)
└── auth.ts               # Reusable auth middleware
```

**Example Middleware:**

```typescript
// src/middleware/_middleware.ts
import { MiddlewareHandler } from '@avalon/avalon';

export const middleware: MiddlewareHandler = async (request, context, next) => {
	// Log all requests
	console.log(`${request.method} ${request.url}`);

	// Add CORS headers
	const response = await next();
	response.headers.set('Access-Control-Allow-Origin', '*');

	return response;
};
```

## Configuration Files

### ⚙️ Deno Configuration (`deno.json`)

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
		"$components/": "./src/components/",
		"$pages/": "./src/pages/",
		"$layouts/": "./src/layouts/",
		"$islands/": "./src/islands/",
		"$api/": "./src/api/"
	},
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "preact",
		"lib": ["dom", "dom.iterable", "deno.ns"]
	}
}
```

### ⚡ Vite Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import { avalon } from '@avalon/avalon/vite';

export default defineConfig({
	plugins: [
		avalon({
			srcDir: './src',
			frameworks: ['preact', 'vue', 'svelte', 'solid'],
		}),
	],
});
```

## File Naming Conventions

### Framework Detection

Avalon automatically detects which framework to use based on file extensions:

```
islands/
├── Counter.tsx           # Preact (default for .tsx)
├── TodoList.vue          # Vue
├── Chart.svelte         # Svelte
├── SearchBox.solid.tsx   # Solid (explicit naming)
└── UserProfile.jsx       # Preact (default for .jsx)
```

### Special Files

- `_layout.tsx` - Layout components
- `_middleware.ts` - Middleware functions
- `[param].tsx` - Dynamic route parameters
- `index.tsx` - Directory index routes

## Import Aliases

Avalon provides convenient import aliases for cleaner imports:

```typescript
// Instead of relative imports
import Header from '../../../components/Header.tsx';
import { api } from '../../../utils/api.ts';

// Use clean aliases
import Header from '$components/Header.tsx';
import { api } from '$utils/api.ts';
```

**Available Aliases:**

- `$components/` → `./src/components/`
- `$pages/` → `./src/pages/`
- `$layouts/` → `./src/layouts/`
- `$islands/` → `./src/islands/`
- `$api/` → `./src/api/`
- `$utils/` → `./src/utils/`
- `$types/` → `./src/types/`

## Best Practices

### 📁 Organization Tips

1. **Group related functionality** in directories
2. **Use descriptive names** for files and directories
3. **Keep islands small** and focused on single responsibilities
4. **Separate concerns** between pages, islands, and API routes
5. **Use layouts** to avoid code duplication

### 🎯 Performance Considerations

1. **Minimize island size** - Only make components interactive when needed
2. **Use static pages** for content that doesn't need interactivity
3. **Leverage file-system routing** for automatic code splitting
4. **Group related API routes** in directories with shared middleware

### 🔧 Development Workflow

1. **Start with pages** - Define your routes first
2. **Add layouts** - Create shared structure
3. **Identify islands** - Make specific components interactive
4. **Build APIs** - Add server-side functionality
5. **Add middleware** - Handle cross-cutting concerns

## Example: E-commerce App Structure

Here's how you might structure a complete e-commerce application:

```
src/
├── pages/
│   ├── index.tsx                    # Homepage
│   ├── products/
│   │   ├── index.tsx               # Product listing
│   │   ├── [id].tsx                # Product detail
│   │   └── categories/
│   │       └── [category].tsx      # Category pages
│   ├── cart.tsx                    # Shopping cart
│   ├── checkout/
│   │   ├── index.tsx               # Checkout form
│   │   └── success.tsx             # Order confirmation
│   └── account/
│       ├── index.tsx               # Account dashboard
│       ├── orders.tsx              # Order history
│       └── profile.tsx             # Profile settings
├── islands/
│   ├── ProductCard.tsx             # Product preview
│   ├── AddToCartButton.tsx         # Add to cart functionality
│   ├── CartWidget.tsx              # Cart icon with count
│   ├── SearchBox.tsx               # Product search
│   └── CheckoutForm.tsx            # Checkout process
├── layouts/
│   ├── _layout.tsx                 # Site-wide layout
│   ├── account/
│   │   └── _layout.tsx             # Account section layout
│   └── checkout/
│       └── _layout.tsx             # Checkout layout
├── api/
│   ├── products/
│   │   ├── index.ts                # Product CRUD
│   │   ├── [id].ts                 # Single product
│   │   └── search.ts               # Product search
│   ├── cart/
│   │   ├── index.ts                # Cart operations
│   │   └── checkout.ts             # Checkout process
│   └── auth/
│       ├── login.ts                # User authentication
│       └── register.ts             # User registration
└── middleware/
    ├── _middleware.ts              # Global middleware
    └── auth.ts                     # Authentication middleware
```

## Next Steps

Now that you understand the project structure, let's learn how to [create your first island](./first-island.md) and make your pages interactive!
