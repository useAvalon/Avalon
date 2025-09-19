# Design Document

## Overview

This design addresses multiple issues in the current hydration system to create a more robust, flexible, and user-friendly framework. The solution involves cleaning up unused build artifacts, removing unimplemented features, enhancing existing hydration controls, and implementing intelligent SSR-only rendering detection.

## Architecture

### Current System Analysis

The current hydration system has several components:

- **Client-side hydration script** (`src/client/main.js`) that handles different hydration triggers
- **SSR rendering** (`src/render/ssr.ts`) that generates HTML with hydration attributes
- **Build system** (`build.ts`, `vite.config.ts`) that compiles components and generates assets
- **Public directory** with unused `dist-svelte-compiled` folder

### Proposed Architecture Changes

1. **Clean Build Output Management**

   - Remove unused `dist-svelte-compiled` directory generation
   - Streamline build process to only generate necessary assets

2. **Enhanced Hydration Directive System**

   - Remove `on:load` directive completely
   - Improve `on:idle` implementation with proper fallbacks
   - Add configurable `rootMargin` support for `on:visible`

3. **Intelligent Component Detection**
   - Implement script detection for automatic SSR-only vs hydration decisions
   - Support explicit SSR-only rendering without errors

## Components and Interfaces

### 1. Build System Cleanup

**Modified Components:**

- `vite.config.ts` - Remove any Svelte compilation that generates `dist-svelte-compiled`
- `build.ts` - Ensure clean build output without orphaned directories
- `public/` directory cleanup

**Interface Changes:**

```typescript
// No new interfaces needed, just cleanup of existing build configuration
```

### 2. Enhanced Hydration Client

**Modified Component:** `src/client/main.js`

**New Interface for Hydration Options:**

```typescript
interface HydrationOptions {
	rootMargin?: string;
	timeout?: number;
	fallbackToLoad?: boolean;
}

interface VisibilityOptions {
	rootMargin: string;
	threshold: number;
}
```

**Key Changes:**

- Remove `on:load` directive handling completely
- Enhance `on:idle` with proper `requestIdleCallback` implementation and timeout fallback
- Add `rootMargin` parsing for `on:visible` directive
- Implement component script detection logic

### 3. Component Detection System

**New Component:** Component analysis utilities

**Interface:**

```typescript
interface ComponentAnalysis {
	hasScript: boolean;
	hasHydrateFunction: boolean;
	framework: 'vue' | 'svelte' | 'solid' | 'unknown';
	recommendedStrategy: 'hydrate' | 'ssr-only';
}

interface DetectionResult {
	shouldHydrate: boolean;
	reason: string;
	warnings?: string[];
}
```

### 4. Enhanced SSR System

**Modified Component:** `src/render/ssr.ts`

**Interface Changes:**

```typescript
interface RenderStrategy {
	type: 'hydrate' | 'ssr-only';
	reason: string;
	warnings?: string[];
}

interface ComponentRenderOptions {
	forceSSROnly?: boolean;
	detectScripts?: boolean;
	suppressWarnings?: boolean;
}
```

## Data Models

### Hydration Configuration Model

```typescript
interface HydrationConfig {
	directive: 'on:client' | 'on:visible' | 'on:idle';
	options?: {
		rootMargin?: string; // For on:visible
		timeout?: number; // For on:idle fallback
		threshold?: number; // For on:visible
	};
}
```

### Component Metadata Model

```typescript
interface ComponentMetadata {
	path: string;
	framework: 'vue' | 'svelte' | 'solid';
	hasScript: boolean;
	hasHydrateFunction: boolean;
	renderStrategy: 'hydrate' | 'ssr-only';
	detectionConfidence: 'high' | 'medium' | 'low';
}
```

## Error Handling

### 1. Build System Error Handling

- **Unused Directory Cleanup**: Gracefully handle cases where `dist-svelte-compiled` doesn't exist
- **Build Process**: Ensure build continues even if cleanup fails, with appropriate warnings

### 2. Hydration Error Handling

- **Missing Hydrate Functions**: Log informative warnings instead of errors for SSR-only components
- **Invalid Directives**: Remove `on:load` handling and log warnings if encountered
- **Malformed Options**: Provide fallbacks for invalid `rootMargin` or other options

### 3. Component Detection Error Handling

- **Ambiguous Detection**: Provide clear feedback when script detection is uncertain
- **Framework Mismatch**: Handle cases where framework detection conflicts with file extension
- **Missing Components**: Graceful degradation when components can't be analyzed

## Testing Strategy

### 1. Build System Testing

**Manual Testing Approach:**

- Verify `dist-svelte-compiled` is not generated after build
- Confirm all necessary assets are still properly built
- Test both development and production builds

**Test Cases:**

- Clean build from scratch
- Incremental builds
- Build with various component types (Vue, Svelte, Solid)

### 2. Hydration Directive Testing

**Manual Testing Approach:**

- Test each hydration directive individually
- Verify `on:load` is no longer recognized
- Test `on:idle` with and without `requestIdleCallback` support
- Test `on:visible` with various `rootMargin` values

**Test Cases:**

```html
<!-- Should work -->
<Component on:client />
<Component on:visible={{rootMargin: "50px"}} />
<Component on:idle />

<!-- Should be ignored/warn -->
<Component on:load />

<!-- Should use defaults -->
<Component on:visible />
```

### 3. SSR-Only Rendering Testing

**Manual Testing Approach:**

- Test components with scripts vs without scripts
- Verify no hydration errors for SSR-only components
- Test explicit SSR-only configuration

**Test Components:**

- `TestCounterNoHydrate.svelte` (no script section)
- `SvelteCounter.svelte` (with script and hydrate function)
- Custom components with scripts but no hydrate function

### 4. Component Detection Testing

**Manual Testing Approach:**

- Test detection accuracy across different component types
- Verify logging output for detection decisions
- Test edge cases (empty scripts, comment-only scripts)

**Test Matrix:**
| Component Type | Has Script | Has Hydrate | Expected Strategy |
|---------------|------------|-------------|-------------------|
| Vue with setup | Yes | Yes | Hydrate |
| Svelte with script | Yes | Yes | Hydrate |
| Svelte no script | No | No | SSR-only |
| Vue template only | No | No | SSR-only |

## Implementation Notes

### 1. Backward Compatibility

- Existing `on:client`, `on:visible`, and `on:idle` directives remain fully functional
- Components with hydrate functions continue to work unchanged
- Build output structure remains the same (minus unused directories)

### 2. Performance Considerations

- Component detection runs during build/SSR time, not runtime
- `on:idle` implementation uses efficient `requestIdleCallback` with timeout fallback
- `on:visible` uses optimized Intersection Observer with configurable options

### 3. Developer Experience

- Clear logging for hydration decisions
- Informative warnings instead of errors for SSR-only components
- Configurable options for fine-tuning behavior

### 4. Framework-Specific Considerations

**Svelte:**

- Detect script sections in `.svelte` files
- Support both Svelte 4 and 5 patterns
- Handle module scripts vs component scripts

**Vue:**

- Detect `<script setup>` and regular `<script>` sections
- Support both Options API and Composition API
- Handle template-only components

**Solid:**

- Detect JSX components with Solid.js imports
- Handle both function components and class components
