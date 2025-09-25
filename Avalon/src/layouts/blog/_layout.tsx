import type { LayoutProps } from '@avalon/avalon';

export default function BlogLayout({ children }: LayoutProps) {
	return (
		<div style={{ display: 'flex', gap: '30px' }}>
			<aside
				style={{
					width: '250px',
					background: '#f8f9fa',
					padding: '20px',
					borderRadius: '10px',
					height: 'fit-content',
				}}>
				<h3 style={{ marginBottom: '15px', color: '#495057' }}>📚 Blog Navigation</h3>
				<nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
					<a
						href="/blog"
						style={{
							color: '#6c757d',
							textDecoration: 'none',
							padding: '8px 12px',
							borderRadius: '6px',
							transition: 'background 0.2s',
						}}>
						All Posts
					</a>
					<a
						href="/blog/getting-started"
						style={{
							color: '#6c757d',
							textDecoration: 'none',
							padding: '8px 12px',
							borderRadius: '6px',
							transition: 'background 0.2s',
						}}>
						Getting Started
					</a>
					<a
						href="/blog/advanced-features"
						style={{
							color: '#6c757d',
							textDecoration: 'none',
							padding: '8px 12px',
							borderRadius: '6px',
							transition: 'background 0.2s',
						}}>
						Advanced Features
					</a>
				</nav>
			</aside>
			<article style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: children }}></article>
		</div>
	);
}
