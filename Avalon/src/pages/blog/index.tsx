export default function BlogIndexPage() {
	return (
		<div>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>📝 Avalon Blog</h1>

			<p style={{ color: '#6c757d', marginBottom: '30px', fontSize: '1.1rem' }}>
				Welcome to the Avalon blog! This section demonstrates nested layouts and file-system routing in action.
			</p>

			<div style={{ display: 'grid', gap: '25px' }}>
				<article
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '1px solid #e9ecef',
					}}>
					<h2 style={{ color: '#495057', marginBottom: '10px' }}>
						<a href="/blog/getting-started" style={{ color: 'inherit', textDecoration: 'none' }}>
							🚀 Getting Started with Avalon
						</a>
					</h2>
					<p style={{ color: '#6c757d', marginBottom: '15px' }}>
						Learn the basics of building applications with Avalon's multi-framework architecture and islands-based
						approach.
					</p>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<span style={{ color: '#adb5bd', fontSize: '0.9rem' }}>📅 December 15, 2024</span>
						<a
							href="/blog/getting-started"
							style={{
								color: '#667eea',
								textDecoration: 'none',
								fontWeight: '500',
							}}>
							Read more →
						</a>
					</div>
				</article>

				<article
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '1px solid #e9ecef',
					}}>
					<h2 style={{ color: '#495057', marginBottom: '10px' }}>
						<a href="/blog/advanced-features" style={{ color: 'inherit', textDecoration: 'none' }}>
							⚡ Advanced Features Deep Dive
						</a>
					</h2>
					<p style={{ color: '#6c757d', marginBottom: '15px' }}>
						Explore advanced features like middleware chains, layout composition, and performance optimizations in
						Avalon applications.
					</p>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
						<span style={{ color: '#adb5bd', fontSize: '0.9rem' }}>📅 December 10, 2024</span>
						<a
							href="/blog/advanced-features"
							style={{
								color: '#667eea',
								textDecoration: 'none',
								fontWeight: '500',
							}}>
							Read more →
						</a>
					</div>
				</article>

				<div
					style={{
						background: '#f8f9fa',
						padding: '25px',
						borderRadius: '12px',
						border: '1px solid #e9ecef',
					}}>
					<h3 style={{ color: '#495057', marginBottom: '15px' }}>💡 About This Blog Section</h3>
					<p style={{ color: '#6c757d', lineHeight: '1.6' }}>
						This blog section demonstrates Avalon's nested layout system. Notice how:
					</p>
					<ul style={{ color: '#6c757d', lineHeight: '1.8', marginTop: '10px' }}>
						<li>The main header and navigation remain consistent (root layout)</li>
						<li>The blog sidebar is added by the blog layout</li>
						<li>Each blog post can have its own specific content</li>
						<li>URLs are automatically generated from the file structure</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
