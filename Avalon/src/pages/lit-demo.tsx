import { renderIsland } from '@avalon/avalon';

export default async function LitDemoPage() {
	return (
		<div>
			<h1 style={{ color: '#ff6b6b', marginBottom: '20px' }}>🔥 Lit Integration Demo</h1>

			<p style={{ color: '#6c757d', marginBottom: '30px', fontSize: '1.1rem' }}>
				Explore Lit web components in Avalon with Shadow DOM and scoped styles.
			</p>

			<div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
				{/* Lit Counter */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #ff6b6b',
					}}>
					<h3 style={{ color: '#ff6b6b', marginBottom: '15px' }}>
						🔢 Lit Counter
					</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px', fontSize: '0.9rem' }}>
						A simple counter using Lit's reactive properties and decorators.
					</p>
					{await renderIsland({
						src: '/islands/Counter.lit.ts',
						condition: 'on:interaction',
						framework: 'lit',
						props: { initialCount: 10 },
					})}
				</div>

				{/* Lit Button */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #ff6b6b',
					}}>
					<h3 style={{ color: '#ff6b6b', marginBottom: '15px' }}>
						🎯 Lit Button with Shadow DOM
					</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px', fontSize: '0.9rem' }}>
						A custom button element demonstrating Shadow DOM and style encapsulation.
					</p>
					{await renderIsland({
						src: '/islands/Button.lit.ts',
						condition: 'on:interaction',
						framework: 'lit',
						props: { label: 'Click Me!' },
					})}
				</div>

				{/* Lit Card */}
				<div
					style={{
						background: '#fff',
						padding: '25px',
						borderRadius: '12px',
						boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
						border: '2px solid #ff6b6b',
					}}>
					<h3 style={{ color: '#ff6b6b', marginBottom: '15px' }}>
						🎴 Lit Card with Scoped Styles
					</h3>
					<p style={{ color: '#6c757d', marginBottom: '15px', fontSize: '0.9rem' }}>
						A card component showcasing Lit's powerful scoped styling capabilities.
					</p>
					{await renderIsland({
						src: '/islands/Card.lit.ts',
						condition: 'on:interaction',
						framework: 'lit',
						props: {
							title: 'Awesome Lit Component',
							description: 'This card demonstrates scoped styles, reactive properties, and custom events.',
							badge: 'New',
						},
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
				<h3 style={{ color: '#495057', marginBottom: '15px' }}>🔍 Lit Integration Features</h3>
				<ul style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<li><strong>Web Standards:</strong> Built on native Web Components APIs</li>
					<li><strong>Shadow DOM:</strong> True style encapsulation with Shadow DOM</li>
					<li><strong>Reactive Properties:</strong> Efficient updates with Lit's reactive system</li>
					<li><strong>Decorators:</strong> Clean syntax with @customElement, @property, @state</li>
					<li><strong>Small Bundle:</strong> Lit is lightweight (~5KB) with minimal overhead</li>
					<li><strong>SSR Support:</strong> Server-side rendering with @lit-labs/ssr</li>
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
				<h3 style={{ color: '#c92a2a', marginBottom: '15px' }}>💡 Why Lit?</h3>
				<div style={{ color: '#6c757d', lineHeight: '1.8' }}>
					<p style={{ marginBottom: '10px' }}>
						<strong>Standards-Based:</strong> Lit builds on Web Components standards, ensuring long-term compatibility
						and interoperability with any framework or vanilla JavaScript.
					</p>
					<p style={{ marginBottom: '10px' }}>
						<strong>Performance:</strong> Small bundle size and efficient rendering make Lit ideal for
						performance-critical applications.
					</p>
					<p>
						<strong>Style Encapsulation:</strong> Shadow DOM provides true CSS isolation, preventing style conflicts
						and making components truly reusable.
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
				<h3 style={{ color: '#1971c2', marginBottom: '15px' }}>🎨 Shadow DOM Demo</h3>
				<p style={{ color: '#6c757d', lineHeight: '1.8' }}>
					Notice how the styles in the Lit components above don't affect the rest of the page?
					That's Shadow DOM in action! Each Lit component has its own isolated style scope,
					preventing CSS conflicts and making components truly portable.
				</p>
			</div>
		</div>
	);
}
