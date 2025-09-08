# avalon Islands

A lightweight, framework-agnostic islands architecture library for building interactive web applications with minimal JavaScript.

## Core Philosophy: The "Unbundled" Approach

avalon is built on a "zero-bundle" philosophy. The goal is to avoid sending large, monolithic JavaScript bundles and instead load only the code for components that are actually interactive.

**How it Works:** Instead of a traditional build step that bundles all your code into one file, avalon serves your components as individual ES modules directly from your `src` directory. When an island needs to be hydrated on the client, the browser requests only that specific component's file and its dependencies.

This approach provides several key advantages:

- **Granular Caching**: Browsers can cache each component file independently. If you change a single component, clients only need to re-download that one small file, not the entire site's JavaScript.
- **No Build Step**: Development is fast and simple. Save a file, and it's immediately ready to be served. This creates a rapid and seamless developer experience.
- **True Islands Architecture**: It perfectly embodies the islands model by shipping the absolute minimum amount of JavaScript required for a page to become interactive.

The primary trade-off is a potential for more HTTP requests on initial load for pages with many complex components. However, with HTTP/2 and effective caching, this impact is often minimal compared to the long-term benefits of smaller, targeted updates.

## Features

- 🏝️ **Islands Architecture**: Ship only the JavaScript you need
- ⚡ **Framework Agnostic**: Support for Vanilla JS, Preact, Solid, and Vue
- 🎯 **Selective Hydration**: Components hydrate only when needed
- 📦 **Minimal Bundle Size**: Tree-shakeable exports for optimal performance
- 🔧 **TypeScript First**: Full type safety and excellent DX
- 🚀 **SSR Ready**: Server-side rendering with client-side hydration
- 🌐 **Zero-Bundle**: Load only the code for components that are actually interactive
- 🔥 **Hot Reload**: Instant development feedback with intelligent change detection
- 🛣️ **API Routes**: Built-in Next.js-style API system with file-based routing
- 📡 **Auto-Discovery**: Automatic API endpoint detection from `src/api/` folder
- 🖼️ **Image Compression**: Automatic WebP conversion and optimization for better performance

## Static by Default: Understanding Island Hydration

avalon follows the core islands architecture principle: **components are static by default and only become interactive when explicitly requested**. This ensures optimal performance by shipping minimal JavaScript to the client.

### Framework-Specific Hydration Behavior

Different frameworks have different capabilities for server-side rendering, which affects their hydration behavior:

#### ✅ **Preact & Vanilla Islands: Conditionally Static**

**Preact** and **Vanilla** components can be server-side rendered and support **true static rendering**:

```typescript
// STATIC: Pure HTML, no JavaScript sent to client
<Island component={MyPreactComponent} />
<Island component={MyVanillaComponent} />

// INTERACTIVE: Includes hydration code with lazy loading
<Island component={MyPreactComponent} condition="on:visible" />
<Island component={MyVanillaComponent} condition="on:interaction" />
```

**When no `condition` prop is provided:**

- ✅ Renders pure static HTML during SSR
- ✅ No hydration infrastructure created behind the scenes
- ✅ No client-side JavaScript included
- ✅ Minimal bundle size
- ✅ Perfect for static content like headers, footers, testimonials

#### ⚡ **Solid & Vue Islands: Always Interactive**

**Solid** and **Vue** components cannot be server-side rendered in avalon, so they are **always hydrated on the client**:

```typescript
// These are ALWAYS interactive - hydrate immediately on page load
<Island component={MySolidComponent} />
<Island component={MyVueComponent} />
```

**Behavior:**

- 🔄 Always hydrates immediately when page loads
- 🔄 Always includes client-side JavaScript
- 🔄 Components render only on the client (no SSR)
- ⚠️ Higher initial bundle size

### When Components Become Interactive

Control when your components hydrate and become interactive:

| Condition                              | When It Hydrates               | Best For                            |
| -------------------------------------- | ------------------------------ | ----------------------------------- |
| **No condition**                       | Never (stays static)           | Headers, footers, static content    |
| `condition="on:visible"`               | When scrolled into view        | Below-fold content, modals          |
| `condition="on:interaction"`           | On first click/touch/hover     | Buttons, forms, interactive widgets |
| `condition="on:idle"`                  | When browser has nothing to do | Non-critical interactive elements   |
| `condition="on:client"`                | Immediately when page loads    | Critical interactive components     |
| `condition="media:(min-width: 768px)"` | When media query matches       | Responsive components               |

### When to Use Islands vs Direct Components

#### 📄 **Use Direct Preact Components When:**

- Content is purely static
- No user interaction required
- Maximum performance is critical

#### 🏝️ **Use Islands When:**

- You need interactivity (clicks, state, effects)
- You want lazy loading for performance
- Component needs client-side data fetching

> **Note**: Vanilla components **always need the Island wrapper** because they require the template system and container setup. Preact components can be used directly for pure static content, or wrapped in Islands for interactivity.

```typescript
// Direct Preact component (pure static HTML, no island infrastructure)
export default function StaticHeader() {
	return <h1>Welcome to My Site</h1>;
}

// Preact island (static rendering, but island infrastructure ready for potential interactivity)
export default function PreactStaticWidget() {
	return <Island component={WidgetComponent} />; // Static HTML
}

// Preact island (interactive with lazy loading)
export default function PreactInteractiveWidget() {
	return <Island component={WidgetComponent} condition="on:interaction" />;
}

// Vanilla island (static by default - always needs Island wrapper)
export default function VanillaWidget() {
	return <Island component={VanillaWidgetComponent} />; // Static HTML
}

// Vanilla island (interactive)
export default function VanillaInteractiveWidget() {
	return <Island component={VanillaWidgetComponent} condition="on:visible" />;
}
```

### Performance Impact

| Component Type       | HTML Size | JS Bundle        | Time to Interactive |
| -------------------- | --------- | ---------------- | ------------------- |
| **Static Preact**    | Minimal   | None             | Immediate (static)  |
| **Static Vanilla**   | Minimal   | None             | Immediate (static)  |
| **Lazy Island**      | Small     | Loaded on demand | When condition met  |
| **Solid/Vue Island** | Small     | Full framework   | On page load        |

**Recommendation**: Use static rendering by default, and only add `condition` directives when interactivity is truly needed.

## How avalon Compares to Other Frameworks

avalon stands out in the islands architecture landscape with its unique approach to framework-agnostic development and true static-by-default behavior.

### Islands Architecture Frameworks Comparison

| Framework  | Philosophy                 | Framework Support                 | Default Behavior       | Runtime Size       |
| ---------- | -------------------------- | --------------------------------- | ---------------------- | ------------------ |
| **avalon** | Framework-agnostic islands | Preact, Solid, Vue, Vanilla       | **Static by default**  | Zero to minimal    |
| **Astro**  | Content-first with islands | React, Preact, Vue, Svelte, Solid | **Zero JS by default** | Zero to minimal    |
| **Fresh**  | Server-side rendering      | Preact only                       | Islands always hydrate | ~10KB + Preact     |
| **Qwik**   | Resumable applications     | Qwik components only              | Progressive hydration  | ~1KB + lazy chunks |

