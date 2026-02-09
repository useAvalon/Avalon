/** @jsxImportSource solid-js */
import { createSignal, onMount, onCleanup } from 'solid-js';

export default function EventSolidCounter(props: { initialCount?: number }) {
	const [count, setCount] = createSignal(props.initialCount ?? 0);

	function dispatch(next: number) {
		setCount(next);
		document.dispatchEvent(new CustomEvent('counter:update', { detail: { count: next } }));
	}

	onMount(() => {
		function handler(e: Event) {
			setCount((e as CustomEvent).detail.count);
		}
		document.addEventListener('counter:update', handler);
		onCleanup(() => document.removeEventListener('counter:update', handler));
	});

	return (
		<div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #3a51b7ff, #2762b0ff); color: white; border-radius: 10px;">
			<h4 style="margin-bottom: 15px;">💎 Solid</h4>
			<div style="font-size: 2rem; font-weight: bold; margin-bottom: 15px; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
				{count()}
			</div>
			<div style="display: flex; gap: 10px; justify-content: center;">
				<button type="button" onClick={() => dispatch(count() - 1)}
					style="padding: 8px 16px; background: rgba(255,255,255,0.2); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 1.2rem;">−</button>
				<button type="button" onClick={() => dispatch(count() + 1)}
					style="padding: 8px 16px; background: rgba(255,255,255,0.2); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 1.2rem;">+</button>
			</div>
			<p style="margin-top: 10px; font-size: 0.8rem; opacity: 0.7;">via CustomEvent</p>
		</div>
	);
}
