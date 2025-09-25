# File-System Routing Integration

This document explains how to integrate file-system routing with the Avalon server architecture.

## Overview

File-system routing has been integrated into the Avalon server architecture, allowing you to automatically generate routes based on your file structure while maintaining backward compatibility with manual route definitions.

## Configuration

### Server Configuration

Add file-system routing configuration to your server config:

```typescript
import { createServer } from './src/render/server.ts';
import type { ServerConfig } from './src/schemas/server.ts';

const serverConfig: ServerConfig = {
	routes: {
		// Your existing manual routes
		'/api/health': {
			component: () => ({ status: 'ok' }),
		},
	},
	port: 8001,
	// File-system routing configuration
	fileSystemRouting: {
		enabled: true, // Enable/disable file-system routing
		fallbackToManual: true, // Fall back to manual routes on errors
		enableCaching: true, // Cache discovered routes (disable in dev)
		cacheTTL: 300000, // Cache TTL in milliseconds (5 minutes)
		discovery: {
			pagesDirectory: 'src/pages', // Directory to scan for pages
			apiDirectory: 'src/api', // Directory to scan for API routes
			extensions: ['.tsx', '.ts', '.jsx', '.js'], // File extensions
			excludeDirectories: ['node_modules', '.git'], // Exclude directories
			enableWatching: true, // Enable file watching (dev only)
			developmentMode: true, // Enable development features
		},
	},
};

const server = await createServer(serverConfig);
```

### Configuration Options

#### `fileSystemRouting`

- `enabled` (boolean, default: `true`): Enable or disable file-system routing
- `fallbackToManual` (boolean, default: `true`): Fall back to manual routes if file-system routing fails
- `enableCaching` (boolean, default: `true`): Cache discovered routes for performance
- `cacheTTL` (number, default: `300000`): Cache time-to-live in milliseconds

#### `discovery`

- `pagesDirectory` (string, default: `'src/pages'`): Directory to scan for page components
- `apiDirectory` (string, default: `'src/api'`): Directory to scan for API routes
- `extensions` (string[], default: `['.tsx', '.ts', '.jsx', '.js']`): File extensions to include
- `excludeDirectories` (string[], default: `['node_modules', '.git']`): Directories to exclude
- `enableWatching` (boolean, default: `false`): Enable file system watching for hot reload
- `developmentMode` (boolean, default: `false`): Enable development-specific features

## Route Priority

Routes are processed in the following order:

1. **API routes** (`/api/*`) - Always first
2. **Framework routes** (Avalon internal routes)
3. **Vite development routes** (development only)
4. **File-system routes** - Discovered from `src/pages/`
5. **Manual routes** - Defined in server config
6. **Static asset routes** - Always last

File-system routes take precedence over manual routes, but you can disable file-system routing to use only manual routes.

## File Structure

```
src/pages/
├── _layout.tsx          # Root layout
├── _middleware.ts       # Global middleware
├── _metadata.ts         # Global metadata
├── index.tsx           # / route
├── about.tsx           # /about route
├── blog/
│   ├── _layout.tsx     # Blog layout
│   ├── index.tsx       # /blog route
│   └── [slug].tsx      # /blog/:slug route
└── (auth)/             # Route group
    ├── login.tsx       # /login route
    └── register.tsx    # /register route
```

## Backward Compatibility

File-system routing is fully backward compatible:

- **Existing manual routes continue to work** - No changes required
- **Gradual migration** - You can migrate routes one by one
- **Fallback support** - If file-system routing fails, manual routes are used
- **Configuration optional** - File-system routing is enabled by default but can be disabled

## Error Handling

The integration includes comprehensive error handling:

- **Route discovery errors** are logged but don't crash the server
- **Invalid page components** are skipped with warnings
- **File system errors** fall back to manual routes
- **Development mode** shows detailed error messages
- **Production mode** fails gracefully with minimal logging

## Development Features

In development mode (`developmentMode: true`):

- **Hot reload** - File changes automatically update routes
- **Detailed logging** - Shows discovered routes and errors
- **Cache disabled** - Routes are re-discovered on each request
- **File watching** - Monitors file system changes

## Production Optimizations

In production mode (`developmentMode: false`):

- **Route caching** - Discovered routes are cached for performance
- **Minimal logging** - Only errors are logged
- **No file watching** - Static route discovery at startup
- **Error resilience** - Graceful fallback to manual routes

## Examples

### Basic Setup

```typescript
// Minimal configuration
const serverConfig: ServerConfig = {
	routes: {},
	fileSystemRouting: {
		enabled: true,
	},
};
```

### Development Setup

```typescript
// Development configuration
const serverConfig: ServerConfig = {
	routes: {},
	fileSystemRouting: {
		enabled: true,
		enableCaching: false, // Disable caching for hot reload
		discovery: {
			enableWatching: true,
			developmentMode: true,
		},
	},
};
```

### Production Setup

```typescript
// Production configuration
const serverConfig: ServerConfig = {
	routes: {},
	fileSystemRouting: {
		enabled: true,
		enableCaching: true, // Enable caching for performance
		cacheTTL: 600000, // 10 minutes
		discovery: {
			enableWatching: false,
			developmentMode: false,
		},
	},
};
```

### Disabled File-System Routing

```typescript
// Use only manual routes
const serverConfig: ServerConfig = {
	routes: {
		'/': { component: () => 'Home' },
		'/about': { component: () => 'About' },
	},
	fileSystemRouting: {
		enabled: false, // Disable file-system routing
	},
};
```

## Migration Guide

### From Manual Routes to File-System Routes

1. **Create the pages directory**: `mkdir -p src/pages`
2. **Move route components**: Move components to `src/pages/` following the naming convention
3. **Update imports**: Update any imports to use the new file locations
4. **Enable file-system routing**: Add `fileSystemRouting: { enabled: true }` to your config
5. **Test**: Verify all routes work correctly
6. **Remove manual routes**: Gradually remove manual route definitions

### Example Migration

Before:

```typescript
const routes = {
	'/': { component: HomePage },
	'/about': { component: AboutPage },
	'/blog': { component: BlogPage },
	'/blog/:slug': { component: BlogPostPage },
};
```

After:

```
src/pages/
├── index.tsx        # HomePage
├── about.tsx        # AboutPage
├── blog/
│   ├── index.tsx    # BlogPage
│   └── [slug].tsx   # BlogPostPage
```

## Troubleshooting

### Common Issues

1. **Routes not discovered**: Check `pagesDirectory` path and file extensions
2. **Permission errors**: Ensure read access to pages directory
3. **Route conflicts**: File-system routes override manual routes with same path
4. **Hot reload not working**: Enable `enableWatching` and `developmentMode`
5. **Performance issues**: Enable caching in production

### Debug Logging

Enable debug logging to see discovered routes:

```typescript
const serverConfig: ServerConfig = {
	renderOptions: {
		logDecisions: true,
	},
	fileSystemRouting: {
		discovery: {
			developmentMode: true, // Enables debug logging
		},
	},
};
```

### Testing Integration

Use the provided test utilities to verify integration:

```typescript
import { createFileSystemRoutes } from './src/render/routes/app-routes.ts';
import { FileSystemRouter } from './src/core/routing/file-system-router.ts';

const router = new FileSystemRouter({ enabled: true });
const routes = await createFileSystemRoutes(router);
console.log(`Discovered ${routes.length} routes`);
```