### Key Differentiators

#### ✅ **avalon's Unique Advantages**

**Framework Flexibility:**

```typescript
// Use any framework in the same project
<Island component={PreactComponent} condition="on:visible" />
<Island component={SolidComponent} condition="on:interaction" />
<Island component={VueComponent} condition="on:idle" />
<Island component={VanillaComponent} /> // Static by default
```

**True Static by Default:**

- ✅ **Astro**: Zero JavaScript by default, explicit hydration directives
- ❌ **Fresh**: Always includes Preact runtime
- ❌ **Qwik**: Uses progressive hydration (still includes runtime)
- ✅ **avalon**: Zero JavaScript for components without `condition`

**Development Simplicity:**

- No build-time optimizations required
- No special syntax to learn
- Direct ES modules serving from `/src/*`
- Works with existing TypeScript/JavaScript knowledge

#### 🎯 **When to Choose avalon Over Alternatives**

**Choose avalon over Astro when:**

- You want to mix different frameworks in the same component
- You prefer runtime-based hydration over build-time compilation
- You want simpler development without build-time optimizations
- You need framework-agnostic islands (Astro requires framework-specific setup)

**Choose avalon over Fresh when:**

- You want to use frameworks other than Preact
- You need truly static components (Fresh always hydrates islands)
- You want more control over when components become interactive

**Choose avalon over Qwik when:**

- You have existing React/Vue/Solid knowledge (no need to learn Qwik syntax)
- You want true static rendering (Qwik uses progressive hydration)
- You prefer explicit hydration control over automatic resumability

### Framework Ecosystem Comparison

| Aspect                      | avalon                 | Astro                    | Fresh                     | Qwik                       |
| --------------------------- | ---------------------- | ------------------------ | ------------------------- | -------------------------- |
| **Component Reuse**         | ✅ Any framework       | ✅ Multiple frameworks   | ❌ Preact only            | ❌ Qwik only               |
| **Learning Curve**          | ✅ Use existing skills | ⚠️ Learn Astro syntax    | ⚠️ Learn Fresh patterns   | ❌ Learn new framework     |
| **Static Performance**      | ✅ True zero-JS        | ✅ Zero-JS by default    | ❌ Always includes Preact | ❌ Always includes runtime |
| **Interactive Performance** | ✅ Lazy loading        | ✅ Lazy loading          | ⚠️ Immediate hydration    | ✅ Progressive hydration   |
| **Build Complexity**        | ✅ Simple (no build)   | ⚠️ Complex optimizations | ✅ Simple                 | ⚠️ Complex optimizations   |

### Real-World Use Cases

**avalon excels for:**

- **Multi-framework teams** - Use everyone's preferred framework
- **Content sites with selective interactivity** - Blog with interactive widgets
- **Performance-critical applications** - E-commerce with minimal JavaScript
- **Gradual modernization** - Add interactivity to existing static sites

**Example: E-commerce Site**

```typescript
// Static product listing (zero JS)
<Island component={ProductGrid} />

// Interactive cart (loads on interaction)
<Island component={CartWidget} condition="on:interaction" />

// Search (loads when visible)
<Island component={SearchComponent} condition="on:visible" />

// Reviews (different framework team preference)
<Island component={VueReviewsWidget} condition="on:visible" />
```

This gives you the best of all worlds: **minimal JavaScript by default**, **framework flexibility**, and **precise control** over when interactivity loads.

## Installation

```bash
# Install from JSR (JavaScript Registry)
deno add jsr:@avalon/islands
```

## Import System

avalon Islands uses a modular import system with framework-specific exports. Each framework has its own entry point to ensure optimal tree-shaking and minimal bundle sizes.

### Framework-Specific Imports

```typescript
// Vanilla JavaScript
import { Island, withImports, from } from '@avalon/islands/vanilla';

// Preact
import { Island, withImports, from } from '@avalon/islands/preact';

// Solid
import { Island, withImports, from } from '@avalon/islands/solid';

// Vue
import { Island, withImports, from } from '@avalon/islands/vue';

// Server utilities
import { createServer, renderToHtml } from '@avalon/islands/server';

// Core utilities and types (shared)
import { mergeOptions, validators } from '@avalon/islands';
```

### Dynamic Imports with `from` Helper

The `from` helper makes **local modules** from your `src` folder available for islands on the client side. In your component code, you import normally from the actual file paths, and the `from` helper ensures those modules are available when the island hydrates.

#### Local Module Imports (using `from`)

```typescript
import { createSignal, onCleanup } from 'solid-js';
import { withImports, from } from '@avalon/islands/solid';
import { $count } from '@store/store.ts';

// Helper for store imports
const withStore = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'store/store.ts')),
	});

// Helper for utils imports
const withUtils = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'utils/utils.ts')),
	});

const SolidCounterComponent = withStore(['$count', '$history'])(() => {
	return () => {
		const [getCount, setCount] = createSignal($count.get());

		// Subscribe to store changes
		const unsubCount = $count.subscribe((count: number) => {
			setCount(() => count);
		});

		// Cleanup subscriptions
		onCleanup(() => {
			unsubCount();
		});

		return (
			<div>
				<h1>Count: {getCount()}</h1>
				<button type="button" onClick={() => $count.set(getCount() + 1)}>
					Increment
				</button>
				<button type="button" onClick={() => $count.set(getCount() - 1)}>
					Decrement
				</button>
			</div>
		);
	};
});
```

#### Detached Pattern with Helper Functions

For cleaner, more readable code, you can create helper functions that work with `withImports`:

```typescript
import { withImports, from } from '@avalon/islands/preact';

// Helper function for common store imports
const withStore = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'store/client-store.ts')),
	});

// Clean, detached usage
const DealAlertsComponent = withStore(['addTrackedTrip'])(() => {
	return <div>Deal alerts content</div>;
});
```

#### Vanilla Example

```typescript
import { withImports, from, Island } from '@avalon/islands/vanilla';
import { $count, increment, decrement } from '@store/store.ts';
import { formatNumber } from '@utils/formatters.ts';

// Helper for combining store and formatter imports
const withStoreAndFormatters = (storeImports: string[], formatterImports: string[]) =>
	withImports({
		imports: [
			...storeImports.map(name => from([name], 'store/store.ts')),
			...formatterImports.map(name => from([name], 'utils/formatters.ts')),
		],
	});

const Counter = withStoreAndFormatters(
	['$count', 'increment', 'decrement'],
	['formatNumber']
)((container, props) => {
	// Use imported functions directly
	const updateDisplay = () => {
		const display = container.querySelector('.count');
		display.textContent = formatNumber($count.get());
	};

	// Set up event listeners
	container.querySelector('.increment').addEventListener('click', () => {
		increment();
		updateDisplay();
	});

	container.querySelector('.decrement').addEventListener('click', () => {
		decrement();
		updateDisplay();
	});

	updateDisplay();
});

Counter.template = props => `
  <div>
    <span class="count">${props.count || 0}</span>
    <button class="increment">+</button>
    <button class="decrement">-</button>
  </div>
