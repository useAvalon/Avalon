# Migration Guide: Manual Routes to File-System Routing

This guide helps you migrate from manual route definitions to Avalon's file-system routing.

## Overview

File-system routing eliminates the need for manual route configuration by automatically generating routes based on your file structure. This migration guide covers common scenarios and provides step-by-step instructions.

## Before You Start

1. **Backup your project** - Always create a backup before major changes
2. **Review your current routes** - Document your existing route structure
3. **Plan your file organization** - Decide how to organize files in `src/pages/`

## Migration Steps

### Step 1: Enable File-System Routing

First, update your server configuration to enable file-system routing:

```tsx
// src/render/server.ts
import { FileSystemRouter } from '@avalon/routing';

// Add file-system router
const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	apiDir: './src/api',
	enableHotReload: process.env.NODE_ENV === 'development',
});

// Update server configuration
const server = createServer({
	fileSystemRouter,
	// Keep existing manual routes for gradual migration
	routes: existingRoutes,
	// other options...
});
```

### Step 2: Create Pages Directory Structure

Create the `src/pages/` directory and organize your routes:

**Before (manual routes):**

```tsx
// Manual route definitions
const routes = [
	{ path: '/', component: HomePage },
	{ path: '/about', component: AboutPage },
	{ path: '/blog', component: BlogIndex },
	{ path: '/blog/:slug', component: BlogPost },
	{ path: '/users/:id', component: UserProfile },
];
```

**After (file-system routing):**

```
src/pages/
├── index.tsx           # / route
├── about.tsx           # /about route
├── blog/
│   ├── index.tsx       # /blog route
│   └── [slug].tsx      # /blog/:slug route
└── users/
    └── [id].tsx        # /users/:id route
```

### Step 3: Move Components to Pages Directory

Move your route components to the appropriate files in `src/pages/`:

**Before:**

```tsx
// src/components/HomePage.tsx
export default function HomePage() {
	return <h1>Welcome</h1>;
}
```

**After:**

```tsx
// src/pages/index.tsx
export default function HomePage() {
	return <h1>Welcome</h1>;
}
```

### Step 4: Convert Dynamic Routes

Update dynamic route components to use the new parameter structure:

**Before:**

```tsx
// Manual route component
interface Props {
	slug: string; // From route params
}

export default function BlogPost({ slug }: Props) {
	return <h1>Post: {slug}</h1>;
}
```

**After:**

```tsx
// src/pages/blog/[slug].tsx
interface Props {
	params: { slug: string };
}

export default function BlogPost({ params }: Props) {
	return <h1>Post: {params.slug}</h1>;
}
```

### Step 5: Migrate Layouts

Convert your layout components to the file-system routing convention:

**Before (manual layout):**

```tsx
// src/layouts/BlogLayout.tsx
export default function BlogLayout({ children }) {
	return (
		<div className="blog-layout">
			<nav>Blog Navigation</nav>
			{children}
		</div>
	);
}

// Applied manually in route config
const routes = [
	{
		path: '/blog/*',
		component: BlogPost,
		layout: BlogLayout,
	},
];
```

**After (file-system layout):**

```tsx
// src/pages/blog/_layout.tsx
interface Props {
	children: React.ReactNode;
}

export default function BlogLayout({ children }: Props) {
	return (
		<div className="blog-layout">
			<nav>Blog Navigation</nav>
			{children}
		</div>
	);
}
```

### Step 6: Migrate Middleware

Convert route-specific middleware to file-system middleware:

**Before:**

```tsx
// Manual middleware application
const routes = [
	{
		path: '/admin/*',
		middleware: [authMiddleware, adminMiddleware],
		component: AdminPage,
	},
];
```

**After:**

