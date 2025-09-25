# File-System Routing Troubleshooting Guide

This guide helps you diagnose and fix common issues with Avalon's file-system routing.

## Common Issues

### 1. Routes Not Found (404 Errors)

#### Symptoms

- Pages return 404 errors
- Routes that should exist are not accessible
- File-system routing seems not to be working

#### Possible Causes & Solutions

**Cause: File-system routing not enabled**

```tsx
// ❌ Missing file-system router configuration
const server = createServer({
	// No fileSystemRouter configured
});

// ✅ Correct configuration
import { FileSystemRouter } from '@avalon/routing';

const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	apiDir: './src/api',
});

const server = createServer({
	fileSystemRouter,
});
```

**Cause: Incorrect file naming**

```
❌ Wrong file extensions
src/pages/
├── about.js          # Should be .tsx
├── contact.ts        # Should be .tsx
└── blog.jsx          # Should be .tsx

✅ Correct file extensions
src/pages/
├── about.tsx
├── contact.tsx
└── blog.tsx
```

**Cause: Missing default export**

```tsx
// ❌ No default export
export function AboutPage() {
	return <h1>About</h1>;
}

// ✅ Default export required
export default function AboutPage() {
	return <h1>About</h1>;
}
```

**Cause: Incorrect directory structure**

```
❌ Wrong structure
src/
└── components/       # Should be 'pages'
    └── about.tsx

✅ Correct structure
src/
└── pages/
    └── about.tsx
```

#### Debugging Steps

1. **Check server logs** for route discovery messages
2. **Verify file-system router configuration**
3. **Confirm file naming conventions**
4. **Test with a simple page first**

```tsx
// Create a simple test page
// src/pages/test.tsx
export default function TestPage() {
	return <h1>Test Page Works!</h1>;
}
```

### 2. Dynamic Routes Not Working

#### Symptoms

- Dynamic routes return 404
- Route parameters are undefined
- Catch-all routes not matching

#### Possible Causes & Solutions

**Cause: Incorrect bracket notation**

```
❌ Wrong bracket usage
src/pages/
├── {id}.tsx          # Should use square brackets
├── (slug).tsx        # Should use square brackets
└── <param>.tsx       # Should use square brackets

✅ Correct bracket notation
src/pages/
├── [id].tsx
├── [slug].tsx
└── [param].tsx
```

**Cause: Incorrect parameter access**

```tsx
// ❌ Wrong parameter access
export default function UserPage({ id }) {
	return <h1>User: {id}</h1>;
}

// ✅ Correct parameter access
interface Props {
	params: { id: string };
}

export default function UserPage({ params }: Props) {
	return <h1>User: {params.id}</h1>;
}
```

**Cause: Catch-all route syntax errors**

```
❌ Wrong catch-all syntax
src/pages/
├── [...].tsx         # Missing parameter name
├── [..rest].tsx      # Missing dot
└── [...rest.tsx      # Missing closing bracket

✅ Correct catch-all syntax
src/pages/
└── [...rest].tsx
```

#### Debugging Steps

1. **Check route parameter names** match file names
2. **Verify component props structure**
3. **Test with simple dynamic route first**
4. **Check server logs for route pattern generation**

### 3. Layouts Not Applying

#### Symptoms

- Layout components not rendering
- Pages render without expected wrapper
- Nested layouts not working

#### Possible Causes & Solutions

**Cause: Incorrect layout file naming**

```
❌ Wrong layout naming
src/pages/
├── layout.tsx        # Should start with underscore
├── Layout.tsx        # Should start with underscore
└── _Layout.tsx       # Should be lowercase

✅ Correct layout naming
src/pages/
└── _layout.tsx
```

**Cause: Missing children prop**

```tsx
// ❌ Layout without children
export default function Layout() {
	return (
		<div>
			<nav>Navigation</nav>
			{/* Missing children */}
		</div>
	);
}

// ✅ Layout with children
interface Props {
	children: React.ReactNode;
}

export default function Layout({ children }: Props) {
	return (
		<div>
			<nav>Navigation</nav>
			<main>{children}</main>
		</div>
	);
}
```

**Cause: Layout in wrong directory**

```
❌ Layout in wrong location
src/pages/
├── blog/
│   └── post.tsx
└── _layout.tsx       # This won't apply to blog routes

✅ Layout in correct location
src/pages/
├── blog/
│   ├── _layout.tsx   # Applies to blog routes
│   └── post.tsx
└── _layout.tsx       # Root layout
```

