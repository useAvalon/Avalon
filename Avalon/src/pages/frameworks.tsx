/** @jsxImportSource preact */

import ReactCounter from '../islands/ReactCounter.tsx';
import PreactCounter from '../islands/PreactCounter.tsx';
import LitCounter from '../islands/Counter.lit.ts';
import VueCounter from '../islands/VueCounter.vue';
import SvelteCounter from '../islands/SvelteCounter.svelte';
import SolidCounter from '../islands/SolidCounter.solid.tsx';

export default async function FrameworksPage() {
	return (
		<div>
			<header style={{ textAlign: 'center', marginBottom: '48px' }}>
				<div style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '8px',
					background: 'rgba(255,255,255,0.04)',
					border: '1px solid rgba(255,255,255,0.07)',
					borderRadius: '100px',
					padding: '6px 14px',
					marginBottom: '16px',
					fontSize: '12px',
					color: 'rgba(255,255,255,0.5)',
				}}>
					6 frameworks supported
				</div>
				<h1 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '36px',
					fontWeight: '400',
					color: 'rgba(255,255,255,0.9)',
					letterSpacing: '-0.02em',
					marginBottom: '12px',
				}}>
					Multi-Framework Components
				</h1>
				<p style={{
					fontSize: '15px',
					color: 'rgba(255,255,255,0.4)',
					maxWidth: '500px',
					margin: '0 auto',
					lineHeight: '1.6',
				}}>
					The same counter component implemented in different frameworks, all working together seamlessly.
				</p>
			</header>

			<div style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
				gap: '16px',
			}}>
				<ReactCounter island={{ condition: 'on:interaction' }} initialCount={0} />
				<PreactCounter island={{ condition: 'on:interaction' }} />
				<LitCounter island={{ condition: 'on:interaction' }} initialCount={0} />
				<VueCounter island={{ condition: 'on:interaction' }} />
				<SvelteCounter island={{ condition: 'on:interaction' }} />
				<SolidCounter island={{ condition: 'on:interaction' }} />
			</div>

			<div style={{
				marginTop: '48px',
				background: 'rgba(255,255,255,0.02)',
				border: '1px solid rgba(255,255,255,0.06)',
				borderRadius: '16px',
				padding: '28px',
			}}>
				<h3 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '20px',
					color: 'rgba(255,255,255,0.8)',
					marginBottom: '16px',
				}}>
					How It Works
				</h3>
				<ul style={{
					color: 'rgba(255,255,255,0.5)',
					lineHeight: '1.8',
					paddingLeft: '20px',
				}}>
					<li style={{ marginBottom: '8px' }}><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Islands Architecture:</strong> Each counter is an independent island that hydrates on interaction</li>
					<li style={{ marginBottom: '8px' }}><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Framework Isolation:</strong> Each framework runs in its own runtime, no conflicts</li>
					<li style={{ marginBottom: '8px' }}><strong style={{ color: 'rgba(255,255,255,0.7)' }}>Selective Hydration:</strong> JavaScript only loads when you interact with a component</li>
					<li><strong style={{ color: 'rgba(255,255,255,0.7)' }}>SSR First:</strong> All components render on the server for instant display</li>
				</ul>
			</div>
		</div>
	);
}
