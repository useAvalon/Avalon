// Example of the new simplified Avalon + Vite architecture with full SSR support
// This shows how much simpler and more powerful the new approach is!

import { h } from 'preact';
import { Island, renderPreactIsland, renderVueIsland, renderSolidIsland } from './src/islands/Island.tsx';

// Import your actual components
import SolidCounter from './examples/islands/SolidCounter.tsx';
// Note: Vue component would be imported differently depending on setup

// Simple Preact component for demo
const PreactCounter = ({ initialCount = 0 }) => {
	return <div>Preact Counter: {initialCount}</div>;
};

// OLD APPROACH (complex HOF wrappers):
/*
import { withImports } from './src/HOF/preact.ts';
import { from } from './src/helpers/from.ts';
import Preact from './src/islands/preact.tsx';

const Counter = withImports({
  imports: [from(['useState'], 'preact/hooks')]
})(({ count }) => {
  const [state, setState] = useState(count);
  return <button onClick={() => setState(state + 1)}>Count: {state}</button>;
});

// Usage in routes
<Preact component={Counter} condition="on:visible" props={{ count: 0 }} />
*/

// NEW APPROACH (simple and clean with full SSR):

// 1. Create island components without any wrappers
// src/islands/Counter.tsx - just a regular component!

// 2. Use the universal Island component with full SSR support
async function HomePage() {
	return (
		<html>
			<head>
				<title>Avalon + Vite Example with Full SSR</title>
				{/* Vite automatically handles module loading */}
				<script type="module" src="/src/client/main.js"></script>
			</head>
			<body>
				<h1>Welcome to Avalon + Vite with Full SSR!</h1>

				{/* Preact island with SSR - renders component directly */}
				{renderPreactIsland(PreactCounter, { initialCount: 5 }, '/examples/islands/Counter.tsx', 'on:visible')}

				{/* Solid island with SSR - renders component directly using JSX */}
				{await renderSolidIsland(
					SolidCounter,
					{ initialCount: 10, step: 5 },
					'/examples/islands/SolidCounter.tsx',
					'on:idle'
				)}

				{/* Vue 3 island with SSR - renders component directly */}
				{/* {await renderVueIsland(VueCounter, { initialCount: 5, step: 2 }, '/examples/islands/VueCounter.tsx', 'on:visible')} */}

				{/* Client-only island (no SSR) */}
				<Island src="/islands/ClientOnlyWidget.tsx" condition="on:client" props={{ apiKey: 'demo' }} />
			</body>
		</html>
	);
}

// Benefits of the new approach:
// ✅ No HOF wrappers needed
// ✅ True HMR with Vite (component-level updates)
// ✅ Universal Island component works with any framework
// ✅ Full SSR support for ALL frameworks (Vue, Solid, Preact)
// ✅ Automatic dependency resolution via Vite
// ✅ Better development experience with Vite dev tools
// ✅ Simplified codebase - less custom code to maintain
// ✅ Graceful SSR fallback - if SSR fails, falls back to client-only
// ✅ Standard tooling instead of custom solutions
// ✅ Zero configuration - framework detection is automatic

export default HomePage;
