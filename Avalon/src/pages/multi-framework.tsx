import { renderIsland } from '@avalon/avalon';

export default async function MultiFrameworkPage() {
	return (
		<div>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>🌈 Multi-Framework Showcase</h1>

			<p style={{ color: '#6c757d', marginBottom: '30px', fontSize: '1.1rem' }}>
				All frameworks working together seamlessly - React, Lit, Preact, Vue, Svelte, and Solid.
			</p>

			<div
				style={{
					marginBottom: '30px',
					padding: '20px',
					background: '#e7f5ff',
					borderRadius: '12px',
					border: '1px solid #d0ebff',
				}}>
				<h3 style={{ color: '#1971c2', marginBottom: '10px' }}>✨ What Makes This Special?</h3>
				<p style={{ color: '#6c757d', lineHeight: '1.8' }}>
					Each component below is built with a different framework, yet they all work together on the same page.
					This is the power of Avalon's islands architecture - framework isolation with seamless integration.
				</p>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px' }}>
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
						⚛️ React
					</h3>
					{await renderIsland({
						src: '/src/islands/ReactCounter.tsx',
						condition: 'on:interaction',
						framework: 'react',
						props: { initialCount: 0 },
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
						🔥 Lit
					</h3>
					{await renderIsland({
						src: '/src/islands/Counter.lit.ts',
						condition: 'on:interaction',
						framework: 'lit',
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
						⚛️ Preact
					</h3>
					{await renderIsland({
						src: '/src/islands/PreactCounter.tsx',
						condition: 'on:interaction',
						framework: 'preact',
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
						💚 Vue
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
						🔥 Svelte
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
						💎 Solid
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
					background: '#fff',
					borderRadius: '12px',
					boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
				}}>
				<h3 style={{ color: '#495057', marginBottom: '15px' }}>🎯 Advanced Examples</h3>
				<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
					{/* React Client Component */}
					<div>
						<h4 style={{ color: '#61dafb', marginBottom: '10px' }}>React Client Component</h4>
						{await renderIsland({
							src: '/src/islands/ReactClientComponent.tsx',
							condition: 'on:visible',
							framework: 'react',
							props: {
								title: 'React in Multi-Framework Page',
								message: 'This React component coexists with Lit, Vue, Svelte, and Solid components.',
							},
						})}
					</div>

					{/* Lit Card */}
					<div>
						<h4 style={{ color: '#ff6b6b', marginBottom: '10px' }}>Lit Card with Shadow DOM</h4>
						{await renderIsland({
							src: '/src/islands/Card.lit.ts',
							condition: 'on:visible',
							framework: 'lit',
							props: {
								title: 'Lit Web Component',
								description: 'This Lit component uses Shadow DOM for style isolation, working alongside React and other frameworks.',
								badge: 'Multi-Framework',
							},
						})}
					</div>
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
				<h3 style={{ color: '#495057', marginBottom: '15px' }}>🔍 How It Works</h3>
				<ul style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<li><strong>Island Isolation:</strong> Each component runs in its own isolated context</li>
					<li><strong>Framework Independence:</strong> Components don't know about each other's frameworks</li>
					<li><strong>Selective Hydration:</strong> Only interactive components load JavaScript</li>
					<li><strong>Lazy Loading:</strong> Islands load on-demand based on hydration conditions</li>
					<li><strong>Optimal Bundles:</strong> Each framework is bundled separately and cached</li>
					<li><strong>Zero Conflicts:</strong> No framework version conflicts or runtime issues</li>
				</ul>
			</div>

			<div
				style={{
					marginTop: '25px',
					padding: '25px',
					background: '#fff5f5',
					borderRadius: '12px',
					border: '1px solid #ffe3e3',
				}}>
				<h3 style={{ color: '#c92a2a', marginBottom: '15px' }}>💡 Cross-Framework Communication</h3>
				<div style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<p style={{ marginBottom: '10px' }}>
						<strong>Props:</strong> Pass serializable data to any island via props, regardless of framework.
					</p>
					<p style={{ marginBottom: '10px' }}>
						<strong>Custom Events:</strong> Islands can communicate using browser's native custom events.
					</p>
					<p>
						<strong>Shared State:</strong> Use URL parameters, localStorage, or custom event buses for shared state.
					</p>
				</div>
			</div>

			<div
				style={{
					marginTop: '25px',
					padding: '25px',
					background: '#e7f5ff',
					borderRadius: '12px',
					border: '1px solid #d0ebff',
				}}>
				<h3 style={{ color: '#1971c2', marginBottom: '15px' }}>🚀 Performance Benefits</h3>
				<div style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<p style={{ marginBottom: '10px' }}>
						By using islands architecture with multiple frameworks, you get:
					</p>
					<ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
						<li>Smaller initial bundle size (only load what's needed)</li>
						<li>Faster time to interactive (progressive enhancement)</li>
						<li>Better caching (framework bundles cached separately)</li>
						<li>Flexibility to choose the best tool for each component</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
