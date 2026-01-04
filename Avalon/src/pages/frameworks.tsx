import { renderIsland } from '@avalon/avalon';

export default async function FrameworksPage() {
	return (
		<div>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>🎨 Multi-Framework Components</h1>

			<p style={{ color: '#6c757d', marginBottom: '30px', fontSize: '1.1rem' }}>
				The same counter component implemented in different frameworks, all working together seamlessly.
			</p>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px' }}>
				{/* React Counter */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #61dafb',
					}}>
					<h3 style={{ color: '#61dafb', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
						⚛️ React Counter
					</h3>
					{await renderIsland({
						src: '/src/islands/ReactCounter.tsx',
						condition: 'on:interaction',
						framework: 'react',
						props: { initialCount: 0 },
					})}
				</div>

				{/* Preact Counter */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #673ab7',
					}}>
					<h3 style={{ color: '#673ab7', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
						⚛️ Preact Counter
					</h3>
					{await renderIsland({
						src: '/src/islands/PreactCounter.tsx',
						condition: 'on:interaction',
						framework: 'preact',
					})}
				</div>

				{/* Lit Counter */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #ff6b6b',
					}}>
					<h3 style={{ color: '#ff6b6b', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
						🔥 Lit Counter
					</h3>
					{await renderIsland({
						src: '/src/islands/Counter.lit.ts',
						condition: 'on:interaction',
						framework: 'lit',
						props: { initialCount: 0 },
					})}
				</div>

				{/* Vue Counter */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #4fc08d',
					}}>
					<h3 style={{ color: '#4fc08d', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
						💚 Vue Counter
					</h3>
					{await renderIsland({
						src: '/src/islands/VueCounter.vue',
						condition: 'on:interaction',
						framework: 'vue',
					})}
				</div>

				{/* Svelte Counter */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #ff3e00',
					}}>
					<h3 style={{ color: '#ff3e00', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
						🔥 Svelte Counter
					</h3>
					{await renderIsland({
						src: '/src/islands/SvelteCounter.svelte',
						condition: 'on:interaction',
						framework: 'svelte',
					})}
				</div>

				{/* Solid Counter */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #2c4f7c',
					}}>
					<h3 style={{ color: '#2c4f7c', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
						💎 Solid Counter
					</h3>
					{await renderIsland({
						src: '/src/islands/SolidCounter.solid.tsx',
						condition: 'on:interaction',
						framework: 'solid',
					})}
				</div>
			</div>

			<div
				style={{
					marginTop: '40px',
					padding: '25px',
					background: '#f8f9fa',
					borderRadius: '12px',
					border: '1px solid #e9ecef',
				}}>
				<h3 style={{ color: '#495057', marginBottom: '15px' }}>🔍 What's Happening Here?</h3>
				<ul style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<li>Each counter is a separate framework component</li>
					<li>They're hydrated independently using islands architecture</li>
					<li>The page itself is server-rendered with Preact</li>
					<li>Each island loads only when needed (lazy loading)</li>
					<li>Framework-specific bundles are automatically generated</li>
				</ul>
			</div>
		</div>
	);
}
