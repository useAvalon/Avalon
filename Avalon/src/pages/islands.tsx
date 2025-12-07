import { renderIsland } from '@avalon/avalon';

export default async function IslandsPage() {
	return (
		<div>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>🏝️ Islands Architecture Demo</h1>

			<div
				style={{
					background: '#e8f4fd',
					padding: '20px',
					borderRadius: '10px',
					marginBottom: '30px',
					border: '1px solid #bee5eb',
				}}>
				<h3 style={{ color: '#0c5460', marginBottom: '10px' }}>💡 What are Islands?</h3>
				<p style={{ color: '#0c5460', lineHeight: '1.6' }}>
					Islands are interactive components that hydrate independently on the client. The rest of the page remains
					static HTML, improving performance by only loading JavaScript where needed.
				</p>
			</div>

			<div style={{ display: 'grid', gap: '25px' }}>
				{/* Static content */}
				<div
					style={{
						background: '#f8f9fa',
						padding: '20px',
						borderRadius: '10px',
						border: '2px dashed #dee2e6',
					}}>
					<h3 style={{ color: '#6c757d' }}>📄 Static Content (No JavaScript)</h3>
					<p style={{ color: '#6c757d' }}>
						This content is rendered on the server and sent as static HTML. No JavaScript is loaded for this section.
					</p>
				</div>

				{/* Interactive island */}
				<div
					style={{
						background: '#fff',
						padding: '20px',
						borderRadius: '10px',
						border: '2px solid #28a745',
						boxShadow: '0 4px 15px rgba(40, 167, 69, 0.1)',
					}}>
					<h3 style={{ color: '#28a745', marginBottom: '15px' }}>⚡ Interactive Island</h3>
					{await renderIsland({
						src: '/src/islands/PreactCounter.tsx',
						condition: 'on:interaction',
						framework: 'preact',
					})}
				</div>

				{/* Another static section */}
				<div
					style={{
						background: '#f8f9fa',
						padding: '20px',
						borderRadius: '10px',
						border: '2px dashed #dee2e6',
					}}>
					<h3 style={{ color: '#6c757d' }}>📊 More Static Content</h3>
					<p style={{ color: '#6c757d' }}>
						Again, this is just static HTML. The JavaScript bundle for the counter above doesn't affect this content at
						all.
					</p>
				</div>

				{/* Multiple islands */}
				<div
					style={{
						background: '#fff',
						padding: '20px',
						borderRadius: '10px',
						border: '2px solid #17a2b8',
						boxShadow: '0 4px 15px rgba(23, 162, 184, 0.1)',
					}}>
					<h3 style={{ color: '#17a2b8', marginBottom: '15px' }}>🌊 Multiple Islands</h3>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
						{await renderIsland({
							src: '/src/islands/VueCounter.vue',
							condition: 'on:interaction',
							framework: 'vue',
						})}
						{await renderIsland({
							src: '/src/islands/SvelteCounter.svelte',
							condition: 'on:interaction',
							framework: 'svelte',
						})}
					</div>
				</div>
			</div>

			<div
				style={{
					marginTop: '40px',
					padding: '25px',
					background: '#fff3cd',
					borderRadius: '12px',
					border: '1px solid #ffeaa7',
				}}>
				<h3 style={{ color: '#856404', marginBottom: '15px' }}>🎯 Performance Benefits</h3>
				<ul style={{ color: '#856404', lineHeight: '1.8' }}>
					<li>
						<strong>Selective Hydration:</strong> Only interactive components load JavaScript
					</li>
					<li>
						<strong>Framework Isolation:</strong> Each island can use a different framework
					</li>
					<li>
						<strong>Lazy Loading:</strong> Islands load only when they enter the viewport
					</li>
					<li>
						<strong>Reduced Bundle Size:</strong> No monolithic JavaScript bundle
					</li>
					<li>
						<strong>Better Core Web Vitals:</strong> Faster initial page load
					</li>
				</ul>
			</div>
		</div>
	);
}
