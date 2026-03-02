/** @jsxImportSource preact */

export default async function AdvancedFeaturesPage() {
	return (
		<article>
			<header style={{ marginBottom: '32px' }}>
				<div style={{
					fontSize: '12px',
					color: 'rgba(255,255,255,0.4)',
					marginBottom: '8px',
				}}>
					January 20, 2024
				</div>
				<h1 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '32px',
					fontWeight: '400',
					color: 'rgba(255,255,255,0.9)',
					letterSpacing: '-0.02em',
					marginBottom: '12px',
				}}>
					Advanced Features
				</h1>
				<p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', lineHeight: '1.6' }}>
					Explore islands architecture, selective hydration, and nested layouts.
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
					Hydration Strategies
				</h2>
				<p style={{ marginBottom: '16px' }}>
					Avalon supports multiple hydration strategies to optimize performance:
				</p>
				<ul style={{ paddingLeft: '20px', marginBottom: '24px' }}>
					<li style={{ marginBottom: '8px' }}><strong style={{ color: 'rgba(255,255,255,0.8)' }}>on:client</strong> — Hydrate immediately on page load</li>
					<li style={{ marginBottom: '8px' }}><strong style={{ color: 'rgba(255,255,255,0.8)' }}>on:visible</strong> — Hydrate when scrolled into view</li>
					<li style={{ marginBottom: '8px' }}><strong style={{ color: 'rgba(255,255,255,0.8)' }}>on:interaction</strong> — Hydrate on click or hover</li>
					<li style={{ marginBottom: '8px' }}><strong style={{ color: 'rgba(255,255,255,0.8)' }}>on:idle</strong> — Hydrate during browser idle time</li>
					<li><strong style={{ color: 'rgba(255,255,255,0.8)' }}>media:</strong> — Hydrate based on media query</li>
				</ul>

				<h2 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '24px',
					color: 'rgba(255,255,255,0.8)',
					marginTop: '32px',
					marginBottom: '16px',
				}}>
					Multi-Framework Support
				</h2>
				<p style={{ marginBottom: '16px' }}>
					Use React, Preact, Vue, Svelte, Solid, or Lit components in the same project. Each framework's islands are bundled separately for optimal code splitting.
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
				}}>{`// Mix frameworks in one page
import ReactCounter from '../islands/ReactCounter.tsx';
import VueCounter from '../islands/VueCounter.vue';
import SvelteCounter from '../islands/SvelteCounter.svelte';

export default async function Page() {
  return (
    <div>
      <ReactCounter island={{ condition: 'on:interaction' }} />
      <VueCounter island={{ condition: 'on:visible' }} />
      <SvelteCounter island={{ condition: 'on:idle' }} />
    </div>
  );
}`}</pre>

				<h2 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '24px',
					color: 'rgba(255,255,255,0.8)',
					marginTop: '32px',
					marginBottom: '16px',
				}}>
					Nested Layouts
				</h2>
				<p style={{ marginBottom: '16px' }}>
					Layouts compose automatically based on directory structure. A layout in <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>src/layouts/blog/_layout.tsx</code> will wrap all pages in <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>src/pages/blog/</code>.
				</p>
			</div>
		</article>
	);
}
