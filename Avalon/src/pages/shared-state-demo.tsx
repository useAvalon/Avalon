/** @jsxImportSource preact */

// --- Section 1: Shared state via CustomEvent ---
import EventPreactCounter from '../islands/EventPreactCounter.tsx';
import EventReactCounter from '../islands/EventReactCounter.tsx';
import EventVueCounter from '../islands/EventVueCounter.vue';
import EventSvelteCounter from '../islands/EventSvelteCounter.svelte';
import EventSolidCounter from '../islands/EventSolidCounter.solid.tsx';
import EventLitCounter from '../islands/EventCounter.lit.ts';

// --- Section 2: Local state via props ---
import PreactCounter from '../islands/PreactCounter.tsx';
import ReactCounter from '../islands/ReactCounter.tsx';
import VueCounter from '../islands/VueCounter.vue';
import SvelteCounter from '../islands/SvelteCounter.svelte';
import SolidCounter from '../islands/SolidCounter.solid.tsx';
import LitCounter from '../islands/Counter.lit.ts';

export default async function SharedStateDemoPage() {
	return (
		<div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
			<h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>
				🔗 Cross-Island Communication
			</h1>
			<p style={{ color: '#6c757d', marginBottom: '40px', fontSize: '1.1rem' }}>
				Islands are isolated hydration boundaries — each runs in its own framework runtime.
				This page demonstrates two patterns: shared state via DOM custom events, and local state via props.
			</p>

			{/* Section 1: Shared state via CustomEvent */}
			<section style={{ marginBottom: '60px' }}>
				<div style={{ marginBottom: '25px' }}>
					<h2 style={{ color: '#495057', marginBottom: '8px' }}>
						📡 Shared state via CustomEvent
					</h2>
					<p style={{ color: '#6c757d', fontSize: '0.95rem' }}>
						Click +/- on any counter below. All 6 islands update together because they communicate
						through <code>document.dispatchEvent(new CustomEvent('counter:update'))</code>.
						No shared module state, no global signals — just the DOM event system.
					</p>
				</div>
				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
					gap: '25px',
				}}>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #61dafb' }}>
						<EventReactCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #673ab7' }}>
						<EventPreactCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #4fc08d' }}>
						<EventVueCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #ff3e00' }}>
						<EventSvelteCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #2c4f7c' }}>
						<EventSolidCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #ff6b6b' }}>
						<EventLitCounter island={{ condition: 'on:interaction' }} />
					</div>
				</div>
			</section>

			{/* Section 2: Local state via props */}
			<section style={{ marginBottom: '60px' }}>
				<div style={{ marginBottom: '25px' }}>
					<h2 style={{ color: '#495057', marginBottom: '8px' }}>
						🏠 Local state via props
					</h2>
					<p style={{ color: '#6c757d', fontSize: '0.95rem' }}>
						These counters all receive <code>initialCount={'{'}42{'}'}</code> from the server, so they
						SSR with the same value. After hydration, each island owns its state independently —
						clicking +/- on one has no effect on the others.
					</p>
				</div>
				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
					gap: '25px',
				}}>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #61dafb' }}>
						<ReactCounter island={{ condition: 'on:interaction' }} initialCount={42} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #673ab7' }}>
						<PreactCounter island={{ condition: 'on:interaction' }} initialCount={42} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #4fc08d' }}>
						<VueCounter island={{ condition: 'on:interaction' }} initialCount={42} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #ff3e00' }}>
						<SvelteCounter island={{ condition: 'on:interaction' }} initialCount={42} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #2c4f7c' }}>
						<SolidCounter island={{ condition: 'on:interaction' }} initialCount={42} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #ff6b6b' }}>
						<LitCounter island={{ condition: 'on:interaction' }} initialCount={42} />
					</div>
				</div>
			</section>

			{/* Explanation */}
			<div style={{ padding: '25px', background: '#e7f5ff', borderRadius: '12px', border: '1px solid #d0ebff' }}>
				<h3 style={{ color: '#1971c2', marginBottom: '15px' }}>📖 Why CustomEvent?</h3>
				<ul style={{ color: '#6c757d', lineHeight: '2' }}>
					<li>Islands are isolated — Preact context, Vue provide/inject, etc. can't cross island boundaries</li>
					<li>Global signals / nanostores have SSR pitfalls (shared state across requests, memory leaks)</li>
					<li>CustomEvent is native to the DOM — every framework can dispatch and listen</li>
					<li>No shared module state means no SSR leaks</li>
					<li>Lazy — listening for an event doesn't wake up any framework</li>
					<li>Works across micro-frontends and different framework versions</li>
				</ul>
			</div>

			{/* Code example */}
			<div style={{ marginTop: '25px', padding: '25px', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
				<h3 style={{ color: '#495057', marginBottom: '15px' }}>✨ The pattern</h3>
				<pre style={{ background: '#1a1a2e', color: '#e0e0e0', padding: '15px', borderRadius: '8px', fontSize: '0.85rem', overflow: 'auto' }}>{[
					"// Any island can dispatch:",
					"document.dispatchEvent(",
					"  new CustomEvent('counter:update', { detail: { count: 5 } })",
					");",
					"",
					"// Any island can listen:",
					"document.addEventListener('counter:update', (e) => {",
					"  setCount(e.detail.count);",
					"});",
				].join('\n')}</pre>
			</div>
		</div>
	);
}
