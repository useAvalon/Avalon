import { useState } from 'preact/hooks';

export default function Counter() {
	const [count, setCount] = useState(0);

	return (
		<div style={{
			padding: '24px',
			background: 'rgba(255,255,255,0.02)',
			border: '1px solid rgba(255,255,255,0.06)',
			borderRadius: '14px',
			textAlign: 'center',
			backdropFilter: 'blur(12px)',
		}}>
			<div style={{
				fontSize: '13px',
				fontWeight: '500',
				color: 'rgba(255,255,255,0.5)',
				marginBottom: '16px',
				letterSpacing: '0.02em',
			}}>
				Default Counter
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
						background: 'rgba(255,255,255,0.06)',
						color: 'rgba(255,255,255,0.8)',
						border: '1px solid rgba(255,255,255,0.08)',
						borderRadius: '8px',
						cursor: 'pointer',
					}}
				>
					−
				</button>
				<button
					onClick={() => setCount(0)}
					style={{
						padding: '10px 16px',
						fontSize: '12px',
						background: 'rgba(255,255,255,0.04)',
						color: 'rgba(255,255,255,0.5)',
						border: '1px solid rgba(255,255,255,0.06)',
						borderRadius: '8px',
						cursor: 'pointer',
					}}
				>
					Reset
				</button>
				<button
					onClick={() => setCount(c => c + 1)}
					style={{
						padding: '10px 20px',
						fontSize: '18px',
						background: 'rgba(255,255,255,0.06)',
						color: 'rgba(255,255,255,0.8)',
						border: '1px solid rgba(255,255,255,0.08)',
						borderRadius: '8px',
						cursor: 'pointer',
					}}
				>
					+
				</button>
			</div>
		</div>
	);
}
