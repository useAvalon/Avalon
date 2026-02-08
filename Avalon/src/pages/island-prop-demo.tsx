/** @jsxImportSource preact */
/// <reference path="../../../packages/avalon/src/types/island-jsx.d.ts" />
import PreactCounter from '../islands/PreactCounter.tsx';
import ReactCounter from '../islands/ReactCounter.tsx';
import VueCounter from '../islands/VueCounter.vue';
import SvelteCounter from '../islands/SvelteCounter.svelte';
import SolidCounter from '../islands/SolidCounter.solid.tsx';
import LitCounter from '../islands/Counter.lit.ts';

export default async function IslandPropDemoPage() {
	return (
		<div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
			<h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>
				🏝️ Island Prop API Demo
			</h1>
			<p style={{ color: '#6c757d', marginBottom: '30px', fontSize: '1.1rem' }}>
				Import island components directly and control hydration with the <code>island</code> prop.
				No more manual <code>renderIsland()</code> calls needed.
			</p>

			{/* on:interaction examples */}
			<section style={{ marginBottom: '40px' }}>
				<h2 style={{ color: '#495057', marginBottom: '20px' }}>
					🖱️ on:interaction — hydrates on click/hover
				</h2>
				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
					gap: '25px',
				}}>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #61dafb' }}>
						<h3 style={{ color: '#61dafb', marginBottom: '15px' }}>⚛️ React</h3>
						<ReactCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #673ab7' }}>
						<h3 style={{ color: '#673ab7', marginBottom: '15px' }}>⚛️ Preact</h3>
						<PreactCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #4fc08d' }}>
						<h3 style={{ color: '#4fc08d', marginBottom: '15px' }}>� Vue</h3>
						<VueCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #ff3e00' }}>
						<h3 style={{ color: '#ff3e00', marginBottom: '15px' }}>🔥 Svelte</h3>
						<SvelteCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #2c4f7c' }}>
						<h3 style={{ color: '#2c4f7c', marginBottom: '15px' }}>💎 Solid</h3>
						<SolidCounter island={{ condition: 'on:interaction' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #ff6b6b' }}>
						<h3 style={{ color: '#ff6b6b', marginBottom: '15px' }}>🔥 Lit</h3>
						<LitCounter island={{ condition: 'on:interaction' }} />
					</div>
				</div>
			</section>

			{/* on:visible examples */}
			<section style={{ marginBottom: '40px' }}>
				<h2 style={{ color: '#495057', marginBottom: '20px' }}>
					👁️ on:visible — hydrates when scrolled into view
				</h2>
				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
					gap: '25px',
				}}>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #673ab7' }}>
						<h3 style={{ color: '#673ab7', marginBottom: '15px' }}>⚛️ Preact</h3>
						<PreactCounter island={{ condition: 'on:visible' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #4fc08d' }}>
						<h3 style={{ color: '#4fc08d', marginBottom: '15px' }}>💚 Vue</h3>
						<VueCounter island={{ condition: 'on:visible' }} />
					</div>
				</div>
			</section>

			{/* on:idle examples */}
			<section style={{ marginBottom: '40px' }}>
				<h2 style={{ color: '#495057', marginBottom: '20px' }}>
					⏱️ on:idle — hydrates when browser is idle
				</h2>
				<div style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
					gap: '25px',
				}}>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #ff3e00' }}>
						<h3 style={{ color: '#ff3e00', marginBottom: '15px' }}>🔥 Svelte</h3>
						<SvelteCounter island={{ condition: 'on:idle' }} />
					</div>
					<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #2c4f7c' }}>
						<h3 style={{ color: '#2c4f7c', marginBottom: '15px' }}>💎 Solid</h3>
						<SolidCounter island={{ condition: 'on:idle' }} />
					</div>
				</div>
			</section>

			{/* SSR-only example */}
			<section style={{ marginBottom: '40px' }}>
				<h2 style={{ color: '#495057', marginBottom: '20px' }}>
					📄 ssrOnly — server-rendered, no client JS
				</h2>
				<div style={{ background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '2px solid #6c757d' }}>
					<h3 style={{ color: '#6c757d', marginBottom: '15px' }}>⚛️ Preact (static)</h3>
					<PreactCounter island={{ ssrOnly: true }} />
				</div>
			</section>

			{/* Code comparison */}
			<div style={{ marginTop: '40px', padding: '25px', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e9ecef' }}>
				<h3 style={{ color: '#495057', marginBottom: '15px' }}>✨ Before vs After</h3>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
					<div>
						<h4 style={{ color: '#c92a2a', marginBottom: '10px' }}>Before (manual)</h4>
						<pre style={{ background: '#1a1a2e', color: '#e0e0e0', padding: '15px', borderRadius: '8px', fontSize: '0.85rem', overflow: 'auto' }}>{[
							"import { renderIsland } from '@avalon/avalon';",
							"",
							"export default async function Page() {",
							"  return (",
							"    <div>",
							"      {await renderIsland({",
							"        src: '/src/components/Counter.tsx',",
							"        condition: 'on:interaction',",
							"        framework: 'preact',",
							"      })}",
							"    </div>",
							"  );",
							"}",
						].join('\n')}</pre>
					</div>
					<div>
						<h4 style={{ color: '#2b8a3e', marginBottom: '10px' }}>After (island prop)</h4>
						<pre style={{ background: '#1a1a2e', color: '#e0e0e0', padding: '15px', borderRadius: '8px', fontSize: '0.85rem', overflow: 'auto' }}>{[
							"import Counter from './components/Counter.tsx';",
							"",
							"export default async function Page() {",
							"  return (",
							"    <div>",
							"      <Counter island={{",
							"        condition: 'on:interaction'",
							"      }} />",
							"    </div>",
							"  );",
							"}",
						].join('\n')}</pre>
					</div>
				</div>
			</div>

			<div style={{ marginTop: '25px', padding: '25px', background: '#e7f5ff', borderRadius: '12px', border: '1px solid #d0ebff' }}>
				<h3 style={{ color: '#1971c2', marginBottom: '15px' }}>📖 island prop options</h3>
				<ul style={{ color: '#6c757d', lineHeight: '2' }}>
					<li><code>condition</code> — <code>'on:visible'</code> | <code>'on:interaction'</code> | <code>'on:idle'</code> | <code>'on:client'</code> | <code>'media:(...)'</code></li>
					<li><code>ssrOnly</code> — <code>true</code> to render server-side only, no client JS</li>
					<li><code>ssr</code> — <code>false</code> to skip SSR (client-only rendering)</li>
				</ul>
				<p style={{ color: '#6c757d', marginTop: '10px' }}>
					Any other props you pass are forwarded to the component. Framework is auto-detected from the file extension.
				</p>
			</div>
		</div>
	);
}
