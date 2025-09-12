// New simplified Preact island - no HOF wrapper needed!
import { useState } from 'preact/hooks';
import { render } from 'preact';
import type { JSX } from 'preact';

interface CounterProps {
	initialCount?: number;
	step?: number;
}

export default function Counter({ initialCount = 0, step = 1 }: CounterProps): JSX.Element {
	const [count, setCount] = useState(initialCount);

	return (
		<div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
			<h3>Counter Island</h3>
			<p>
				Count: <strong>{count}</strong>
			</p>
			<button onClick={() => setCount(count + step)} style={{ marginRight: '0.5rem' }}>
				+{step}
			</button>
			<button onClick={() => setCount(count - step)} style={{ marginRight: '0.5rem' }}>
				-{step}
			</button>
			<button onClick={() => setCount(initialCount)}>Reset</button>
		</div>
	);
}

// Hydration function for the island system
export function hydrate(container: HTMLElement, props: CounterProps) {
	render(<Counter {...props} />, container);
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
