export default function GettingStartedPage() {
	return (
		<div>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>🚀 Getting Started with Avalon</h1>

			<div style={{ color: '#6c757d', marginBottom: '30px' }}>
				<span>📅 December 15, 2024</span> • <span>⏱️ 5 min read</span>
			</div>

			<div style={{ lineHeight: '1.8', color: '#495057' }}>
				<p style={{ marginBottom: '20px', fontSize: '1.1rem' }}>
					Welcome to Avalon! This guide will help you understand the core concepts and get you building multi-framework
					applications in no time.
				</p>

				<h2 style={{ color: '#2c3e50', marginTop: '30px', marginBottom: '15px' }}>🏗️ Project Structure</h2>

				<div
					style={{
						background: '#f8f9fa',
						padding: '20px',
						borderRadius: '8px',
						fontFamily: 'monospace',
						fontSize: '0.9rem',
						marginBottom: '20px',
					}}>
					<div>📁 my-avalon-app/</div>
					<div style={{ marginLeft: '20px' }}>├── src/</div>
					<div style={{ marginLeft: '40px' }}>├── pages/ # Your app pages</div>
					<div style={{ marginLeft: '40px' }}>├── layouts/ # Layout components</div>
					<div style={{ marginLeft: '40px' }}>├── islands/ # Interactive components</div>
					<div style={{ marginLeft: '40px' }}>├── api/ # API routes</div>
					<div style={{ marginLeft: '40px' }}>└── middleware/ # Middleware functions</div>
					<div style={{ marginLeft: '20px' }}>├── public/ # Static assets</div>
					<div style={{ marginLeft: '20px' }}>├── deno.json # Deno configuration</div>
					<div style={{ marginLeft: '20px' }}>└── vite.config.ts # Vite configuration</div>
				</div>

				<h2 style={{ color: '#2c3e50', marginTop: '30px', marginBottom: '15px' }}>🎯 Key Concepts</h2>

				<div style={{ display: 'grid', gap: '20px', marginBottom: '30px' }}>
					<div
						style={{
							background: '#e8f4fd',
							padding: '20px',
							borderRadius: '10px',
							border: '1px solid #bee5eb',
						}}>
						<h3 style={{ color: '#0c5460', marginBottom: '10px' }}>🏝️ Islands Architecture</h3>
						<p style={{ color: '#0c5460' }}>
							Only the interactive parts of your page load JavaScript. The rest stays as lightweight HTML, improving
							performance dramatically.
						</p>
					</div>

					<div
						style={{
							background: '#f0f8ff',
							padding: '20px',
							borderRadius: '10px',
							border: '1px solid #b3d9ff',
						}}>
						<h3 style={{ color: '#0056b3', marginBottom: '10px' }}>🎨 Multi-Framework</h3>
						<p style={{ color: '#0056b3' }}>
							Use React, Vue, Svelte, and Solid components in the same application. Each framework is loaded only when
							needed.
						</p>
					</div>

					<div
						style={{
							background: '#e8f5e8',
							padding: '20px',
							borderRadius: '10px',
							border: '1px solid #c3e6c3',
						}}>
						<h3 style={{ color: '#2d5a2d', marginBottom: '10px' }}>📁 File-System Routing</h3>
						<p style={{ color: '#2d5a2d' }}>
							Your file structure becomes your URL structure. No need to configure routes manually - they're discovered
							automatically.
						</p>
					</div>
				</div>

				<h2 style={{ color: '#2c3e50', marginTop: '30px', marginBottom: '15px' }}>🚀 Quick Start</h2>

				<ol style={{ lineHeight: '1.8', paddingLeft: '20px' }}>
					<li style={{ marginBottom: '10px' }}>
						<strong>Create a new page:</strong> Add a <code>.tsx</code> file in <code>src/pages/</code>
					</li>
					<li style={{ marginBottom: '10px' }}>
						<strong>Add interactivity:</strong> Create an island component in <code>src/islands/</code>
					</li>
					<li style={{ marginBottom: '10px' }}>
						<strong>Style your layout:</strong> Create layout components in <code>src/layouts/</code>
					</li>
					<li style={{ marginBottom: '10px' }}>
						<strong>Add APIs:</strong> Create API handlers in <code>src/api/</code>
					</li>
				</ol>

				<div
					style={{
						background: '#fff3cd',
						padding: '20px',
						borderRadius: '10px',
						border: '1px solid #ffeaa7',
						marginTop: '30px',
					}}>
					<h3 style={{ color: '#856404', marginBottom: '10px' }}>💡 Pro Tip</h3>
					<p style={{ color: '#856404' }}>
						Start simple with static pages, then gradually add islands for interactivity. This approach ensures optimal
						performance from day one.
					</p>
				</div>
			</div>
		</div>
	);
}
