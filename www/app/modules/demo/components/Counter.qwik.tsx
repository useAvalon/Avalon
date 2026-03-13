/** @jsxImportSource @builder.io/qwik */
import { component$, useSignal } from '@builder.io/qwik';

export default component$(() => {
	const count = useSignal(0);

	return (
		<div style={{
			padding: '2rem',
			borderRadius: '12px',
			background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
			border: '1px solid rgba(172, 127, 244, 0.2)',
			textAlign: 'center',
			fontFamily: 'system-ui, sans-serif',
			color: '#e0e0e0',
			maxWidth: '320px',
		}}>
			<h3 style={{ margin: '0 0 0.5rem', color: '#ac7ff4', fontSize: '1.1rem' }}>
				Qwik Counter
			</h3>
			<p style={{ margin: '0 0 1rem', fontSize: '0.85rem', opacity: 0.7 }}>
				Resumable — no hydration needed
			</p>
			<div style={{ fontSize: '2.5rem', fontWeight: 700, margin: '1rem 0' }}>
				{count.value}
			</div>
			<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
				<button
					onClick$={() => count.value--}
					style={{
						padding: '0.5rem 1.25rem',
						borderRadius: '8px',
						border: '1px solid rgba(172, 127, 244, 0.3)',
						background: 'rgba(172, 127, 244, 0.1)',
						color: '#ac7ff4',
						fontSize: '1.1rem',
						cursor: 'pointer',
					}}
				>
					−
				</button>
				<button
					onClick$={() => count.value++}
					style={{
						padding: '0.5rem 1.25rem',
						borderRadius: '8px',
						border: '1px solid rgba(172, 127, 244, 0.3)',
						background: 'rgba(172, 127, 244, 0.1)',
						color: '#ac7ff4',
						fontSize: '1.1rem',
						cursor: 'pointer',
					}}
				>
					+
				</button>
			</div>
		</div>
	);
});
