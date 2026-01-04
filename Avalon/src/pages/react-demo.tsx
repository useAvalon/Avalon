import { renderIsland } from '@avalon/avalon';

export default async function ReactDemoPage() {
	return (
		<div>
			<h1 style={{ color: '#61dafb', marginBottom: '20px' }}>⚛️ React Integration Demo</h1>

			<p style={{ color: '#6c757d', marginBottom: '30px', fontSize: '1.1rem' }}>
				Explore React components in Avalon, including React Server Components and Client Components.
			</p>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
				{/* React Counter */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #61dafb',
					}}>
					<h3 style={{ color: '#61dafb', marginBottom: '15px' }}>
						⚛️ React Counter (Client Component)
					</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px', fontSize: '0.9rem' }}>
						A simple counter using React's useState hook. Hydrates on interaction.
					</p>
					{await renderIsland({
						src: '/islands/ReactCounter.tsx',
						condition: 'on:interaction',
						framework: 'react',
						props: { initialCount: 5 },
					})}
				</div>

				{/* React Server Component */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #61dafb',
					}}>
					<h3 style={{ color: '#61dafb', marginBottom: '15px' }}>
						🚀 React Server Component
					</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px', fontSize: '0.9rem' }}>
						This component fetches data on the server and renders without client-side JavaScript.
						No hydration needed!
					</p>
					{await renderIsland({
						src: '/islands/ReactServerComponent.tsx',
						condition: 'on:interaction',
						framework: 'react',
						ssrOnly: true,
					})}
				</div>

				{/* React Client Component */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #61dafb',
					}}>
					<h3 style={{ color: '#61dafb', marginBottom: '15px' }}>
						⚡ React Client Component
					</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px', fontSize: '0.9rem' }}>
						A component with the "use client" directive. Demonstrates interactive features.
					</p>
					{await renderIsland({
						src: '/islands/ReactClientComponent.tsx',
						condition: 'on:interaction',
						framework: 'react',
						props: {
							title: 'Interactive React Component',
							message: 'This component uses the "use client" directive for client-side interactivity.',
						},
					})}
				</div>

				{/* React Form */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #61dafb',
					}}>
					<h3 style={{ color: '#61dafb', marginBottom: '15px' }}>
						📝 React Form with useEffect
					</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px', fontSize: '0.9rem' }}>
						A form component demonstrating useEffect for side effects and event handling.
					</p>
					{await renderIsland({
						src: '/islands/ReactForm.tsx',
						condition: 'on:interaction',
						framework: 'react',
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
				<h3 style={{ color: '#495057', marginBottom: '15px' }}>🔍 React Integration Features</h3>
				<ul style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<li><strong>React 18+ Support:</strong> Full support for React 18 features including concurrent rendering</li>
					<li><strong>Server Components:</strong> Components without "use client" render only on the server</li>
					<li><strong>Client Components:</strong> Components with "use client" hydrate on the client</li>
					<li><strong>All React Hooks:</strong> useState, useEffect, useContext, and more</li>
					<li><strong>Flexible Hydration:</strong> Control when components become interactive (on:client, on:visible, on:interaction)</li>
					<li><strong>Error Boundaries:</strong> Support for React error boundaries within islands</li>
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
				<h3 style={{ color: '#c92a2a', marginBottom: '15px' }}>💡 Server vs Client Components</h3>
				<div style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<p style={{ marginBottom: '10px' }}>
						<strong>Server Components (default):</strong> Render only on the server, no JavaScript sent to client.
						Perfect for static content, data fetching, and reducing bundle size.
					</p>
					<p style={{ marginBottom: '10px' }}>
						<strong>Client Components ("use client"):</strong> Hydrate on the client for interactivity.
						Use for components that need event handlers, state, or browser APIs.
					</p>
					<p>
						<strong>Best Practice:</strong> Use Server Components by default, add "use client" only when needed.
					</p>
				</div>
			</div>
		</div>
	);
}
