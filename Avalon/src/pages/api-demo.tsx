/** @jsxImportSource preact */

import ApiTester from '../islands/ApiTester.tsx';

export default async function ApiDemoPage() {
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
					Server Routes
				</div>
				<h1 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '36px',
					fontWeight: '400',
					color: 'rgba(255,255,255,0.9)',
					letterSpacing: '-0.02em',
					marginBottom: '12px',
				}}>
					API Routes
				</h1>
				<p style={{
					fontSize: '15px',
					color: 'rgba(255,255,255,0.4)',
					maxWidth: '500px',
					margin: '0 auto',
					lineHeight: '1.6',
				}}>
					File-based API routes with middleware support, powered by Nitro.
				</p>
			</header>

			<div style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
				gap: '16px',
				marginBottom: '32px',
			}}>
				<div style={{
					background: 'rgba(255,255,255,0.02)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '14px',
					padding: '24px',
				}}>
					<h3 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '18px',
						color: 'rgba(255,255,255,0.8)',
						marginBottom: '12px',
					}}>
						GET /api/hello
					</h3>
					<p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '12px' }}>
						Simple hello world endpoint
					</p>
					<a 
						href="/api/hello" 
						target="_blank"
						style={{
							display: 'inline-flex',
							padding: '8px 14px',
							background: 'rgba(255,255,255,0.06)',
							border: '1px solid rgba(255,255,255,0.08)',
							borderRadius: '6px',
							color: 'rgba(255,255,255,0.7)',
							textDecoration: 'none',
							fontSize: '13px',
						}}
					>
						Try it →
					</a>
				</div>

				<div style={{
					background: 'rgba(255,255,255,0.02)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '14px',
					padding: '24px',
				}}>
					<h3 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '18px',
						color: 'rgba(255,255,255,0.8)',
						marginBottom: '12px',
					}}>
						GET /api/time
					</h3>
					<p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '12px' }}>
						Returns current server time
					</p>
					<a 
						href="/api/time" 
						target="_blank"
						style={{
							display: 'inline-flex',
							padding: '8px 14px',
							background: 'rgba(255,255,255,0.06)',
							border: '1px solid rgba(255,255,255,0.08)',
							borderRadius: '6px',
							color: 'rgba(255,255,255,0.7)',
							textDecoration: 'none',
							fontSize: '13px',
						}}
					>
						Try it →
					</a>
				</div>

				<div style={{
					background: 'rgba(255,255,255,0.02)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '14px',
					padding: '24px',
				}}>
					<h3 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '18px',
						color: 'rgba(255,255,255,0.8)',
						marginBottom: '12px',
					}}>
						GET /api/users/:id
					</h3>
					<p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '12px' }}>
						Dynamic route with parameters
					</p>
					<a 
						href="/api/users/123" 
						target="_blank"
						style={{
							display: 'inline-flex',
							padding: '8px 14px',
							background: 'rgba(255,255,255,0.06)',
							border: '1px solid rgba(255,255,255,0.08)',
							borderRadius: '6px',
							color: 'rgba(255,255,255,0.7)',
							textDecoration: 'none',
							fontSize: '13px',
						}}
					>
						Try it →
					</a>
				</div>
			</div>

			<div style={{
				background: 'rgba(255,255,255,0.02)',
				border: '1px solid rgba(255,255,255,0.06)',
				borderRadius: '16px',
				padding: '28px',
				marginBottom: '32px',
			}}>
				<h3 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '20px',
					color: 'rgba(255,255,255,0.8)',
					marginBottom: '16px',
				}}>
					Interactive Tester
				</h3>
				<ApiTester island={{ condition: 'on:interaction' }} />
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
					File Structure
				</h3>
				<pre style={{
					background: 'rgba(0,0,0,0.3)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '8px',
					padding: '16px',
					color: 'rgba(255,255,255,0.7)',
					fontSize: '13px',
					overflow: 'auto',
				}}>{`routes/
└── api/
    ├── _middleware.ts   ← Runs before all API routes
    ├── hello.ts         ← GET /api/hello
    ├── time.ts          ← GET /api/time
    └── users/
        └── [id].ts      ← GET /api/users/:id`}</pre>
			</div>
		</div>
	);
}
