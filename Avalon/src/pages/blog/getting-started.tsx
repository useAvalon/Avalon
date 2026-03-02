/** @jsxImportSource preact */

export default async function GettingStartedPage() {
	return (
		<article>
			<header style={{ marginBottom: '32px' }}>
				<div style={{
					fontSize: '12px',
					color: 'rgba(255,255,255,0.4)',
					marginBottom: '8px',
				}}>
					January 15, 2024
				</div>
				<h1 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '32px',
					fontWeight: '400',
					color: 'rgba(255,255,255,0.9)',
					letterSpacing: '-0.02em',
					marginBottom: '12px',
				}}>
					Getting Started with Avalon
				</h1>
				<p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', lineHeight: '1.6' }}>
					Learn how to set up your first Avalon project with multi-framework support.
				</p>
			</header>

			<div style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.8' }}>
				<h2 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '24px',
					color: 'rgba(255,255,255,0.8)',
					marginTop: '32px',
					marginBottom: '16px',
				}}>
					Installation
				</h2>
				<p style={{ marginBottom: '16px' }}>
					Create a new Avalon project using the CLI:
				</p>
				<pre style={{
					background: 'rgba(0,0,0,0.3)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '8px',
					padding: '16px',
					color: 'rgba(255,255,255,0.7)',
					fontSize: '13px',
					overflow: 'auto',
					marginBottom: '24px',
				}}>{`bun create avalon my-app
cd my-app
bun install
bun run dev`}</pre>

				<h2 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '24px',
					color: 'rgba(255,255,255,0.8)',
					marginTop: '32px',
					marginBottom: '16px',
				}}>
					Project Structure
				</h2>
				<p style={{ marginBottom: '16px' }}>
					Avalon uses a file-based routing system. Pages go in <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>src/pages/</code> and interactive components go in <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>src/islands/</code>.
				</p>

				<h2 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '24px',
					color: 'rgba(255,255,255,0.8)',
					marginTop: '32px',
					marginBottom: '16px',
				}}>
					Creating Your First Island
				</h2>
				<p style={{ marginBottom: '16px' }}>
					Islands are interactive components that hydrate on the client. Create one in <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>src/islands/</code>:
				</p>
				<pre style={{
					background: 'rgba(0,0,0,0.3)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '8px',
					padding: '16px',
					color: 'rgba(255,255,255,0.7)',
					fontSize: '13px',
					overflow: 'auto',
					marginBottom: '24px',
				}}>{`// src/islands/Counter.tsx
import { useState } from 'preact/hooks';

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}`}</pre>

				<p>
					Then use it in a page with the <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>island</code> prop to control hydration.
				</p>
			</div>
		</article>
	);
}
