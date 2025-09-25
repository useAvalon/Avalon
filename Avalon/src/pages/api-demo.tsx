import { renderIsland } from '@avalon/avalon';

export default async function ApiDemoPage() {
	return (
		<div>
			<h1 style={{ color: '#2c3e50', marginBottom: '20px' }}>🔌 API Routes Demo</h1>

			<div
				style={{
					background: '#fff3cd',
					padding: '20px',
					borderRadius: '10px',
					marginBottom: '30px',
					border: '1px solid #ffeaa7',
				}}>
				<h3 style={{ color: '#856404', marginBottom: '10px' }}>⚡ Server-Side APIs</h3>
				<p style={{ color: '#856404', lineHeight: '1.6' }}>
					Avalon provides file-system based API routes with automatic middleware support. Try the examples below to see
					the APIs in action.
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
					<h3 style={{ color: '#495057', marginBottom: '15px' }}>🌟 Available API Endpoints</h3>

					<div style={{ display: 'grid', gap: '15px' }}>
						<div
							style={{
								background: '#f8f9fa',
								padding: '15px',
								borderRadius: '8px',
								border: '1px solid #dee2e6',
							}}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
								<div>
									<strong style={{ color: '#28a745' }}>GET</strong>
									<code style={{ marginLeft: '10px', background: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
										/api/hello
									</code>
								</div>
								<a
									href="/api/hello"
									target="_blank"
									style={{
										padding: '6px 12px',
										background: '#28a745',
										color: 'white',
										textDecoration: 'none',
										borderRadius: '4px',
										fontSize: '0.9rem',
									}}>
									Try it →
								</a>
							</div>
							<p style={{ color: '#6c757d', marginTop: '8px', fontSize: '0.9rem' }}>
								Simple greeting API with JSON response
							</p>
						</div>

						<div
							style={{
								background: '#f8f9fa',
								padding: '15px',
								borderRadius: '8px',
								border: '1px solid #dee2e6',
							}}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
								<div>
									<strong style={{ color: '#17a2b8' }}>GET</strong>
									<code style={{ marginLeft: '10px', background: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
										/api/time
									</code>
								</div>
								<a
									href="/api/time"
									target="_blank"
									style={{
										padding: '6px 12px',
										background: '#17a2b8',
										color: 'white',
										textDecoration: 'none',
										borderRadius: '4px',
										fontSize: '0.9rem',
									}}>
									Try it →
								</a>
							</div>
							<p style={{ color: '#6c757d', marginTop: '8px', fontSize: '0.9rem' }}>
								Current server time with timezone info
							</p>
						</div>

						<div
							style={{
								background: '#f8f9fa',
								padding: '15px',
								borderRadius: '8px',
								border: '1px solid #dee2e6',
							}}>
							<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
								<div>
									<strong style={{ color: '#6f42c1' }}>GET</strong>
									<code style={{ marginLeft: '10px', background: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
										/api/users/[id]
									</code>
								</div>
								<a
									href="/api/users/123"
									target="_blank"
									style={{
										padding: '6px 12px',
										background: '#6f42c1',
										color: 'white',
										textDecoration: 'none',
										borderRadius: '4px',
										fontSize: '0.9rem',
									}}>
									Try it →
								</a>
							</div>
							<p style={{ color: '#6c757d', marginTop: '8px', fontSize: '0.9rem' }}>
								Dynamic route with parameter extraction
							</p>
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
					<h3 style={{ color: '#495057', marginBottom: '15px' }}>🛡️ Middleware in Action</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px' }}>
						All API routes automatically get logging middleware. Check your server console to see the middleware in
						action when you call the APIs above.
					</p>

					<div
						style={{
							background: '#f8f9fa',
							padding: '15px',
							borderRadius: '8px',
							fontFamily: 'monospace',
							fontSize: '0.9rem',
							color: '#495057',
						}}>
						<div>📁 src/api/</div>
						<div style={{ marginLeft: '20px' }}>├── _middleware.ts (Applied to all API routes)</div>
						<div style={{ marginLeft: '20px' }}>├── hello.ts</div>
						<div style={{ marginLeft: '20px' }}>├── time.ts</div>
						<div style={{ marginLeft: '20px' }}>└── users/</div>
						<div style={{ marginLeft: '40px' }}>└── [id].ts</div>
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
					<h3 style={{ color: '#495057', marginBottom: '15px' }}>🧪 Interactive API Test</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px' }}>
						This island component makes a live API call to demonstrate client-server communication:
					</p>

					{await renderIsland({
						src: '/islands/ApiTester.tsx',
						condition: 'on:visible',
						framework: 'preact',
					})}
				</div>
			</div>

			<div
				style={{
					marginTop: '40px',
					padding: '25px',
					background: '#e3f2fd',
					borderRadius: '12px',
					border: '1px solid #bbdefb',
				}}>
				<h3 style={{ color: '#0d47a1', marginBottom: '15px' }}>🚀 API Features</h3>
				<ul style={{ color: '#0d47a1', lineHeight: '1.8' }}>
					<li>
						<strong>File-System Routing:</strong> API routes based on file structure
					</li>
					<li>
						<strong>Dynamic Routes:</strong> Support for parameters like [id]
					</li>
					<li>
						<strong>Middleware Support:</strong> Automatic middleware application
					</li>
					<li>
						<strong>TypeScript Support:</strong> Full type safety for API handlers
					</li>
					<li>
						<strong>Multiple HTTP Methods:</strong> GET, POST, PUT, DELETE support
					</li>
					<li>
						<strong>Request/Response Helpers:</strong> Built-in JSON parsing and validation
					</li>
				</ul>
			</div>
		</div>
	);
}