`;

// Export the component with island wrapper
export default function VanillaCounter() {
	return <Island component={Counter} props={{ count: 0 }} />;
}
```

> **Important**:
>
> - The `from` helper is only for **local modules** in your `src` folder
> - In your component code, import normally: `import { $count } from 'store/store.ts'`
> - The `from` helper makes these imports available in the client hydration script
> - Paths are relative to your `src` folder (e.g., `'utils/utils.ts'` = `src/utils/utils.ts`)

#### External Package Imports (using Import Maps)

External packages are loaded via import maps in your server configuration:

```typescript
// External packages go in import maps, NOT in component imports
const routes: Routes = {
	'/dashboard': {
		component: DashboardPage,
		options: {
			importMap: {
				imports: {
					// External packages
					lodash: 'https://esm.sh/lodash@4.17.21',
					d3: 'https://esm.sh/d3@7.8.5',
				},
			},
		},
	},
};
```

#### Framework-Specific Import Behavior

**Preact Islands**:

- Pre-loads common hooks: `useState`, `useEffect`, `useCallback`, etc.
- Additional Preact hooks need to be added to import maps
- Component-level imports using `from` are **not currently supported**

**Solid Islands**:

- Pre-loads: `render`, `jsx`, `createSignal`, `onCleanup`
- Supports component-level imports using `from` helper
- Can accept `imports` prop directly on the island

**Vanilla Islands**:

- Supports component-level imports using `from` helper
- All imports are for local modules only

**Vue Islands**:

- Supports component-level imports using `from` helper
- Pre-loads basic Vue functionality

```typescript
// Example: Solid island with component-level imports
import { createSignal } from 'solid-js';
import { withImports, from, Island } from '@avalon/islands/solid';
import { formatData, calculateStats } from '@utils/data.ts';
import { logger } from '@utils/logger.ts';

const withDataUtils = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'utils/data.ts')),
	});

const withLogger = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'utils/logger.ts')),
	});

// Option 1: Combine multiple import sources
const withDataAndLogger = (dataImports: string[], loggerImports: string[]) =>
	withImports({
		imports: [
			...dataImports.map(name => from([name], 'utils/data.ts')),
			...loggerImports.map(name => from([name], 'utils/logger.ts')),
		],
	});

const ChartComponent = withDataAndLogger(
	['formatData', 'calculateStats'],
	['logger']
)(() => {
	return () => {
		const [data, setData] = createSignal([]);

		// Use imported local modules directly
		const processedData = formatData(data());
		const stats = calculateStats(processedData);
		logger.info('Chart rendered', stats);

		return <div>Chart with {stats.count} data points</div>;
	};
});

// Export the component with island wrapper
export default function Chart() {
	return <Island component={ChartComponent} />;
}

// Usage in pages
// import Chart from './Chart.tsx';
// <Chart />
```

### Global vs Per-Route Imports

#### Global Imports (Server Configuration)

Define imports that are available across all routes:

```typescript
import { createServer } from '@avalon/islands/server';

const server = createServer({
	routes: {
		'/': {
			component: HomePage,
		},
		'/about': {
			component: AboutPage,
		},
	},
	defaultOptions: {
		title: 'My App',
	},
	// Global import map configuration
	importMap: {
		imports: {
			preact: 'https://esm.sh/preact@10.26.9',
			'preact/hooks': 'https://esm.sh/preact@10.26.9/hooks',
			'solid-js': 'https://esm.sh/solid-js@1.8.15',
			vue: 'https://esm.sh/vue@3.4.0',
			lodash: 'https://esm.sh/lodash@4.17.21',
		},
	},
});
```

#### Per-Route Imports

Define route-specific imports in the server configuration that are only loaded on certain pages:

```typescript
import { createServer, type Routes } from '@avalon/islands/server';
import HomePage from './pages/home.tsx';
import DashboardPage from './pages/dashboard.tsx';

const routes: Routes = {
	'/': {
		component: HomePage,
		options: {
			title: 'Home - My App',
			meta: [{ name: 'description', content: 'Welcome to the homepage' }],
		},
	},
	'/dashboard': {
		component: DashboardPage,
		options: {
			title: 'Dashboard - My App',
			meta: [{ name: 'description', content: 'User dashboard' }],
			// Route-specific import map configuration
			importMap: {
				imports: {
					// Add dashboard-specific libraries
					d3: 'https://esm.sh/d3@7.8.5',
					'chart.js': 'https://esm.sh/chart.js@4.4.0',
					'ag-grid': 'https://cdn.jsdelivr.net/npm/ag-grid-community@31.0.1/dist/ag-grid-community.min.js',
				},
			},
		},
	},
	'/analytics': {
		component: AnalyticsPage,
		options: {
			title: 'Analytics - My App',
			importMap: {
				imports: {
					'plotly.js': 'https://esm.sh/plotly.js@2.26.0',
					'date-fns': 'https://esm.sh/date-fns@2.30.0',
				},
			},
		},
	},
};

const server = createServer({
	routes,
	defaultOptions: {
		title: 'My App',
	},
	// Global import map configuration
	importMap: {
		imports: {
			preact: 'https://esm.sh/preact@10.26.9',
			'preact/hooks': 'https://esm.sh/preact@10.26.9/hooks',
		},
	},
});
```

#### Component-Level Imports (Local Modules Only)

Define imports at the component level for local modules using the `from` helper:

```typescript
import { vanillaComponent, from, Island } from '@avalon/islands/vanilla';
import { formatData, processData } from 'utils/data.ts';
import { logger } from 'debug/logger.ts';

// Helper functions for cleaner syntax
const withDataUtils = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'utils/data.ts')),
	});

const withDebug = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'debug/logger.ts')),
	});

// Component that imports local utilities from multiple files
const MyComponent = withDataAndDebug(
	['formatData', 'processData'],
	['logger']
)((container, props) => {
	// Use imported local modules directly
	const data = formatData(props.rawData);
	const processed = processData(data);
	logger.info('Component initialized', { data, processed });
});

// Export the component with island wrapper
export default function DataProcessor() {
	return <Island component={MyComponent} props={{ rawData: [] }} />;
}
```

#### Complete Example

