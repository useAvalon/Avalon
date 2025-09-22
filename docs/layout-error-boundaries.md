# Layout Error Boundaries

The Layout Error Boundary system provides comprehensive error handling for the advanced layout system, ensuring that errors in one part of the layout don't crash the entire application.

## Overview

The error boundary system consists of several specialized components and utilities:

- **LayoutErrorBoundary**: General-purpose error boundary for layout components
- **LayoutDataErrorBoundary**: Specialized error boundary for data loading errors
- **IslandErrorBoundary**: Isolated error boundary for island components
- **LayoutErrorRecovery**: Error recovery strategies and handling
- **LayoutErrorLogger**: Error logging and debugging utilities
- **LayoutErrorBoundaryManager**: Centralized management of error boundaries

## Key Features

### Multi-Level Error Handling

The system provides error boundaries at different levels:

1. **Layout Level**: Catches errors in layout components
2. **Data Level**: Handles data loading failures with retry mechanisms
3. **Island Level**: Isolates island errors to prevent page-wide failures
4. **Rendering Level**: Catches rendering errors during SSR

### Error Recovery Strategies

Four main recovery strategies are supported:

- **Retry**: Attempt to retry the failed operation
- **Fallback**: Show fallback UI while maintaining functionality
- **Skip**: Skip the failed component and continue with degraded functionality
- **Redirect**: Redirect to an error page

### Error Isolation

Island errors are isolated by default, ensuring that:

- Island failures don't affect the main layout
- Multiple islands can fail independently
- The page remains functional even with failed islands

## Usage

### Basic Layout Error Boundary

```tsx
import { LayoutErrorBoundary } from '../src/types/layout.ts';

<LayoutErrorBoundary
	layoutPath="/blog/_layout.tsx"
	errorType="component"
	fallback={(error, retry) => (
		<div class="error-fallback">
			<h3>Something went wrong</h3>
			<p>{error.message}</p>
			<button onClick={retry}>Try Again</button>
		</div>
	)}
	onError={(error, errorInfo) => {
		console.error('Layout error:', error, errorInfo);
	}}>
	<BlogLayout>
		<BlogPost />
	</BlogLayout>
</LayoutErrorBoundary>;
```

### Data Loading Error Boundary

```tsx
import { LayoutDataErrorBoundary } from '../src/types/layout.ts';

<LayoutDataErrorBoundary
	layoutPath="/blog/_layout.tsx"
	context={layoutContext}
	fallbackData={{ posts: [] }}
	retryLoader={async () => {
		return await fetchBlogPosts();
	}}
	onError={(error, errorInfo) => {
		console.error('Data loading error:', error);
	}}>
	<BlogPostList />
</LayoutDataErrorBoundary>;
```

### Island Error Boundary

```tsx
import { IslandErrorBoundary } from '../src/types/layout.ts';

<IslandErrorBoundary
	islandId="comment-form"
	isolateError={true}
	fallback={(error, islandId) => (
		<div class="island-error">
			<p>Comment form is temporarily unavailable.</p>
			<p>Error: {error.message}</p>
		</div>
	)}>
	<CommentForm />
</IslandErrorBoundary>;
```

### Higher-Order Component Wrapper

```tsx
import { withIslandErrorBoundary } from '../src/types/layout.ts';

const SafeCommentForm = withIslandErrorBoundary(CommentForm, 'comment-form', {
	isolateError: true,
	fallback: (error, islandId) => <div>Comment form failed to load: {error.message}</div>,
});

// Use the wrapped component
<SafeCommentForm postId="123" />;
```

## Error Recovery System

### Registering Custom Recovery Strategies

```tsx
import { LayoutErrorRecovery } from '../src/types/layout.ts';

const errorRecovery = new LayoutErrorRecovery();

// Register custom strategy for specific error types
errorRecovery.registerStrategy('loader', {
	type: 'retry',
	maxRetries: 5,
});

errorRecovery.registerStrategy('component', {
	type: 'fallback',
	maxRetries: 2,
	fallbackComponent: CustomFallbackComponent,
});
```

### Handling Errors Programmatically

```tsx
import { layoutErrorBoundaryManager } from '../src/types/layout.ts';

// Register an error boundary
layoutErrorBoundaryManager.registerErrorBoundary('my-boundary', '/blog/_layout.tsx', {
	component: 'layout',
	strategy: { type: 'fallback', maxRetries: 3 },
	isolateError: false,
});

// Handle an error
layoutErrorBoundaryManager.handleError('my-boundary', new Error('Something went wrong'), {
	layoutPath: '/blog/_layout.tsx',
	errorType: 'component',
	timestamp: Date.now(),
});
```

## Error Logging and Debugging

### Error Logger

The error logger automatically captures and stores error information:

```tsx
import { layoutErrorLogger } from '../src/types/layout.ts';

// Log an error manually
const errorId = layoutErrorLogger.logError(new Error('Custom error'), {
	layoutPath: '/custom/_layout.tsx',
	errorType: 'component',
	timestamp: Date.now(),
});

// Mark error as resolved
layoutErrorLogger.markResolved(errorId);

// Get error statistics
const stats = layoutErrorLogger.getErrorStats();
console.log(`Total errors: ${stats.total}`);
console.log(`Resolved: ${stats.resolved}`);
console.log(`By type:`, stats.byType);
```

### Error Debugging

```tsx
import { layoutErrorDebugger } from '../src/types/layout.ts';

// Generate debug report
const report = layoutErrorDebugger.generateDebugReport();
console.log(report);

// Get problematic layouts
const problematic = layoutErrorDebugger.getProblematicLayouts(5);
console.log('Layouts with 5+ errors:', problematic);

// Get fix suggestions
const suggestions = layoutErrorDebugger.suggestFixes();
suggestions.forEach(suggestion => {
	console.log(`${suggestion.priority}: ${suggestion.issue}`);
	console.log(`  Solution: ${suggestion.suggestion}`);
});
```

