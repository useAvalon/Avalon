# 🚀 Avalon + Vite: What Changed for Users

## Major Architecture Changes

### ❌ **What's Removed (Breaking Changes)**

- **Framework-specific imports**: No more `@avalon/avalon/preact`, `/solid`, `/vue`, `/vanilla`
- **HOF wrappers**: No more `withImports()` functions
- **Manual import maps**: Vite handles all module resolution
- **Framework-specific island components**: No more `<Preact>`, `<Solid>`, `<Vue>` components

### ✅ **What's New**

- **Universal `Island` component**: Works with all frameworks
- **Vite integration**: True HMR, optimized builds, better DX
- **Simplified API**: Much less boilerplate
- **Build system**: Production optimization with `deno task build`

## Migration Steps for Your Project

### 1. **Update Your Dependencies**

```json
// deno.json
{
	"imports": {
		"@avalon/avalon": "jsr:@avalon/avalon@latest",
		"vite": "npm:vite@5.0.0",
		"@deno/vite-plugin": "npm:@deno/vite-plugin@1.0.5",
		"preact": "npm:preact@10.26.9",
		"preact/hooks": "npm:preact@10.26.9/hooks"
		// Add other frameworks as needed
	}
}
```

### 2. **Vite Configuration (Optional)**

Avalon provides sensible defaults, but you can customize if needed:

```typescript
// vite.config.ts (optional - Avalon has built-in defaults)
import { defineConfig } from 'vite';
import deno from '@deno/vite-plugin';

export default defineConfig({
	plugins: [deno()],
	// Avalon auto-discovers your islands and handles the rest
});
```

### 3. **Update Your Islands**

**Before (complex HOF wrappers):**

```typescript
import { withImports } from '@avalon/avalon/preact';
import { from } from '@avalon/avalon';

const Counter = withImports({
	imports: [from(['useState'], 'preact/hooks')],
})(({ count }) => {
	const [state, setState] = useState(count);
	return <button onClick={() => setState(state + 1)}>Count: {state}</button>;
});
```

**After (simple components):**

```typescript
// src/islands/Counter.tsx
import { useState } from 'preact/hooks';
import { render } from 'preact';

export default function Counter({ initialCount = 0 }) {
	const [count, setCount] = useState(initialCount);
	return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}

// Required: Export hydration function
export function hydrate(container, props) {
	render(<Counter {...props} />, container);
}
```

### 4. **Update Island Usage**

**Before (framework-specific):**

```typescript
import Preact from '@avalon/avalon/preact';
<Preact component={Counter} condition="on:visible" props={{ count: 0 }} />;
```

**After (universal):**

```typescript
import { Island } from '@avalon/avalon';
<Island src="/islands/Counter.tsx" condition="on:visible" props={{ initialCount: 0 }} />;
```

### 5. **Update Your Build Process**

**Add to your `deno.json`:**

```json
{
	"tasks": {
		"dev": "deno run --allow-all server.ts",
		"build": "deno run --allow-all jsr:@avalon/avalon/build",
		"preview": "DENO_ENV=production deno run --allow-all server.ts"
	}
}
```

**That's it!** 🎉 No build scripts needed - Avalon handles everything internally.

### **Framework Support & SSR**

All frameworks now support traditional SSR + hydration! Just like React/Next.js:

**✅ Preact Islands (SSR + Hydration):**

```typescript
import { renderPreactIsland } from '@avalon/avalon';
import Counter from './islands/Counter.tsx';

// Renders component to HTML, then hydrates in place
{
	renderPreactIsland(Counter, { initialCount: 5 }, '/islands/Counter.tsx', 'on:visible');
}
```

**✅ Vue Islands (SSR + Hydration):**

```typescript
import { renderVueIsland } from '@avalon/avalon';
import VueCounter from './islands/VueCounter.tsx';

// Renders Vue component to HTML, then hydrates in place
{
	await renderVueIsland(VueCounter, { initialCount: 5 }, '/islands/VueCounter.tsx', 'on:visible');
}
```

**✅ Solid Islands (SSR + Hydration):**

```typescript
import { renderSolidIsland } from '@avalon/avalon';
import SolidWidget from './islands/SolidWidget.tsx';

// Renders Solid component to HTML, then hydrates in place
{
	await renderSolidIsland(SolidWidget, { data: [] }, '/islands/SolidWidget.tsx', 'on:interaction');
}
```

All frameworks get the full SSR + hydration experience with Vite! 🚀

## Development Workflow

### **Development Mode**

```bash
deno task dev
```

- Avalon server runs on port 8000
- Vite dev server runs on port 8002
- HMR WebSocket on port 8003
- **True HMR**: Component updates without page refresh!

### **Production Build**

```bash
deno task build    # Build islands + generate manifest
deno task preview  # Test production build
```

### **What Avalon's Build Does (Internally)**

1. **Auto-scans `src/islands/`** for your island components
2. **Detects frameworks** (Preact, Solid, Vue) automatically
3. **Generates manifest** with content hashing for cache busting
4. **Runs Vite build** to bundle and optimize everything
5. **Creates `dist/`** with production-ready assets

All handled by Avalon - zero configuration needed! 🚀

## File Structure

```
your-project/
├── vite.config.ts          # Vite configuration (optional - Avalon provides defaults)
├── src/
│   ├── islands/            # Your island components
│   │   ├── Counter.tsx     # Preact island
│   │   ├── TodoList.tsx    # Complex Preact island
│   │   └── VueWidget.tsx   # Vue 3 island
│   └── routes/             # Your page routes
└── dist/                   # Built assets (auto-generated)
    ├── islands/            # Bundled island files
    └── island-manifest.json # Auto-generated manifest
```

## Key Benefits You Get

### 🔥 **True Hot Module Replacement**

- Component-level updates without page refresh
- State preservation during development
- Instant feedback loop

### 🎯 **Simplified Development**

- No more HOF wrappers or complex setup
- Universal Island component for all frameworks
- Standard Vite tooling and ecosystem

### 🚀 **Better Performance**

- Vite's optimized bundling and tree shaking
- Automatic code splitting per island
- Production-ready minification

### 🌐 **Enhanced Framework Support**

- **All frameworks**: Full SSR + hydration support with Vite
- **Preact**: Direct `Island` component usage
- **Vue & Solid**: Use `createVueIslandWithSSR` and `createSolidIslandWithSSR` helpers
- **Automatic fallback**: If SSR fails, gracefully falls back to client-only
- **Zero configuration**: Framework-specific rendering handled automatically

## Breaking Changes Summary

| Old Way                                               | New Way                                   |
| ----------------------------------------------------- | ----------------------------------------- |
| `import { withImports } from '@avalon/avalon/preact'` | `// No wrapper needed`                    |
| `<Preact component={Counter} />`                      | `<Island src="/islands/Counter.tsx" />`   |
| Manual import maps                                    | Vite handles imports                      |
| `from(['useState'], 'preact/hooks')`                  | `import { useState } from 'preact/hooks'` |
| No build step                                         | `deno task build` (batteries included)    |

The new architecture is **much simpler**, **more powerful**, and **zero-config**! 🎉

### 🔋 **Batteries Included Philosophy**

- **No custom build scripts** - Just `deno task build`
- **Auto-discovery** - Avalon finds your islands automatically
- **Smart defaults** - Vite config optional, sensible defaults provided
- **Framework detection** - Automatically detects Preact, Solid, Vue
- **Zero configuration** - Works out of the box
