/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';

export default function SolidCounter(props: { initialCount?: number }) {
	const [count, setCount] = createSignal(props.initialCount ?? 0);

	return (
		<div style={{
			padding: '24px',
			background: 'linear-gradient(135deg, rgba(79,136,198,0.1) 0%, rgba(79,136,198,0.02) 100%)',
			border: '1px solid rgba(79,136,198,0.15)',
			'border-radius': '14px',
			'text-align': 'center',
		}}>
			<div style={{
				'font-size': '14px',
				'font-weight': '600',
				color: '#4F88C6',
				'margin-bottom': '16px',
				'letter-spacing': '0.03em',
				'font-family': "'DM Sans', sans-serif",
			}}>
				💎 Solid
			</div>
			
			<div style={{
				'font-size': '42px',
				'font-weight': '300',
				color: 'rgba(255,255,255,0.9)',
				'margin-bottom': '20px',
				'font-family': "'DM Sans', sans-serif",
			}}>
				{count()}
			</div>
			
			<div style={{ display: 'flex', gap: '8px', 'justify-content': 'center' }}>
				<button
					onClick={() => setCount(c => c - 1)}
					style={{
						padding: '10px 20px',
						'font-size': '18px',
						background: 'rgba(79,136,198,0.12)',
						color: '#fff',
						border: '1px solid rgba(79,136,198,0.2)',
						'border-radius': '8px',
						cursor: 'pointer',
					}}
				>
					−
				</button>
				<button
					onClick={() => setCount(c => c + 1)}
					style={{
						padding: '10px 20px',
						'font-size': '18px',
						background: 'rgba(79,136,198,0.12)',
						color: '#fff',
						border: '1px solid rgba(79,136,198,0.2)',
						'border-radius': '8px',
						cursor: 'pointer',
					}}
				>
					+
				</button>
			</div>
			
			<div style={{
				'margin-top': '14px',
				'font-size': '10px',
				color: 'rgba(255,255,255,0.3)',
				'text-transform': 'uppercase',
				'letter-spacing': '0.1em',
				'font-family': "'DM Sans', sans-serif",
			}}>
				Fine-Grained Reactivity
			</div>
		</div>
	);
}
