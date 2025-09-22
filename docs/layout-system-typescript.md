# Layout System TypeScript Guide

This guide provides comprehensive TypeScript documentation and examples for the Advanced Layout System.

## Table of Contents

- [Core Types](#core-types)
- [Layout Discovery](#layout-discovery)
- [Layout Data Loading](#layout-data-loading)
- [Conditional Rendering](#conditional-rendering)
- [Layout Composition](#layout-composition)
- [Persistent Islands](#persistent-islands)
- [Error Boundaries](#error-boundaries)
- [Streaming Support](#streaming-support)
- [Enhanced Layout Resolver](#enhanced-layout-resolver)
- [Utilities and Helpers](#utilities-and-helpers)
- [Complete Examples](#complete-examples)

## Core Types

### LayoutContext

The `LayoutContext` provides request information and state for layout processing:

```typescript
import type { LayoutContext } from '@avalon/layout-system';

const layoutContext: LayoutContext = {
	request: new Request('https://example.com/blog/post-1'),
	params: { slug: 'post-1' },
	query: new URLSearchParams('?theme=dark'),
	state: new Map([['user', { id: 1, name: 'John' }]]),
	middlewareContext: undefined, // Optional middleware context
};
```

### LayoutData

Layout data is a flexible record structure returned by layout loaders:

```typescript
import type { LayoutData } from '@avalon/layout-system';

const layoutData: LayoutData = {
	user: { id: 1, name: 'John Doe', avatar: '/avatars/john.jpg' },
	navigation: [
		{ label: 'Home', href: '/' },
		{ label: 'Blog', href: '/blog' },
		{ label: 'About', href: '/about' },
	],
	theme: 'dark',
	metadata: {
		title: 'My Blog',
		description: 'A blog about web development',
	},
};
```

### LayoutProps

Props passed to layout components include children, data, and route information:

```typescript
import type { LayoutProps } from '@avalon/layout-system';
import { ComponentChildren } from 'preact';

function MyLayout({ children, data, route }: LayoutProps) {
	return (
		<div class="layout">
			<header>
				<h1>{data.metadata?.title}</h1>
				<nav>
					{data.navigation?.map(item => (
						<a href={item.href}>{item.label}</a>
					))}
				</nav>
			</header>
			<main>{children}</main>
			<footer>
				<p>Current route: {route.path}</p>
			</footer>
		</div>
	);
}
```

## Layout Discovery

### LayoutDiscovery Class

The `LayoutDiscovery` class handles automatic discovery of layout files:

```typescript
import { LayoutDiscovery } from '@avalon/layout-system';
import type { LayoutDiscoveryOptions, LayoutRoute } from '@avalon/layout-system';

// Create layout discovery instance
const discoveryOptions: LayoutDiscoveryOptions = {
	baseDirectory: 'src/pages',
	filePattern: '_layout.tsx',
	excludeDirectories: ['node_modules', '.git'],
	enableWatching: true,
	developmentMode: true,
};

const layoutDiscovery = new LayoutDiscovery(discoveryOptions);

// Discover layouts for a route
const layouts: LayoutRoute[] = await layoutDiscovery.discoverLayouts('/blog/post-1');

// Build complete layout chain
const layoutChain = await layoutDiscovery.buildLayoutChain(new URL('https://example.com/blog/post-1'));
```

### ILayoutDiscovery Interface

For custom implementations:

```typescript
import type { ILayoutDiscovery, LayoutRoute, LayoutHandler } from '@avalon/layout-system';

class CustomLayoutDiscovery implements ILayoutDiscovery {
	async discoverLayouts(routePath: string): Promise<LayoutRoute[]> {
		// Custom discovery logic
		return [];
	}

	async buildLayoutChain(url: URL): Promise<LayoutHandler[]> {
		// Custom chain building logic
		return [];
	}

	setWatching(enabled: boolean): void {
		// Custom watching logic
	}

	getOptions() {
		return this.options;
	}
}
```

## Layout Data Loading

### LayoutLoader Function

Layout loaders fetch data for layout components:

```typescript
import type { LayoutLoader, LayoutContext, LayoutData } from '@avalon/layout-system';

const blogLayoutLoader: LayoutLoader = async (ctx: LayoutContext): Promise<LayoutData> => {
	// Extract route information
	const { request, params, query } = ctx;

	// Fetch user data
	const user = await fetchUser(request.headers.get('Authorization'));

	// Fetch navigation data
	const navigation = await fetchNavigation();

	// Return layout data
	return {
		user,
		navigation,
		theme: query.get('theme') || 'light',
		breadcrumbs: generateBreadcrumbs(request.url),
	};
};

// Export from layout file
export { blogLayoutLoader as layoutLoader };
```

### LayoutDataLoader Class

For advanced data loading scenarios:

```typescript
import { LayoutDataLoader } from '@avalon/layout-system';
import type { LayoutDataLoadingOptions } from '@avalon/layout-system';

const dataLoader = new LayoutDataLoader({
	parallel: true,
	timeout: 5000,
	retries: 3,
	cache: true,
	cacheTTL: 300000, // 5 minutes
});

// Load data for multiple layouts
const result = await dataLoader.loadLayoutData(layoutHandlers, context);
```

## Conditional Rendering

### LayoutRule Interface

Define rules for conditional layout rendering:

```typescript
import type { LayoutRule, RouteInfo } from '@avalon/layout-system';

const mobileLayoutRule: LayoutRule = {
	matches: (layoutPath: string, route: RouteInfo): boolean => {
		const userAgent = route.headers.get('User-Agent') || '';
		const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
		return layoutPath.includes('mobile') && isMobile;
	},
	apply: true,
	priority: 10,
};

const apiSkipRule: LayoutRule = {
	matches: (layoutPath: string, route: RouteInfo): boolean => {
		return route.path.startsWith('/api/');
	},
	apply: false, // Skip layouts for API routes
	priority: 100,
};
```

### LayoutMatcher Class

Manage layout rules:

```typescript
import { LayoutMatcher } from '@avalon/layout-system';

const layoutMatcher = new LayoutMatcher();

// Add rules
layoutMatcher.addRule(mobileLayoutRule);
layoutMatcher.addRule(apiSkipRule);

// Check if layout should be applied
const shouldApply = layoutMatcher.shouldApplyLayout('src/pages/_layout.tsx', {
	path: '/blog/post-1',
	params: { slug: 'post-1' },
	method: 'GET',
	headers: new Headers({ 'User-Agent': 'Mozilla/5.0...' }),
});
```

## Layout Composition

### LayoutConfig Interface

Control layout composition at the page level:

```typescript
import type { LayoutConfig } from '@avalon/layout-system';

// Skip specific layouts
const skipLayoutsConfig: LayoutConfig = {
	skipLayouts: ['src/pages/_layout.tsx', 'src/pages/blog/_layout.tsx'],
};

// Use only specific layouts
const onlyLayoutsConfig: LayoutConfig = {
	onlyLayouts: ['src/pages/admin/_layout.tsx'],
};

// Replace all layouts with custom one
const replaceLayoutConfig: LayoutConfig = {
	replaceLayout: true,
	customLayout: 'src/layouts/special-layout.tsx',
};

// Export from page component
export const layoutConfig = skipLayoutsConfig;
```

### LayoutComposer Class

Handle layout composition:

```typescript
import { LayoutComposer } from '@avalon/layout-system';
import type { LayoutHandler } from '@avalon/layout-system';

const layoutComposer = new LayoutComposer();

// Resolve layouts with page configuration
const resolvedLayouts: LayoutHandler[] = await layoutComposer.resolveLayouts(
	'/blog/post-1',
	pageModule // Page module with layoutConfig export
);

// Apply configuration manually
const configuredLayouts = await layoutComposer.applyConfiguration(discoveredLayouts, {
	skipLayouts: ['src/pages/_layout.tsx'],
});
```

## Persistent Islands

### PersistentIslandProps

Props for persistent island components:

```typescript
import type { PersistentIslandProps } from '@avalon/layout-system';

const persistentIslandProps: PersistentIslandProps = {
	persistentId: 'shopping-cart',
	children: <ShoppingCartComponent />,
};
```

### PersistentIsland Component

Wrap islands for state persistence:

```typescript
import { PersistentIsland } from '@avalon/layout-system';

function ShoppingCartIsland() {
	return (
		<PersistentIsland
			persistentId="shopping-cart"
			src="/islands/ShoppingCart.tsx"
			condition="on:client"
			props={{ initialItems: [] }}>
			<div>Shopping Cart Loading...</div>
		</PersistentIsland>
	);
}
```

### Island State Management

Access persistent state in island components:

```typescript
import { usePersistentIslandContext } from '@avalon/layout-system';
import type { IslandState } from '@avalon/layout-system';

function ShoppingCartComponent() {
	const { saveState, loadState, clearState } = usePersistentIslandContext();

	// Load initial state
	const initialState = loadState() || { items: [], total: 0 };
	const [cartState, setCartState] = useState(initialState);

	// Save state when it changes
	useEffect(() => {
		saveState(cartState);
	}, [cartState, saveState]);

	const addItem = (item: any) => {
		setCartState(prev => ({
			items: [...prev.items, item],
			total: prev.total + item.price,
		}));
	};

	return (
		<div>
			<h3>Shopping Cart ({cartState.items.length})</h3>
			<button onClick={() => addItem({ id: 1, name: 'Product', price: 10 })}>Add Item</button>
			<button onClick={clearState}>Clear Cart</button>
		</div>
	);
}
```

## Error Boundaries

### LayoutErrorBoundaryProps

Props for layout error boundaries:

```typescript
import type { LayoutErrorBoundaryProps, LayoutErrorInfo } from '@avalon/layout-system';

const errorBoundaryProps: LayoutErrorBoundaryProps = {
	children: <MyLayoutComponent />,
	fallback: (error: Error, retry: () => void) => (
		<div class="error-fallback">
			<h2>Layout Error</h2>
			<p>{error.message}</p>
			<button onClick={retry}>Retry</button>
		</div>
	),
	onError: (error: Error, errorInfo: LayoutErrorInfo) => {
		console.error('Layout error:', error);
		// Send to error reporting service
		reportError(error, errorInfo);
	},
};
```

### LayoutErrorBoundary Component

Wrap layouts with error boundaries:

```typescript
import { LayoutErrorBoundary } from '@avalon/layout-system';

function SafeLayout({ children }: { children: any }) {
	return (
		<LayoutErrorBoundary
			fallback={(error, retry) => (
				<div class="layout-error">
					<h1>Something went wrong</h1>
					<p>{error.message}</p>
					<button onClick={retry}>Try Again</button>
				</div>
			)}
			onError={(error, errorInfo) => {
				// Log error
				console.error('Layout error:', error, errorInfo);
			}}>
			<div class="main-layout">
				<header>Header Content</header>
				<main>{children}</main>
				<footer>Footer Content</footer>
			</div>
		</LayoutErrorBoundary>
	);
}
```

## Streaming Support

### StreamingLayoutProps

Props for streaming layout components:

```typescript
import type { StreamingLayoutProps } from '@avalon/layout-system';

const streamingProps: StreamingLayoutProps = {
	children: <HeavyComponent />,
	fallback: <div>Loading heavy component...</div>,
	priority: 'high',
};
```

### StreamingLayout Component

Enable progressive rendering:

```typescript
import { StreamingLayout } from '@avalon/layout-system';

function BlogLayout({ children, data }: LayoutProps) {
	return (
		<div class="blog-layout">
			<header>
				<h1>{data.title}</h1>
			</header>

			{/* Stream heavy sidebar component */}
			<StreamingLayout fallback={<div class="sidebar-skeleton">Loading sidebar...</div>} priority="medium">
				<BlogSidebar />
			</StreamingLayout>

			<main>{children}</main>

			{/* Stream comments with low priority */}
			<StreamingLayout fallback={<div class="comments-skeleton">Loading comments...</div>} priority="low">
				<CommentsSection />
			</StreamingLayout>
		</div>
	);
}
```

### Custom Streaming Components

Create streaming-aware components:

```typescript
import type { StreamingComponent } from '@avalon/layout-system';

const heavyComponent: StreamingComponent = {
	component: HeavyDataComponent,
	fallback: LoadingSkeleton,
	priority: 1,
	isReady: async () => {
		// Check if data is ready
		const data = await checkDataAvailability();
		return data.isReady;
	},
};
```

## Enhanced Layout Resolver

### EnhancedLayoutResolver Class

Main orchestrator for the layout system:

```typescript
import { EnhancedLayoutResolver } from '@avalon/layout-system';
import type { EnhancedLayoutResolverOptions, ResolvedLayout } from '@avalon/layout-system';

const resolverOptions: EnhancedLayoutResolverOptions = {
	caching: true,
	cacheTTL: 300000, // 5 minutes
	streaming: true,
	errorBoundaries: true,
	developmentMode: true,
};

const layoutResolver = new EnhancedLayoutResolver(resolverOptions);

// Resolve complete layout chain
const resolvedLayout: ResolvedLayout = await layoutResolver.resolveAndRender('/blog/post-1', pageModule, layoutContext);
```

### Custom Layout Resolution

Implement custom resolution logic:

```typescript
import type { IEnhancedLayoutResolver, ResolvedLayout } from '@avalon/layout-system';

class CustomLayoutResolver implements IEnhancedLayoutResolver {
	async resolveAndRender(routePath: string, pageModule: any, context: LayoutContext): Promise<ResolvedLayout> {
		// Custom resolution logic
		const handlers = await this.discoverLayouts(routePath);
		const dataLoaders = this.extractDataLoaders(handlers);
		const data = await this.loadData(dataLoaders, context);

		return {
			handlers,
			dataLoaders,
			errorBoundaries: [],
			streamingComponents: [],
			metadata: {
				totalLayouts: handlers.length,
				resolutionTime: Date.now(),
				cacheHit: false,
			},
		};
	}

	getCachedResolution(routePath: string): ResolvedLayout | null {
		return this.cache.get(routePath) || null;
	}

	clearCache(): void {
		this.cache.clear();
	}

	setCaching(enabled: boolean): void {
		this.cachingEnabled = enabled;
	}
}
```

## Utilities and Helpers

### Layout Cache Management

```typescript
import { LayoutCacheManager } from '@avalon/layout-system';
import type { CacheConfig, CacheStats } from '@avalon/layout-system';

const cacheConfig: CacheConfig = {
	maxSize: 100,
	ttl: 300000, // 5 minutes
	cleanupInterval: 60000, // 1 minute
};

const cacheManager = new LayoutCacheManager(cacheConfig);

// Cache layout data
cacheManager.set('layout:/blog', layoutData, 300000);

// Get cached data
const cachedData = cacheManager.get('layout:/blog');

// Get cache statistics
const stats: CacheStats = cacheManager.getStats();
```

### Layout Performance Monitoring

```typescript
import { LayoutPerformanceMonitor } from '@avalon/layout-system';
import type { PerformanceMetric, PerformanceThresholds } from '@avalon/layout-system';

const thresholds: PerformanceThresholds = {
	discoveryTime: 100, // ms
	dataLoadingTime: 500, // ms
	renderingTime: 200, // ms
	totalTime: 1000, // ms
};

const monitor = new LayoutPerformanceMonitor(thresholds);

// Start monitoring
monitor.startMeasurement('layout-resolution');

// ... layout resolution code ...

// End monitoring
const metrics: PerformanceMetric = monitor.endMeasurement('layout-resolution');

// Check for performance issues
const alerts = monitor.checkThresholds(metrics);
```

### Layout Configuration Validation

```typescript
import { validateLayoutConfiguration } from '@avalon/layout-system';
import type { ValidationResult, LayoutConfig } from '@avalon/layout-system';

const config: LayoutConfig = {
	skipLayouts: ['src/pages/_layout.tsx'],
	customLayout: 'src/layouts/special.tsx',
};

const validation: ValidationResult = await validateLayoutConfiguration(config);

if (!validation.isValid) {
	console.error('Layout configuration errors:', validation.errors);
	console.warn('Layout configuration warnings:', validation.warnings);
}
```

## Complete Examples

### Full Layout System Setup

```typescript
// src/layouts/_layout.tsx
import type { LayoutProps, LayoutLoader } from '@avalon/layout-system';

export const layoutLoader: LayoutLoader = async ctx => {
	const user = await fetchUser(ctx.request);
	const navigation = await fetchNavigation();

	return {
		user,
		navigation,
		theme: ctx.query.get('theme') || 'light',
	};
};

export default function RootLayout({ children, data, route }: LayoutProps) {
	return (
		<html>
			<head>
				<title>My App</title>
				<meta name="theme-color" content={data.theme === 'dark' ? '#000' : '#fff'} />
			</head>
			<body class={`theme-${data.theme}`}>
				<LayoutErrorBoundary
					fallback={(error, retry) => (
						<div class="error-page">
							<h1>Application Error</h1>
							<p>{error.message}</p>
							<button onClick={retry}>Retry</button>
						</div>
					)}>
					<header>
						<nav>
							{data.navigation?.map(item => (
								<a href={item.href} class={route.path === item.href ? 'active' : ''}>
									{item.label}
								</a>
							))}
						</nav>
						{data.user && <div class="user-info">Welcome, {data.user.name}!</div>}
					</header>

					<main>{children}</main>

					<StreamingLayout fallback={<div>Loading footer...</div>} priority="low">
						<Footer />
					</StreamingLayout>
				</LayoutErrorBoundary>
			</body>
		</html>
	);
}
```

### Blog Layout with Persistent Sidebar

```typescript
// src/pages/blog/_layout.tsx
import type { LayoutProps, LayoutLoader, LayoutConfig } from '@avalon/layout-system';
import { PersistentIsland, StreamingLayout } from '@avalon/layout-system';

export const layoutLoader: LayoutLoader = async ctx => {
	const categories = await fetchBlogCategories();
	const recentPosts = await fetchRecentPosts(5);

	return {
		categories,
		recentPosts,
	};
};

export default function BlogLayout({ children, data, route }: LayoutProps) {
	return (
		<div class="blog-layout">
			<div class="blog-content">{children}</div>

			<aside class="blog-sidebar">
				<PersistentIsland
					persistentId="blog-sidebar-state"
					src="/islands/BlogSidebar.tsx"
					condition="on:visible"
					props={{
						categories: data.categories,
						recentPosts: data.recentPosts,
					}}>
					<div class="sidebar-loading">Loading sidebar...</div>
				</PersistentIsland>

				<StreamingLayout fallback={<div class="newsletter-skeleton">Loading newsletter...</div>} priority="low">
					<NewsletterSignup />
				</StreamingLayout>
			</aside>
		</div>
	);
}
```

### Page with Custom Layout Configuration

```typescript
// src/pages/special-page.tsx
import type { LayoutConfig } from '@avalon/layout-system';

// Skip the blog layout but keep the root layout
export const layoutConfig: LayoutConfig = {
	skipLayouts: ['src/pages/blog/_layout.tsx'],
	customLayout: 'src/layouts/special-layout.tsx',
};

export default function SpecialPage() {
	return (
		<div class="special-page">
			<h1>Special Page</h1>
			<p>This page uses a custom layout configuration.</p>
		</div>
	);
}
```

### Server Integration

```typescript
// src/server.ts
import { EnhancedLayoutResolver, createEnhancedLayoutResolver } from '@avalon/layout-system';
import type { LayoutContext } from '@avalon/layout-system';

const layoutResolver = createEnhancedLayoutResolver({
	caching: true,
	streaming: true,
	errorBoundaries: true,
	developmentMode: Deno.env.get('NODE_ENV') === 'development',
});

export async function handleRequest(request: Request): Promise<Response> {
	const url = new URL(request.url);

	// Create layout context
	const layoutContext: LayoutContext = {
		request,
		params: extractParams(url),
		query: url.searchParams,
		state: new Map(),
		middlewareContext: await createMiddlewareContext(request),
	};

	// Resolve layouts
	const resolvedLayout = await layoutResolver.resolveAndRender(url.pathname, pageModule, layoutContext);

	// Render with layouts
	return renderWithLayouts(resolvedLayout, layoutContext);
}
```

This comprehensive TypeScript guide covers all aspects of the Advanced Layout System with practical examples and type definitions. Use these examples as a reference for implementing layout functionality in your applications.