```typescript
// Server configuration with external packages
const routes: Routes = {
	'/analytics': {
		component: AnalyticsPage,
		options: {
			importMap: {
				imports: {
					// External packages available to all components on this route
					d3: 'https://esm.sh/d3@7.8.5',
					lodash: 'https://esm.sh/lodash@4.17.21',
				},
			},
		},
	},
};

// Component with local module imports
import { vanillaComponent, from, Island } from '@avalon/islands/vanilla';
import { calculateStats, generateReport } from 'analytics/stats.ts';
import { formatNumber, formatCurrency } from 'utils/formatters.ts';

// Helper for combining analytics and formatter imports
const withAnalyticsAndFormatters = (analyticsImports: string[], formatterImports: string[]) =>
	withImports({
		imports: [
			...analyticsImports.map(name => from([name], 'analytics/stats.ts')),
			...formatterImports.map(name => from([name], 'utils/formatters.ts')),
		],
	});

const ChartComponent = withAnalyticsAndFormatters(
	['calculateStats', 'generateReport'],
	['formatNumber', 'formatCurrency']
)((container, props) => {
	// External packages are available globally via import maps
	// Local modules are used directly via normal imports
	const stats = calculateStats(props.data);
	const report = generateReport(stats);
	const displayValue = formatNumber(stats.total);
});

// Export the component with island wrapper
export default function AnalyticsChart() {
	return <Island component={ChartComponent} props={{ data: [] }} />;
}
```

#### Import Map Merging Behavior

Route-level import maps are **always merged** with global import maps. If the same package is defined in both global and route-level import maps, the route-level version takes precedence.

```typescript
// Global import map
const serverConfig: ServerConfig = {
  importMap: {
    imports: {
      'lodash': 'https://esm.sh/lodash@4.17.21',
      'preact': 'https://esm.sh/preact@10.26.9',
    },
  },
};

// Route-level import map
'/special-page': {
  component: SpecialPage,
  options: {
    importMap: {
      imports: {
        'special-lib': 'https://esm.sh/special-lib@1.0.0',
        'lodash': 'https://esm.sh/lodash@4.18.0', // Overrides global lodash version
      },
    }
  }
}
// Result: special-lib, lodash@4.18.0, and preact@10.26.9 are all available
```

> **Note**: Local module imports via `from` helper are always additive and independent of external package import maps.

## Quick Start

### Vanilla JavaScript

```typescript
// src/components/VanillaCounter.tsx
import { withImports, Island } from '@avalon/islands/vanilla';

// Simple component without imports
const CounterComponent = withImports()((container, props = { count: 0 }) => {
	let count = props.count;
	const button = container.querySelector('button')!;
	const span = container.querySelector('span')!;

	const updateCount = () => {
		span.textContent = count.toString();
	};

	button.addEventListener('click', () => {
		count++;
		updateCount();
	});

	updateCount();
});

// Add template
CounterComponent.template = (props = { count: 0 }) => `
  <div>
    <span>${props.count}</span>
    <button>+</button>
  </div>
`;

// Export the component with island wrapper
export default function VanillaCounter() {
	// STATIC VERSION: Renders as pure HTML, no interactivity
	return <Island component={CounterComponent} props={{ count: 5 }} />;

	// INTERACTIVE VERSION: Hydrates when user interacts
	// return <Island component={CounterComponent} props={{ count: 5 }} condition="on:interaction" />;
}
```

### Preact

```typescript
// src/components/PreactCounter.tsx
import { withImports, Island } from '@avalon/islands/preact';
import { useState } from 'preact/hooks';

// Simple component without imports
const CounterComponent = withImports()(() => {
	const [count, setCount] = useState(0);

	return (
		<div>
			<span>{count}</span>
			<button onClick={() => setCount(c => c + 1)}>+</button>
		</div>
	);
});

// Export the component with island wrapper
export default function PreactCounter() {
	// STATIC VERSION: Renders as pure HTML, no interactivity
	return <Island component={CounterComponent} />;

	// INTERACTIVE VERSION: Hydrates when component becomes visible
	// return <Island component={CounterComponent} condition="on:visible" />;
}
```

### Solid

```typescript
import { Island, withImports, from } from '@avalon/islands/solid';

// Helper for client utilities
const withClient = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'client/some.ts')),
	});

const Counter = withClient(['someClientFn'])(() => {
	const [count, setCount] = createSignal(0);
	return () => <button onClick={() => setCount(count() + 1)}>Count: {count()}</button>;
});

// Solid components are ALWAYS interactive (cannot be static)
export default function SolidCounter() {
	// Always hydrates immediately on client (equivalent to condition="on:client")
	return <Island component={Counter} props={{ initial: 5 }} />;
}
```

### Vue

```typescript
// src/components/VueCounter.tsx
import { withImports, Island } from '@avalon/islands/vue';
import { ref } from 'vue';

// Simple component without imports
const CounterComponent = withImports()(() => ({
	setup() {
		const count = ref(0);
		return { count };
	},
	template: `
    <div>
      <span>{{ count }}</span>
      <button @click="count++">+</button>
    </div>
  `,
}));

// Export the component with island wrapper
export default function VueCounter() {
	// Vue components are ALWAYS interactive (cannot be static)
	// Always hydrates immediately on client (equivalent to condition="on:client")
	return <Island component={CounterComponent} />;
}
```

### Using Components in Pages

Now you can import and use your components directly without worrying about island syntax:

```typescript
// src/pages/home.tsx
import VanillaCounter from '../components/VanillaCounter.tsx';
import PreactCounter from '../components/PreactCounter.tsx';
import SolidCounter from '../components/SolidCounter.tsx';
import VueCounter from '../components/VueCounter.tsx';

export default function HomePage() {
	return (
		<div>
			<h1>My App</h1>
			<VanillaCounter />
			<PreactCounter />
			<SolidCounter />
			<VueCounter />
		</div>
	);
}
```

## 🖼️ Image Compression

High-performance image compression with WebP conversion using Sharp.

```bash
# Setup
mkdir -p src/images  # Add your images here
deno task compress-images  # Compress when needed
```

**Create `compress-images.ts` in your project:**

```typescript
import { compressImages } from '@avalon/islands/server';

await compressImages({
	enabled: true,
	quality: 80,
	srcDir: 'src/images',
	outputDir: 'public/images',
	formats: ['webp'],
	sizes: [
		{ width: 800, height: 600, suffix: '_md' },
		{ width: 400, height: 300, suffix: '_sm' },
	],
});
```

**Add to `deno.json`:**

```json
{
	"tasks": {
		"compress-images": "deno run -A compress-images.ts"
	}
}
```

✨ Compresses 4MB images to ~200KB with excellent quality retention.

## 🔥 Hot Reload Development

avalon includes a hot reload system that provides instant feedback during development. The hot reload automatically detects file changes and updates your browser in real-time without full page refreshes.

### How Hot Reload Works

#### 1. **File Watching & Change Detection**

