/** @jsxImportSource preact */

import Counter from '../islands/Counter.tsx';
import PreactCounter from '../islands/PreactCounter.tsx';

export default async function IslandsPage() {
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
					Selective Hydration
				</div>
				<h1 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '36px',
					fontWeight: '400',
					color: 'rgba(255,255,255,0.9)',
					letterSpacing: '-0.02em',
					marginBottom: '12px',
				}}>
					Islands Architecture
				</h1>
				<p style={{
					fontSize: '15px',
					color: 'rgba(255,255,255,0.4)',
					maxWidth: '550px',
					margin: '0 auto',
					lineHeight: '1.6',
				}}>
					Interactive components hydrate independently. Click or hover on a counter to activate it.
				</p>
			</header>

			<div style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(2, 1fr)',
				gap: '24px',
				marginBottom: '48px',
			}}>
				<div style={{
					background: 'rgba(255,255,255,0.02)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '16px',
					padding: '24px',
				}}>
					<h2 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '18px',
						color: 'rgba(255,255,255,0.7)',
						marginBottom: '8px',
					}}>
						⚡ on:client
					</h2>
					<p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '20px', fontSize: '13px' }}>
						Hydrates immediately when the page loads.
					</p>
					<Counter island={{ condition: 'on:client' }} />
				</div>

				<div style={{
					background: 'rgba(255,255,255,0.02)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '16px',
					padding: '24px',
				}}>
					<h2 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '18px',
						color: 'rgba(255,255,255,0.7)',
						marginBottom: '8px',
					}}>
						🖱️ on:interaction
					</h2>
					<p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '20px', fontSize: '13px' }}>
						Hydrates when you interact with the component.
					</p>
					<PreactCounter island={{ condition: 'on:interaction' }} />
				</div>

				<div style={{
					background: 'rgba(255,255,255,0.02)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '16px',
					padding: '24px',
				}}>
					<h2 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '18px',
						color: 'rgba(255,255,255,0.7)',
						marginBottom: '8px',
					}}>
						👁️ on:visible
					</h2>
					<p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '20px', fontSize: '13px' }}>
						Hydrates when scrolled into the viewport.
					</p>
					<Counter island={{ condition: 'on:visible' }} />
				</div>

				<div style={{
					background: 'rgba(255,255,255,0.02)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '16px',
					padding: '24px',
				}}>
					<h2 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '18px',
						color: 'rgba(255,255,255,0.7)',
						marginBottom: '8px',
					}}>
						⏱️ on:idle
					</h2>
					<p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '20px', fontSize: '13px' }}>
						Hydrates during browser idle time.
					</p>
					<PreactCounter island={{ condition: 'on:idle' }} />
				</div>
			</div>

			<div style={{
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
					Why Islands?
				</h3>
				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(2, 1fr)',
					gap: '16px',
				}}>
					<div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
						<strong style={{ color: 'rgba(255,255,255,0.7)' }}>Minimal JavaScript</strong>
						<p style={{ marginTop: '4px' }}>Only interactive parts load JS</p>
					</div>
					<div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
						<strong style={{ color: 'rgba(255,255,255,0.7)' }}>Fast Initial Load</strong>
						<p style={{ marginTop: '4px' }}>Static HTML renders instantly</p>
					</div>
					<div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
						<strong style={{ color: 'rgba(255,255,255,0.7)' }}>Progressive Enhancement</strong>
						<p style={{ marginTop: '4px' }}>Content works without JS</p>
					</div>
					<div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
						<strong style={{ color: 'rgba(255,255,255,0.7)' }}>Framework Freedom</strong>
						<p style={{ marginTop: '4px' }}>Mix React, Vue, Svelte in one page</p>
					</div>
				</div>
			</div>
		</div>
	);
}
