# 🚀 Avalon + Vite Migration Guide

This document outlines the new Vite-powered architecture that replaces the previous no-build approach.

## What Changed

### ❌ Old Architecture (Removed)

- Manual import maps (`src/import_maps.ts`)
- HOF wrapper functions (`src/HOF/`)
- Framework-specific island components (`src/islands/preact.tsx`, etc.)
- Custom hot reload system
- Runtime TypeScript compilation
- Complex hydration with string serialization

### ✅ New Architecture (Current)

- **Vite dev server** with true HMR using `@deno/vite-plugin`
- **Universal Island component** works with any framework
- **Simplified island creation** - no wrappers needed
- **Automatic dependency resolution** via Vite
- **Build system** for production optimization
- **Island manifest** for efficient bundling
- **Official Deno-Vite integration** for seamless compatibility

## Migration Steps

### 1. Update Dependencies

```json
// deno.json - New imports
{
	"imports": {
		"vite": "npm:vite@5.0.0",
		"@deno/vite-plugin": "npm:@deno/vite-plugin",
		"preact/hooks": "npm:preact@10.26.9/hooks",
		"solid-js/web": "npm:solid-js@1.9.3/web"
	}
}
```

### 2. Create Islands (No More HOF!)

**Before:**

```tsx
import { withImports } from './src/HOF/preact.ts';
import { from } from './src/helpers/from.ts';

const Counter = withImports({
	imports: [from(['useState'], 'preact/hooks')],
})(({ count }) => {
	const [state, setState] = useState(count);
	return <button onClick={() => setState(state + 1)}>Count: {state}</button>;
});
```

**After:**

```tsx
// src/islands/Counter.tsx
import { useState } from 'preact/hooks';
import { render } from 'preact';

export default function Counter({ initialCount = 0 }) {
	const [count, setCount] = useState(initialCount);
	return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}

// Hydration function
export function hydrate(container, props) {
	render(<Counter {...props} />, container);
}
```

### 3. Use Universal Island Component

**Before:**

```tsx
import Preact from './src/islands/preact.tsx';
<Preact component={Counter} condition="on:visible" props={{ count: 0 }} />;
```

**After:**

```tsx
import { Island } from '@avalon/avalon';
<Island src="/islands/Counter.tsx" condition="on:visible" props={{ initialCount: 0 }} />;
```

### 4. Create Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import deno from '@deno/vite-plugin';

export default defineConfig({
	plugins: [deno()],
	// ... other config
});
```

### 5. Development Workflow

```bash
# Start development server (now with Vite HMR!)
deno task dev

# Build for production
deno task build

# Preview production build
deno task preview
```

## Key Benefits

### 🔥 True Hot Module Replacement

- Component-level updates without page refresh
- Preserves component state during updates
- Instant feedback loop

### 🎯 Simplified API

- No more HOF wrappers
- Universal Island component
- Clean, intuitive syntax

### 🚀 Better Performance

- Vite's optimized bundling
- Tree shaking
- Code splitting
- Efficient caching

### 🛠️ Enhanced DX

- Vite's dev tools
- Better error messages
- Source maps
- TypeScript support

### 🌐 Framework Support

- Vue SSR now works seamlessly
- Solid.js with fine-grained reactivity
- Preact with hooks
- Vanilla JS islands

## File Structure

```
avalon/
├── vite.config.ts              # Vite configuration
├── src/
│   ├── client/
│   │   └── main.ts            # Client-side island system
│   ├── islands/
│   │   ├── Island.tsx         # Universal island component
│   │   ├── Counter.tsx        # Example Preact island
│   │   ├── SolidCounter.tsx   # Example Solid island
│   │   └── TodoList.tsx       # Example complex island
│   ├── build/
│   │   └── island-manifest.ts # Island discovery & manifest
│   └── render/
│       └── server.ts          # Updated server with Vite integration
├── scripts/
│   ├── build.ts               # Production build script
│   └── build-islands.ts       # Island build script
└── dist/                      # Built assets (production)
    ├── islands/               # Bundled islands
    └── island-manifest.json   # Island manifest
```

## Development vs Production

### Development Mode

- Vite dev server on port 8002
- HMR WebSocket on port 8003
- Source files served directly
- Instant updates

### Production Mode

- Pre-built island bundles in `dist/`
- Island manifest for efficient loading
- Optimized and minified code
- Cache-friendly file names

## Examples

See `example-usage.tsx` for complete examples of the new architecture.

## Troubleshooting

### Vite Dev Server Issues

- Ensure port 8002 is available
- Check Vite configuration in `vite.config.ts`

### Island Not Loading

- Verify island exports `default` function and `hydrate` function
- Check browser console for errors
- Ensure island path is correct

### HMR Not Working

- Confirm HMR WebSocket connection on port 8003
- Check if `import.meta.hot` is available in islands

## Migration Checklist

- [ ] Update `deno.json` with new dependencies
- [ ] Create `vite.config.ts`
- [ ] Convert HOF-wrapped components to simple islands
- [ ] Replace framework-specific island usage with universal `Island`
- [ ] Update development workflow to use `deno task dev`
- [ ] Set up production build with `deno task build`
- [ ] Test HMR functionality
- [ ] Verify all islands hydrate correctly

The new architecture is simpler, more powerful, and provides a better developer experience while maintaining all the benefits of islands architecture!
