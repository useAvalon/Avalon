/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';

export default function SolidCounter() {
	const [count, setCount] = createSignal(0);

	return (
		<div>
			<h4>💎 Solid Counter</h4>
			<div>{count()}</div>
			<div>
				<button onClick={() => setCount(count() - 1)}>−</button>
				<button onClick={() => setCount(count() + 1)}>+</button>
			</div>
			<p>Powered by Solid signals</p>
		</div>
	);
}
