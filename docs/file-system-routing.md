# File-System Routing in Avalon

Avalon's file-system routing automatically generates routes based on your file structure in the `src/pages/` directory, similar to Fresh and Next.js. This zero-configuration approach eliminates the need for manual route definitions while providing powerful features like dynamic routes, layouts, middleware, and metadata management.

## Quick Start

1. Create a page file in `src/pages/`:

```tsx
// src/pages/about.tsx
export default function About() {
	return <h1>About Us</h1>;
}
```

2. The route `/about` is automatically available!

## File-System Conventions

### Basic Routes

Files in `src/pages/` automatically become routes:

```
src/pages/
├── index.tsx        → /
├── about.tsx        → /about
├── contact.tsx      → /contact
└── blog/
    ├── index.tsx    → /blog
    └── post.tsx     → /blog/post
```

### Dynamic Routes

Use square brackets `[param]` for dynamic segments:

```
src/pages/
├── users/
│   ├── [id].tsx           → /users/:id
│   └── [id]/
│       └── profile.tsx    → /users/:id/profile
└── blog/
    └── [slug].tsx         → /blog/:slug
```

**Example dynamic route:**

```tsx
// src/pages/users/[id].tsx
interface Props {
	params: { id: string };
}

export default function UserProfile({ params }: Props) {
	return <h1>User ID: {params.id}</h1>;
}
```

### Catch-All Routes

Use `[...param]` for catch-all routes:

```
src/pages/
└── docs/
    └── [...path].tsx      → /docs/* (matches any path under /docs)
```

**Example catch-all route:**

```tsx
// src/pages/docs/[...path].tsx
interface Props {
	params: { path: string[] };
}

export default function DocsPage({ params }: Props) {
	const fullPath = params.path.join('/');
	return <h1>Docs: {fullPath}</h1>;
}
```

### Optional Catch-All Routes

Use `[[...param]]` for optional catch-all routes:

```
src/pages/
└── shop/
    └── [[...category]].tsx  → /shop and /shop/*
```

## Special Files

### Layouts (`_layout.tsx`)

Create shared layouts for groups of routes:

```tsx
// src/pages/_layout.tsx (root layout)
import { ReactNode } from 'react';

interface Props {
	children: ReactNode;
}

export default function RootLayout({ children }: Props) {
	return (
		<html>
			<head>
				<title>My App</title>
			</head>
			<body>
				<nav>
					<a href="/">Home</a>
					<a href="/about">About</a>
				</nav>
				<main>{children}</main>
			</body>
		</html>
	);
}
```

**Nested layouts:**

```tsx
// src/pages/blog/_layout.tsx
interface Props {
	children: ReactNode;
}

export default function BlogLayout({ children }: Props) {
	return (
		<div className="blog-container">
			<aside>Blog Sidebar</aside>
			<article>{children}</article>
		</div>
	);
}
```

### Middleware (`_middleware.ts`)

Add middleware for authentication, logging, etc.:

```tsx
// src/pages/_middleware.ts (global middleware)
import { MiddlewareContext, MiddlewareNext } from '@avalon/types';

export default async function middleware(context: MiddlewareContext, next: MiddlewareNext) {
	console.log(`Request to: ${context.url.pathname}`);

	// Add custom headers
	context.response.headers.set('X-Custom-Header', 'Avalon');

	return next();
}
```

**Route-specific middleware:**

```tsx
// src/pages/admin/_middleware.ts
export default async function adminMiddleware(context: MiddlewareContext, next: MiddlewareNext) {
	const token = context.request.headers.get('Authorization');

	if (!token) {
		return new Response('Unauthorized', { status: 401 });
	}

	return next();
}
```

### Metadata (`_metadata.ts`)

Define SEO and meta information:

```tsx
// src/pages/_metadata.ts (global metadata)
import { Metadata } from '@avalon/types';

export const metadata: Metadata = {
	title: 'My Avalon App',
	description: 'A modern web application built with Avalon',
	keywords: ['avalon', 'web', 'framework'],
	openGraph: {
		title: 'My Avalon App',
		description: 'A modern web application',
		type: 'website',
	},
};
```

**Dynamic metadata:**

```tsx
// src/pages/blog/[slug].tsx
import { Metadata, RouteParams } from '@avalon/types';

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
	const post = await fetchPost(params.slug);

	return {
		title: post.title,
		description: post.excerpt,
		openGraph: {
			title: post.title,
			description: post.excerpt,
			image: post.coverImage,
		},
	};
}

export default function BlogPost({ params }: { params: RouteParams }) {
	// Component implementation
}
```

### Error Pages

Create custom error and 404 pages:

```tsx
// src/pages/_404.tsx
export default function NotFound() {
	return (
		<div>
			<h1>404 - Page Not Found</h1>
			<p>The page you're looking for doesn't exist.</p>
			<a href="/">Go Home</a>
		</div>
	);
}
```

