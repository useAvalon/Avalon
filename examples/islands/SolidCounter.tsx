// Solid.js island example - now works seamlessly with Vite!
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import type { JSX } from 'solid-js';

interface SolidCounterProps {
	initialCount?: number;
	step?: number;
}

export default function SolidCounter(props: SolidCounterProps): JSX.Element {
	const [count, setCount] = createSignal(props.initialCount || 0);
	const step = () => props.step || 1;

	return (
		<div style={{ padding: '1rem', border: '2px solid #2c4f7c', borderRadius: '4px' }}>
			<h3>Solid Counter Island</h3>
			<p>
				Count: <strong>{count()}</strong>
			</p>
			<button onClick={() => setCount(count() + step())} style={{ marginRight: '0.5rem' }}>
				+{step()}
			</button>
			<button onClick={() => setCount(count() - step())} style={{ marginRight: '0.5rem' }}>
				-{step()}
			</button>
			<button onClick={() => setCount(props.initialCount || 0)}>Reset</button>
			<div style={{ marginTop: '0.5rem', fontSize: '0.9em', color: '#666' }}>
				Powered by Solid.js with fine-grained reactivity
			</div>
		</div>
	);
}

// Hydration function for the island system
export function hydrate(container: HTMLElement, props: SolidCounterProps) {
	// Solid.js hydration - Vite handles the bundling automatically
	render(() => <SolidCounter {...props} />, container);
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