- **Native Deno File Watcher**: Uses `Deno.watchFs()` for efficient file system monitoring
- **Smart Filtering**: Automatically ignores temporary files, build outputs, and IDE-specific files
- **Rate Limiting**: Prevents excessive reloads with intelligent debouncing (30-50ms)

#### 2. **WebSocket Communication**

- **Real-time Updates**: Changes are pushed to browsers via WebSocket connections
- **Connection Management**: Automatically handles client connections and disconnections
- **Change Queuing**: Queues changes that occur before clients are ready, ensuring no updates are lost

#### 3. **Intelligent Content Updates**

- **CSS Hot Reload**: CSS files update instantly without page refresh
- **Smart HTML Updates**: Other files trigger intelligent content replacement with smooth transitions
- **Fallback Handling**: Gracefully falls back to full page reload if needed

### Configuration

Hot reload is automatically enabled in development mode. You can customize the behavior:

```typescript
// server.ts
import { createServer } from '@avalon/islands/server';

const server = createServer({
	routes,
	port: 8001,
	// Hot reload automatically runs on port + 1 (8002)
	// Customize hot reload options if needed
	hotReload: {
		debounceMs: 30, // Faster debounce for development
		watchDirs: ['src'], // Only watch source directory
		watchExtensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.html'],
	},
});
```

### Performance Optimizations

The hot reload system includes several performance optimizations:

- **Debounced Updates**: Prevents rapid successive reloads
- **Efficient File Filtering**: Skips unnecessary files and directories
- **Polling Fallback**: 1-second polling as backup to native file watching
- **Connection Buffering**: Queues changes until clients are ready
- **Rate Limiting**: Minimum 50ms between reloads to prevent spam

### Development Workflow

1. **Start Development Server**:

   ```bash
   deno task dev
   ```

2. **Make Changes**: Edit any file in your `src/` directory
3. **Instant Updates**: See changes reflected immediately in your browser
4. **No Manual Refresh**: Hot reload handles everything automatically

### Troubleshooting

- **Changes Not Detected**: Ensure files are in watched directories (`src/`, `public/`)
- **Slow Updates**: Check if large files or build outputs are being watched
- **Connection Issues**: Hot reload automatically reconnects if WebSocket connection drops

## Global State Management with Nanostore

Nanostore provides a lightweight, framework-agnostic reactive state management system that works seamlessly with avalon Islands. It's particularly useful for sharing state between islands and managing global application state.

### Setting Up Nanostore

First, configure Nanostore in your server's import map:

```typescript
// server.ts
import { createServer } from '@avalon/islands/server';
import { routes } from './routes.ts';

const server = createServer({
	routes,
	port: 8001,
	importMap: {
		imports: {
			nanostores: 'https://esm.sh/nanostores@1.0.1',
		},
	},
});
```

### Creating a Global Store

Create a store file that defines your global state:

```typescript
// src/store/counter.ts
import { atom } from 'nanostores';

export const $count = atom(0);

export function increment() {
	$count.set($count.get() + 1);
}

export function decrement() {
	$count.set($count.get() - 1);
}

export function reset() {
	$count.set(0);
}
```

### Using Nanostore in Components

#### Understanding the Dual Import Pattern

When using Nanostore with avalon Islands, you'll notice a dual import pattern in the examples below. This is important to understand:

1. **TypeScript Import** (top of file): For development experience only

   - Provides syntax highlighting and type checking in your IDE
   - NOT sent to the client browser
   - Only used during development and build-time type checking

2. **Runtime Import** (in `imports` array): For actual client-side execution
   - Uses the `from()` helper to specify which files to load in the browser
   - These files ARE sent to the client when the island hydrates
   - This is what makes your code actually work at runtime

**Why both?** The TypeScript import gives you a great development experience with auto-completion and error checking, while the `from()` import ensures the code is available when your island runs in the browser.

#### Preact Example

```typescript
// src/components/PreactCounter.tsx
import { useState, useEffect } from 'preact/hooks';
import { withImports, from, Island } from '@avalon/islands/preact';

// TypeScript import for development (syntax highlighting, type checking)
// This is NOT sent to the client - it's only for your IDE and TypeScript compiler
import { $count, increment, decrement } from '@store/counter.ts';

// Helper for store imports
const withStore = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'store/counter.ts')),
	});

const PreactCounterComponent = withStore(['$count', 'increment', 'decrement', 'reset'])(function PreactGlobalUtil() {
	const [count, setCount] = useState($count.get());

	useEffect(() => {
		const unsubscribe = $count.subscribe(setCount);
		return unsubscribe;
	}, []);

	return (
		<div>
			<h3>Preact Counter: {count}</h3>
			<button onClick={increment}>+</button>
			<button onClick={decrement}>-</button>
			<button onClick={reset}>Reset</button>
		</div>
	);
});

export default function PreactGlobalUtil() {
	return <Island component={PreactCounterComponent} condition="on:interaction" />;
}
```

#### Solid Example

```typescript
// src/components/SolidCounter.tsx
import { createSignal, onCleanup } from 'solid-js';
import { withImports, from, Island } from '@avalon/islands/solid';

// Helper for store imports
const withStore = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'store/counter.ts')),
	});

const SolidCounterComponent = withStore(['$count', 'increment', 'decrement', 'reset'])(() => {
	const [count, setCount] = createSignal($count.get());

	const unsubscribe = $count.subscribe(setCount);
	onCleanup(unsubscribe);

	return (
		<div>
			<h3>Solid Counter: {count()}</h3>
			<button onClick={increment}>+</button>
			<button onClick={decrement}>-</button>
			<button onClick={reset}>Reset</button>
		</div>
	);
});

export default function SolidCounter() {
	return <Island component={SolidCounterComponent} condition="on:interaction" />;
}
```

#### Vanilla Example

```typescript
// src/components/VanillaCounter.tsx
import { withImports, from, Island } from '@avalon/islands/vanilla';

function createCounter(container: HTMLElement) {
	const updateDisplay = () => {
		const countElement = container.querySelector('.count');
		if (countElement) {
			countElement.textContent = $count.get().toString();
		}
	};

	// Subscribe to store changes
	const unsubscribe = $count.subscribe(updateDisplay);

	// Add event listeners
	container.addEventListener('click', e => {
		const target = e.target as HTMLElement;
		if (target.matches('.increment')) increment();
		if (target.matches('.decrement')) decrement();
		if (target.matches('.reset')) reset();
	});

	// Initial render
	updateDisplay();

	// Cleanup function
	return () => {
		unsubscribe();
	};
}

createCounter.template = () => `
  <div>
    <h3>Vanilla Counter: <span class="count">0</span></h3>
    <button class="increment">+</button>
    <button class="decrement">-</button>
    <button class="reset">Reset</button>
  </div>
