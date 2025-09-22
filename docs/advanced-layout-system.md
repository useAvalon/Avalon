# Advanced Layout System Guide

The Advanced Layout System provides a sophisticated approach to managing layouts in web applications, extending beyond basic file-system routing to include data loading, persistent state, conditional rendering, error boundaries, and streaming support.

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Getting Started](#getting-started)
4. [Layout Discovery](#layout-discovery)
5. [Data Loading](#data-loading)
6. [Persistent Islands](#persistent-islands)
7. [Conditional Rendering](#conditional-rendering)
8. [Layout Composition](#layout-composition)
9. [Error Boundaries](#error-boundaries)
10. [Streaming Support](#streaming-support)
11. [Performance Optimization](#performance-optimization)
12. [Best Practices](#best-practices)
13. [API Reference](#api-reference)
14. [Examples](#examples)

## Overview

The Advanced Layout System transforms how layouts are managed in web applications by providing:

- **Hierarchical Discovery**: Automatic layout discovery based on file system structure
- **Data Loading**: Layout-level data fetching to eliminate duplication
- **Persistent State**: Islands that maintain state across navigation
- **Conditional Rendering**: Smart layout application based on context
- **Error Boundaries**: Graceful error handling at every level
- **Streaming Support**: Progressive rendering for better perceived performance

## Core Concepts

### Layout Hierarchy

Layouts are discovered and applied in a hierarchical manner based on your file system structure:

```
src/pages/
├── _layout.tsx          # Root layout (priority: 0)
├── blog/
│   ├── _layout.tsx      # Blog layout (priority: 10)
│   └── post.tsx         # Blog post page
└── admin/
    ├── _layout.tsx      # Admin layout (priority: 10)
    └── dashboard.tsx    # Admin dashboard
```

### Layout Resolution Pipeline

The system processes layouts through a structured pipeline:

1. **Discovery**: Find all applicable layouts in the hierarchy
2. **Conditional Filtering**: Apply conditional rendering rules
3. **Composition Control**: Handle page-level layout customization
4. **Data Loading**: Execute layout data loaders
5. **Error Boundaries**: Wrap components with error handling
6. **Streaming**: Enable progressive rendering where configured

## Getting Started

### Basic Layout Structure

Create a basic layout by adding a `_layout.tsx` file:

```typescript
// src/pages/_layout.tsx
import { LayoutProps, LayoutData, LayoutContext } from '../types/layout.ts';

// Optional: Layout data loader
export async function layoutLoader(ctx: LayoutContext): Promise<LayoutData> {
	return {
		siteName: 'My App',
		user: await fetchUser(ctx.request),
	};
}

// Layout component
export default function RootLayout({ children, data, route }: LayoutProps) {
	return (
		<html>
			<head>
				<title>{data.siteName}</title>
			</head>
			<body>
				<header>
					<h1>{data.siteName}</h1>
					<nav>{/* Navigation */}</nav>
				</header>
				<main>{children}</main>
				<footer>{/* Footer */}</footer>
			</body>
		</html>
	);
}
```

### Nested Layouts

Create nested layouts for specific sections:

```typescript
// src/pages/blog/_layout.tsx
export async function layoutLoader(ctx: LayoutContext): Promise<LayoutData> {
	return {
		blogTitle: 'My Blog',
		categories: await fetchCategories(),
	};
}

export default function BlogLayout({ children, data, route }: LayoutProps) {
	return (
		<div className="blog-container">
			<aside>
				<h2>{data.blogTitle}</h2>
				{/* Sidebar content */}
			</aside>
			<main>{children}</main>
		</div>
	);
}
```

## Layout Discovery

The layout discovery system automatically finds and prioritizes layouts based on file system structure.

### Discovery Rules

1. **File Pattern**: Looks for `_layout.tsx` files
2. **Hierarchy**: Applies layouts from root to most specific
3. **Priority**: Assigns priority based on directory depth
4. **Hot Reloading**: Automatically updates in development

### Custom Discovery Options

```typescript
// Configure layout discovery
const discoveryOptions = {
	baseDirectory: 'src/pages',
	filePattern: '_layout.tsx',
	excludeDirectories: ['node_modules', '.git'],
	enableWatching: true,
	developmentMode: true,
};
```

## Data Loading

Layout data loaders provide a powerful way to fetch data at the layout level, preventing duplication and improving performance.

### Basic Data Loading

```typescript
export async function layoutLoader(ctx: LayoutContext): Promise<LayoutData> {
	// Access request context
	const { request, params, query, state } = ctx;

	// Fetch data
	const userData = await fetchUserData(request);
	const siteConfig = await fetchSiteConfig();

	return {
		user: userData,
		config: siteConfig,
		timestamp: new Date().toISOString(),
	};
}
```

### Parallel Data Loading

When multiple layouts have loaders, they execute in parallel:

```typescript
// Root layout loader
export async function layoutLoader(ctx: LayoutContext): Promise<LayoutData> {
	return {
		globalData: await fetchGlobalData(),
	};
}

// Blog layout loader (runs in parallel with root)
export async function layoutLoader(ctx: LayoutContext): Promise<LayoutData> {
	return {
		blogData: await fetchBlogData(),
	};
}
```

### Error Handling in Data Loading

```typescript
export async function layoutLoader(ctx: LayoutContext): Promise<LayoutData> {
	try {
		const data = await fetchCriticalData();
		return { data };
	} catch (error) {
		// Handle gracefully
		console.error('Layout data loading failed:', error);
		return {
			data: null,
			error: 'Failed to load data',
			fallback: true,
		};
	}
}
```

## Persistent Islands

Persistent islands maintain their state across navigation, providing seamless user experiences.

### Basic Persistent Island

```typescript
import { PersistentIsland } from '../components/PersistentIsland.tsx';

function ShoppingCart() {
	const [items, setItems] = useState([]);

	return <div>{/* Cart UI */}</div>;
}

// In your layout or page
<PersistentIsland persistentId="shopping-cart">
	<ShoppingCart />
</PersistentIsland>;
```

### Cross-Page Communication

```typescript
// Island with communication capabilities
function NotificationCenter() {
	const [notifications, setNotifications] = useState([]);

	// Listen for cross-page events
	useEffect(() => {
		const handleNotification = event => {
			setNotifications(prev => [...prev, event.detail]);
		};

		window.addEventListener('app:notification', handleNotification);
		return () => window.removeEventListener('app:notification', handleNotification);
	}, []);

	return (
		<div>
			{notifications.map(notification => (
				<div key={notification.id}>{notification.message}</div>
			))}
		</div>
	);
}
```

### Storage Configuration

```typescript
// Custom storage configuration
const persistenceConfig = {
	storage: 'localStorage', // or 'sessionStorage'
	prefix: 'myapp_',
	serializer: JSON,
	ttl: 24 * 60 * 60 * 1000, // 24 hours
};
```

## Conditional Rendering

Control which layouts apply based on routes, headers, or custom conditions.

### Built-in Rules

```typescript
// Skip layouts for API routes
export const layoutRules = {
	skipForApi: true,
	skipPatterns: ['/api/*', '/webhook/*'],
};
```

### Custom Conditional Rules

```typescript
export const layoutRules = {
	matches: (layoutPath: string, route: RouteInfo) => {
		// Custom logic
		return route.path.startsWith('/admin') && route.headers.get('authorization');
	},
	priority: 10,
};
```

### Mobile-Specific Layouts

```typescript
export const layoutRules = {
	matches: (layoutPath: string, route: RouteInfo) => {
		const userAgent = route.headers.get('user-agent') || '';
		return /Mobile|Android|iPhone/i.test(userAgent);
	},
};
```

## Layout Composition

Pages can override the default layout chain through composition control.

### Skip Specific Layouts

```typescript
// In your page component
export const layoutConfig: LayoutConfig = {
	skipLayouts: ['/admin/_layout.tsx', '/blog/_layout.tsx'],
};
```

### Use Only Specific Layouts

```typescript
export const layoutConfig: LayoutConfig = {
	onlyLayouts: ['/_layout.tsx'], // Only use root layout
};
```

### Custom Layout

```typescript
export const layoutConfig: LayoutConfig = {
	customLayout: './special-layout.tsx',
};
```

### Replace All Layouts

```typescript
export const layoutConfig: LayoutConfig = {
	replaceLayout: true,
	customLayout: './standalone-layout.tsx',
};
```

## Error Boundaries

Comprehensive error handling with graceful fallbacks and recovery options.

### Basic Error Boundary

```typescript
import { LayoutErrorBoundary } from '../components/LayoutErrorBoundary.tsx';

<LayoutErrorBoundary
	fallback={(error, retry) => (
		<div className="error-fallback">
			<h3>Something went wrong</h3>
			<p>{error.message}</p>
			<button onClick={retry}>Try Again</button>
		</div>
	)}
	onError={(error, errorInfo) => {
		console.error('Layout error:', error);
		// Send to error tracking service
	}}>
	<YourComponent />
</LayoutErrorBoundary>;
```

### Multi-Level Error Handling

```typescript
// Outer boundary for layout-level errors
<LayoutErrorBoundary fallback={LayoutErrorFallback}>
	<Layout>
		{/* Inner boundary for component-level errors */}
		<LayoutErrorBoundary fallback={ComponentErrorFallback}>
			<Component />
		</LayoutErrorBoundary>
	</Layout>
</LayoutErrorBoundary>
```

### Error Recovery Strategies

```typescript
const errorRecoveryStrategies = {
	retry: { maxAttempts: 3, backoff: 'exponential' },
	fallback: { component: SimpleFallback },
	redirect: { url: '/error' },
	skip: { continueWithoutComponent: true },
};
```

## Streaming Support

Progressive rendering with skeleton components for better perceived performance.

### Basic Streaming

```typescript
import { StreamingLayout } from '../components/StreamingLayout.tsx';

<StreamingLayout fallback={<SkeletonComponent />} priority="high">
	<HeavyComponent />
</StreamingLayout>;
```

### Priority-Based Loading

```typescript
// High priority - loads first
<StreamingLayout priority="high" fallback={<CriticalSkeleton />}>
  <CriticalComponent />
</StreamingLayout>

// Medium priority - loads second
<StreamingLayout priority="medium" fallback={<ImportantSkeleton />}>
  <ImportantComponent />
</StreamingLayout>

// Low priority - loads last
<StreamingLayout priority="low" fallback={<NiceToHaveSkeleton />}>
  <NiceToHaveComponent />
</StreamingLayout>
```

### Custom Skeleton Components

```typescript
function CustomSkeleton() {
	return (
		<div className="animate-pulse">
			<div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
			<div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
			<div className="h-32 bg-gray-200 rounded"></div>
		</div>
	);
}
```

## Performance Optimization

### Layout Caching

```typescript
const cacheConfig = {
	enabled: true,
	ttl: 5 * 60 * 1000, // 5 minutes
	maxSize: 100,
	strategy: 'lru',
};
```

### Bundle Splitting

```typescript
// Lazy load heavy layouts
const AdminLayout = lazy(() => import('./admin/_layout.tsx'));
const BlogLayout = lazy(() => import('./blog/_layout.tsx'));
```

### Data Loading Optimization

```typescript
export async function layoutLoader(ctx: LayoutContext): Promise<LayoutData> {
	// Use parallel loading
	const [userData, siteConfig, navigation] = await Promise.all([
		fetchUserData(ctx.request),
		fetchSiteConfig(),
		fetchNavigation(),
	]);

	return { userData, siteConfig, navigation };
}
```

## Best Practices

### Layout Organization

1. **Single Responsibility**: Each layout should have a focused purpose
2. **Composition Over Inheritance**: Use layout composition for flexibility
3. **Data Locality**: Load data at the appropriate level
4. **Error Isolation**: Use error boundaries to prevent cascading failures

### Performance

1. **Lazy Loading**: Load layouts and components on demand
2. **Caching**: Cache layout resolution and data loading results
3. **Streaming**: Use streaming for non-critical components
4. **Bundle Optimization**: Split layout code appropriately

### User Experience

1. **Loading States**: Always provide meaningful loading indicators
2. **Error Recovery**: Give users options to recover from errors
3. **Progressive Enhancement**: Ensure core functionality works without JavaScript
4. **Accessibility**: Follow accessibility best practices in all layouts

### Development

1. **Type Safety**: Use TypeScript for better development experience
2. **Testing**: Write comprehensive tests for layout logic
3. **Documentation**: Document layout behavior and data requirements
4. **Monitoring**: Track layout performance and errors

## API Reference

### Types

```typescript
interface LayoutProps {
	children: ComponentChildren;
	data: LayoutData;
	route: {
		path: string;
		params: Record<string, string>;
		query: URLSearchParams;
	};
}

interface LayoutContext {
	request: Request;
	params: Record<string, string>;
	query: URLSearchParams;
	state: Map<string, unknown>;
	middlewareContext?: MiddlewareContext;
}

interface LayoutConfig {
	skipLayouts?: string[];
	replaceLayout?: boolean;
	onlyLayouts?: string[];
	customLayout?: string;
}
```

### Components

```typescript
// Error Boundary
<LayoutErrorBoundary
  fallback={(error, retry) => JSX.Element}
  onError={(error, errorInfo) => void}
>

// Persistent Island
<PersistentIsland persistentId={string}>

// Streaming Layout
<StreamingLayout
  fallback={JSX.Element}
  priority="high" | "medium" | "low"
>
```

### Functions

```typescript
// Layout data loader
export async function layoutLoader(ctx: LayoutContext): Promise<LayoutData>;

// Layout rules
export const layoutRules: LayoutRule;

// Layout configuration
export const layoutConfig: LayoutConfig;
```

## Examples

See the [examples directory](../examples/) for comprehensive examples demonstrating all features:

- **Basic Layouts**: Root and nested layout examples
- **Data Loading**: Layout data loaders with error handling
- **Persistent Islands**: State management across navigation
- **Conditional Rendering**: Authentication and mobile layouts
- **Error Boundaries**: Multi-level error handling
- **Streaming**: Progressive rendering with skeletons
- **Composition Control**: Custom layout configurations

## Migration Guide

### From Basic Layouts

1. Add layout data loaders for shared data
2. Wrap components with error boundaries
3. Convert stateful components to persistent islands
4. Add streaming for heavy components

### From Other Frameworks

1. Map existing layout patterns to the new system
2. Migrate data fetching to layout loaders
3. Convert global state to persistent islands
4. Add error boundaries and streaming incrementally

## Troubleshooting

### Common Issues

1. **Layout Not Found**: Check file naming and directory structure
2. **Data Loading Errors**: Verify loader function signature and error handling
3. **State Not Persisting**: Ensure unique persistent IDs and proper storage
4. **Performance Issues**: Review caching configuration and bundle splitting

### Debug Tools

1. **Layout Inspector**: View resolved layout chain
2. **Performance Monitor**: Track layout resolution times
3. **Error Logger**: Centralized error tracking
4. **Cache Analyzer**: Monitor cache hit rates

## Contributing

When contributing to the layout system:

1. Follow existing patterns and conventions
2. Add comprehensive tests for new features
3. Update documentation and examples
4. Consider performance implications
5. Maintain backward compatibility

## License

The Advanced Layout System is part of the main project and follows the same license terms.
