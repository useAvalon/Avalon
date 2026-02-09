/** @jsxImportSource preact */
import { useState, useEffect } from 'preact/hooks';

export default function EventPreactCounter({ initialCount = 0 }: { initialCount?: number }) {
	const [count, setCount] = useState(initialCount);

	useEffect(() => {
		const handler = (e: Event) => {
			setCount((e as CustomEvent).detail.count);
		};
		document.addEventListener('counter:update', handler);
		return () => document.removeEventListener('counter:update', handler);
	}, []);

	function dispatch(next: number) {
		setCount(next);
		document.dispatchEvent(new CustomEvent('counter:update', { detail: { count: next } }));
	}

	return (
		<div style={{
			textAlign: 'center', padding: '20px',
			background: 'linear-gradient(135deg, #673ab7, #9c27b0)',
			color: 'white', borderRadius: '10px',
		}}>
			<h4 style={{ marginBottom: '15px' }}>⚛️ Preact</h4>
			<div style={{
				fontSize: '2rem', fontWeight: 'bold', marginBottom: '15px',
				background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '8px',
			}}>{count}</div>
			<div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
				<button onClick={() => dispatch(count - 1)}
					style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>−</button>
				<button onClick={() => dispatch(count + 1)}
					style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>+</button>
			</div>
			<p style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.7 }}>via CustomEvent</p>
		</div>
	);
}