#### Debugging Steps

1. **Check layout file naming and location**
2. **Verify children prop is used**
3. **Test layout hierarchy step by step**
4. **Check for layout discovery in server logs**

### 4. Middleware Not Executing

#### Symptoms

- Middleware functions not running
- Expected headers/modifications not applied
- Authentication not working

#### Possible Causes & Solutions

**Cause: Incorrect middleware file naming**

```
❌ Wrong middleware naming
src/pages/
├── middleware.ts     # Should start with underscore
├── _Middleware.ts    # Should be lowercase
└── _middle.ts        # Should be full name

✅ Correct middleware naming
src/pages/
└── _middleware.ts
```

**Cause: Incorrect middleware function signature**

```tsx
// ❌ Wrong function signature
export default function middleware(req, res) {
	// Wrong parameters
}

// ✅ Correct function signature
import { MiddlewareContext, MiddlewareNext } from '@avalon/types';

export default async function middleware(context: MiddlewareContext, next: MiddlewareNext) {
	// Correct implementation
	return next();
}
```

**Cause: Middleware not calling next()**

```tsx
// ❌ Not calling next()
export default async function middleware(context, next) {
	console.log('Middleware executed');
	// Missing next() call - request will hang
}

// ✅ Calling next()
export default async function middleware(context, next) {
	console.log('Middleware executed');
	return next(); // Important!
}
```

#### Debugging Steps

1. **Add console.log to middleware** to verify execution
2. **Check middleware file naming**
3. **Verify function signature**
4. **Ensure next() is called**

### 5. Metadata Not Showing

#### Symptoms

- Meta tags not appearing in HTML
- SEO information missing
- Open Graph tags not working

#### Possible Causes & Solutions

**Cause: Incorrect metadata file naming**

```
❌ Wrong metadata naming
src/pages/
├── metadata.ts       # Should start with underscore
├── _meta.ts          # Should be full name
└── _Metadata.ts      # Should be lowercase

✅ Correct metadata naming
src/pages/
└── _metadata.ts
```

**Cause: Incorrect metadata export**

```tsx
// ❌ Wrong export format
export default {
	title: 'My Page',
};

// ✅ Correct export format
export const metadata = {
	title: 'My Page',
	description: 'Page description',
};
```

**Cause: Invalid metadata structure**

```tsx
// ❌ Invalid metadata structure
export const metadata = {
  title: 123,           # Should be string
  keywords: 'keyword',  # Should be array
};

// ✅ Valid metadata structure
export const metadata = {
  title: 'My Page',
  description: 'Page description',
  keywords: ['keyword1', 'keyword2'],
  openGraph: {
    title: 'My Page',
    description: 'Page description',
    type: 'website',
  },
};
```

#### Debugging Steps

1. **Check metadata file naming**
2. **Verify export format**
3. **Validate metadata structure**
4. **Check HTML output for meta tags**

### 6. API Routes Not Working

#### Symptoms

- API endpoints return 404
- HTTP methods not supported
- API middleware not executing

#### Possible Causes & Solutions

**Cause: API routes in wrong directory**

```
❌ Wrong API directory
src/pages/api/        # Should be separate 'api' directory
└── users.ts

✅ Correct API directory
src/api/
└── users.ts
```

**Cause: Missing HTTP method exports**

```tsx
// ❌ No HTTP method exports
export default function handler() {
	// This won't work for API routes
}

// ✅ HTTP method exports
export async function GET(context) {
	return Response.json({ message: 'Hello' });
}

export async function POST(context) {
	const data = await context.request.json();
	return Response.json(data);
}
```

**Cause: Incorrect API route configuration**

```tsx
// ❌ Missing API directory in config
const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	// Missing apiDir
});

// ✅ Correct API configuration
const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	apiDir: './src/api',
});
```

#### Debugging Steps

1. **Check API directory structure**
2. **Verify HTTP method exports**
3. **Test with simple API route**
4. **Check server configuration**

### 7. Route Groups Not Working

#### Symptoms

- Route groups affecting URLs
- Layouts not applying to route groups
- Unexpected route paths

#### Possible Causes & Solutions

**Cause: Incorrect route group syntax**

```
❌ Wrong route group syntax
src/pages/
├── {auth}/           # Should use parentheses
├── [auth]/           # Should use parentheses
└── _auth/            # Should use parentheses

✅ Correct route group syntax
src/pages/
└── (auth)/
```