```tsx
// src/pages/admin/_middleware.ts
import { MiddlewareContext, MiddlewareNext } from '@avalon/types';

export default async function adminMiddleware(context: MiddlewareContext, next: MiddlewareNext) {
	// Auth check
	const isAuthenticated = await checkAuth(context);
	if (!isAuthenticated) {
		return new Response('Unauthorized', { status: 401 });
	}

	// Admin check
	const isAdmin = await checkAdmin(context);
	if (!isAdmin) {
		return new Response('Forbidden', { status: 403 });
	}

	return next();
}
```

### Step 7: Migrate API Routes

Move API endpoints to the `src/api/` directory:

**Before:**

```tsx
// Manual API routes
const apiRoutes = [
	{ path: '/api/users', handler: getUsersHandler },
	{ path: '/api/users/:id', handler: getUserHandler },
	{ path: '/api/posts', handler: getPostsHandler },
];
```

**After:**

```
src/api/
├── users/
│   ├── index.ts        # /api/users
│   └── [id].ts         # /api/users/:id
└── posts/
    └── index.ts        # /api/posts
```

```tsx
// src/api/users/index.ts
export async function GET() {
	const users = await getUsers();
	return Response.json(users);
}

export async function POST(context) {
	const data = await context.request.json();
	const user = await createUser(data);
	return Response.json(user, { status: 201 });
}
```

### Step 8: Migrate Metadata

Convert manual meta tag management to file-system metadata:

**Before:**

```tsx
// Manual meta tags
const routes = [
	{
		path: '/blog/:slug',
		component: BlogPost,
		meta: {
			title: 'Blog Post',
			description: 'Read our latest blog post',
		},
	},
];
```

**After:**

```tsx
// src/pages/blog/_metadata.ts
export const metadata = {
	title: 'Blog - My Site',
	description: 'Read our latest blog posts',
	keywords: ['blog', 'articles', 'news'],
};

// src/pages/blog/[slug].tsx
export async function generateMetadata({ params }) {
	const post = await getPost(params.slug);

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
```

## Common Migration Patterns

### Pattern 1: Nested Routes with Shared Layout

**Before:**

```tsx
const routes = [
	{ path: '/dashboard', component: Dashboard, layout: DashboardLayout },
	{ path: '/dashboard/settings', component: Settings, layout: DashboardLayout },
	{ path: '/dashboard/profile', component: Profile, layout: DashboardLayout },
];
```

**After:**

```
src/pages/
└── dashboard/
    ├── _layout.tsx     # Shared layout
    ├── index.tsx       # /dashboard
    ├── settings.tsx    # /dashboard/settings
    └── profile.tsx     # /dashboard/profile
```

### Pattern 2: Route Groups for Organization

**Before:**

```tsx
const routes = [
	// Marketing pages
	{ path: '/', component: Home, layout: MarketingLayout },
	{ path: '/about', component: About, layout: MarketingLayout },
	{ path: '/contact', component: Contact, layout: MarketingLayout },

	// App pages
	{ path: '/app', component: AppHome, layout: AppLayout },
	{ path: '/app/dashboard', component: Dashboard, layout: AppLayout },
];
```

**After:**

```
src/pages/
├── (marketing)/
│   ├── _layout.tsx     # Marketing layout
│   ├── index.tsx       # /
│   ├── about.tsx       # /about
│   └── contact.tsx     # /contact
└── (app)/
    ├── _layout.tsx     # App layout
    ├── index.tsx       # /app
    └── dashboard.tsx   # /app/dashboard
```

### Pattern 3: Complex Dynamic Routes

**Before:**

```tsx
const routes = [
	{ path: '/users/:userId/posts/:postId', component: UserPost },
	{ path: '/categories/:category/products/:productId', component: Product },
];
```

**After:**

```
src/pages/
├── users/
│   └── [userId]/
│       └── posts/
│           └── [postId].tsx
└── categories/
    └── [category]/
        └── products/
            └── [productId].tsx
```

## Gradual Migration Strategy

You can migrate gradually by keeping both systems running:

### Phase 1: Set up file-system routing alongside manual routes

