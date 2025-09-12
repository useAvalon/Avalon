# Example Islands

This folder contains example island components demonstrating the new Vite-powered Avalon architecture.

## Examples

### `Counter.tsx` - Simple Preact Island

Basic counter component showing Preact hooks and state management.

### `TodoList.tsx` - Complex Preact Island

More advanced example with multiple state variables, event handling, and conditional rendering.

### `SolidCounter.tsx` - Solid.js Island

Demonstrates Solid.js fine-grained reactivity with signals.

### `VueCounter.tsx` - Vue 3 Island

Shows Vue 3 Composition API integration with the island system.

## Usage

These examples can be used in your routes like this:

```tsx
import { Island } from '@avalon/avalon';

function HomePage() {
	return (
		<div>
			<h1>My App</h1>

			{/* Preact Counter */}
			<Island src="/examples/islands/Counter.tsx" condition="on:visible" props={{ initialCount: 0, step: 1 }} />

			{/* Vue Counter */}
			<Island src="/examples/islands/VueCounter.tsx" condition="on:interaction" props={{ initialCount: 5, step: 2 }} />
		</div>
	);
}
```

## Creating Your Own Islands

1. Create a component file (e.g., `src/islands/MyComponent.tsx`)
2. Export a default component function
3. Export a `hydrate` function for client-side mounting
4. Use the universal `Island` component to render it

```tsx
// src/islands/MyComponent.tsx
import { useState } from 'preact/hooks';
import { render } from 'preact';

export default function MyComponent({ message }) {
	const [count, setCount] = useState(0);

	return (
		<div>
			<p>{message}</p>
			<button onClick={() => setCount(count + 1)}>Clicked {count} times</button>
		</div>
	);
}

export function hydrate(container, props) {
	render(<MyComponent {...props} />, container);
}
```

The new architecture handles all the complexity - no HOF wrappers or framework-specific components needed!
