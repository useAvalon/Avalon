export default function HomePage() {
	return (
		<div>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>Welcome to Avalon Framework Demo</h1>

			<div
				style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
					gap: '20px',
					marginBottom: '30px',
				}}>
				<div
					style={{
						background: 'linear-gradient(135deg, #74b9ff, #0984e3)',
						color: 'white',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 8px 25px rgba(116, 185, 255, 0.3)',
					}}>
					<h3>🚀 Multi-Framework Support</h3>
					<p>Build with React, Vue, Svelte, and Solid in the same project</p>
				</div>

				<div
					style={{
						background: 'linear-gradient(135deg, #fd79a8, #e84393)',
						color: 'white',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 8px 25px rgba(253, 121, 168, 0.3)',
					}}>
					<h3>🏝️ Islands Architecture</h3>
					<p>Selective hydration for optimal performance</p>
				</div>

				<div
					style={{
						background: 'linear-gradient(135deg, #fdcb6e, #e17055)',
						color: 'white',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 8px 25px rgba(253, 203, 110, 0.3)',
					}}>
					<h3>📁 File-System Routing</h3>
					<p>Automatic route discovery and nested layouts</p>
				</div>

				<div
					style={{
						background: 'linear-gradient(135deg, #a29bfe, #6c5ce7)',
						color: 'white',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 8px 25px rgba(162, 155, 254, 0.3)',
					}}>
					<h3>⚡ Middleware System</h3>
					<p>Hierarchical middleware for pages and APIs</p>
				</div>
			</div>

			<div
				style={{
					background: '#f8f9fa',
					padding: '25px',
					borderRadius: '12px',
					border: '1px solid #e9ecef',
				}}>
				<h2 style={{ color: '#495057', marginBottom: '15px' }}>🎯 What to Explore</h2>
				<ul style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<li>
						<strong>Frameworks Page:</strong> See different frameworks rendering the same component
					</li>
					<li>
						<strong>Islands Demo:</strong> Interactive components with selective hydration
					</li>
					<li>
						<strong>Layouts:</strong> Nested layout system in action
					</li>
					<li>
						<strong>API Demo:</strong> Server-side API routes with middleware
					</li>
					<li>
						<strong>Blog:</strong> File-system routing with nested layouts
					</li>
				</ul>
			</div>
		</div>
	);
}
