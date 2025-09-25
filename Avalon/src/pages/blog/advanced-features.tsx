export default function AdvancedFeaturesPage() {
	return (
		<div>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>⚡ Advanced Features Deep Dive</h1>

			<div style={{ color: '#6c757d', marginBottom: '30px' }}>
				<span>📅 December 10, 2024</span> • <span>⏱️ 8 min read</span>
			</div>

			<div style={{ lineHeight: '1.8', color: '#495057' }}>
				<p style={{ marginBottom: '20px', fontSize: '1.1rem' }}>
					Ready to unlock Avalon's full potential? Let's explore the advanced features that make it a powerful framework
					for modern web applications.
				</p>

				<h2 style={{ color: '#2c3e50', marginTop: '30px', marginBottom: '15px' }}>🛡️ Middleware System</h2>

				<p style={{ marginBottom: '20px' }}>
					Avalon's middleware system provides powerful request/response processing capabilities with automatic hierarchy
					detection.
				</p>

				<div
					style={{
						background: '#f8f9fa',
						padding: '20px',
						borderRadius: '8px',
						fontFamily: 'monospace',
						fontSize: '0.9rem',
						marginBottom: '20px',
					}}>
					<div>📁 src/</div>
					<div style={{ marginLeft: '20px' }}>├── _middleware.ts # Global middleware</div>
					<div style={{ marginLeft: '20px' }}>├── api/</div>
					<div style={{ marginLeft: '40px' }}>├── _middleware.ts # API-only middleware</div>
					<div style={{ marginLeft: '40px' }}>└── auth/</div>
					<div style={{ marginLeft: '60px' }}>├── _middleware.ts # Auth API middleware</div>
					<div style={{ marginLeft: '60px' }}>└── login.ts</div>
				</div>

				<div
					style={{
						background: '#e8f4fd',
						padding: '20px',
						borderRadius: '10px',
						border: '1px solid #bee5eb',
						marginBottom: '30px',
					}}>
					<h3 style={{ color: '#0c5460', marginBottom: '10px' }}>🔄 Middleware Chain</h3>
					<p style={{ color: '#0c5460' }}>
						Middleware executes in order from root to leaf, allowing you to build sophisticated request processing
						pipelines with authentication, logging, CORS, and more.
					</p>
				</div>

				<h2 style={{ color: '#2c3e50', marginTop: '30px', marginBottom: '15px' }}>🎨 Layout Composition</h2>

				<p style={{ marginBottom: '20px' }}>
					Layouts can be nested and composed to create complex page structures while maintaining code reusability.
				</p>

				<div style={{ display: 'grid', gap: '15px', marginBottom: '30px' }}>
					<div
						style={{
							background: '#f0f8ff',
							padding: '15px',
							borderRadius: '8px',
							border: '1px solid #b3d9ff',
						}}>
						<strong style={{ color: '#0056b3' }}>Root Layout:</strong>
						<span style={{ color: '#0056b3' }}> HTML structure, global navigation</span>
					</div>
					<div
						style={{
							background: '#f0f8ff',
							padding: '15px',
							borderRadius: '8px',
							border: '1px solid #b3d9ff',
							marginLeft: '20px',
						}}>
						<strong style={{ color: '#0056b3' }}>Section Layout:</strong>
						<span style={{ color: '#0056b3' }}> Sidebar, breadcrumbs</span>
					</div>
					<div
						style={{
							background: '#f0f8ff',
							padding: '15px',
							borderRadius: '8px',
							border: '1px solid #b3d9ff',
							marginLeft: '40px',
						}}>
						<strong style={{ color: '#0056b3' }}>Page Content:</strong>
						<span style={{ color: '#0056b3' }}> Actual page content</span>
					</div>
				</div>

				<h2 style={{ color: '#2c3e50', marginTop: '30px', marginBottom: '15px' }}>🚀 Performance Optimizations</h2>

				<div style={{ display: 'grid', gap: '20px', marginBottom: '30px' }}>
					<div
						style={{
							background: '#e8f5e8',
							padding: '20px',
							borderRadius: '10px',
							border: '1px solid #c3e6c3',
						}}>
						<h3 style={{ color: '#2d5a2d', marginBottom: '10px' }}>📦 Code Splitting</h3>
						<p style={{ color: '#2d5a2d' }}>
							Each island gets its own bundle, loaded only when needed. Framework code is shared across islands of the
							same type.
						</p>
					</div>

					<div
						style={{
							background: '#fff0f0',
							padding: '20px',
							borderRadius: '10px',
							border: '1px solid #ffcccb',
						}}>
						<h3 style={{ color: '#8b0000', marginBottom: '10px' }}>⚡ Lazy Loading</h3>
						<p style={{ color: '#8b0000' }}>
							Islands can be configured to load only when they enter the viewport, reducing initial page load time
							significantly.
						</p>
					</div>

					<div
						style={{
							background: '#f3e5f5',
							padding: '20px',
							borderRadius: '10px',
							border: '1px solid #e1bee7',
						}}>
						<h3 style={{ color: '#4a148c', marginBottom: '10px' }}>🎯 Selective Hydration</h3>
						<p style={{ color: '#4a148c' }}>
							Only interactive components hydrate on the client. Static content remains as lightweight HTML.
						</p>
					</div>
				</div>

				<h2 style={{ color: '#2c3e50', marginTop: '30px', marginBottom: '15px' }}>🔧 Development Experience</h2>

				<ul style={{ lineHeight: '1.8', paddingLeft: '20px', marginBottom: '30px' }}>
					<li style={{ marginBottom: '10px' }}>
						<strong>Hot Module Replacement:</strong> Instant updates during development
					</li>
					<li style={{ marginBottom: '10px' }}>
						<strong>TypeScript Support:</strong> Full type safety across all frameworks
					</li>
					<li style={{ marginBottom: '10px' }}>
						<strong>Error Boundaries:</strong> Graceful error handling for each island
					</li>
					<li style={{ marginBottom: '10px' }}>
						<strong>Dev Tools:</strong> Framework-specific dev tools work seamlessly
					</li>
				</ul>

				<div
					style={{
						background: '#fff3cd',
						padding: '20px',
						borderRadius: '10px',
						border: '1px solid #ffeaa7',
						marginTop: '30px',
					}}>
					<h3 style={{ color: '#856404', marginBottom: '10px' }}>🎯 Best Practices</h3>
					<ul style={{ color: '#856404', paddingLeft: '20px' }}>
						<li>Keep islands small and focused</li>
						<li>Use static rendering for non-interactive content</li>
						<li>Leverage middleware for cross-cutting concerns</li>
						<li>Design layouts for reusability</li>
						<li>Monitor bundle sizes and loading performance</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
