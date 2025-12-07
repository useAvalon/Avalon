import { renderIsland } from '@avalon/avalon';

export default async function HydrationTestPage() {
	return (
		<div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>🧪 Hydration Conditions Test</h1>

			<p style={{ color: '#6c757d', marginBottom: '30px', fontSize: '1.1rem' }}>
				Testing all hydration conditions across multiple frameworks.
			</p>

			{/* on:client - Immediate hydration */}
			<section style={{ marginBottom: '40px' }}>
				<h2 style={{ color: '#495057', marginBottom: '20px' }}>⚡ on:client (Immediate)</h2>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#673ab7', marginBottom: '10px' }}>Preact</h3>
						{await renderIsland({
							src: '/src/islands/PreactCounter.tsx',
							condition: 'on:client',
							framework: 'preact',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#4fc08d', marginBottom: '10px' }}>Vue</h3>
						{await renderIsland({
							src: '/src/islands/VueCounter.vue',
							condition: 'on:client',
							framework: 'vue',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#ff3e00', marginBottom: '10px' }}>Svelte</h3>
						{await renderIsland({
							src: '/src/islands/SvelteCounter.svelte',
							condition: 'on:client',
							framework: 'svelte',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#2c4f7c', marginBottom: '10px' }}>Solid</h3>
						{await renderIsland({
							src: '/src/islands/SolidCounter.solid.tsx',
							condition: 'on:client',
							framework: 'solid',
						})}
					</div>
				</div>
			</section>

			{/* on:visible - Lazy hydration when visible */}
			<section style={{ marginBottom: '40px' }}>
				<h2 style={{ color: '#495057', marginBottom: '20px' }}>👁️ on:visible (Lazy - when scrolled into view)</h2>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#673ab7', marginBottom: '10px' }}>Preact</h3>
						{await renderIsland({
							src: '/src/islands/PreactCounter.tsx',
							condition: 'on:visible',
							framework: 'preact',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#4fc08d', marginBottom: '10px' }}>Vue</h3>
						{await renderIsland({
							src: '/src/islands/VueCounter.vue',
							condition: 'on:visible',
							framework: 'vue',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#ff3e00', marginBottom: '10px' }}>Svelte</h3>
						{await renderIsland({
							src: '/src/islands/SvelteCounter.svelte',
							condition: 'on:visible',
							framework: 'svelte',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#2c4f7c', marginBottom: '10px' }}>Solid</h3>
						{await renderIsland({
							src: '/src/islands/SolidCounter.solid.tsx',
							condition: 'on:visible',
							framework: 'solid',
						})}
					</div>
				</div>
			</section>

			{/* on:interaction - Hydrate on user interaction */}
			<section style={{ marginBottom: '40px' }}>
				<h2 style={{ color: '#495057', marginBottom: '20px' }}>🖱️ on:interaction (Hydrate on click/hover)</h2>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#673ab7', marginBottom: '10px' }}>Preact</h3>
						{await renderIsland({
							src: '/src/islands/PreactCounter.tsx',
							condition: 'on:interaction',
							framework: 'preact',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#4fc08d', marginBottom: '10px' }}>Vue</h3>
						{await renderIsland({
							src: '/src/islands/VueCounter.vue',
							condition: 'on:interaction',
							framework: 'vue',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#ff3e00', marginBottom: '10px' }}>Svelte</h3>
						{await renderIsland({
							src: '/src/islands/SvelteCounter.svelte',
							condition: 'on:interaction',
							framework: 'svelte',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#2c4f7c', marginBottom: '10px' }}>Solid</h3>
						{await renderIsland({
							src: '/src/islands/SolidCounter.solid.tsx',
							condition: 'on:interaction',
							framework: 'solid',
						})}
					</div>
				</div>
			</section>

			{/* on:idle - Hydrate when browser is idle */}
			<section style={{ marginBottom: '40px' }}>
				<h2 style={{ color: '#495057', marginBottom: '20px' }}>⏱️ on:idle (Hydrate when browser is idle)</h2>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#673ab7', marginBottom: '10px' }}>Preact</h3>
						{await renderIsland({
							src: '/src/islands/PreactCounter.tsx',
							condition: 'on:idle',
							framework: 'preact',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#4fc08d', marginBottom: '10px' }}>Vue</h3>
						{await renderIsland({
							src: '/src/islands/VueCounter.vue',
							condition: 'on:idle',
							framework: 'vue',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#ff3e00', marginBottom: '10px' }}>Svelte</h3>
						{await renderIsland({
							src: '/src/islands/SvelteCounter.svelte',
							condition: 'on:idle',
							framework: 'svelte',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#2c4f7c', marginBottom: '10px' }}>Solid</h3>
						{await renderIsland({
							src: '/src/islands/SolidCounter.solid.tsx',
							condition: 'on:idle',
							framework: 'solid',
						})}
					</div>
				</div>
			</section>

			{/* media: - Conditional hydration based on media query */}
			<section style={{ marginBottom: '40px' }}>
				<h2 style={{ color: '#495057', marginBottom: '20px' }}>📱 media: (Hydrate on desktop only)</h2>
				<p style={{ color: '#6c757d', marginBottom: '15px', fontSize: '0.95rem' }}>
					These islands only hydrate on screens wider than 768px. Try resizing your browser!
				</p>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#673ab7', marginBottom: '10px' }}>Preact</h3>
						{await renderIsland({
							src: '/src/islands/PreactCounter.tsx',
							condition: 'media:(min-width: 768px)',
							framework: 'preact',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#4fc08d', marginBottom: '10px' }}>Vue</h3>
						{await renderIsland({
							src: '/src/islands/VueCounter.vue',
							condition: 'media:(min-width: 768px)',
							framework: 'vue',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#ff3e00', marginBottom: '10px' }}>Svelte</h3>
						{await renderIsland({
							src: '/src/islands/SvelteCounter.svelte',
							condition: 'media:(min-width: 768px)',
							framework: 'svelte',
						})}
					</div>
					<div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
						<h3 style={{ color: '#2c4f7c', marginBottom: '10px' }}>Solid</h3>
						{await renderIsland({
							src: '/src/islands/SolidCounter.solid.tsx',
							condition: 'media:(min-width: 768px)',
							framework: 'solid',
						})}
					</div>
				</div>
			</section>

			{/* Info section */}
			<div
				style={{
					marginTop: '40px',
					padding: '25px',
					background: '#f8f9fa',
					borderRadius: '12px',
					border: '1px solid #e9ecef',
				}}>
				<h3 style={{ color: '#495057', marginBottom: '15px' }}>🔍 Testing Instructions</h3>
				<ul style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<li><strong>on:client:</strong> Should be interactive immediately on page load</li>
					<li><strong>on:visible:</strong> Scroll down to see these hydrate when they enter the viewport</li>
					<li><strong>on:interaction:</strong> Hover or click to trigger hydration</li>
					<li><strong>on:idle:</strong> Will hydrate after the browser becomes idle (a few seconds after page load)</li>
					<li><strong>media:</strong> Only hydrates on desktop (min-width: 768px) - try resizing your browser</li>
				</ul>
				<p style={{ color: '#6c757d', marginTop: '15px', fontSize: '0.95rem' }}>
					Open your browser's DevTools Console to see hydration logs and verify when each island hydrates.
				</p>
			</div>
		</div>
	);
}