`;

// Helper for store imports
const withStore = (imports: string[]) =>
	withImports({
		imports: imports.map(name => from([name], 'store/counter.ts')),
	});

const VanillaCounterComponent = withStore(['$count', 'increment', 'decrement', 'reset'])(createCounter);

export default function VanillaCounter() {
	return <Island component={VanillaCounterComponent} condition="on:interaction" />;
}
```

### Advanced Store Patterns

#### Computed Values

```typescript
// src/store/advanced.ts
import { atom, computed } from 'nanostores';

export const $todos = atom([]);

export const $completedTodos = computed($todos, todos => todos.filter(todo => todo.completed));

export const $todoStats = computed([$todos, $completedTodos], (todos, completed) => ({
	total: todos.length,
	completed: completed.length,
	remaining: todos.length - completed.length,
}));
```

#### Persistent Store

```typescript
// src/store/persistent.ts
import { persistentAtom } from 'nanostores';

export const $userPreferences = persistentAtom('user-prefs', {
	theme: 'light',
	language: 'en',
});

export function updateTheme(theme: 'light' | 'dark') {
	$userPreferences.set({ ...$userPreferences.get(), theme });
}
```

### Cross-Framework State Sharing

One of the key benefits of Nanostore is seamless state sharing between different framework islands:

```typescript
// src/pages/dashboard.tsx
import PreactCounter from '../components/PreactCounter.tsx';
import SolidCounter from '../components/SolidCounter.tsx';
import VanillaCounter from '../components/VanillaCounter.tsx';

export default function DashboardPage() {
	return (
		<div>
			<h1>Dashboard</h1>
			{/* Multiple islands can share the same store */}
			<PreactCounter /> {/* Updates global $count */}
			<SolidCounter /> {/* Reacts to $count changes */}
			<VanillaCounter /> {/* Can modify $count */}
		</div>
	);
}
```

All islands automatically stay in sync through the reactive store system.

### Best Practices

1. **Keep stores focused**: Create separate stores for different domains (user, cart, notifications)
2. **Use computed values**: Derive state instead of duplicating it
3. **Cleanup subscriptions**: Always unsubscribe in cleanup functions
4. **Export actions**: Provide functions to modify state instead of direct mutations
5. **Type your stores**: Use TypeScript interfaces for complex state shapes

```typescript
// Example of well-structured store
interface User {
	id: string;
	name: string;
	email: string;
}

export const $user = atom<User | null>(null);
export const $isLoggedIn = computed($user, user => !!user);

export function login(user: User) {
	$user.set(user);
}

export function logout() {
	$user.set(null);
}
```

## Server Setup

avalon Islands provides a powerful server setup with native Deno.serve and URLPattern routing. The server handles SSR, static file serving, and automatic TypeScript/JavaScript minification.

### Basic Server Configuration

```typescript
import { createServer, type Routes, type ServerConfig } from '@avalon/islands/server';
import HomePage from './pages/home.tsx';
import DashboardPage from './pages/dashboard.tsx';

// Define your routes
const routes: Routes = {
	'/': {
		component: HomePage,
		options: {
			title: 'Home - My Deno App',
			meta: [{ name: 'description', content: 'Welcome to the homepage' }],
		},
	},
	'/dashboard': {
		component: DashboardPage,
		options: {
			title: 'Dashboard - My Deno App',
			meta: [{ name: 'description', content: 'User dashboard' }],
			scripts: ['/js/dashboard.js'],
			styles: ['/css/dashboard.css'],
		},
	},
};

// Configure the server
const serverConfig: ServerConfig = {
	routes,
	port: 8001,

	// Global default options for all routes
	defaultOptions: {
		title: 'My avalon App',
		styles: ['/css/global.css'],
		scripts: ['/js/global.js'],
		meta: [
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ name: 'charset', content: 'utf-8' },
		],
	},

	// Global import map configuration
	importMap: {
		imports: {
			preact: 'https://esm.sh/preact@10.26.9',
			'solid-js': 'https://esm.sh/solid-js@1.8.15',
			lodash: 'https://esm.sh/lodash@4.17.21',
		},
	},
};

// Start the server
createServer(serverConfig);
```

### Route-Specific Configuration

Each route can have its own specific options that override or extend the global defaults:

```typescript
const routes: Routes = {
	'/analytics': {
		component: AnalyticsPage,
		options: {
			title: 'Analytics Dashboard',

			// Route-specific import map
			importMap: {
				imports: {
					d3: 'https://esm.sh/d3@7.8.5',
					'chart.js': 'https://esm.sh/chart.js@4.4.0',
				},
			},

			// Route-specific assets
			scripts: ['/js/analytics.js'],
			styles: ['/css/analytics.css'],

			// Route-specific meta tags
			meta: [
				{ name: 'description', content: 'Advanced analytics dashboard' },
				{ name: 'keywords', content: 'analytics, dashboard, charts' },
			],
		},
	},
};
```

### Static File Serving

The server automatically serves static files from the `public/` directory and provides special handling for source files:

- **`/css/*`** → Served from `public/css/`
- **`/js/*`** → Served from `public/js/`
- **`/src/*`** → Served from `src/` with automatic TypeScript compilation and minification

### Import Map System

avalon supports both global and route-specific import maps for managing external dependencies:

#### Global Import Maps

```typescript
const serverConfig: ServerConfig = {
	// ... other config
	importMap: {
		imports: {
			// Available on all routes
			preact: 'https://esm.sh/preact@10.26.9',
			lodash: 'https://esm.sh/lodash@4.17.21',
		},
	},
};
```

#### Route-Level Import Maps

```typescript
const routes: Routes = {
	'/data-viz': {
		component: DataVizPage,
		options: {
			importMap: {
				imports: {
					// Only available on this route
					d3: 'https://esm.sh/d3@7.8.5',
					three: 'https://esm.sh/three@0.158.0',
				},
			},
		},
	},
};
```

### Server API Reference

#### `createServer(config: ServerConfig): Deno.HttpServer`

Creates and starts a new HTTP server with the provided configuration.

#### `createServerSafe(config: unknown): Deno.HttpServer`

Same as `createServer` but with graceful error handling for invalid configurations.

#### `validateServerConfiguration(config: unknown)`

Validates a server configuration and returns detailed validation results.

### TypeScript Support

All server configuration is fully typed with comprehensive TypeScript definitions:

```typescript
import type { ServerConfig, Routes, RouteConfig, RenderOptions, ImportMap } from '@avalon/islands/server';
```

### Error Handling

The server includes built-in error handling:

- **404 responses** for unmatched routes
- **500 responses** with error logging for server errors
- **Graceful configuration validation** with detailed error messages

### Performance Features

- **Native URLPattern routing** using web standards
- **Automatic TypeScript/JavaScript minification** for `/src/*` routes
- **Efficient caching headers** for static assets
- **Minimal JavaScript shipping** with islands architecture

## 🚀 Development