**Cause: Route group affecting URL**

```
If (auth)/login.tsx creates /auth/login instead of /login:

1. Check parentheses syntax: (auth) not [auth]
2. Verify file-system router supports route groups
3. Check for conflicting route definitions
```

#### Debugging Steps

1. **Verify parentheses syntax**
2. **Check generated route patterns**
3. **Test route group isolation**

### 8. Performance Issues

#### Symptoms

- Slow route discovery
- High memory usage
- Slow page loads

#### Possible Causes & Solutions

**Cause: Route discovery caching disabled**

```tsx
// ❌ Caching disabled in production
const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	enableCaching: false, // Should be true in production
});

// ✅ Caching enabled
const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	enableCaching: process.env.NODE_ENV === 'production',
	cacheTTL: 60000, // 1 minute cache
});
```

**Cause: Too many files in pages directory**

```
Solution: Use private folders to organize non-route files

❌ All files in pages root
src/pages/
├── about.tsx
├── contact.tsx
├── Header.tsx        # Should be in private folder
├── Footer.tsx        # Should be in private folder
├── utils.ts          # Should be in private folder
└── types.ts          # Should be in private folder

✅ Organized with private folders
src/pages/
├── _components/
│   ├── Header.tsx
│   └── Footer.tsx
├── _utils/
│   └── utils.ts
├── _types/
│   └── types.ts
├── about.tsx
└── contact.tsx
```

#### Debugging Steps

1. **Enable performance monitoring**
2. **Check route discovery time**
3. **Monitor memory usage**
4. **Optimize file organization**

## Debugging Tools

### 1. Enable Debug Logging

```tsx
const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	apiDir: './src/api',
	debug: true, // Enable debug logging
});
```

### 2. Route Discovery Inspection

```tsx
// Get discovered routes for debugging
const routes = await fileSystemRouter.discoverRoutes();
console.log('Discovered routes:', routes);
```

### 3. Metadata Resolution Testing

```tsx
// Test metadata resolution
const metadata = await fileSystemRouter.resolveMetadata('/blog/my-post');
console.log('Resolved metadata:', metadata);
```

### 4. Development Server Logs

Check your development server logs for:

- Route discovery messages
- File watching events
- Error messages
- Performance warnings

## Best Practices for Avoiding Issues

### 1. Follow Naming Conventions

- Use `.tsx` for page components
- Use `_layout.tsx` for layouts
- Use `_middleware.ts` for middleware
- Use `_metadata.ts` for metadata
- Use `[param].tsx` for dynamic routes

### 2. Organize Files Properly

```
src/
├── pages/
│   ├── _components/    # Private folder for components
│   ├── _utils/         # Private folder for utilities
│   ├── _types/         # Private folder for types
│   ├── _layout.tsx     # Root layout
│   ├── _middleware.ts  # Global middleware
│   ├── _metadata.ts    # Global metadata
│   └── index.tsx       # Home page
└── api/
    ├── _middleware.ts  # API middleware
    └── users.ts        # API endpoint
```

### 3. Use TypeScript

Enable strict TypeScript checking to catch issues early:

```tsx
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true
  }
}
```

### 4. Test Incrementally

- Start with simple static routes
- Add dynamic routes one at a time
- Test layouts and middleware separately
- Verify metadata generation

### 5. Monitor Performance

```tsx
// Add performance monitoring
const fileSystemRouter = new FileSystemRouter({
	pagesDir: './src/pages',
	onRouteDiscovery: stats => {
		console.log(`Discovered ${stats.routeCount} routes in ${stats.duration}ms`);
	},
});
```

## Getting Help

If you're still experiencing issues:

1. **Check the main documentation** - [File-System Routing Guide](./file-system-routing.md)
2. **Review examples** - Look at working examples in the `examples/` directory
3. **Search existing issues** - Check the project's issue tracker
4. **Create a minimal reproduction** - Isolate the problem in a small test case
5. **Ask for help** - Create an issue with detailed information about your problem

### When Reporting Issues

Include the following information:

1. **Avalon version**
2. **Node.js version**
3. **Operating system**
4. **File structure** (relevant parts)
5. **Configuration** (server setup)
6. **Error messages** (full stack traces)
7. **Expected vs actual behavior**
8. **Minimal reproduction case**

This helps maintainers diagnose and fix issues quickly.
