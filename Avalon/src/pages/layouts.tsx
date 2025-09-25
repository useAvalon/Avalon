export default function LayoutsPage() {
	return (
		<div>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>📐 Layout System Demo</h1>

			<div
				style={{
					background: '#f0f8ff',
					padding: '20px',
					borderRadius: '10px',
					marginBottom: '30px',
					border: '1px solid #b3d9ff',
				}}>
				<h3 style={{ color: '#0056b3', marginBottom: '10px' }}>🏗️ How Layouts Work</h3>
				<p style={{ color: '#0056b3', lineHeight: '1.6' }}>
					This page uses the root layout (_layout.tsx) which provides the header, navigation, and overall page
					structure. Nested routes can have their own layouts that wrap around the page content.
				</p>
			</div>

			<div style={{ display: 'grid', gap: '25px' }}>
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '1px solid #e9ecef',
					}}>
					<h3 style={{ color: '#495057', marginBottom: '15px' }}>🎯 Current Layout Structure</h3>
					<div
						style={{
							background: '#f8f9fa',
							padding: '15px',
							borderRadius: '8px',
							fontFamily: 'monospace',
							fontSize: '0.9rem',
							color: '#495057',
						}}>
						<div>📁 src/layouts/</div>
						<div style={{ marginLeft: '20px' }}>├── _layout.tsx (Root layout - you see this!)</div>
						<div style={{ marginLeft: '20px' }}>└── blog/</div>
						<div style={{ marginLeft: '40px' }}>└── _layout.tsx (Blog layout)</div>
					</div>
				</div>

				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '1px solid #e9ecef',
					}}>
					<h3 style={{ color: '#495057', marginBottom: '15px' }}>🔗 Layout Features</h3>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
						<div
							style={{
								background: 'linear-gradient(135deg, #667eea, #764ba2)',
								color: 'white',
								padding: '20px',
								borderRadius: '10px',
							}}>
							<h4>🔄 Automatic Nesting</h4>
							<p style={{ fontSize: '0.9rem', opacity: 0.9 }}>
								Layouts automatically wrap child routes based on file structure
							</p>
						</div>

						<div
							style={{
								background: 'linear-gradient(135deg, #f093fb, #f5576c)',
								color: 'white',
								padding: '20px',
								borderRadius: '10px',
							}}>
							<h4>📊 Data Loading</h4>
							<p style={{ fontSize: '0.9rem', opacity: 0.9 }}>Layouts can load data and pass it to child components</p>
						</div>

						<div
							style={{
								background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
								color: 'white',
								padding: '20px',
								borderRadius: '10px',
							}}>
							<h4>🎨 Style Isolation</h4>
							<p style={{ fontSize: '0.9rem', opacity: 0.9 }}>Each layout can have its own styles and components</p>
						</div>
					</div>
				</div>

				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '1px solid #e9ecef',
					}}>
					<h3 style={{ color: '#495057', marginBottom: '15px' }}>🧪 Try the Blog Layout</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px' }}>
						Visit the blog section to see a nested layout in action. The blog layout adds a sidebar navigation while
						keeping the main header and footer.
					</p>
					<a
						href="/blog"
						style={{
							display: 'inline-block',
							padding: '12px 24px',
							background: 'linear-gradient(135deg, #667eea, #764ba2)',
							color: 'white',
							textDecoration: 'none',
							borderRadius: '8px',
							transition: 'transform 0.2s',
						}}>
						Visit Blog →
					</a>
				</div>
			</div>

			<div
				style={{
					marginTop: '40px',
					padding: '25px',
					background: '#e8f5e8',
					borderRadius: '12px',
					border: '1px solid #c3e6c3',
				}}>
				<h3 style={{ color: '#2d5a2d', marginBottom: '15px' }}>✨ Layout Benefits</h3>
				<ul style={{ color: '#2d5a2d', lineHeight: '1.8' }}>
					<li>
						<strong>Code Reuse:</strong> Share common UI elements across pages
					</li>
					<li>
						<strong>Consistent UX:</strong> Maintain consistent navigation and branding
					</li>
					<li>
						<strong>Performance:</strong> Layouts are cached and reused
					</li>
					<li>
						<strong>SEO Friendly:</strong> Server-side rendered with proper meta tags
					</li>
					<li>
						<strong>Flexible:</strong> Mix and match layouts for different page types
					</li>
				</ul>
			</div>
		</div>
	);
}