avalon Islands provides a fast and efficient development experience with built-in hot reload, testing, and development tools.

### Available Commands

```bash
# Development server with hot reload
deno task dev

# Production server
deno task start

# Run all tests
deno task test

# Run specific test suites
deno task test-minification    # Test minification
deno task test-islands         # Test islands functionality
deno task test-static-default  # Test static rendering
deno task test-all             # Run all test suites

# Code quality
deno task lint                 # Check code with Deno linter
deno task format               # Check code formatting
deno task clear                # Clear Deno cache

# Package management
deno task publish-check        # Dry run package publish
deno task publish              # Publish package
deno task package-size         # Check package size
```

### Development Server

The development server (`deno task dev`) automatically:

- **Starts on port 8001** with hot reload on port 8002
- **Enables hot reload** for instant file change detection
- **Auto-discovers API routes** from `src/api/` directory
- **Provides detailed error messages** with stack traces
- **Enables TypeScript compilation** on-the-fly

### Hot Reload Features

- **Instant Updates**: See changes immediately without page refresh
- **CSS Hot Reload**: CSS changes apply instantly
- **Smart Reloading**: Only reloads what's necessary
- **Connection Buffering**: Queues changes until clients are ready
- **Performance Optimized**: Minimal overhead with intelligent debouncing

### Testing

avalon Islands includes comprehensive testing for all major features:

- **Islands Architecture**: Test component hydration and rendering
- **Minification**: Verify code compression works correctly
- **Static Rendering**: Ensure static components render properly
- **SSR Functionality**: Test server-side rendering capabilities

### Code Quality

- **TypeScript**: Full type safety and IntelliSense
- **Linting**: Deno linter for code quality checks
- **Formatting**: Consistent code style with Prettier
- **Validation**: Runtime schema validation with Zod

## API Routes

avalon Islands includes a built-in API system similar to Next.js API routes. Any file inside the `src/api` folder is automatically mapped to `/api/*` and will be treated as an API endpoint.

### Basic API Route

Create a file in `src/api/` to define an API endpoint:

**src/api/hello.ts**

```typescript
import { json } from '@avalon/islands/server';
import type { ApiContext } from '@avalon/islands/server';

export default function handler(context: ApiContext) {
	const { request, query } = context;

	return json({
		message: `Hello, ${query.name || 'World'}!`,
		timestamp: new Date().toISOString(),
	});
}
```

This creates an endpoint at `GET /api/hello?name=John`.

### Method-Specific Handlers

Handle different HTTP methods with an object export:

**src/api/users/index.ts**

```typescript
import { json, badRequest, parseJson } from '@avalon/islands/server';
import type { ApiContext } from '@avalon/islands/server';

const users = new Map();

export default {
	async GET(context: ApiContext) {
		const allUsers = Array.from(users.values());
		return json({ users: allUsers });
	},

	async POST(context: ApiContext) {
		try {
			const userData = await parseJson(context.request);

			if (!userData.name || !userData.email) {
				return badRequest('Name and email are required');
			}

			const newUser = { id: Date.now().toString(), ...userData };
			users.set(newUser.id, newUser);

			return json(newUser, { status: 201 });
		} catch {
			return badRequest('Invalid JSON data');
		}
	},
};
```

### Dynamic Routes

Use square brackets for dynamic parameters:

**src/api/users/[id].ts**

```typescript
import { json, notFound } from '@avalon/islands/server';
import type { ApiContext } from '@avalon/islands/server';

export default {
	async GET(context: ApiContext) {
		const { params } = context;
		const userId = params.id; // Extracted from /api/users/123

		const user = users.get(userId);
		if (!user) {
			return notFound('User not found');
		}

		return json(user);
	},

	async PUT(context: ApiContext) {
		const { params, request } = context;
		const userId = params.id;
		const updateData = await parseJson(request);

		// Update user logic...
		return json(updatedUser);
	},
};
```

### API Context Object

Every API handler receives a context object with:

```typescript
interface ApiContext {
	request: Request; // Original HTTP request
	url: URL; // Parsed URL object
	params: Record<string, string>; // Dynamic route parameters
	query: Record<string, string | string[]>; // Query parameters
}
```

### Response Helpers

avalon provides utility functions for common responses:

```typescript
import {
	json, // JSON response with proper headers
	text, // Plain text response
	html, // HTML response
	redirect, // Redirect response
	notFound, // 404 response
	badRequest, // 400 response
	unauthorized, // 401 response
	forbidden, // 403 response
	internalServerError, // 500 response
	methodNotAllowed, // 405 response
	corsHeaders, // CORS headers helper
} from '@avalon/islands/server';

// Usage examples
return json({ message: 'Success' });
return json({ error: 'Invalid data' }, { status: 400 });
return text('Plain text response');
return redirect('/login');
return notFound('Resource not found');
```

### Request Parsing Helpers

```typescript
import { parseJson, parseFormData, getQueryParams } from '@avalon/islands/server';

export default async function handler(context: ApiContext) {
	// Parse JSON body
	const jsonData = await parseJson(context.request);

	// Parse form data
	const formData = await parseFormData(context.request);

	// Get query parameters (already available in context.query)
	const queryParams = getQueryParams(context.url);

	return json({ success: true });
}
```

### CORS Support

```typescript
import { json, corsHeaders } from '@avalon/islands/server';

export default {
	// Handle preflight requests
	OPTIONS() {
		return new Response(null, {
			status: 204,
			headers: corsHeaders({
				origin: ['https://example.com', 'https://app.example.com'],
				methods: ['GET', 'POST', 'PUT', 'DELETE'],
				headers: ['Content-Type', 'Authorization'],
			}),
		});
	},

	GET(context: ApiContext) {
		return json(
			{ message: 'Hello from API' },
			{
				headers: corsHeaders({
					origin: '*',
					methods: ['GET', 'POST'],
				}),
			}
		);
	},
};
```

### File Structure Examples

```
src/api/
├── hello.ts              → GET/POST /api/hello
├── users/
│   ├── index.ts          → GET/POST /api/users
│   ├── [id].ts          → GET/PUT/DELETE /api/users/:id
│   └── [id]/
│       └── posts.ts      → GET/POST /api/users/:id/posts
└── auth/
    ├── login.ts         → POST /api/auth/login
    └── logout.ts        → POST /api/auth/logout
```

### Error Handling

API routes include automatic error handling:

- **404** for unmatched routes
- **405** for unsupported methods
- **500** for unhandled errors with logging
- Graceful error responses with proper JSON formatting

### Best Practices

1. **Use TypeScript**: Full type safety with `ApiContext` and helper functions
2. **Validate Input**: Always validate request data before processing
3. **Handle Errors**: Use try-catch blocks and appropriate error responses
4. **Return Consistent JSON**: Use the `json()` helper for consistent formatting
5. **Support CORS**: Add CORS headers for cross-origin requests when needed

