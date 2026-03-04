/** @jsxImportSource preact */
import { usePersistentState } from '@avalon/avalon/client';

export default function PersistentCounterDemo() {
	const [count, setCount, clearCount] = usePersistentState('demo-counter', 0, {storage:"session"});

	return (
		<div style={{
			padding: '24px',
			background: 'linear-gradient(135deg, rgba(21,159,236,0.1) 0%, rgba(21,159,236,0.02) 100%)',
			border: '1px solid rgba(21,159,236,0.15)',
			borderRadius: '14px',
			textAlign: 'center',
		}}>
			<div style={{
				fontSize: '14px',
				fontWeight: '600',
				color: '#159fec',
				marginBottom: '16px',
				letterSpacing: '0.03em',
				fontFamily: "'DM Sans', sans-serif",
			}}>
				💾 Persistent
			</div>

			<div style={{
				fontSize: '42px',
				fontWeight: '300',
				color: 'rgba(255,255,255,0.9)',
				marginBottom: '8px',
				fontFamily: "'DM Sans', sans-serif",
			}}>
				{count}
			</div>

			<div style={{
				fontSize: '11px',
				color: 'rgba(255,255,255,0.35)',
				marginBottom: '20px',
			}}>
				Saved to sessionStorage
			</div>

			<div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
				<button
					onClick={() => setCount(c => c - 1)}
					style={{
						padding: '10px 20px',
						fontSize: '18px',
						background: 'rgba(21,159,236,0.12)',
						color: '#fff',
						border: '1px solid rgba(21,159,236,0.2)',
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
						background: 'rgba(21,159,236,0.12)',
						color: '#fff',
						border: '1px solid rgba(21,159,236,0.2)',
						borderRadius: '8px',
						cursor: 'pointer',
					}}
				>
					+
				</button>
				<button
					onClick={() => { setCount(0); clearCount(); }}
					style={{
						padding: '10px 16px',
						fontSize: '12px',
						background: 'rgba(255,255,255,0.04)',
						color: 'rgba(255,255,255,0.5)',
						border: '1px solid rgba(255,255,255,0.08)',
						borderRadius: '8px',
						cursor: 'pointer',
					}}
				>
					Reset
				</button>
			</div>

			<div style={{
				marginTop: '14px',
				fontSize: '10px',
				color: 'rgba(255,255,255,0.3)',
				textTransform: 'uppercase',
				letterSpacing: '0.1em',
			}}>
				Navigate away and come back — count persists
			</div>
		</div>
	);
}