```tsx
// src/render/server.ts
const server = createServer({
	// New file-system routes
	fileSystemRouter,

	// Keep existing manual routes
	routes: existingRoutes,

	// File-system routes take precedence
	routePriority: 'filesystem-first',
});
```

### Phase 2: Migrate routes one section at a time

1. Start with simple static routes
2. Move to dynamic routes
3. Migrate complex nested routes
4. Finally, remove manual route definitions

### Phase 3: Clean up

1. Remove unused manual route files
2. Update imports and references
3. Remove manual route configuration
4. Test thoroughly

## Testing Your Migration

### 1. Route Functionality

Test that all routes work as expected:

```bash
# Test static routes
curl http://localhost:3000/
curl http://localhost:3000/about

# Test dynamic routes
curl http://localhost:3000/users/123
curl http://localhost:3000/blog/my-post

# Test API routes
curl http://localhost:3000/api/users
curl -X POST http://localhost:3000/api/users -d '{"name":"John"}'
```

### 2. Layout Inheritance

Verify that layouts are applied correctly:

- Check that root layouts wrap all pages
- Verify nested layouts work properly
- Test route group layouts

### 3. Middleware Execution

Confirm middleware runs in the correct order:

- Global middleware runs first
- Section-specific middleware runs next
- Route-specific middleware runs last

### 4. Metadata Generation

Check that metadata is generated correctly:

- View page source to verify meta tags
- Test dynamic metadata generation
- Verify metadata inheritance

## Troubleshooting Migration Issues

### Issue: Routes not found after migration

**Cause:** File naming or directory structure doesn't match expected patterns.

**Solution:**

1. Check file naming conventions (use `.tsx` for pages)
2. Verify directory structure matches route paths
3. Ensure `index.tsx` files for directory routes

### Issue: Dynamic routes not working

**Cause:** Incorrect bracket notation or parameter handling.

**Solution:**

1. Use `[param].tsx` for single dynamic segments
2. Use `[...param].tsx` for catch-all routes
3. Update component props to use `params` object

### Issue: Layouts not applying

**Cause:** Layout files not named correctly or in wrong location.

**Solution:**

1. Use `_layout.tsx` naming convention
2. Place layouts in correct directory hierarchy
3. Ensure layouts export default component

### Issue: Middleware not executing

**Cause:** Middleware files not named correctly or missing exports.

**Solution:**

1. Use `_middleware.ts` naming convention
2. Export default async function
3. Check middleware function signature

### Issue: Metadata not showing

**Cause:** Metadata files not found or incorrect export format.

**Solution:**

1. Use `_metadata.ts` naming convention
2. Export `metadata` object or `generateMetadata` function
3. Check metadata object structure

## Performance Considerations

### Route Discovery Caching

File-system routing caches discovered routes for performance:

```tsx
const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	// Enable caching in production
	enableCaching: process.env.NODE_ENV === 'production',
	// Cache TTL in milliseconds
	cacheTTL: 60000,
});
```

### Bundle Splitting

File-system routing automatically enables code splitting by route:

- Each page becomes a separate chunk
- Shared components are automatically optimized
- Lazy loading is enabled by default

## Next Steps

After completing your migration:

1. **Remove manual route files** - Clean up unused route configuration
2. **Update documentation** - Document your new file structure
3. **Train your team** - Ensure everyone understands the new conventions
4. **Monitor performance** - Check that the migration didn't impact performance
5. **Consider advanced features** - Explore route groups, metadata inheritance, etc.

## Getting Help

If you encounter issues during migration:

1. Check the [Troubleshooting Guide](./file-system-routing-troubleshooting.md)
2. Review the [main documentation](./file-system-routing.md)
3. Look at [examples](../examples/) for reference implementations
4. Search existing issues or create a new one in the project repository

Remember: Migration can be done gradually. Start with simple routes and work your way up to more complex patterns.
