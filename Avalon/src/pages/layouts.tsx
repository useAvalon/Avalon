/** @jsxImportSource preact */

export default async function LayoutsPage() {
	return (
		<div>
			<header style={{ textAlign: 'center', marginBottom: '48px' }}>
				<div style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: '8px',
					background: 'rgba(255,255,255,0.04)',
					border: '1px solid rgba(255,255,255,0.07)',
					borderRadius: '100px',
					padding: '6px 14px',
					marginBottom: '16px',
					fontSize: '12px',
					color: 'rgba(255,255,255,0.5)',
				}}>
					Nested Composition
				</div>
				<h1 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '36px',
					fontWeight: '400',
					color: 'rgba(255,255,255,0.9)',
					letterSpacing: '-0.02em',
					marginBottom: '12px',
				}}>
					Layout System
				</h1>
				<p style={{
					fontSize: '15px',
					color: 'rgba(255,255,255,0.4)',
					maxWidth: '500px',
					margin: '0 auto',
					lineHeight: '1.6',
				}}>
					Hierarchical layouts that compose automatically based on your file structure.
				</p>
			</header>

			<div style={{
				display: 'grid',
				gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
				gap: '16px',
				marginBottom: '32px',
			}}>
				<div style={{
					background: 'rgba(255,255,255,0.02)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '14px',
					padding: '24px',
				}}>
					<h3 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '18px',
						color: 'rgba(255,255,255,0.8)',
						marginBottom: '12px',
					}}>
						📁 Root Layout
					</h3>
					<p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: '1.6' }}>
						<code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>src/layouts/_layout.tsx</code> wraps all pages with the header, navigation, and global styles.
					</p>
				</div>

				<div style={{
					background: 'rgba(255,255,255,0.02)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '14px',
					padding: '24px',
				}}>
					<h3 style={{
						fontFamily: "'Instrument Serif', serif",
						fontSize: '18px',
						color: 'rgba(255,255,255,0.8)',
						marginBottom: '12px',
					}}>
						📚 Nested Layouts
					</h3>
					<p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: '1.6' }}>
						<code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>src/layouts/blog/_layout.tsx</code> adds a sidebar for blog pages, nested inside the root layout.
					</p>
				</div>
			</div>

			<div style={{
				background: 'rgba(255,255,255,0.02)',
				border: '1px solid rgba(255,255,255,0.06)',
				borderRadius: '16px',
				padding: '28px',
				marginBottom: '32px',
			}}>
				<h3 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '20px',
					color: 'rgba(255,255,255,0.8)',
					marginBottom: '16px',
				}}>
					Directory Structure
				</h3>
				<pre style={{
					background: 'rgba(0,0,0,0.3)',
					border: '1px solid rgba(255,255,255,0.06)',
					borderRadius: '8px',
					padding: '16px',
					color: 'rgba(255,255,255,0.7)',
					fontSize: '13px',
					overflow: 'auto',
				}}>{`src/
├── layouts/
│   ├── _layout.tsx      ← Root layout (header, nav)
│   └── blog/
│       └── _layout.tsx  ← Blog layout (sidebar)
└── pages/
    ├── index.tsx        ← Uses root layout
    ├── about.tsx        ← Uses root layout
    └── blog/
        ├── index.tsx    ← Uses root + blog layout
        └── post.tsx     ← Uses root + blog layout`}</pre>
			</div>

			<div style={{
				background: 'rgba(255,255,255,0.02)',
				border: '1px solid rgba(255,255,255,0.06)',
				borderRadius: '16px',
				padding: '28px',
			}}>
				<h3 style={{
					fontFamily: "'Instrument Serif', serif",
					fontSize: '20px',
					color: 'rgba(255,255,255,0.8)',
					marginBottom: '16px',
				}}>
					Try It
				</h3>
				<p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '16px', lineHeight: '1.6' }}>
					Visit the <a href="/blog" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Blog section</a> to see nested layouts in action. The blog pages have a sidebar that's added by the blog-specific layout.
				</p>
			</div>
		</div>
	);
}