### Integration with Islands

API routes work seamlessly with your islands:

```typescript
// In your island component
const Counter = () => {
	const [count, setCount] = useState(0);

	const saveCount = async () => {
		await fetch('/api/counter', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ count }),
		});
	};

	return (
		<div>
			<p>Count: {count}</p>
			<button onClick={() => setCount(c => c + 1)}>+</button>
			<button onClick={saveCount}>Save</button>
		</div>
	);
};
```

## Island Conditions

Control when islands hydrate for optimal performance. You can specify conditions directly in your component exports:

```typescript
// src/components/ConditionalComponents.tsx
import { withImports, Island } from '@avalon/islands/preact';

// Simple components without imports
const ImmediateCounter = withImports()(() => {
	// Component logic here
});

const LazyCounter = withImports()(() => {
	// Component logic here
});

const InteractiveCounter = withImports()(() => {
	// Component logic here
});

const DesktopOnlyCounter = withImports()(() => {
	// Component logic here
});

// Export components with different hydration conditions
export default function ImmediateCounter() {
	return <Island component={ImmediateCounter} />; // Hydrate immediately (default)
}

export default function LazyCounter() {
	return <Island component={LazyCounter} condition="on:visible" />; // Hydrate when visible
}

export default function InteractiveCounter() {
	return <Island component={InteractiveCounter} condition="on:interaction" />; // Hydrate on interaction
}

export default function DesktopOnlyCounter() {
	return <Island component={DesktopOnlyCounter} condition="media:(min-width: 768px)" />; // Hydrate on media query
}

// Available conditions:
// - "on:visible" - Hydrate when visible (intersection observer)
// - "on:interaction" - Hydrate on interaction (click, focus, etc.)
// - "on:idle" - Hydrate when browser is idle (uses requestIdleCallback)
// - "on:client" - Client-only render (skip SSR, render on client immediately)
// - "media:(min-width: 768px)" - Hydrate when media query matches
// - "media:(prefers-color-scheme: dark)" - Hydrate on dark mode preference
// - "media:(orientation: landscape)" - Hydrate on landscape orientation
```

> **⚠️ Testing Media Query Conditions**
>
> When testing media query conditions like `condition="media:(min-width: 768px)"`, make sure to test properly:
>
> - **Browser responsive mode** may not always work as expected since `window.innerWidth` reflects the actual browser window size, not the simulated device size
> - **Actually resize your browser window** to be smaller/larger than the breakpoint to test the condition
> - **Use real devices** or proper device emulation that constrains the actual viewport
> - Media queries use CSS pixels and respect the actual viewport dimensions, not simulated ones

## Complete Export Reference

### Framework-Specific Exports

#### Vanilla (`@avalon/islands/vanilla`)

```typescript
import {
	Island, // Vanilla island component
	withImports, // Component decorator
	from, // Import helper
	// Types
	type VanillaIslandProps,
	type VanillaProps,
	type VanillaComponentFunction,
	type VanillaComponentWithMetadata,
	type TemplatedVanillaComponent,
	type ImportConfig,
	type IslandCondition,
	type ComponentMetadata,
} from '@avalon/islands/vanilla';
```

#### Preact (`@avalon/islands/preact`)

```typescript
import {
	Island, // Preact island component
	withImports, // Component decorator
	from, // Import helper
	// Types
	type PreactIslandProps,
	type PreactComponentFunction,
	type PreactComponentWithMetadata,
	type ImportConfig,
	type IslandCondition,
	type ComponentMetadata,
} from '@avalon/islands/preact';
```

#### Solid (`@avalon/islands/solid`)

```typescript
import {
	Island, // Solid island component
	withImports, // Component decorator
	from, // Import helper
	// Types
	type SolidIslandProps,
	type SolidComponentFunction,
	type SolidComponentWithMetadata,
	type ImportConfig,
	type IslandCondition,
	type ComponentMetadata,
} from '@avalon/islands/solid';
```

#### Vue (`@avalon/islands/vue`)

```typescript
import {
	Island, // Vue island component
	withImports, // Component decorator
	from, // Import helper
	// Types
	type VueIslandProps,
	type VueComponent,
	type ImportConfig,
	type IslandCondition,
	type ComponentMetadata,
} from '@avalon/islands/vue';
```

#### Server (`@avalon/islands/server`)

```typescript
import {
	createServer, // Create HTTP server
	createServerSafe, // Safe server creation with validation
	validateServerConfiguration, // Validate server config
	renderToHtml, // SSR rendering
	mergeOptions, // Merge render options
	mergePartialOptions, // Merge partial options
	// Types
	type Routes,
	type ServerConfig,
	type RouteConfig,
	type RenderOptions,
	type ImportMap,
} from '@avalon/islands/server';
```

#### Core (`@avalon/islands`)

```typescript
import {
	renderToHtml, // SSR rendering
	from, // Import helper
	// Validation
	ValidationError,
	validators,
	safeValidators,
	devValidators,
	validate,
	safeValidate,
	isValidImportConfig,
	isValidRenderOptions,
	// Schemas
	ServerConfigSchema,
	// Types
	type ImportConfig,
	type IslandId,
	type IslandCondition,
	type IslandProps,
	type ComponentMetadata,
	type RenderOptions,
	type ImportMap,
	type CleanupFunction,
	type Routes,
	type ServerConfig,
	type RouteConfig,
	type ValidationResult,
	type ValidationSuccess,
	type ValidationFailure,
} from '@avalon/islands';
```

## Best Practices

1. **Choose the Right Hydration Condition**

   ```typescript
   // src/components/Header.tsx
   export default function Header() {
   	return <Island component={HeaderComponent} />; // For above-the-fold content - instant hydration
   }

   // src/components/Footer.tsx
   export default function Footer() {
   	return <Island component={FooterComponent} condition="on:visible" />; // For below-the-fold content - hydration on visible
   }

   // src/components/Calculator.tsx
   export default function Calculator() {
   	return <Island component={CalculatorComponent} condition="on:interaction" />; // For interactive widgets - hydration on interaction
   }

   // src/components/Sidebar.tsx
   export default function Sidebar() {
   	return <Island component={SidebarComponent} condition="media:(min-width: 768px)" />; // For desktop-only features - hydration on media query
   }
   ```

2. **Use Helper Functions for Clean Syntax**: Create reusable helper functions like `withStore()` for common import patterns

3. **Keep Components Small**: Islands work best with focused, single-purpose components

4. **Use TypeScript**: Take advantage of full type safety for better DX

5. **Test Hydration Conditions**: Actually resize your browser window to test media queries

6. **Component Organization**: Export each component with its own island wrapper for cleaner imports and better separation of concerns

7. **Emoji Support**: Emojis and Unicode characters are fully supported out of the box with proper UTF-8 encoding

## License

MIT