## Error Boundary Manager

### Health Monitoring

```tsx
import { layoutErrorBoundaryManager } from '../src/types/layout.ts';

// Get boundary health status
const health = layoutErrorBoundaryManager.getBoundaryHealth();
health.forEach(boundary => {
	console.log(`${boundary.id}: ${boundary.status}`);
	if (boundary.errorCount > 0) {
		console.log(`  Errors: ${boundary.errorCount}`);
		console.log(`  Last error: ${boundary.lastError}`);
	}
});

// Generate comprehensive report
const report = layoutErrorBoundaryManager.generateReport();
console.log(report);
```

### Global Error Handling

```tsx
import { layoutErrorBoundaryManager } from '../src/types/layout.ts';

// Set global error handler
layoutErrorBoundaryManager.setGlobalErrorHandler((error, errorInfo) => {
	// Send to external logging service
	console.error('Global layout error:', {
		message: error.message,
		layoutPath: errorInfo.layoutPath,
		errorType: errorInfo.errorType,
		timestamp: errorInfo.timestamp,
	});

	// Could send to Sentry, LogRocket, etc.
});
```

## Configuration

### Standard Configurations

```tsx
import { ErrorBoundaryUtils } from '../src/types/layout.ts';

// Create standard configurations for different component types
const layoutConfig = ErrorBoundaryUtils.createStandardConfig('layout');
const dataConfig = ErrorBoundaryUtils.createStandardConfig('data');
const islandConfig = ErrorBoundaryUtils.createStandardConfig('island');
const streamingConfig = ErrorBoundaryUtils.createStandardConfig('streaming');

// Customize configurations
const customConfig = ErrorBoundaryUtils.createStandardConfig('layout', {
	strategy: { type: 'redirect', redirectUrl: '/error' },
	maxRetries: 5,
});
```

### Error Type Strategies

Default strategies by error type:

- **component**: Fallback with 2 retries
- **loader**: Retry with 3 attempts
- **rendering**: Fallback with 1 retry
- **island**: Skip with 0 retries (isolated)

## Best Practices

### 1. Use Appropriate Error Boundaries

- Use `LayoutErrorBoundary` for general layout components
- Use `LayoutDataErrorBoundary` for data-dependent components
- Use `IslandErrorBoundary` for interactive islands
- Always isolate island errors to prevent page-wide failures

### 2. Provide Meaningful Fallbacks

```tsx
// Good: Specific, actionable fallback
<LayoutErrorBoundary
  fallback={(error, retry) => (
    <div class="error-state">
      <h3>Unable to load blog posts</h3>
      <p>There was a problem loading the latest posts.</p>
      <button onClick={retry}>Try Again</button>
      <a href="/archive">View Archive</a>
    </div>
  )}
>
  <BlogPostList />
</LayoutErrorBoundary>

// Bad: Generic, unhelpful fallback
<LayoutErrorBoundary
  fallback={() => <div>Error</div>}
>
  <BlogPostList />
</LayoutErrorBoundary>
```

### 3. Log Errors for Debugging

Always provide error handlers for debugging:

```tsx
<LayoutErrorBoundary
	onError={(error, errorInfo) => {
		console.error('Layout error:', {
			error: error.message,
			stack: error.stack,
			layoutPath: errorInfo.layoutPath,
			errorType: errorInfo.errorType,
		});
	}}>
	<MyLayout />
</LayoutErrorBoundary>
```

### 4. Monitor Error Boundaries

Regularly check error boundary health:

```tsx
// In development, log error statistics
if (Deno.env.get('NODE_ENV') === 'development') {
	setInterval(() => {
		const stats = layoutErrorLogger.getErrorStats();
		if (stats.unresolved > 0) {
			console.warn(`${stats.unresolved} unresolved layout errors`);
		}
	}, 30000); // Check every 30 seconds
}
```

### 5. Test Error Scenarios

Create tests that simulate error conditions:

```tsx
// Test component that throws errors for testing
class TestErrorComponent extends Component {
	override render() {
		if (this.props.shouldError) {
			throw new Error('Test error');
		}
		return <div>Normal content</div>;
	}
}

// Test error boundary behavior
<LayoutErrorBoundary>
	<TestErrorComponent shouldError={true} />
</LayoutErrorBoundary>;
```

## Integration with Layout System

The error boundary system integrates seamlessly with the layout system:

1. **Automatic Registration**: Layout components automatically get error boundaries
2. **Data Loader Integration**: Data loading errors are handled gracefully
3. **Island Isolation**: Island errors don't affect the main layout
4. **SSR Compatibility**: Error boundaries work during server-side rendering

## Performance Considerations

- Error boundaries have minimal performance impact when no errors occur
- Error logging is optimized for production use
- Error boundary manager automatically deactivates problematic boundaries
- Caching prevents repeated error boundary registrations

## Troubleshooting

### Common Issues

1. **Error boundaries not catching errors**: Ensure you're using class components for error boundaries
2. **Islands affecting main layout**: Make sure `isolateError` is set to `true` for islands
3. **Too many retries**: Adjust `maxRetries` in recovery strategies
4. **Memory leaks**: Error logs are automatically trimmed to prevent memory issues

### Debug Mode

Enable debug mode for detailed error information:

```tsx
// Set environment variable
Deno.env.set('NODE_ENV', 'development');

// Error boundaries will show detailed error information
// Error logger will output to console
// Debug utilities will be available
```

This comprehensive error boundary system ensures that your layout system remains robust and provides excellent user experience even when errors occur.
