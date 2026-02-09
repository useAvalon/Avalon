/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';

export default function SolidCounter(props: { initialCount?: number }) {
	const [count, setCount] = createSignal(props.initialCount ?? 0);

	return (
		<div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #3a51b7ff, #2762b0ff); color: white; border-radius: 10px;">
			<h4>💎 Solid Counter</h4>
			<div style="font-size: 2em; margin: 10px 0;">{count()}</div>
			<div>
				<button 
					type="button" 
					style="padding: 10px 20px; margin: 0 5px; border-radius: 5px; border: none; background: rgba(255, 255, 255, 0.2); color: white; cursor: pointer; font-size: 1.2em;"
					onClick={() => setCount(count() - 1)}
				>
					−
				</button>
				<button 
					type="button" 
					style="padding: 10px 20px; margin: 0 5px; border-radius: 5px; border: none; background: rgba(255, 255, 255, 0.2); color: white; cursor: pointer; font-size: 1.2em;"
					onClick={() => setCount(count() + 1)}
				>
					+
				</button>
			</div>
			<p style="margin-top: 15px; opacity: 0.9;">Powered by Solid signals!</p>
		</div>
	);
}