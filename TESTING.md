# Testing Structure

This project uses a co-located testing approach where tests are placed next to the code they test for better maintainability.

## Test Organization

### Core Layout System Tests

- `src/core/layout/tests/` - Core layout functionality
  - `enhanced-layout-resolver.test.ts` - Main layout resolver tests
  - `layout-streaming.test.ts` - Streaming functionality tests

### Helper Tests

- `src/helpers/tests/` - Layout helper components
  - `layout-matcher.test.ts` - Layout matching rules
  - `layout-composer.test.ts` - Layout composition
  - `layout-data-loader.test.ts` - Data loading functionality
  - `layout-discovery.test.ts` - Layout file discovery
  - `layout-utilities.test.ts` - Utility functions
  - `layout-*-optimization.test.ts` - Performance optimizations

### Middleware Tests

- `src/core/middleware/tests/` - Middleware system tests
  - `middleware-*.test.ts` - Various middleware functionality
  - `server-middleware-*.test.ts` - Server-side middleware
  - `api-middleware-*.test.ts` - API middleware

### Component Tests

- `src/components/tests/` - Component-related tests
  - `component-*.test.ts` - Component analysis and detection
  - `layout-error-boundaries.test.ts` - Error boundary components
  - `persistent-islands.test.ts` - Island persistence
  - `real-component-detection.test.ts` - Real component analysis
  - `ssr-only-rendering.test.ts` - SSR functionality
  - `visibility-options.test.ts` - Component visibility

### Type Tests

- `src/types/tests/layout-types.test.ts` - Type definitions and schemas

### Client Tests

- `src/client/tests/hydration-option-parsing.test.ts` - Client-side functionality

### Core Tests

- `src/core/tests/error-handler-tests.test.ts` - Core error handling

### Integration Tests

- `tests/integration/` - Cross-component integration tests
  - `layout-*-integration.test.ts` - Layout system integration
  - `layout-*-comprehensive.test.ts` - Comprehensive test suites
  - `layout-performance-benchmarks.test.ts` - Performance benchmarks

## Running Tests

### All Tests

```bash
deno task test
# or
deno run --no-check --allow-env --allow-read --allow-write test.ts
```

### Specific Test Categories

```bash
# Layout system tests
deno task test:layout

# Helper tests
deno task test:helpers

# Middleware tests
deno task test:middleware

# Component tests
deno task test:components

# Type tests
deno task test:types

# Client tests
deno task test:client

# Core tests
deno task test:core

# Integration tests
deno task test:integration
```

### Individual Test Files

```bash
# Run a specific test file
deno test src/core/layout/tests/enhanced-layout-resolver.test.ts --no-check --allow-env --allow-read --allow-write
```

## Test Status

✅ **Working test categories**:

- Layout System: 8 test suites, 60 steps ✅
- Types: 1 test suite, 13 steps ✅
- Client: 5 test suites ✅
- Core: 6 test suites ✅

⚠️ **Test categories with issues**:

- Helpers: 34 test suites, some timer leaks
- Middleware: 47 test suites, missing fixtures and rollup issues
- Components: 17 test suites, persistent islands test failures
- Integration: Complex integration tests with various issues

## Benefits of Co-located Tests

1. **Better Maintainability**: Tests are next to the code they test
2. **Easier Navigation**: Find tests quickly when working on specific modules
3. **Clearer Ownership**: Each module owns its tests
4. **Reduced Coupling**: Tests are organized by functionality, not by test type
5. **Better Discoverability**: New developers can easily find relevant tests

## Test Guidelines

- Place unit tests in the same directory as the code being tested
- Use integration tests for cross-module functionality
- Keep tests focused and maintainable
- Avoid complex async tests that are hard to debug
- Use descriptive test names that explain the behavior being tested
- Clean up resources (timers, watchers) in test teardown

## Common Issues and Solutions

### Timer Leaks

Some tests create intervals or timeouts that aren't properly cleaned up. Make sure to:

```typescript
// In test cleanup
clearInterval(intervalId);
clearTimeout(timeoutId);
```

### File System Watchers

Tests that use file system watchers should close them:

```typescript
// In test cleanup
watcher.close();
```

### Missing Fixtures

Some middleware tests depend on fixture files that may need to be created or have their paths updated after the reorganization.

### Import Path Issues

After moving tests, import paths need to be updated to reflect the new relative locations.