```tsx
// src/pages/_error.tsx
interface Props {
	error: Error;
	reset: () => void;
}

export default function ErrorPage({ error, reset }: Props) {
	return (
		<div>
			<h1>Something went wrong!</h1>
			<p>{error.message}</p>
			<button onClick={reset}>Try again</button>
		</div>
	);
}
```

## Route Groups

Use parentheses `()` to organize routes without affecting URLs:

```
src/pages/
├── (auth)/
│   ├── _layout.tsx      # Auth layout
│   ├── login.tsx        → /login (not /auth/login)
│   └── register.tsx     → /register
└── (dashboard)/
    ├── _layout.tsx      # Dashboard layout
    ├── settings.tsx     → /settings
    └── profile.tsx      → /profile
```

Route groups are perfect for:

- Shared layouts without URL nesting
- Organizing related routes
- Different middleware for route groups

## Private Folders

Use underscore prefix `_` to create private folders that don't generate routes:

```
src/pages/
├── _components/         # Not a route
│   ├── Header.tsx
│   └── Footer.tsx
├── _utils/             # Not a route
│   └── helpers.ts
└── about.tsx           → /about
```

## API Routes

Create API endpoints in `src/api/`:

```
src/api/
├── users.ts            → /api/users
├── auth/
│   └── login.ts        → /api/auth/login
└── posts/
    └── [id].ts         → /api/posts/:id
```

**Example API route:**

```tsx
// src/api/users/[id].ts
import { RouteContext } from '@avalon/types';

export async function GET(context: RouteContext) {
	const { id } = context.params;
	const user = await getUserById(id);

	return Response.json(user);
}

export async function PUT(context: RouteContext) {
	const { id } = context.params;
	const data = await context.request.json();

	const updatedUser = await updateUser(id, data);
	return Response.json(updatedUser);
}
```

## Advanced Features

### Route Priority

Routes are matched in order of specificity:

1. Static routes (`/about`)
2. Dynamic routes (`/users/:id`)
3. Catch-all routes (`/docs/*`)
4. 404 fallback

### Metadata Inheritance

Metadata is inherited and merged hierarchically:

```
src/pages/
├── _metadata.ts         # Global metadata
└── blog/
    ├── _metadata.ts     # Blog-specific metadata (merged with global)
    └── [slug].tsx       # Can override with generateMetadata()
```

### TypeScript Support

Avalon provides full TypeScript support with type-safe route parameters:

```tsx
import { RouteParams, PageProps } from '@avalon/types';

interface UserParams extends RouteParams {
	id: string;
}

interface Props extends PageProps {
	params: UserParams;
}

export default function UserPage({ params }: Props) {
	// params.id is properly typed as string
	return <h1>User: {params.id}</h1>;
}
```

## Configuration

Enable file-system routing in your server configuration:

```tsx
// src/render/server.ts
import { createServer } from '@avalon/server';
import { FileSystemRouter } from '@avalon/routing';

const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	apiDir: './src/api',
	enableHotReload: true, // Development only
});

const server = createServer({
	fileSystemRouter,
	// other options...
});
```

## Best Practices

### 1. Organize with Route Groups

```
src/pages/
├── (marketing)/
│   ├── _layout.tsx      # Marketing layout
│   ├── index.tsx        → /
│   ├── about.tsx        → /about
│   └── contact.tsx      → /contact
└── (app)/
    ├── _layout.tsx      # App layout
    ├── dashboard.tsx    → /dashboard
    └── settings.tsx     → /settings
```

### 2. Use Private Folders for Organization

```
src/pages/
├── _components/         # Shared components
├── _hooks/             # Custom hooks
├── _utils/             # Utility functions
└── _types/             # Type definitions
```

### 3. Leverage Metadata Hierarchy

```
src/pages/
├── _metadata.ts         # Site-wide defaults
├── blog/
│   ├── _metadata.ts     # Blog section defaults
│   └── [slug].tsx       # Post-specific metadata
```

### 4. Structure API Routes Logically

```
src/api/
├── auth/
│   ├── login.ts
│   ├── logout.ts
│   └── refresh.ts
├── users/
│   ├── index.ts         # GET /api/users
│   ├── [id].ts          # GET/PUT/DELETE /api/users/:id
│   └── [id]/
│       └── posts.ts     # GET /api/users/:id/posts
```

## Migration from Manual Routes

See the [Migration Guide](./file-system-routing-migration.md) for detailed instructions on migrating from manual route definitions to file-system routing.

## Troubleshooting

See the [Troubleshooting Guide](./file-system-routing-troubleshooting.md) for common issues and solutions.

## Examples

Check out the [examples directory](../examples/) for complete working examples of various routing patterns.
