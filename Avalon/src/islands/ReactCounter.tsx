/** @jsxImportSource react */
import { useState } from 'react';

export default function ReactCounter({ initialCount = 0 }: { initialCount?: number }) {
	const [count, setCount] = useState(initialCount);

	return (
		<div style={{
			padding: '24px',
			background: 'linear-gradient(135deg, rgba(97,218,251,0.1) 0%, rgba(97,218,251,0.02) 100%)',
			border: '1px solid rgba(97,218,251,0.15)',
			borderRadius: '14px',
			textAlign: 'center',
		}}>
			<div style={{
				fontSize: '14px',
				fontWeight: '600',
				color: '#61DAFB',
				marginBottom: '16px',
				letterSpacing: '0.03em',
				fontFamily: "'DM Sans', sans-serif",
			}}>
				⚛️ React
			</div>
			
			<div style={{
				fontSize: '42px',
				fontWeight: '300',
				color: 'rgba(255,255,255,0.9)',
				marginBottom: '20px',
				fontFamily: "'DM Sans', sans-serif",
			}}>
				{count}
			</div>
			
			<div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
				<button
					onClick={() => setCount(c => c - 1)}
					style={{
						padding: '10px 20px',
						fontSize: '18px',
						background: 'rgba(97,218,251,0.12)',
						color: '#fff',
						border: '1px solid rgba(97,218,251,0.2)',
						borderRadius: '8px',
						cursor: 'pointer',
					}}
				>
					−
				</button>
				<button
					onClick={() => setCount(c => c + 1)}
					style={{
						padding: '10px 20px',
						fontSize: '18px',
						background: 'rgba(97,218,251,0.12)',
						color: '#fff',
						border: '1px solid rgba(97,218,251,0.2)',
						borderRadius: '8px',
						cursor: 'pointer',
					}}
				>
					+
				</button>
			</div>
			
			<div style={{
				marginTop: '14px',
				fontSize: '10px',
				color: 'rgba(255,255,255,0.3)',
				textTransform: 'uppercase',
				letterSpacing: '0.1em',
				fontFamily: "'DM Sans', sans-serif",
			}}>
				React Hooks
			</div>
		</div>
	);
}
